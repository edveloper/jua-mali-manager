// Deletes the caller's account for good: every shop they alone own, those shops'
// records and logos, staff logins that have nowhere else to go, and the caller's
// own profile and login. Google Play requires this to be available in the app.
//
// Every step can be repeated. Anything that fails stops the run and is found
// again on retry, because the caller's login is always the last thing to go.
//
// Deploy:  Supabase dashboard -> Edge Functions -> delete-account

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

const LOGO_BUCKET = "shop-logos";
const RETRY = "Some of it may already be gone. Please try again.";

// Phone keyboards add capitals and stray spaces, so these are not differences.
const normalise = (text: string) => text.trim().replace(/\s+/g, " ").toLowerCase();

const isMissingUser = (message?: string) => /not found|does not exist/i.test(message ?? "");

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

  // 1. Identify the caller. Everything below follows from this login, never
  //    from anything in the request body.
  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return json(401, { error: "Missing authorization header" });

  const { data: caller, error: callerError } = await admin.auth.getUser(token);
  if (callerError || !caller?.user) return json(401, { error: "Invalid or expired session" });
  const userId = caller.user.id;

  let body: { confirm?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Invalid JSON body" });
  }
  const confirm = normalise(String(body.confirm ?? ""));
  const password = String(body.password ?? "");
  if (!confirm || !password) return json(400, { error: "Please confirm first." });

  // 2. Work out what this login alone owns.
  const { data: memberships, error: membershipsError } = await admin
    .from("shop_members")
    .select("shop_id, role")
    .eq("user_id", userId);
  if (membershipsError) return json(500, { error: "Could not look up your shops. Nothing was changed." });

  const ownedIds = (memberships ?? []).filter((m) => m.role === "owner").map((m) => m.shop_id);

  let shopsToDelete: { id: string; name: string; business_id: string | null }[] = [];
  let staffIds: string[] = [];

  if (ownedIds.length > 0) {
    const { data: ownedShops, error: shopsError } = await admin
      .from("shops")
      .select("id, name, business_id")
      .in("id", ownedIds);
    const { data: colleagues, error: colleaguesError } = await admin
      .from("shop_members")
      .select("shop_id, user_id, role")
      .in("shop_id", ownedIds);
    if (shopsError || colleaguesError) {
      return json(500, { error: "Could not look up your shops. Nothing was changed." });
    }

    // A shop with a second owner is not this person's to delete. They leave it,
    // when their login goes, and it carries on.
    const coOwned = new Set(
      (colleagues ?? [])
        .filter((c) => c.role === "owner" && c.user_id !== userId)
        .map((c) => c.shop_id),
    );
    shopsToDelete = (ownedShops ?? []).filter((s) => !coOwned.has(s.id));

    const deleting = new Set(shopsToDelete.map((s) => s.id));
    staffIds = [
      ...new Set(
        (colleagues ?? [])
          .filter((c) => deleting.has(c.shop_id) && c.user_id !== userId)
          .map((c) => c.user_id),
      ),
    ];
  }

  // 3. The typed confirmation. With no shop left to name, as with staff or a
  //    retry after the shops have already gone, the app asks for a word instead
  //    and anything typed is enough.
  if (shopsToDelete.length > 0 && !shopsToDelete.some((s) => normalise(s.name) === confirm)) {
    return json(400, { error: "That is not the name of your shop. Nothing was changed." });
  }

  // The password, because somebody holding an unlocked phone can read the shop's
  // name off the screen. Checked on a client of its own: signing in on the admin
  // client would swap its service role for this user's session.
  const passwordCheck = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") ?? serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error: passwordError } = await passwordCheck.auth.signInWithPassword({
    email: caller.user.email ?? "",
    password,
  });
  if (passwordError) {
    const wrong = passwordError.code === "invalid_credentials" || /invalid login/i.test(passwordError.message ?? "");
    return json(wrong ? 403 : 500, {
      error: wrong
        ? "That password is not right. Nothing was changed."
        : "Could not check your password. Nothing was changed.",
    });
  }

  // 4. Staff whose only work was in these shops lose their login too. One who
  //    also works elsewhere keeps it, because the other owner still needs them.
  //    Their login goes before the shop does, since the shop's membership rows
  //    are how a retry would find them again.
  const deleting = new Set(shopsToDelete.map((s) => s.id));
  let staffRemoved = 0;

  if (staffIds.length > 0) {
    const { data: staffMemberships, error: staffError } = await admin
      .from("shop_members")
      .select("user_id, shop_id")
      .in("user_id", staffIds);
    if (staffError) return json(500, { error: "Could not check your staff. Nothing was changed." });

    const worksElsewhere = new Set(
      (staffMemberships ?? []).filter((m) => !deleting.has(m.shop_id)).map((m) => m.user_id),
    );

    for (const staffId of staffIds) {
      if (worksElsewhere.has(staffId)) continue;

      const { error: codesError } = await admin.from("password_reset_codes").delete().eq("user_id", staffId);
      const { error: profileError } = await admin.from("profiles").delete().eq("id", staffId);
      if (codesError || profileError) return json(500, { error: `Could not remove a staff login. ${RETRY}` });

      const { error: loginError } = await admin.auth.admin.deleteUser(staffId);
      if (loginError && !isMissingUser(loginError.message)) {
        return json(500, { error: `Could not remove a staff login. ${RETRY}` });
      }
      staffRemoved += 1;
    }
  }

  // 5. The shops, with everything in them.
  for (const shop of shopsToDelete) {
    // Logos sit in a public bucket and no database rule reaches them.
    const { data: logos, error: listError } = await admin.storage.from(LOGO_BUCKET).list(shop.id);
    if (listError) return json(500, { error: `Could not remove your logo. ${RETRY}` });
    if (logos && logos.length > 0) {
      const { error: removeError } = await admin.storage
        .from(LOGO_BUCKET)
        .remove(logos.map((logo) => `${shop.id}/${logo.name}`));
      if (removeError) return json(500, { error: `Could not remove your logo. ${RETRY}` });
    }

    // service_sales points at services with ON DELETE RESTRICT, which can stop
    // the shop's cascade halfway. Clearing them first takes that out of the way.
    const { error: serviceSalesError } = await admin.from("service_sales").delete().eq("shop_id", shop.id);
    if (serviceSalesError) return json(500, { error: `Could not delete your records. ${RETRY}` });

    // Every other shop table cascades from here.
    const { error: shopError } = await admin.from("shops").delete().eq("id", shop.id);
    if (shopError) return json(500, { error: `Could not delete your shop. ${RETRY}` });

    // A business is only a label over shops, so it goes with its last one.
    if (shop.business_id) {
      const { data: remaining, error: remainingError } = await admin
        .from("shops")
        .select("id")
        .eq("business_id", shop.business_id);
      if (remainingError) return json(500, { error: `Could not tidy up your business. ${RETRY}` });
      if ((remaining ?? []).length === 0) {
        const { error: businessError } = await admin.from("businesses").delete().eq("id", shop.business_id);
        if (businessError) return json(500, { error: `Could not tidy up your business. ${RETRY}` });
      }
    }
  }

  // 6. The caller, last. Their login staying alive until now is what makes a
  //    retry possible. Memberships in anyone else's shop cascade from the login.
  const { error: codesError } = await admin.from("password_reset_codes").delete().eq("user_id", userId);
  const { error: profileError } = await admin.from("profiles").delete().eq("id", userId);
  if (codesError || profileError) return json(500, { error: `Could not remove your details. ${RETRY}` });

  const { error: loginError } = await admin.auth.admin.deleteUser(userId);
  if (loginError && !isMissingUser(loginError.message)) {
    return json(500, { error: `Could not remove your login. ${RETRY}` });
  }

  return json(200, { deleted: true, shopsDeleted: shopsToDelete.length, staffRemoved });
});
