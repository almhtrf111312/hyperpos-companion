import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const CHANNEL = Deno.env.get('TELEGRAM_RELEASE_CHANNEL_ID') || '@flowpospro';
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

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

    const body = await req.json().catch(() => ({}));
    const version = String(body.version || '').slice(0, 40);
    const title = String(body.title || 'تحسينات وميزات جديدة').slice(0, 200);
    const notes = String(body.notes || '').slice(0, 3000);
    const link = String(body.download_url || '');
    if (!/^https:\/\//.test(link)) return json({ error: 'رابط التحميل يجب أن يبدأ بـ https://' }, 400);

    const text = `🚀 <b>تحديث جديد: Flow POS Pro</b>\n🏷️ <b>الإصدار:</b> ${esc(version)}\n📌 ${esc(title)}\n\n${esc(notes)}`;
    const res = await fetch('https://connector-gateway.lovable.dev/telegram/sendMessage', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${Deno.env.get('LOVABLE_API_KEY') ?? ''}`,
        'X-Connection-Api-Key': Deno.env.get('TELEGRAM_API_KEY') ?? '',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: CHANNEL, text, parse_mode: 'HTML',
        reply_markup: { inline_keyboard: [[{ text: '📥 تحميل التحديث', url: link }]] },
      }),
    });
    const out = await res.text();
    if (!res.ok) { console.error('telegram', res.status, out); return json({ error: 'فشل النشر', details: out }, 502); }
    return json({ success: true });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
