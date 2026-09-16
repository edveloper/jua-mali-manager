// Sends a one-time code to an owner who has forgotten their password.
//
// No session required, by necessity: the whole point is that the person cannot
// get in. That makes this the most exposed endpoint in the app, so almost all
// of it is refusals rather than work.
//
// Deploy:  npx supabase functions deploy request-password-otp --project-ref <ref>
// Secrets: OTP_PEPPER (required), RESEND_API_KEY, RESEND_FROM,
//          AT_USERNAME, AT_API_KEY, AT_SENDER_ID

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

  // A sender is optional on sandbox and often required on a live account. Only
  // sent when configured, because passing an unregistered one is itself a
  // rejection.
  const from = Deno.env.get("AT_SENDER_ID");
  const form = new URLSearchParams({ username, to: `+${to}`, message });
  if (from) form.set("from", from);

  let response: Response;
  try {
    response = await fetch(`${host}/version1/messaging`, {
      method: "POST",
      headers: {
        apiKey,
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form,
    });
  } catch (err) {
    console.error("SMS request never reached Africa's Talking:", err);
    return false;
  }

  const raw = await response.text();

  if (!response.ok) {
    console.error("SMS send failed", response.status, raw);
    return false;
  }

  /*
   * A 2xx from Africa's Talking does not mean the message went.
   *
   * It means the request was well formed. Whether anything was delivered is
   * inside the body, per recipient, as a numeric status: 101 is sent, 102 is
   * queued, and everything else is a refusal with a name attached
   * (InvalidSenderId, InsufficientBalance, InvalidPhoneNumber). Trusting the
   * HTTP status alone is why the first attempt failed silently, with no text,
   * no charge and nothing in the log to say so.
   */
  try {
    const parsed = JSON.parse(raw);
    const recipients = parsed?.SMSMessageData?.Recipients ?? [];

    if (recipients.length === 0) {
      console.error("Africa's Talking accepted nothing:", raw);
      return false;
    }

    const delivered = recipients.filter((r: { statusCode?: number }) =>
      r.statusCode === 101 || r.statusCode === 102 || r.statusCode === 100
    );

    if (delivered.length === 0) {
      console.error("Africa's Talking refused the message:", raw);
      return false;
    }

    console.log("SMS accepted:", parsed?.SMSMessageData?.Message ?? raw);
    return true;
  } catch {
    console.error("Could not read the reply from Africa's Talking:", raw);
    return false;
  }
};

/**
 * The other way to reach somebody, and for now the only one that works.
 *
 * Two separate Kenyan numbers came back UserInBlacklist: the do-not-disturb
 * register blocks bulk SMS from an unregistered sender, and a registered sender
 * ID wants company documents we do not have yet. So the code goes by email when
 * an address is on file, and SMS is tried as a backstop.
 *
 * Kept behind its own function so swapping the provider later is one place.
 */
const sendEmail = async (to: string, code: string): Promise<boolean> => {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) {
    console.error("No email provider configured");
    return false;
  }

  const from = Deno.env.get("RESEND_FROM") ?? "DukaKonnect <hello@dukakonnect.co.ke>";

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to,
        subject: `${code} is your DukaKonnect code`,
        // Deliberately plain. A code buried in a designed template is a code
        // somebody has to hunt for on a small screen.
        html: `<div style="font-family:system-ui,sans-serif;font-size:16px;line-height:1.6">
<p>Your DukaKonnect code is:</p>
<p style="font-size:32px;font-weight:700;letter-spacing:4px;margin:16px 0">${code}</p>
<p>It works for 10 minutes.</p>
<p style="color:#666;font-size:14px">We will never ask you for this code. If somebody does, they are not us. If you did not ask to reset your password, you can ignore this.</p>
</div>`,
      }),
    });

    if (!response.ok) {
      console.error("Email send failed", response.status, await response.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error("Email request never left:", err);
    return false;
  }
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

  /*
   * Email first while SMS cannot deliver, then SMS as a backstop.
   *
   * The order reverses itself once a sender ID is approved: a text reaches
   * somebody who is standing behind a counter, and an inbox does not. Until
   * then an address is the only thing that actually arrives.
   */
  const recoveryEmail = (user.user_metadata?.recovery_email as string | undefined)?.trim();

  let sent = false;
  if (recoveryEmail) sent = await sendEmail(recoveryEmail, code);
  if (!sent) {
    sent = await sendSms(
      phone,
      `${code} is your DukaKonnect code. It works for 10 minutes. We will never ask you for it.`,
    );
  }

  if (!sent) console.error("Could not deliver the code by any route for", phone);

  // Even a failed send returns the same thing. Whether the message arrived is
  // not something to tell an unauthenticated caller.
  return sameAnswer;
});
