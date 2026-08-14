// Removes an employee from the caller's shop AND deletes their login.
//
// Deleting only the shop_members row (what the client used to do) leaves the auth
// user behind: the person can still sign in, and their phone number stays taken
// forever, so a mistyped number can never be reused.
//
// The profiles row is deliberately NOT deleted. Neither profiles.id nor
// sales.sold_by has a foreign key to auth.users, so keeping it means historical
// sales still resolve to a name after the account is gone.
//
// Deploy:  Supabase dashboard -> Edge Functions -> remove-employee

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

  let body: { memberId?: string };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Invalid JSON body" });
  }

  const memberId = String(body.memberId ?? "").trim();
  if (!memberId) return json(400, { error: "Which employee?" });

  // 2. Load the membership being removed.
  const { data: member, error: memberError } = await admin
    .from("shop_members")
    .select("id, shop_id, user_id, role")
    .eq("id", memberId)
    .maybeSingle();

  if (memberError) return json(500, { error: "Could not look up that employee" });
  if (!member) return json(404, { error: "That employee is no longer in your shop" });

  // 3. Authorise: the caller must own the shop this membership belongs to. The
  //    shop is taken from the target row, never from the request body.
  const { data: ownership, error: ownershipError } = await admin
    .from("shop_members")
    .select("id")
    .eq("user_id", caller.user.id)
    .eq("shop_id", member.shop_id)
    .eq("role", "owner")
    .maybeSingle();

  if (ownershipError) return json(500, { error: "Could not verify shop ownership" });
  if (!ownership) return json(403, { error: "Only the shop owner can remove employees" });

  if (member.user_id === caller.user.id) {
    return json(400, { error: "You cannot remove yourself" });
  }
  if (member.role !== "employee") {
    return json(400, { error: "Only employees can be removed here" });
  }

  // 4. Delete the login first, then the membership. Ordered this way so a partial
  //    failure is retryable: the membership row survives to be found again, and
  //    deleting an already-deleted user is treated as success.
  const { error: deleteUserError } = await admin.auth.admin.deleteUser(member.user_id);
  if (deleteUserError && !/not found|does not exist/i.test(deleteUserError.message ?? "")) {
    return json(500, { error: "Could not delete their login. Nothing was changed." });
  }

  const { error: unlinkError } = await admin
    .from("shop_members")
    .delete()
    .eq("id", member.id);

  if (unlinkError) {
    return json(500, { error: "Their login was deleted but removing them failed. Try again." });
  }

  return json(200, { removed: true, userId: member.user_id });
});
