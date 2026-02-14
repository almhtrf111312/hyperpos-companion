import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
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
        JSON.stringify({ error: "Only admins or boss can create users" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user data from request body
    const { email, password, fullName, role, userType, phone, allowedPages } = await req.json();
    
    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: "Email and password are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (password.length < 6) {
      return new Response(
        JSON.stringify({ error: "Password must be at least 6 characters" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log('Creating user with email:', email);

    // Create user using admin API - this won't affect the current session
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm the email
      user_metadata: {
        full_name: fullName,
      },
    });

    if (createError) {
      console.error("Error creating user:", createError);
      return new Response(
        JSON.stringify({ error: createError.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!newUser?.user) {
      return new Response(
        JSON.stringify({ error: "Failed to create user" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log('User created:', newUser.user.id);

    // ✅ CRITICAL FIX: Delete any auto-created role from the trigger FIRST
    // The handle_new_user_role trigger auto-creates an 'admin' role for ALL new users
    // We need to delete it before inserting the correct role
    const { error: deleteRoleError } = await adminClient
      .from("user_roles")
      .delete()
      .eq("user_id", newUser.user.id);
    
    if (deleteRoleError) {
      console.log('No existing role to delete or delete failed:', deleteRoleError);
    } else {
      console.log('Deleted auto-created role for user:', newUser.user.id);
    }

    // Create role for the new user
    // IMPORTANT: Only Boss can create admin accounts
    // Regular admins can only create cashier accounts linked to themselves
    // This prevents privilege escalation
    let finalRole = role || 'cashier';
    let ownerId: string | null = null;
    
    if (isBoss) {
      // Boss can create any role
      // If creating admin, no owner_id (they're independent)
      // If creating cashier, link to boss (or could be null for boss-created cashiers)
      if (finalRole === 'cashier') {
        ownerId = currentUser.id;
      }
      // Boss can also create admin accounts without owner_id
    } else {
      // Regular admin can ONLY create cashiers, ALWAYS linked to themselves
      finalRole = 'cashier'; // Force to cashier regardless of what was passed
      ownerId = currentUser.id;
    }
    
    console.log('Creating role with:', { finalRole, ownerId, isBoss });
    
    // ✅ Now insert the correct role
    const { error: roleInsertError } = await adminClient
      .from("user_roles")
      .insert({
        user_id: newUser.user.id,
        role: finalRole,
        owner_id: ownerId,
      });

    if (roleInsertError) {
      console.error("Error creating user role:", roleInsertError);
      // This is critical - if role creation fails, delete the user
      await adminClient.auth.admin.deleteUser(newUser.user.id);
      return new Response(
        JSON.stringify({ error: "Failed to assign role to user" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    console.log('Role created successfully:', finalRole, 'with owner_id:', ownerId);

    // Update profile with user_type, phone, and allowed_pages if provided
    const profileUpdate: { user_type?: string; phone?: string; allowed_pages?: unknown } = {};
    if (userType) {
      profileUpdate.user_type = userType;
    }
    if (phone) {
      profileUpdate.phone = phone;
    }
    if (allowedPages && Array.isArray(allowedPages)) {
      profileUpdate.allowed_pages = allowedPages;
    }
    
    if (Object.keys(profileUpdate).length > 0) {
      const { error: profileError } = await adminClient
        .from("profiles")
        .update(profileUpdate)
        .eq("user_id", newUser.user.id);

      if (profileError) {
        console.error("Error updating profile:", profileError);
      }
    }

    console.log('User created successfully:', newUser.user.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "User created successfully",
        user: {
          id: newUser.user.id,
          email: newUser.user.email,
        }
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error in create-user function:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
