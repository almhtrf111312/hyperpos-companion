import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `أنت مساعد ذكي لنظام FlowPOS Pro - نظام محاسبة وإدارة أعمال شامل.

الميزات الرئيسية للنظام:
1. **نقطة البيع (POS)**: واجهة بيع سريعة مع دعم مسح الباركود، البحث بالاسم، والبيع النقدي والآجل
2. **إدارة المنتجات**: دعم باركود متعدد (حتى 3 باركودات)، أصناف/متغيرات، وحدات مزدوجة (قطعة/كرتونة)، تتبع المخزون، حد أدنى للمخزون
3. **إدارة العملاء**: سجل عملاء متكامل مع تتبع المشتريات والديون
4. **نظام الديون**: تسجيل ديون نقدية وآجلة، تتبع الأقساط، تنبيهات الاستحقاق
5. **الفواتير**: فواتير بيع وشراء، طباعة ومشاركة عبر واتساب
6. **المصاريف**: تسجيل المصاريف اليومية والمتكررة مع تصنيفات
7. **المستودعات**: دعم مستودعات متعددة، مخازن موزعين، تحويل العهدة
8. **الشركاء**: نظام شراكة مع توزيع أرباح ورأس مال
9. **التقارير**: تقارير مبيعات، أرباح، مخزون، ديون مع فلترة متقدمة
10. **النسخ الاحتياطي**: نسخ محلي وسحابي مع تشفير
11. **الأمان**: نظام تراخيص، ربط بالجهاز، صلاحيات (مشرف/كاشير)
12. **خدمات الصيانة**: تسجيل ومتابعة أوامر الصيانة
13. **الصندوق**: إدارة ورديات الصندوق اليومية
14. **تعدد اللغات**: عربي وإنجليزي
15. **تعدد السمات**: 10+ سمات لونية مع وضع فاتح/داكن

أنواع الأنشطة المدعومة: صيدليات، مطاعم، بقالة، ملابس، إلكترونيات، هواتف، أدوات منزلية، وغيرها.

أجب بلغة السؤال (عربي أو إنجليزي). كن مختصراً ومفيداً. إذا كان السؤال عن ميزة غير موجودة، اذكر ذلك بوضوح.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, language } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "تم تجاوز الحد المسموح، حاول لاحقاً" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "يرجى إضافة رصيد للمتابعة" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "خطأ في الخدمة" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("help-assistant error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
