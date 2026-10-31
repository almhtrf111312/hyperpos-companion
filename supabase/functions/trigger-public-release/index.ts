import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const GW = 'https://connector-gateway.lovable.dev/github';
const REPO = 'repos/almhtrf111312/hyperpos-companion';
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const auth = req.headers.get('Authorization');
    if (!auth?.startsWith('Bearer ')) return json({ error: 'غير مصرح' }, 401);
    const url = Deno.env.get('SUPABASE_URL')!;
    const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: 'جلسة غير صالحة' }, 401);
    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: isBoss } = await admin.rpc('is_boss', { _user_id: user.id });
    if (!isBoss) return json({ error: 'للمدير العام فقط' }, 403);

    const LK = Deno.env.get('LOVABLE_API_KEY'), GK = Deno.env.get('GITHUB_API_KEY');
    if (!LK || !GK) return json({ error: 'ربط GitHub غير مهيأ' }, 500);
    const gh = async (method: string, path: string, body?: unknown) => {
      const r = await fetch(`${GW}/${REPO}/${path}`, {
        method,
        headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${LK}`, 'X-Connection-Api-Key': GK, 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });
      const t = await r.text();
      return { ok: r.ok, status: r.status, text: t, data: t ? (() => { try { return JSON.parse(t); } catch { return null; } })() : null };
    };

    const main = await gh('GET', 'git/ref/heads/main');
    if (!main.ok) return json({ error: 'تعذر قراءة فرع main', status: main.status, details: main.text }, 502);
    const sha = main.data.object.sha as string;

    const run = await gh('POST', 'actions/workflows/build-apk.yml/dispatches', {
      ref: 'main',
      inputs: { publish_telegram: 'true' },
    });
    if (!run.ok) return json({ error: 'تعذر بدء البناء', status: run.status, details: run.text }, 502);
    return json({ success: true, sha: sha.slice(0, 7) });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
