import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: 'البريد الإلكتروني وكلمة المرور مطلوبان' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const supabaseAnon = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!);

    // Step 1: Verify credentials
    const { data: signInData, error: signInError } = await supabaseAnon.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError || !signInData.user) {
      console.log('[transfer-license] Invalid credentials:', signInError?.message);
      return new Response(
        JSON.stringify({ error: 'كلمة المرور غير صحيحة' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = signInData.user.id;
    console.log('[transfer-license] Credentials verified for user:', userId);

    // Step 2: Clear device_id from active license
    const { error: updateError } = await supabaseAdmin
      .from('app_licenses')
      .update({ device_id: null })
      .eq('user_id', userId)
      .eq('is_revoked', false);

    if (updateError) {
      console.error('[transfer-license] Failed to clear device:', updateError);
      return new Response(
        JSON.stringify({ error: 'فشل في فك ارتباط الجهاز' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[transfer-license] Device unbound successfully for user:', userId);

    // Sign out the temporary session
    await supabaseAnon.auth.signOut();

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'تم فك ارتباط الجهاز بنجاح. يمكنك الآن التفعيل من الجهاز الجديد.' 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[transfer-license] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'حدث خطأ غير متوقع' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
