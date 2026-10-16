import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Attachment constraints
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_AUDIO_BYTES = 10 * 1024 * 1024; // 10 MB

const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const ALLOWED_AUDIO_TYPES = new Set([
  "audio/webm",
  "audio/wav",
  "audio/mp3",
  "audio/mpeg",
  "audio/ogg",
  "audio/m4a",
  "audio/aac",
  "audio/x-m4a",
]);

function parseDataUrl(dataUrl: string): { mimeType: string; base64: string } | null {
  if (typeof dataUrl !== "string") return null;
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return { mimeType: match[1].toLowerCase().trim(), base64: match[2].trim() };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 1. Strict Authentication: Verify caller JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "غير مصرح: يرجى تسجيل الدخول أولاً للوصول إلى المساعد" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      console.error("[BossAssistant] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
      return new Response(
        JSON.stringify({ error: "خطأ في تهيئة خادم Supabase الداخلي" }),
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
        JSON.stringify({ error: "غير مصرح: جلسة المستخدم غير صالحة أو منتهية" }),
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

    // 3. Read GEMINI_API_KEY from server secrets
    // We strictly check GEMINI_API_KEY or the named secret "AI Flow POS Pro" / "AI_FLOW_POS_PRO"
    const GEMINI_API_KEY =
      Deno.env.get("GEMINI_API_KEY") ||
      Deno.env.get("AI Flow POS Pro") ||
      Deno.env.get("AI_FLOW_POS_PRO");

    if (!GEMINI_API_KEY) {
      console.error("[BossAssistant] Secret GEMINI_API_KEY is missing in server environment");
      return new Response(
        JSON.stringify({
          error:
            "مفتاح GEMINI_API_KEY غير مهيأ في أسرار خادم Supabase (Secrets). يرجى إضافة السر باسم GEMINI_API_KEY في إعدادات Supabase.",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Fetch Live System Context & Metrics
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
      console.warn("[BossAssistant] Failed to fetch live system metrics:", metricErr);
      systemContext = "\n[ملاحظة: تعذر استرداد القياسات الحية، ركز على إجابة طلب المالك مباشرة]\n";
    }

    // 5. Parse and Validate Request Payload
    const reqBody = await req.json();
    const { messages, image, images, audio } = reqBody;

    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: "لم يتم تقديم أي رسائل في الطلب" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate and process image attachments
    const validatedImageParts: Array<{ mimeType: string; base64: string }> = [];
    const rawImages: string[] = [];

    if (typeof image === "string") {
      rawImages.push(image);
    }
    if (Array.isArray(images)) {
      for (const img of images) {
        if (typeof img === "string") rawImages.push(img);
      }
    }

    for (const rawImg of rawImages) {
      const parsed = parseDataUrl(rawImg);
      if (!parsed) {
        return new Response(
          JSON.stringify({ error: "صيغة بيانات الصورة المرفقة غير صالحة" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (!ALLOWED_IMAGE_TYPES.has(parsed.mimeType)) {
        return new Response(
          JSON.stringify({ error: `نوع الصورة (${parsed.mimeType}) غير مدعوم. الصيغ المدعومة: JPEG, PNG, WebP, GIF` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      // Check byte length (~3/4 of base64 length)
      const approxBytes = (parsed.base64.length * 3) / 4;
      if (approxBytes > MAX_IMAGE_BYTES) {
        return new Response(
          JSON.stringify({ error: "حجم الصورة يتجاوز الحد الأقصى المسموح (5 ميجابايت)" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      validatedImageParts.push(parsed);
    }

    // Validate and process audio attachment
    let validatedAudioPart: { mimeType: string; base64: string } | null = null;
    if (audio) {
      let rawAudioStr = typeof audio === "string" ? audio : audio.data;
      let rawAudioMime = typeof audio === "object" ? audio.mimeType : undefined;

      if (rawAudioStr) {
        const parsed = parseDataUrl(rawAudioStr);
        let mime = parsed ? parsed.mimeType : (rawAudioMime || "audio/webm").toLowerCase();
        let b64 = parsed ? parsed.base64 : rawAudioStr;

        // Clean any potential prefix
        if (b64.includes(",")) {
          b64 = b64.split(",")[1];
        }

        if (!ALLOWED_AUDIO_TYPES.has(mime)) {
          // Normalize mime if e.g. audio/webm;codecs=opus
          const cleanMime = mime.split(";")[0].trim();
          if (ALLOWED_AUDIO_TYPES.has(cleanMime)) {
            mime = cleanMime;
          } else {
            return new Response(
              JSON.stringify({ error: `نوع الملف الصوتي (${mime}) غير مدعوم.` }),
              { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        }

        const approxBytes = (b64.length * 3) / 4;
        if (approxBytes > MAX_AUDIO_BYTES) {
          return new Response(
            JSON.stringify({ error: "حجم الملف الصوتي يتجاوز الحد الأقصى المسموح (10 ميجابايت)" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        validatedAudioPart = { mimeType: mime, base64: b64 };
      }
    }

    console.log(
      `[BossAssistant] Calling Gemini API (images: ${validatedImageParts.length}, audio: ${Boolean(validatedAudioPart)})`
    );

    // 6. Construct System Prompt
    const systemPrompt = `أنت «المستشار التنفيذي الذكي» والمساعد الإداري والتقني الخاص والحصري لمالك ومطور نظام Flow POS Pro (الـ Boss).
أنت تعمل كغرفة قيادة ذكية ومساعد تنفيذي فائق الذكاء، ولديك صلاحية وفهم شامل لكافة جوانب النظام: نقاط البيع (POS)، المخزون، قواعد البيانات، الشبكات، الفواتير، رادار الأخطاء، وحسابات المشتركين والتراخيص.

مهامك وصلاحياتك التنفيذية:
1. تقديم إجابات وتحليلات إدارية وتقنية مباشرة لمالك النظام مع الاستشهاد بالأرقام والبيانات الحية المرفقة أدناه.
2. تحليل الصور المرفقة بدقة (فواتير، شاشات أخطاء، تقارير، إيصالات، باركودات) وتفكيك أي عطل أو معلومة واردة بها.
3. معالجة الرسائل والتسجيلات الصوتية بذكاء وفهم سواء كانت بالعربية الفصحى أو بمختلف اللهجات العربية، وتقديم خلاصة وحلول فورية.
4. تفسير أخطاء رادار الأخطاء وتقديم التشخيص الجذري (Root Cause) والحل البرمجي أو الإجرائي الفوري.
5. تقديم مقترحات واستراتيجيات لتطوير المبيعات وضبط اشتراكات وتراخيص العملاء.

أسلوب الرد:
- الرد دائماً باللغة العربية الواضحة والفصيحة، بأسلوب وقور، مهني، مباشر، وحاسم يحرص على وقت الـ Boss.
- استخدم تنسيق Markdown ببراعة: العناوين البارزة، النقاط المرتبة، الجداول للمقارنات والأرقام، وصناديق التنبيه (Alerts/Callouts).
- قدم أرقاماً وإحصائيات دقيقة اعتماداً على السياق الحي أدناه.

${systemContext}`;

    // 7. Adapt to Google Gemini Contents Format
    // In Gemini API, roles are "user" and "model"
    const geminiContents: Array<{ role: "user" | "model"; parts: Array<Record<string, unknown>> }> = [];

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      const role = msg.role === "assistant" ? "model" : "user";
      const isLast = i === messages.length - 1;

      const parts: Array<Record<string, unknown>> = [];
      const text = typeof msg.content === "string" ? msg.content : (msg.content?.[0]?.text || "");
      if (text) {
        parts.push({ text });
      }

      // If last user message, attach images and audio
      if (isLast && role === "user") {
        for (const imgPart of validatedImageParts) {
          parts.push({
            inline_data: {
              mime_type: imgPart.mimeType,
              data: imgPart.base64,
            },
          });
        }

        if (validatedAudioPart) {
          parts.push({
            inline_data: {
              mime_type: validatedAudioPart.mimeType,
              data: validatedAudioPart.base64,
            },
          });
        }
      }

      if (parts.length === 0) {
        parts.push({ text: "يرجى التحليل والمساعدة" });
      }

      geminiContents.push({ role, parts });
    }

    // 8. Connect to Google Gemini API
    const geminiPayload = {
      system_instruction: {
        parts: [{ text: systemPrompt }],
      },
      contents: geminiContents,
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 4096,
      },
    };

    // Primary model: gemini-2.5-flash with SSE streaming
    const geminiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse&key=${encodeURIComponent(GEMINI_API_KEY)}`;

    let geminiRes = await fetch(geminiEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(geminiPayload),
    });

    // Fallback model if gemini-2.5-flash is not available on this key tier
    if (geminiRes.status === 404) {
      console.warn("[BossAssistant] gemini-2.5-flash not found, falling back to gemini-2.0-flash");
      const fallbackEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:streamGenerateContent?alt=sse&key=${encodeURIComponent(GEMINI_API_KEY)}`;
      geminiRes = await fetch(fallbackEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(geminiPayload),
      });
    }

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      let cleanErrorMessage = `خطأ في خادم Gemini (${geminiRes.status})`;

      try {
        const parsed = JSON.parse(errText);
        if (parsed.error?.message) {
          cleanErrorMessage = parsed.error.message;
        }
      } catch {}

      // Scrub any sensitive key reflections
      cleanErrorMessage = cleanErrorMessage.replace(GEMINI_API_KEY, "[REDACTED]");

      if (geminiRes.status === 400 && cleanErrorMessage.toLowerCase().includes("api key not valid")) {
        cleanErrorMessage = "مفتاح Gemini API غير صالح أو لم يتم تفعيله في Google AI Studio. يرجى مراجعة السر GEMINI_API_KEY.";
      } else if (geminiRes.status === 429) {
        cleanErrorMessage = "تم تجاوز حد استهلاك Gemini مؤقتاً، يرجى المحاولة بعد لحظات.";
      }

      console.error("[BossAssistant] Gemini API Error:", geminiRes.status, cleanErrorMessage);

      return new Response(
        JSON.stringify({ error: cleanErrorMessage }),
        { status: geminiRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 9. Forward SSE Stream Directly to Client
    return new Response(geminiRes.body, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("[BossAssistant] Unhandled error:", errorMsg);
    return new Response(
      JSON.stringify({ error: `حدث خطأ أثناء معالجة الطلب: ${errorMsg}` }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
