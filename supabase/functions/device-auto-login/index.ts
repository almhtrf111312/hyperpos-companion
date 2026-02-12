import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { device_id } = await req.json();

    if (!device_id || typeof device_id !== 'string' || device_id.length < 5 || device_id.length > 200) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid request' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate device_id format: must start with DEV-, CAP-, or FB- followed by UUID-like pattern
    const validDeviceIdPattern = /^(DEV|CAP|FB)-[A-Z0-9-]{8,}$/i;
    if (!validDeviceIdPattern.test(device_id)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid request' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[DeviceAutoLogin] Device lookup attempt');

    // Create admin client with service role
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // --- Rate Limiting: max 5 attempts per IP per 10 minutes ---
    const clientIP = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                     req.headers.get('cf-connecting-ip') || 
                     'unknown';
    
    // Use app_settings table for simple rate limiting
    const rateLimitKey = `rate_limit:device_login:${clientIP}`;
    const { data: rateData } = await supabaseAdmin
      .from('app_settings')
      .select('value, updated_at')
      .eq('key', rateLimitKey)
      .maybeSingle();

    const now = new Date();
    const windowMs = 10 * 60 * 1000; // 10 minutes
    const maxAttempts = 5;

    if (rateData) {
      const lastUpdated = new Date(rateData.updated_at || '');
      const attempts = parseInt(rateData.value || '0', 10);
      
      if (now.getTime() - lastUpdated.getTime() < windowMs && attempts >= maxAttempts) {
        console.warn('[DeviceAutoLogin] Rate limit exceeded for IP');
        return new Response(
          JSON.stringify({ success: false, error: 'Too many attempts. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Update or reset counter
      const newCount = (now.getTime() - lastUpdated.getTime() < windowMs) ? attempts + 1 : 1;
      await supabaseAdmin
        .from('app_settings')
        .update({ value: String(newCount), updated_at: now.toISOString() })
        .eq('key', rateLimitKey);
    } else {
      await supabaseAdmin
        .from('app_settings')
        .insert({ key: rateLimitKey, value: '1' });
    }

    // Step 1: Find user by device_id in app_licenses
    const { data: license, error: licenseError } = await supabaseAdmin
      .from('app_licenses')
      .select('user_id, expires_at, is_revoked')
      .eq('device_id', device_id)
      .eq('is_revoked', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (licenseError) {
      console.error('[DeviceAutoLogin] License lookup error:', licenseError);
      return new Response(
        JSON.stringify({ success: false, error: 'Database error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!license) {
      // Don't reveal whether device exists or not
      return new Response(
        JSON.stringify({ success: false, found: false }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 2: Check if license is still valid (not expired)
    const now = new Date();
    const expiresAt = new Date(license.expires_at);
    if (expiresAt < now) {
      return new Response(
        JSON.stringify({ success: false, found: true, error: 'License expired' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 3: Get user email for login (server-side only, not returned to client)
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(
      license.user_id
    );

    if (userError || !userData.user) {
      console.error('[DeviceAutoLogin] User lookup error:', userError);
      return new Response(
        JSON.stringify({ success: false, found: true, error: 'User not found' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userEmail = userData.user.email;

    if (!userEmail) {
      return new Response(
        JSON.stringify({ success: false, found: true, error: 'User has no email' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 4: Generate a magic link token for auto-login
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: userEmail,
      options: {
        redirectTo: '/',
      }
    });

    if (linkError || !linkData) {
      console.error('[DeviceAutoLogin] Generate link error:', linkError);
      return new Response(
        JSON.stringify({ success: false, found: true, error: 'Failed to generate login' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract only the minimal token needed - DO NOT return email or action_link
    const tokenHash = linkData.properties?.hashed_token;
    const verificationToken = linkData.properties?.email_otp;

    console.log('[DeviceAutoLogin] Successfully generated login for device');

    return new Response(
      JSON.stringify({
        success: true,
        found: true,
        token_hash: tokenHash,
        verification_token: verificationToken,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[DeviceAutoLogin] Unexpected error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
