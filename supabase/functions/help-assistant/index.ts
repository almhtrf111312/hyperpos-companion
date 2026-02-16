import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `أنت مساعد ذكي لنظام FlowPOS Pro - نظام محاسبة وإدارة أعمال شامل.

الميزات الرئيسية للنظام:
1. **نقطة البيع (POS)**: واجهة بيع سريعة مع دعم مسح الباركود، البحث بالاسم، والبيع النقدي والآجل. تتضمن اختصارات لوحة مفاتيح وآلة حاسبة مدمجة.
2. **إدارة المنتجات**: دعم باركود متعدد (حتى 3 باركودات)، أصناف/متغيرات، وحدات مزدوجة (قطعة/كرتونة مع معامل تحويل)، تتبع المخزون، حد أدنى للمخزون، حقول مخصصة، تصنيفات، وأرشفة المنتجات.
3. **إدارة العملاء**: سجل عملاء متكامل مع تتبع المشتريات والديون وسجل الفواتير.
4. **نظام الديون**: تسجيل ديون نقدية وآجلة، تتبع الأقساط والمدفوعات، تنبيهات الاستحقاق (متأخرة/مستحقة اليوم/قريبة).
5. **الفواتير**: فواتير بيع وشراء، طباعة حرارية ومشاركة PDF عبر واتساب، دعم الخصم بالنسبة أو المبلغ، فواتير مرتجعة.
6. **فواتير الشراء**: تسجيل فواتير الشراء من الموردين، مطابقة الكميات المتوقعة مع الفعلية، تحديث المخزون تلقائياً.
7. **المصاريف**: تسجيل المصاريف اليومية والمتكررة (إيجار/كهرباء/رواتب) مع تصنيفات وتوزيع على الشركاء.
8. **المستودعات**: دعم مستودعات متعددة (رئيسي/فرعي/موزع)، تحويل بضاعة بين المستودعات، تتبع عهدة الموزعين.
9. **الشركاء**: نظام شراكة متقدم مع توزيع أرباح حسب النسبة أو حسب التصنيف، سجل رأس المال والسحوبات.
10. **التقارير**: تقارير مبيعات يومية/أسبوعية/شهرية، أرباح مع رسوم بيانية، تقارير مخزون، تقارير ديون، تقرير أداء الكاشير، تقرير الإغلاق اليومي، تصدير Excel.
11. **النسخ الاحتياطي**: نسخ محلي تلقائي ويدوي، نسخ سحابي عبر Google Drive، تشفير اختياري.
12. **الأمان**: نظام تراخيص (تجريبي/مدفوع)، ربط بالجهاز، صلاحيات متعددة (مشرف/كاشير/بوس)، سجل النشاطات.
13. **خدمات الصيانة**: تسجيل ومتابعة أوامر الصيانة مع تكلفة القطع وسعر الخدمة وحساب الربح.
14. **الصندوق**: إدارة ورديات الصندوق اليومية مع تتبع المبالغ الافتتاحية والختامية.
15. **تعدد اللغات**: عربي وإنجليزي مع دعم RTL كامل.
16. **السمات والمظهر**: 10 سمات لونية (زمردي، أزرق، بنفسجي، وردي، برتقالي، سماوي، نيلي، كهرماني، تركوازي، قرمزي) مع وضع فاتح/داكن وتأثير زجاجي (glassmorphism) قابل للتعديل. انتقال سلس عند التبديل بين الأوضاع.
17. **لوحة التحكم**: بطاقات إحصائية مع عداد أرقام متحرك (count-up animation)، رسم بياني مصغر (sparkline) لاتجاه المبيعات، إجراءات سريعة، تنبيهات الديون والمخزون المنخفض.
18. **المكتبات**: نظام إعارة كتب مع تتبع الأعضاء والغرامات.
19. **أعضاء المكتبة**: إدارة أعضاء المكتبة مع حالة العضوية والاشتراكات.

أنواع الأنشطة المدعومة: صيدليات، مطاعم، بقالة، ملابس، إلكترونيات، هواتف، أدوات منزلية، مكتبات، وغيرها.

**ملاحظات تقنية:**
- النظام يعمل على الويب والموبايل (Android عبر Capacitor).
- يدعم العمل بدون إنترنت مع مزامنة سحابية.
- يمكن الوصول للإعدادات من القائمة الجانبية > الإعدادات.
- صفحة المظهر منفصلة في القائمة الجانبية لتغيير السمة والوضع الفاتح/الداكن.

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
