// Creates an employee account for the caller's shop.
//
// This has to run server-side: calling supabase.auth.signUp() in the owner's
// browser swaps the browser session over to the newly created user, which both
// logs the owner out and makes the follow-up shop_members insert fail RLS
// (auth.uid() is the employee by then, so is_shop_owner() is false).
//
// Deploy:  npx supabase functions deploy create-employee
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected by the platform.

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

// Mirrors the shape produced by toAuthEmail() on the client. Phone logins are
// stored as <msisdn>@duka.local, so this deliberately accepts .local addresses.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  if (!serviceRoleKey || !supabaseUrl) {
    return json(500, { error: "Server is not configured" });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 1. Identify the caller from their JWT.
  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return json(401, { error: "Missing authorization header" });

  const { data: caller, error: callerError } = await admin.auth.getUser(token);
  if (callerError || !caller?.user) return json(401, { error: "Invalid or expired session" });

  // 2. Resolve the caller's shop server-side. The shop is never taken from the
  //    request body, so an employee cannot add members to someone else's shop.
  const { data: ownerships, error: ownershipError } = await admin
    .from("shop_members")
    .select("shop_id")
    .eq("user_id", caller.user.id)
    .eq("role", "owner");

  if (ownershipError) return json(500, { error: "Could not verify shop ownership" });
  if (!ownerships || ownerships.length === 0) {
    return json(403, { error: "Only shop owners can add employees" });
  }
  if (ownerships.length > 1) {
    // The app assumes one shop per user (AuthContext uses maybeSingle()). If that
    // ever changes, this needs an explicit shopId argument rather than a guess.
    return json(409, { error: "Your account owns multiple shops; cannot pick one automatically" });
  }
  const shopId = ownerships[0].shop_id;

  // 3. Validate input.
  let body: { email?: string; password?: string; fullName?: string };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Invalid JSON body" });
  }

  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  const fullName = String(body.fullName ?? "").trim();

  if (!EMAIL_RE.test(email)) return json(400, { error: "Enter a valid phone number or email" });
  if (password.length < 6) return json(400, { error: "Password must be at least 6 characters" });
  if (!fullName) return json(400, { error: "Employee name is required" });

  // 4. Create the auth user. email_confirm is forced on: phone-based accounts use
  //    synthetic @duka.local addresses that can never receive a confirmation mail.
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });

  if (createError || !created?.user) {
    const message = createError?.message ?? "Could not create the account";
    const alreadyExists = /already|registered|exists/i.test(message);
    return json(alreadyExists ? 409 : 400, {
      error: alreadyExists
        ? "That phone number or email already has an account"
        : message,
    });
  }

  // 5. Link them to the shop. Service role bypasses RLS, which is the whole point.
  const { error: memberError } = await admin
    .from("shop_members")
    .insert([{ shop_id: shopId, user_id: created.user.id, role: "employee" }]);

  if (memberError) {
    // Don't leave an orphaned auth user behind that blocks retrying the same number.
    await admin.auth.admin.deleteUser(created.user.id);
    return json(500, { error: "Could not add the employee to your shop. Nothing was saved." });
  }

  return json(200, {
    userId: created.user.id,
    email,
    fullName,
  });
});
