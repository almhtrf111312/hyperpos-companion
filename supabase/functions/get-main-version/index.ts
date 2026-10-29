import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

// يقرأ أحدث إصدار مدفوع إلى فرع main (version.json + changelog) — للمدير العام فقط
const GW = 'https://connector-gateway.lovable.dev/github';
const REPO = 'repos/almhtrf111312/hyperpos-companion';
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const decode = (b64: string) => new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\n/g, '')), (c) => c.charCodeAt(0)));

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
    const gh = async (path: string) => {
      const r = await fetch(`${GW}/${REPO}/${path}`, {
        headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${LK}`, 'X-Connection-Api-Key': GK },
      });
      return r.ok ? await r.json() : null;
    };

    const [ver, log, commit] = await Promise.all([
      gh('contents/version.json?ref=main'),
      gh('contents/public/changelog.json?ref=main'),
      gh('commits/main'),
    ]);
    if (!ver?.content) return json({ error: 'تعذر قراءة نسخة main' }, 502);
    const v = JSON.parse(decode(ver.content));

    let notes: string[] = [];
    try {
      const c = log?.content ? JSON.parse(decode(log.content)) : null;
      const list = Array.isArray(c) ? c : c?.entries || c?.versions || [];
      const entry = list.find((e: any) => Number(e.versionCode ?? e.build) === Number(v.versionCode)) || list[0];
      const pub = entry?.public;
      if (pub) notes = [...(pub.new || []), ...(pub.improved || []), ...(pub.fixed || [])].map(String).slice(0, 8);
    } catch { /* الملاحظات اختيارية */ }

    return json({
      versionName: String(v.versionName),
      versionCode: Number(v.versionCode),
      sha: commit?.sha ? String(commit.sha).slice(0, 7) : null,
      message: commit?.commit?.message ? String(commit.commit.message).split('\n')[0].slice(0, 120) : null,
      committedAt: commit?.commit?.committer?.date ?? null,
      notes,
    });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
