// Lets a shop owner set a new password for one of their staff.
//
// Most people here sign in with a phone number, which Supabase stores as a
// synthetic <msisdn>@duka.local address. That address has no inbox, so the
// ordinary "email me a reset link" route cannot work for them. Without this
// function, a member of staff who forgets their password is locked out for good.
//
// Deploy:  Supabase dashboard -> Edge Functions -> reset-employee-password

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

  // 1. Identify the caller.
  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return json(401, { error: "Missing authorization header" });

  const { data: caller, error: callerError } = await admin.auth.getUser(token);
  if (callerError || !caller?.user) return json(401, { error: "Invalid or expired session" });

  let body: { memberId?: string; newPassword?: string };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Invalid JSON body" });
  }

  const memberId = String(body.memberId ?? "").trim();
  const newPassword = String(body.newPassword ?? "");

  if (!memberId) return json(400, { error: "Which member of staff?" });
  if (newPassword.length < 6) return json(400, { error: "Password must be at least 6 characters" });

  // 2. Load the membership. The shop comes from this row, never from the body.
  const { data: member, error: memberError } = await admin
    .from("shop_members")
    .select("id, shop_id, user_id, role")
    .eq("id", memberId)
    .maybeSingle();

  if (memberError) return json(500, { error: "Could not look up that person" });
  if (!member) return json(404, { error: "That person is no longer in your shop" });

  // 3. Authorise.
  const { data: ownership, error: ownershipError } = await admin
    .from("shop_members")
    .select("id")
    .eq("user_id", caller.user.id)
    .eq("shop_id", member.shop_id)
    .eq("role", "owner")
    .maybeSingle();

  if (ownershipError) return json(500, { error: "Could not verify shop ownership" });
  if (!ownership) return json(403, { error: "Only the shop owner can reset a password" });

  if (member.user_id === caller.user.id) {
    return json(400, { error: "Use Forgot password on the sign-in screen for your own account" });
  }
  if (member.role !== "employee") {
    return json(400, { error: "Only staff passwords can be reset here" });
  }

  // 4. Read the existing metadata first. Passing user_metadata to updateUserById
  //    replaces the object wholesale, so writing the flag on its own would erase
  //    the person's name.
  const { data: existing, error: readError } = await admin.auth.admin.getUserById(member.user_id);
  if (readError || !existing?.user) {
    return json(500, { error: "Could not find their login" });
  }

  const { error: updateError } = await admin.auth.admin.updateUserById(member.user_id, {
    password: newPassword,
    user_metadata: {
      ...(existing.user.user_metadata ?? {}),
      // Same rule as a new account: the owner knows this password, so the staff
      // member is made to replace it the moment they sign in.
      must_change_password: true,
    },
  });

  if (updateError) {
    return json(500, { error: "Could not set the new password. Try again." });
  }

  return json(200, { reset: true });
});
