import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 1. Verify Authentication JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "غير مصرح: يرجى تسجيل الدخول لاستخدام مساعد الذكاء الاصطناعي" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return new Response(
        JSON.stringify({ error: "خطأ في تهيئة الخادم الداخلي" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const serviceClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await serviceClient.auth.getUser(token);
    if (userError || !userData?.user) {
      return new Response(
        JSON.stringify({ error: "جلسة المستخدم منتهية الصلاحية" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Read LOVABLE_API_KEY
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({
          error: "مفتاح LOVABLE_API_KEY غير مهيأ في الخادم. يرجى تفعيله في إعدادات المنصة.",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Parse Request Payload
    const reqBody = await req.json();
    const { messages, contextType, shopData, preferredModel } = reqBody;

    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: "مصفوفة الرسائل مطلوبة ولا يمكن أن تكون فارغة" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Build Context String
    let contextHeader = "";
    if (shopData) {
      contextHeader = `\n[بيانات المتجر والوردية الحالية لحظة هذا الطلب]:\n`;
      if (shopData.storeName) contextHeader += `- اسم المتجر: ${shopData.storeName}\n`;
      if (shopData.storeType) contextHeader += `- نوع النشاط: ${shopData.storeType}\n`;
      if (shopData.currencies) {
        contextHeader += `- أسعار صرف العملات المعتمدة: ${JSON.stringify(shopData.currencies)}\n`;
      }
      if (shopData.activeShift) {
        contextHeader += `- تفاصيل الوردية النشطة:\n  * افتتاح الصندوق: ${shopData.activeShift.openingCashUsd ?? 0} USD\n  * المبيعات المحصلة بالعملات: ${JSON.stringify(shopData.activeShift.salesByCurrency || {})}\n  * إجمالي المصروفات من الصندوق: ${shopData.activeShift.totalExpensesUsd ?? 0} USD\n  * النقد المتوقع بالدولار: ${shopData.activeShift.expectedCashUsd ?? 0} USD\n`;
        if (shopData.activeShift.differenceUsd !== undefined) {
          contextHeader += `  * الفارق النقدي (عجز/زيادة): ${shopData.activeShift.differenceUsd} USD\n`;
        }
      }
      if (shopData.inventory) {
        contextHeader += `- حالة المخزون:\n  * أصناف شارفت على النفاد (${shopData.inventory.lowStockCount || 0} صنف): ${JSON.stringify(shopData.inventory.lowStockSamples || [])}\n`;
      }
      if (shopData.profitSummary) {
        contextHeader += `- ملخص الأرباح اليومية:\n  * إجمالي المبيعات: ${shopData.profitSummary.totalSalesUsd ?? 0} USD\n  * مجمل الربح: ${shopData.profitSummary.grossProfitUsd ?? 0} USD\n  * صافي الربح التشغيلي: ${shopData.profitSummary.netProfitUsd ?? 0} USD\n  * هامش الربح: ${shopData.profitSummary.marginPercent ?? 0}%\n`;
      }
    }

    let specialization = "";
    switch (contextType) {
      case "shift_audit":
        specialization = `أنت في وضع «مدقق الورديات والخزينة النقدي». ركز على تدقيق المبالغ المحصلة بكل عملة، كشف أي عجز أو فائض، تحليل أسباب الفروقات المحتملة (مثل دفع باقي بعملة مختلفة، أو مصروفات غير مسجلة)، واقتراح حلول محاسبية سريعة لتسوية الصندوق.`;
        break;
      case "pricing_advisor":
        specialization = `أنت في وضع «مستشار التسعير وهامش الربح». حلل أسعار التكلفة المرجحة (WAC)، أسعار البيع، هوامش الربح الصافية بعد تقلبات أسعار الصرف، واقترح أسعار بيع مثالية تحقق أعلى عائد مع مراعاة المنافسة وتكاليف التعبئة (كرتون/علبة/قطعة).`;
        break;
      case "inventory_forecast":
        specialization = `أنت في وضع «رادار التنبؤ بالمخزون والمشتريات الذكية». حلل معدل نفاد البضائع، حركات البيع، والأصناف الراكدة والحرجة، واقترح جدول زمني للطلبيات مع الكميات المثلى لتفادي انقطاع البضاعة وتجميد السيولة.`;
        break;
      case "profit_analysis":
        specialization = `أنت في وضع «خبير التحليل المالي والربح الصافي». ميز بدقة بين مجمل الربح (Gross Profit) وصافي الربح الحقيقي بعد استقطاع المصروفات التشغيلية المباشرة والمجدولة واستهلاكات الصندوق.`;
        break;
      default:
        specialization = `أنت المساعد الذكي الخبير المدمج لنظام Flow POS Pro، مستعد لتقديم استشارات فورية في إدارة المبيعات، المحاسبة متعددة العملات، فواتير الشراء والبيع، والسيولة.`;
    }

    const systemPrompt = `أنت «FlowPOS Copilot» — المساعد المحاسبي والإداري الذكي لنظام Flow POS Pro لإدارة نقاط البيع والمتاجر متعددة العملات.
${specialization}

قواعد وإرشادات هامة:
1. الدولار الأمريكي (USD) هو العملة المرجعية الأساسية للمتجر، ولكن المتجر يتعامل بعملات متعددة (مثل الليرة التركية TRY، الليرة السورية SYP، الريال السعودي SAR، الدينار الأردني JOD، وغيرها).
2. قدم تحليلات دقيقة مدعومة بالأرقام والحسابات المنطقية باللغة العربية الواضحة والمباشرة.
3. نسق الإجابة بأسلوب Markdown احترافي: عناوين رئيسية، نقاط واضحة، جداول عند المقارنة، وصناديق تنبيه للمخاطر.
4. كن عملياً واقترح خطوات تنفيذية يمكن للكاشير أو مدير المتجر اتخاذها فوراً داخل شاشات البرنامج.
${contextHeader}`;

    const formattedMessages: Array<{
      role: "system" | "user" | "assistant";
      content: string;
    }> = [
      { role: "system", content: systemPrompt },
    ];

    for (const msg of messages) {
      if (!msg) continue;
      formattedMessages.push({
        role: msg.role === "assistant" ? "assistant" : "user",
        content: typeof msg.content === "string" ? msg.content.trim() : JSON.stringify(msg.content),
      });
    }

    // 5. Select Model: Claude 3.5 Sonnet first, with graceful fallback
    const targetModel = preferredModel || "anthropic/claude-3.5-sonnet";
    const gatewayEndpoint = "https://ai.gateway.lovable.dev/v1/chat/completions";

    let gatewayRes = await fetch(gatewayEndpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: targetModel,
        messages: formattedMessages,
        stream: true,
      }),
    });

    // If Claude 3.5 Sonnet is unavailable or unsupported, fallback to Gemini 2.5 Flash
    if (!gatewayRes.ok && gatewayRes.status !== 401 && gatewayRes.status !== 402 && gatewayRes.status !== 429) {
      console.warn(`[FlowPOS Copilot] Primary model ${targetModel} returned status ${gatewayRes.status}, falling back to google/gemini-2.5-flash`);
      gatewayRes = await fetch(gatewayEndpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: formattedMessages,
          stream: true,
        }),
      });
    }

    if (!gatewayRes.ok) {
      if (gatewayRes.status === 429) {
        return new Response(
          JSON.stringify({ error: "تم تجاوز حد الطلبات المسموح به مؤقتاً، يرجى المحاولة بعد قليل." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (gatewayRes.status === 402) {
        return new Response(
          JSON.stringify({ error: "رصيد بوابة الذكاء الاصطناعي منتهٍ، يرجى شحن الرصيد للمتابعة." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const errText = await gatewayRes.text();
      let cleanMsg = `خطأ في استجابة بوابة الذكاء الاصطناعي (${gatewayRes.status})`;
      try {
        const parsed = JSON.parse(errText);
        cleanMsg = parsed.error?.message || parsed.message || parsed.title || cleanMsg;
      } catch {}

      return new Response(
        JSON.stringify({ error: cleanMsg }),
        { status: gatewayRes.status >= 400 && gatewayRes.status < 500 ? gatewayRes.status : 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 6. Return Streaming Response
    return new Response(gatewayRes.body, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("[FlowPOS Copilot] Unhandled error:", errorMsg);
    return new Response(
      JSON.stringify({ error: `حدث خطأ أثناء معالجة استشارة الذكاء الاصطناعي: ${errorMsg}` }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
