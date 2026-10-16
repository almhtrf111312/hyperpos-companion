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
    // 1. Strict Authentication: Verify caller JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "غير مصرح: يرجى تسجيل الدخول أولاً" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const serviceClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await serviceClient.auth.getUser(token);
    if (userError || !userData?.user) {
      return new Response(
        JSON.stringify({ error: "غير مصرح: جلسة غير صالحة" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const callerUserId = userData.user.id;

    // 2. Strict Role Authorization: Verify caller is 'boss' in user_roles
    const { data: roleData, error: roleError } = await serviceClient
      .from("user_roles")
      .select("role")
      .eq("user_id", callerUserId)
      .maybeSingle();

    if (roleError || roleData?.role !== "boss") {
      return new Response(
        JSON.stringify({ error: "محظور: هذه الميزة مخصصة ومحصورة حصرياً لمالك ومطور النظام (Boss)" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Fetch Live System Context & Metrics
    let systemContext = "";
    try {
      const nowIso = new Date().toISOString();
      const in7Days = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      // Fetch licenses summary
      const { data: licenses } = await serviceClient
        .from("app_licenses")
        .select("id, user_id, expires_at, is_revoked, is_trial, license_tier");

      let totalLicenses = 0;
      let activeLicenses = 0;
      let expiredLicenses = 0;
      let expiringSoonLicenses = 0;
      let trialLicenses = 0;

      if (licenses) {
        totalLicenses = licenses.length;
        for (const lic of licenses) {
          if (lic.is_revoked) continue;
          if (lic.is_trial) trialLicenses++;
          if (lic.expires_at && lic.expires_at < nowIso) {
            expiredLicenses++;
          } else {
            activeLicenses++;
            if (lic.expires_at && lic.expires_at <= in7Days) {
              expiringSoonLicenses++;
            }
          }
        }
      }

      // Fetch registered users count
      const { count: usersCount } = await serviceClient
        .from("profiles")
        .select("*", { count: "exact", head: true });

      // Fetch roles breakdown
      const { data: roles } = await serviceClient
        .from("user_roles")
        .select("role");

      const adminsCount = roles?.filter((r) => r.role === "admin").length || 0;
      const cashiersCount = roles?.filter((r) => r.role === "cashier").length || 0;
      const bossCount = roles?.filter((r) => r.role === "boss").length || 0;

      // Fetch recent errors from error_logs
      const { data: recentErrors } = await serviceClient
        .from("error_logs")
        .select("id, occurred_at, error_type, error_message, platform, page_url, is_resolved, extra_context")
        .order("occurred_at", { ascending: false })
        .limit(10);

      let errorsSummary = "لا توجد أخطاء حديثة مسجلة.";
      if (recentErrors && recentErrors.length > 0) {
        errorsSummary = recentErrors
          .map((err, idx) => {
            const sev = err.extra_context?.severity || err.error_type || "خطأ";
            const status = err.is_resolved ? "تم الحل" : "قيد المتابعة";
            const dateStr = new Date(err.occurred_at).toLocaleString("ar-SA", { timeZone: "Asia/Riyadh" });
            return `${idx + 1}. [${status}] (${sev}) في المسار [${err.page_url || "عام"}]: ${err.error_message} (${dateStr})`;
          })
          .join("\n");
      }

      systemContext = `
[تقرير حي ومباشر عن حالة النظام والبيانات لحظة هذا السؤال]:
- التاريخ والوقت الحالي: ${new Date().toLocaleString("ar-SA", { timeZone: "Asia/Riyadh" })} (توقيت مكة)
- إجمالي المستخدمين المسجلين: ${usersCount || totalLicenses || 0}
  * مدراء المتاجر (Admins): ${adminsCount}
  * موظفو نقاط البيع (Cashiers): ${cashiersCount}
  * مالكو النظام (Boss): ${bossCount}
- إحصائيات التراخيص:
  * إجمالي التراخيص المسجلة: ${totalLicenses}
  * التراخيص النشطة السارية: ${activeLicenses}
  * التراخيص التجريبية (Trials): ${trialLicenses}
  * التراخيص المنتهية الصلاحية: ${expiredLicenses}
  * تراخيص تنتهي قريباً (خلال 7 أيام): ${expiringSoonLicenses}
- أحدث تقارير رادار الأخطاء الحية (Central Error Radar):
${errorsSummary}
`;
    } catch (metricErr) {
      console.warn("Failed to fetch live system metrics:", metricErr);
      systemContext = "\n[ملاحظة: تعذر استرداد القياسات الحية، ركز على إجابة طلب المالك مباشرة]\n";
    }

    // 4. Parse incoming body
    const reqBody = await req.json();
    const { messages, image, images, audio, stream = true } = reqBody;

    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: "لم يتم تقديم أي رسائل في الطلب" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5. Construct System Prompt
    const systemPrompt = `أنت «المستشار التنفيذي الذكي» والمساعد الإداري والتقني الخاص والحصري لمالك ومطور نظام Flow POS Pro (الـ Boss).
أنت تعمل كغرفة قيادة ذكية ومساعد تنفيذي فائق الذكاء، ولديك صلاحية مطلقة وفهم شامل لكافة جوانب النظام: نقاط البيع (POS)، المخزون، قواعد البيانات، الشبكات، الفواتير، رادار الأخطاء، وحسابات المشتركين والتراخيص.

مهامك وصلاحياتك التنفيذية:
1. تقديم إجابات وتحليلات إدارية وتقنية مباشرة لمالك النظام مع الاستشهاد بالأرقام والبيانات الحية المرفقة أدناه.
2. تحليل الصور المرفقة بدقة (فواتير، شاشات أخطاء، تقارير، إيصالات، باركودات) وتفكيك أي عطل أو معلومة واردة بها.
3. معالجة الرسائل والتسجيلات الصوتية بذكاء وفهم سواء كانت بالعربية الفصحى أو بمختلف اللهجات العربية العامية، وتقديم خلاصة وحلول فورية.
4. تفسير أخطاء رادار الأخطاء وتقديم التشخيص الجذري (Root Cause) والحل البرمجي أو الإجرائي الفوري.
5. تقديم مقترحات واستراتيجيات لتطوير المبيعات وضبط اشتراكات وتراخيص العملاء.

أسلوب الرد:
- الرد دائماً باللغة العربية الواضحة والفصيحة، بأسلوب وقور، مهني، مباشر، وحاسم يحرص على وقت الـ Boss.
- استخدم تنسيق Markdown ببراعة: العناوين البارزة، النقاط المرتبة، الجداول للمقارنات والأرقام، وصناديق التنبيه (Alerts/Callouts).
- قدم أرقاماً وإحصائيات دقيقة اعتماداً على السياق الحي أدناه.

${systemContext}`;

    // 6. Format Messages with Multimodal Support
    const formattedMessages: Array<{ role: string; content: string | Array<Record<string, unknown>> }> = [];

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      const isLast = i === messages.length - 1;
      const role = msg.role === "assistant" ? "assistant" : "user";

      // If last user message and contains attachments (image/audio)
      if (isLast && role === "user") {
        const contentParts: Array<Record<string, unknown>> = [];
        const textContent = typeof msg.content === "string" ? msg.content : (msg.content?.[0]?.text || "");
        
        contentParts.push({
          type: "text",
          text: textContent || "يرجى تحليل هذه المرفقات وتقديم ملخص وحلول مناسبة.",
        });

        // Add single image or multiple images
        const allImages: string[] = [];
        if (typeof image === "string" && image.startsWith("data:image")) {
          allImages.push(image);
        }
        if (Array.isArray(images)) {
          for (const img of images) {
            if (typeof img === "string" && img.startsWith("data:image")) {
              allImages.push(img);
            }
          }
        }
        if (Array.isArray(msg.images)) {
          for (const img of msg.images) {
            if (typeof img === "string" && img.startsWith("data:image")) {
              allImages.push(img);
            }
          }
        }

        for (const imgUrl of allImages) {
          contentParts.push({
            type: "image_url",
            image_url: { url: imgUrl },
          });
        }

        // Add audio input if provided
        if (audio?.data && typeof audio.data === "string") {
          contentParts.push({
            type: "input_audio",
            input_audio: {
              data: audio.data,
              format: audio.format || "wav",
            },
          });
        }

        formattedMessages.push({ role, content: contentParts.length === 1 ? textContent : contentParts });
      } else {
        formattedMessages.push({
          role,
          content: typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content),
        });
      }
    }

    // 7. Call Lovable AI Gateway
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY is not configured in Supabase environment");
      return new Response(
        JSON.stringify({ error: "مفتاح خدمة الذكاء الاصطناعي (LOVABLE_API_KEY) غير مهيأ في الخادم" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          ...formattedMessages,
        ],
        stream: stream !== false,
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "تم تجاوز حد الطلبات المسموح به مؤقتاً، يرجى الانتظار ثوانٍ والمحاولة ثانية" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "رصيد الذكاء الاصطناعي غير كافٍ، يرجى مراجعة اشتراك Lovable" }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);
      return new Response(
        JSON.stringify({ error: `خطأ في بوابة الذكاء الاصطناعي (${aiResponse.status})` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 8. Stream or JSON Response
    if (stream !== false && aiResponse.body) {
      return new Response(aiResponse.body, {
        headers: {
          ...corsHeaders,
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
        },
      });
    }

    const responseJson = await aiResponse.json();
    return new Response(JSON.stringify(responseJson), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("boss-assistant unhandled error:", errorMsg);
    return new Response(
      JSON.stringify({ error: `حدث خطأ غير متوقع: ${errorMsg}` }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
