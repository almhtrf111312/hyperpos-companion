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
    const { email, password } = await req.json();

    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: 'Email and password are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Create admin client for service operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    
    // Create anon client to verify credentials
    const supabaseAnon = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!);

    // Step 1: Verify credentials by attempting to sign in
    const { data: signInData, error: signInError } = await supabaseAnon.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError || !signInData.user) {
      console.log('[reset-own-device] Invalid credentials:', signInError?.message);
      return new Response(
        JSON.stringify({ error: 'بيانات الدخول غير صحيحة' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = signInData.user.id;
    console.log('[reset-own-device] Credentials verified for user:', userId);

    // Step 2: Reset the device_id in app_licenses
    const { error: updateError } = await supabaseAdmin
      .from('app_licenses')
      .update({ device_id: null })
      .eq('user_id', userId)
      .eq('is_revoked', false);

    if (updateError) {
      console.error('[reset-own-device] Failed to reset device:', updateError);
      return new Response(
        JSON.stringify({ error: 'فشل في إعادة تعيين الجهاز' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[reset-own-device] Device reset successful for user:', userId);

    // Sign out the temporary session we created for verification
    await supabaseAnon.auth.signOut();

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'تم إعادة تعيين الجهاز بنجاح. يمكنك الآن تسجيل الدخول.' 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[reset-own-device] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'حدث خطأ غير متوقع' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
