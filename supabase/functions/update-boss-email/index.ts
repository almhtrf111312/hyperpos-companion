import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Create admin client
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    
    // Get user from auth header
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is boss
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (roleError || roleData?.role !== 'boss') {
      console.error('Role check failed:', roleError);
      return new Response(
        JSON.stringify({ error: 'Only boss can update email' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { newEmail, targetUserId } = await req.json();

    if (!newEmail) {
      return new Response(
        JSON.stringify({ error: 'New email is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
      return new Response(
        JSON.stringify({ error: 'Invalid email format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Determine which user to update (self or target)
    const userIdToUpdate = targetUserId || user.id;

    // If updating another user, verify they are also a boss
    if (targetUserId && targetUserId !== user.id) {
      const { data: targetRole, error: targetRoleError } = await supabaseAdmin
        .from('user_roles')
        .select('role')
        .eq('user_id', targetUserId)
        .single();

      if (targetRoleError || targetRole?.role !== 'boss') {
        return new Response(
          JSON.stringify({ error: 'Can only update email for boss accounts' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Check if email is already in use
    const { data: existingUsers, error: existingError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (existingError) {
      console.error('Error listing users:', existingError);
      return new Response(
        JSON.stringify({ error: 'Failed to verify email availability' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const emailExists = existingUsers.users.some(
      u => u.email?.toLowerCase() === newEmail.toLowerCase() && u.id !== userIdToUpdate
    );

    if (emailExists) {
      return new Response(
        JSON.stringify({ error: 'Email already in use' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update user email
    const { data: updateData, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      userIdToUpdate,
      { email: newEmail, email_confirm: true }
    );

    if (updateError) {
      console.error('Error updating email:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update email', details: updateError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Email updated successfully for user ${userIdToUpdate} to ${newEmail}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Email updated successfully',
        email: updateData.user.email 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
