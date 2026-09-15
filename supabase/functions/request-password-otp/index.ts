// Sends a one-time code to an owner who has forgotten their password.
//
// No session required, by necessity: the whole point is that the person cannot
// get in. That makes this the most exposed endpoint in the app, so almost all
// of it is refusals rather than work.
//
// Deploy:  npx supabase functions deploy request-password-otp --project-ref <ref>
// Secrets: AT_USERNAME, AT_API_KEY, OTP_PEPPER

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.87.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const PHONE_DOMAIN = "duka.local";

/**
 * The same mapping the app uses, repeated here on purpose.
 *
 * `src/lib/identity.ts` does this in the browser, but an Edge Function cannot
 * import from the app bundle. If these two ever disagree, a person types the
 * number they always type and no account is found. Any change to one belongs in
 * the other in the same commit.
 */
const normalisePhone = (input: string): string | null => {
  let digits = input.replace(/\D/g, "");
  if (digits.startsWith("0")) digits = `254${digits.slice(1)}`;
  else if (digits.length === 9) digits = `254${digits}`;
  return /^254\d{9}$/.test(digits) ? digits : null;
};

/**
 * A keyed hash, so the stored value is useless on its own.
 *
 * Six digits is a million possibilities, which a plain SHA-256 gives up in
 * under a second offline. The pepper lives in the environment and never in the
 * database, so reading the table does not hand anybody a working code.
 */
const hashCode = async (code: string, pepper: string): Promise<string> => {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(pepper),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(code));
  return [...new Uint8Array(signature)].map((b) => b.toString(16).padStart(2, "0")).join("");
};

const sendSms = async (to: string, message: string): Promise<boolean> => {
  const username = Deno.env.get("AT_USERNAME");
  const apiKey = Deno.env.get("AT_API_KEY");
  if (!username || !apiKey) {
    console.error("Africa's Talking credentials are not set");
    return false;
  }

  // Sandbox and live are different hosts as well as different credentials, and
  // the username is what tells them apart.
  const host = username === "sandbox"
    ? "https://api.sandbox.africastalking.com"
    : "https://api.africastalking.com";

  const response = await fetch(`${host}/version1/messaging`, {
    method: "POST",
    headers: {
      apiKey,
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ username, to: `+${to}`, message }),
  });

  if (!response.ok) {
    console.error("SMS send failed", response.status, await response.text());
    return false;
  }
  return true;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const pepper = Deno.env.get("OTP_PEPPER");
  if (!serviceRoleKey || !supabaseUrl || !pepper) {
    return json(500, { error: "Server is not configured" });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let body: { phone?: string };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Expected a JSON body" });
  }

  const phone = body.phone ? normalisePhone(body.phone) : null;

  /*
   * One answer, whatever happened.
   *
   * Saying "no account with that number" turns this into a free directory of
   * who uses DukaKonnect, which is a list of small businesses and their phone
   * numbers. Every path below returns exactly this, including the ones that did
   * nothing at all.
   */
  const sameAnswer = json(200, {
    ok: true,
    message: "If that number has an account, a code is on its way.",
  });

  if (!phone) return sameAnswer;

  await admin.rpc("purge_old_reset_codes");

  /*
   * Rate limit before anything else.
   *
   * An SMS endpoint with no limit is a way for a stranger to spend somebody
   * else's money, and it is the most likely thing here to be abused. Three an
   * hour is more than a person who has genuinely forgotten a password needs and
   * far less than is worth automating.
   */
  const anHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await admin
    .from("password_reset_codes")
    .select("id", { count: "exact", head: true })
    .eq("phone", phone)
    .gte("created_at", anHourAgo);

  if ((count ?? 0) >= 3) return sameAnswer;

  // Phone logins map to a synthetic address, so finding the account needs no
  // lookup table: the address is a function of the number.
  const email = `${phone}@${PHONE_DOMAIN}`;
  const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  const user = list?.users?.find((u) => u.email?.toLowerCase() === email);

  if (!user) return sameAnswer;

  const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, "0");

  const { error: insertError } = await admin.from("password_reset_codes").insert({
    user_id: user.id,
    phone,
    code_hash: await hashCode(code, pepper),
    expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  });

  if (insertError) {
    console.error("Could not store the code", insertError);
    return sameAnswer;
  }

  await sendSms(phone, `${code} is your DukaKonnect code. It works for 10 minutes. We will never ask you for it.`);

  // Even a failed send returns the same thing. Whether the message arrived is
  // not something to tell an unauthenticated caller.
  return sameAnswer;
});
