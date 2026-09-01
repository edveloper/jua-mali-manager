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
/**
 * Finds an existing login by address.
 *
 * The admin API has no lookup by email, so this pages through listUsers. A shop
 * with a handful of staff never gets past the first page; the loop is there so
 * an instance with many accounts still finds somebody rather than silently
 * deciding they are new and failing at creation.
 */
async function findUserByEmail(admin: any, email: string) {
  const perPage = 200;
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) return null;

    const users = data?.users ?? [];
    const hit = users.find(
      (u: any) => String(u.email ?? "").toLowerCase() === email
    );
    if (hit) return hit;
    if (users.length < perPage) return null;
  }
  return null;
}

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

  // 2. Read the request first: with more than one shop possible, which shop is
  //    now something only the caller can tell us.
  let body: { email?: string; password?: string; fullName?: string; shopId?: string };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Invalid JSON body" });
  }

  // 3. Authorise against that shop specifically.
  //
  //    The shop id arrives in the body, which sounds like the hole this function
  //    was written to close. It is not: the id is only ever used after checking
  //    that this caller owns that shop. Naming a shop you do not own gets you a
  //    403, exactly as before. What has changed is that an owner of two shops
  //    can now say which one, instead of being refused for having more than one.
  const { data: ownerships, error: ownershipError } = await admin
    .from("shop_members")
    .select("shop_id")
    .eq("user_id", caller.user.id)
    .eq("role", "owner");

  if (ownershipError) return json(500, { error: "Could not verify shop ownership" });
  if (!ownerships || ownerships.length === 0) {
    return json(403, { error: "Only shop owners can add employees" });
  }

  const requested = String(body.shopId ?? "").trim();
  const owned = ownerships.map((row) => row.shop_id as string);

  // One shop and no id given is the ordinary case, and still works.
  const shopId = requested || (owned.length === 1 ? owned[0] : "");

  if (!shopId) {
    return json(400, { error: "Say which shop this person is for" });
  }
  if (!owned.includes(shopId)) {
    return json(403, { error: "Only the shop owner can add employees" });
  }

  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  const fullName = String(body.fullName ?? "").trim();

  if (!EMAIL_RE.test(email)) return json(400, { error: "Enter a valid phone number or email" });
  if (password.length < 6) return json(400, { error: "Password must be at least 6 characters" });
  if (!fullName) return json(400, { error: "Employee name is required" });

  // 4. Somebody who already has a login is added to the shop, not recreated.
  //
  //    One person can work in two of the owner's shops, or already run a shop of
  //    their own. Creating a second account for the same address is impossible
  //    anyway, and the old code turned that into a dead end: "that email already
  //    has an account", with nothing the owner could do about it.
  //
  //    Their password is deliberately left alone. It may be the password to
  //    their own business. An owner adding somebody to a shop has no business
  //    changing the way that person signs in everywhere else.
  const existing = await findUserByEmail(admin, email);

  if (existing) {
    const { data: already, error: alreadyError } = await admin
      .from("shop_members")
      .select("id")
      .eq("shop_id", shopId)
      .eq("user_id", existing.id)
      .maybeSingle();

    if (alreadyError) return json(500, { error: "Could not check your staff list" });
    if (already) return json(409, { error: "They are already in this shop" });

    const { error: linkError } = await admin
      .from("shop_members")
      .insert([{ shop_id: shopId, user_id: existing.id, role: "employee" }]);

    if (linkError) return json(500, { error: "Could not add them to this shop" });

    return json(200, {
      userId: existing.id,
      existingAccount: true,
      message: "Added to this shop. They sign in with the password they already use.",
    });
  }

  // 5. A new person. email_confirm is forced on: phone-based accounts use
  //    synthetic @duka.local addresses that can never receive a confirmation mail.
  // must_change_password forces the employee to pick their own password on first
  // sign-in, so the owner who typed this one stops knowing it. That matters now
  // that sales carry sold_by and permissions are per-employee.
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, must_change_password: true },
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
    // Roll the login back, or the address stays taken and retrying returns 409
    // with no way for the owner to clear it.
    const { error: rollbackError } = await admin.auth.admin.deleteUser(created.user.id);

    if (rollbackError) {
      // Be honest about the half-finished state rather than claiming nothing
      // was saved -- the login exists and only an admin can remove it.
      console.error("Rollback failed, orphaned auth user:", created.user.id, rollbackError);
      return json(500, {
        error:
          "Their login was created but could not be linked to your shop. " +
          "Use a different phone number or email, and ask your developer to remove the stray login.",
      });
    }

    return json(500, { error: "Could not add the employee to your shop. Nothing was saved." });
  }

  return json(200, {
    userId: created.user.id,
    email,
    fullName,
  });
});
