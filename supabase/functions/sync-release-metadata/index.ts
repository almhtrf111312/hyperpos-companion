// Edge Function: sync-release-metadata
// مهمتها: تُستدعى من GitHub Actions بعد كل Push إلى main
// لتحديث قاعدة البيانات برقم الإصدار ورمز آخر Commit تلقائياً
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const authHeader = req.headers.get('Authorization') || '';

    // التحقق من الصلاحية: يقبل Bearer + Service Role Key فقط (من GitHub Actions)
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (token !== serviceKey && !authHeader.includes(serviceKey)) {
      return new Response(
        JSON.stringify({ error: 'غير مصرح: مفتاح الخدمة غير صحيح' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const {
      latest_version_code,
      latest_version_name,
      commit_sha,
      commit_message,
    } = body;

    // التحقق من صحة المدخلات
    if (!latest_version_code || !latest_version_name) {
      return new Response(
        JSON.stringify({ error: 'latest_version_code و latest_version_name مطلوبان' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const adminClient = createClient(supabaseUrl, serviceKey);

    // جلب الإعداد الحالي لدمج القيم الموجودة (grace_days, update_url, إلخ) مع تجنب مسحها
    const { data: current } = await adminClient
      .from('app_settings')
      .select('value')
      .eq('key', 'release_config')
      .maybeSingle();

    let existingConfig: Record<string, unknown> = {};
    if (current?.value) {
      try {
        existingConfig = JSON.parse(current.value);
      } catch {
        existingConfig = {};
      }
    }

    const updatedConfig = {
      // الحقول الثابتة المحمية (لا تُعاد كتابتها من CI)
      min_version_code: existingConfig.min_version_code ?? 0,
      grace_days: existingConfig.grace_days ?? 3,
      forced_since: existingConfig.forced_since ?? null,
      update_url: existingConfig.update_url ?? 'https://t.me/flowpospro',
      telegram_url: existingConfig.telegram_url ?? 'https://t.me/flowpospro',
      message: existingConfig.message ?? '',
      // الحقول المحدّثة تلقائياً من كل Push
      latest_version_code: Number(latest_version_code),
      latest_version_name: String(latest_version_name),
      latest_commit_sha: commit_sha ? String(commit_sha).slice(0, 7) : null,
      latest_commit_message: commit_message ? String(commit_message).slice(0, 120) : null,
      last_synced_at: new Date().toISOString(),
    };

    const { error } = await adminClient
      .from('app_settings')
      .upsert(
        {
          key: 'release_config',
          value: JSON.stringify(updatedConfig),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'key' }
      );

    if (error) {
      throw new Error(`خطأ في قاعدة البيانات: ${error.message}`);
    }

    console.log(`[sync-release-metadata] ✅ Updated to v${latest_version_name} (Build ${latest_version_code}) — SHA: ${String(commit_sha).slice(0, 7)}`);

    return new Response(
      JSON.stringify({
        success: true,
        updated: {
          version_name: latest_version_name,
          version_code: latest_version_code,
          commit_sha: String(commit_sha).slice(0, 7),
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[sync-release-metadata] ❌ Error:', message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
