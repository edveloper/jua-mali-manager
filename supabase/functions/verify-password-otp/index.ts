// Checks a one-time code and sets a new password.
//
// The other half of request-password-otp. Also unauthenticated, for the same
// reason, and also mostly refusals.
//
// Deploy:  npx supabase functions deploy verify-password-otp --project-ref <ref>
// Secrets: OTP_PEPPER  (must match the one the request function uses)

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

// Kept in step with request-password-otp and src/lib/identity.ts by hand. A
// change to one belongs in the others in the same commit.
const normalisePhone = (input: string): string | null => {
  let digits = input.replace(/\D/g, "");
  if (digits.startsWith("0")) digits = `254${digits.slice(1)}`;
  else if (digits.length === 9) digits = `254${digits}`;
  return /^254\d{9}$/.test(digits) ? digits : null;
};

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

/** Compares without leaking, through timing, how much of the code was right. */
const equals = (a: string, b: string): boolean => {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
};

const MAX_ATTEMPTS = 5;

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

  let body: { phone?: string; code?: string; newPassword?: string };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Expected a JSON body" });
  }

  /*
   * One refusal for every way of being wrong.
   *
   * No such account, no code requested, wrong code, expired code, too many
   * tries: all the same sentence. Telling them apart would say whether a number
   * has an account, which is the thing the request side goes to some trouble
   * not to reveal.
   */
  const refuse = () => json(400, { error: "That code is wrong or has expired. Ask for a new one." });

  const phone = body.phone ? normalisePhone(body.phone) : null;
  const code = (body.code ?? "").replace(/\D/g, "");
  const newPassword = body.newPassword ?? "";

  if (!phone || code.length !== 6) return refuse();

  // Said plainly, because this one is about what they typed just now and gives
  // nothing away about whose account it is.
  if (newPassword.length < 6) {
    return json(400, { error: "Your new password needs at least 6 characters." });
  }

  const { data: row } = await admin
    .from("password_reset_codes")
    .select("id, user_id, code_hash, expires_at, attempts, used_at")
    .eq("phone", phone)
    .is("used_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!row) return refuse();
  if (new Date(row.expires_at).getTime() < Date.now()) return refuse();
  if (row.attempts >= MAX_ATTEMPTS) return refuse();

  /*
   * Count the attempt before checking it, never after.
   *
   * Counting afterwards means a caller who abandons the connection mid-request
   * never gets counted, and the cap becomes advisory. Six digits is a million
   * guesses, which matters only while guessing stays expensive.
   */
  await admin
    .from("password_reset_codes")
    .update({ attempts: row.attempts + 1 })
    .eq("id", row.id);

  if (!equals(row.code_hash, await hashCode(code, pepper))) return refuse();

  // Only the password. Passing user_metadata here would replace it wholesale
  // and erase the person's name, which is a trap this codebase has hit before.
  const { error: updateError } = await admin.auth.admin.updateUserById(row.user_id, {
    password: newPassword,
  });

  if (updateError) {
    console.error("Could not set the new password", updateError);
    return json(500, { error: "Could not set your new password. Try again in a moment." });
  }

  // Spent, whatever happens next. A code that still works after it has been
  // used is a code somebody can use twice.
  await admin
    .from("password_reset_codes")
    .update({ used_at: new Date().toISOString() })
    .eq("id", row.id);

  return json(200, { ok: true });
});
