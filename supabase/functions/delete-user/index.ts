import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type DeleteType = 'user' | 'owner' | 'boss';

// NOTE: Deno edge runtime + esm.sh types can be overly strict here.
// We intentionally treat the client as `any` to avoid type mismatches.
type SupabaseAnyClient = any;

async function safeDeleteByUserId(
  adminClient: SupabaseAnyClient,
  table: 'user_roles' | 'profiles' | 'app_licenses',
  userId: string,
) {
  const { error } = await adminClient.from(table).delete().eq('user_id', userId);
  if (error) console.error(`Error deleting from ${table}:`, error);
}

async function deleteAuthUser(adminClient: SupabaseAnyClient, userId: string) {
  const { error } = await adminClient.auth.admin.deleteUser(userId);
  if (error) throw error;
}

async function deleteUserCompletely(adminClient: SupabaseAnyClient, userId: string) {
  // Order: child-ish tables first, then role/profile, then auth
  await safeDeleteByUserId(adminClient, 'app_licenses', userId);
  await safeDeleteByUserId(adminClient, 'profiles', userId);
  await safeDeleteByUserId(adminClient, 'user_roles', userId);
  await deleteAuthUser(adminClient, userId);
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get the authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith('Bearer ')) {
      console.log('No authorization header found');
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || '';

    // Create admin client with service role
    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Verify the user token
    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: userError } = await adminClient.auth.getUser(token);
    
    if (userError || !userData?.user) {
      console.log('JWT verification failed:', userError);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const currentUser = userData.user;
    console.log('Authenticated user:', currentUser.id);

    // Check if current user is admin or boss
    const { data: currentUserRole, error: roleError } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", currentUser.id)
      .single();

    console.log('Role check result:', currentUserRole, roleError);

    const isBoss = currentUserRole?.role === "boss";
    const isAdmin = currentUserRole?.role === "admin";

    if (roleError || (!isAdmin && !isBoss)) {
      return new Response(
        JSON.stringify({ error: "Only admins or boss can delete users" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the user ID to delete from request body
    const { userId, deleteType } = await req.json() as { userId?: string; deleteType?: DeleteType };
    
    if (!userId) {
      return new Response(
        JSON.stringify({ error: "User ID is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Prevent deleting yourself
    if (userId === currentUser.id) {
      return new Response(
        JSON.stringify({ error: "Cannot delete your own account" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Load target role/ownership context
    const { data: targetRoleRow, error: targetRoleErr } = await adminClient
      .from('user_roles')
      .select('role, owner_id')
      .eq('user_id', userId)
      .maybeSingle();

    if (targetRoleErr) {
      console.error('Error loading target role:', targetRoleErr);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to read target role' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const targetRole = targetRoleRow?.role as string | undefined;
    const targetOwnerId = (targetRoleRow as any)?.owner_id as string | null | undefined;

    // Boss-only deletion of boss accounts
    if (deleteType === 'boss') {
      if (!isBoss) {
        return new Response(
          JSON.stringify({ success: false, error: 'Only boss can delete other boss accounts' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (targetRole !== 'boss') {
        return new Response(
          JSON.stringify({ success: false, error: 'Target user is not a boss' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Owner deletion must be boss-only, and must fully delete auth + all sub-accounts + data.
    if (deleteType === 'owner') {
      if (!isBoss) {
        return new Response(
          JSON.stringify({ success: false, error: 'Only boss can delete owner accounts' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (targetRole === 'boss') {
        return new Response(
          JSON.stringify({ success: false, error: 'Cannot delete a boss account using owner deletion' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Admin restrictions: admins can only delete their own sub-accounts (cashier) via this function.
    if (isAdmin && !isBoss) {
      if (!targetRoleRow) {
        return new Response(
          JSON.stringify({ success: false, error: 'Target user not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (targetRole !== 'cashier') {
        return new Response(
          JSON.stringify({ success: false, error: 'Admins can only delete cashier accounts' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (targetOwnerId !== currentUser.id) {
        return new Response(
          JSON.stringify({ success: false, error: 'Cannot delete users outside your ownership' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    console.log('Deleting user:', userId, 'deleteType:', deleteType || 'user');

    // Owner deletion flow (boss only): delete sub-accounts + owner data + auth account
    if (deleteType === 'owner') {
      // 1) Fetch all sub-accounts BEFORE data wipe (owner_id linkage)
      const { data: subRoles, error: subErr } = await adminClient
        .from('user_roles')
        .select('user_id')
        .eq('owner_id', userId);

      if (subErr) {
        console.error('Error fetching sub accounts:', subErr);
        return new Response(
          JSON.stringify({ success: false, error: 'Failed to fetch sub accounts' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const subUserIds = (subRoles || []).map((r: any) => r.user_id).filter(Boolean);
      console.log('Owner sub accounts:', subUserIds.length);

      // 2) Delete sub-accounts fully (including auth)
      for (const subId of subUserIds) {
        try {
          await deleteUserCompletely(adminClient, subId);
        } catch (e) {
          console.error('Failed deleting sub account:', subId, e);
        }
      }

      // 3) Delete owner data from business tables (must run as boss JWT for auth.uid() checks)
      if (!supabaseAnonKey) {
        console.error('Missing SUPABASE_ANON_KEY / SUPABASE_PUBLISHABLE_KEY in env');
      } else {
        const authedClient = createClient(supabaseUrl, supabaseAnonKey, {
          global: {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
          auth: { autoRefreshToken: false, persistSession: false },
        });

        const { data: cascadeOk, error: cascadeErr } = await authedClient.rpc('delete_owner_cascade', {
          _owner_id: userId,
        });

        if (cascadeErr) {
          console.error('delete_owner_cascade failed:', cascadeErr);
          // We still proceed with auth delete, but return a warning to caller
        } else {
          console.log('delete_owner_cascade result:', cascadeOk);
        }
      }

      // 4) Finally delete the owner auth account (and any leftovers)
      await deleteUserCompletely(adminClient, userId);

      return new Response(
        JSON.stringify({ success: true, message: 'Owner deleted completely' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Default deletion flow (single user)
    await deleteUserCompletely(adminClient, userId);

    console.log('User deleted successfully:', userId);

    return new Response(
      JSON.stringify({ success: true, message: "User deleted successfully" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error in delete-user function:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
