import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      console.log('No authorization header found');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create clients
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Use service role client for all operations
    const serviceClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Get the token and verify the user
    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: userError } = await serviceClient.auth.getUser(token);
    
    if (userError || !userData?.user) {
      console.log('JWT verification failed:', userError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const callerUserId = userData.user.id;
    console.log('Authenticated user:', callerUserId);

    // Check if caller is a boss
    const { data: roleData, error: roleError } = await serviceClient
      .from('user_roles')
      .select('role')
      .eq('user_id', callerUserId)
      .single();

    console.log('Role check result:', roleData, roleError);

    if (roleError || roleData?.role !== 'boss') {
      return new Response(
        JSON.stringify({ error: 'Forbidden: Only Boss can create Boss accounts' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const { email, password, fullName } = await req.json();

    if (!email || !password || !fullName) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: email, password, fullName' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate password length
    if (password.length < 6) {
      return new Response(
        JSON.stringify({ error: 'Password must be at least 6 characters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create the new user
    const { data: newUser, error: createError } = await serviceClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName
      }
    });

    if (createError) {
      console.error('Error creating user:', createError);
      
      if (createError.message?.includes('already been registered')) {
        return new Response(
          JSON.stringify({ error: 'البريد الإلكتروني مسجل مسبقاً' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: 'Failed to create user' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!newUser?.user) {
      return new Response(
        JSON.stringify({ error: 'Failed to create user' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const newUserId = newUser.user.id;
    console.log('Created new user:', newUserId);

    // Update or insert profile for the new user (trigger may have already created one)
    const { error: profileError } = await serviceClient
      .from('profiles')
      .upsert({
        user_id: newUserId,
        full_name: fullName
      }, { onConflict: 'user_id' });

    if (profileError) {
      console.error('Error upserting profile:', profileError);
    }

    // Update the user role to boss (trigger creates cashier by default)
    const { error: roleUpdateError } = await serviceClient
      .from('user_roles')
      .update({
        role: 'boss',
        is_active: true
      })
      .eq('user_id', newUserId);

    if (roleUpdateError) {
      console.error('Error updating role:', roleUpdateError);
      
      // Try to insert if update didn't work (no existing row)
      const { error: roleInsertError } = await serviceClient
        .from('user_roles')
        .insert({
          user_id: newUserId,
          role: 'boss',
          is_active: true
        });
      
      if (roleInsertError) {
        console.error('Error inserting role:', roleInsertError);
        // Try to clean up the user if role assignment fails
        await serviceClient.auth.admin.deleteUser(newUserId);
        
        return new Response(
          JSON.stringify({ error: 'Failed to assign boss role' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    console.log(`Boss ${callerUserId} created new Boss account ${newUserId} at ${new Date().toISOString()}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Boss account created successfully',
        user_id: newUserId
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in create-boss-account:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
