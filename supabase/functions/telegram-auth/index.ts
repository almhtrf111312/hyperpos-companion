import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

// Phone normalization helper
function cleanDigits(phone: string): string {
  return phone.replace(/\D/g, "");
}

function isPhoneMatch(p1: string | null | undefined, p2: string | null | undefined): boolean {
  if (!p1 || !p2) return false;
  const c1 = cleanDigits(p1);
  const c2 = cleanDigits(p2);
  if (!c1 || !c2) return false;
  if (c1 === c2) return true;
  if (c1.replace(/^0+/, "") === c2.replace(/^0+/, "")) return true;
  if (c1.length >= 9 && c2.length >= 9 && c1.slice(-9) === c2.slice(-9)) {
    return true;
  }
  return false;
}

// SHA-256 hash helper
async function sha256(text: string): Promise<string> {
  const msgUint8 = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256b64url(text: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return btoa(String.fromCharCode(...new Uint8Array(d))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

// Telegram message sender
async function sendTelegramMessage(
  botToken: string,
  chatId: string | number,
  text: string,
  replyMarkup?: any
) {
  const url = `https://connector-gateway.lovable.dev/telegram/sendMessage`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${Deno.env.get("LOVABLE_API_KEY") ?? ""}`,
        "X-Connection-Api-Key": botToken,
      },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "Markdown",
        reply_markup: replyMarkup,
      }),
    });
    return await res.json();
  } catch (err) {
    console.error("[TelegramAuth] Error sending Telegram message:", err);
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const botToken = Deno.env.get("TELEGRAM_API_KEY");
  const botUsername = Deno.env.get("TELEGRAM_BOT_USERNAME") || "flowpos_helper_bot";

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    console.error("[TelegramAuth] Missing Supabase configuration");
    return new Response(
      JSON.stringify({ error: "خطأ في تهيئة خادم Supabase الداخلي" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const serviceClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const body = await req.json().catch(() => ({}));

    // =========================================================================
    // 1. TELEGRAM WEBHOOK HANDLER
    // Detect incoming Telegram updates (has update_id and message/callback_query)
    // =========================================================================
    if (body.update_id !== undefined || body.message !== undefined) {
      if (!botToken) {
        console.error("[TelegramAuth] TELEGRAM_BOT_TOKEN is missing for webhook");
        return new Response("Bot token not configured", { status: 500 });
      }
      const expected = (await sha256b64url(`telegram-webhook:${botToken}`));
      if (req.headers.get("X-Telegram-Bot-Api-Secret-Token") !== expected) {
        return new Response("Unauthorized", { status: 401 });
      }

      const message = body.message;
      if (!message) {
        return new Response("OK", { status: 200 });
      }

      const chatId = message.chat?.id;
      const fromId = message.from?.id;

      // Case A: /start command
      if (typeof message.text === "string" && message.text.startsWith("/start")) {
        console.log(`[TelegramAuth] Received /start from chat ${chatId}`);
        await sendTelegramMessage(
          botToken,
          chatId,
          "👋 مرحباً بك في بوت التحقق واستعادة الحساب لنظام *Flow POS Pro*.\n\n📱 للتحقق من هويتك وربط حسابك بالنظام، يرجى الضغط على زر *«مشاركة رقم الهاتف للتحقق»* أدناه:",
          {
            keyboard: [
              [{ text: "📱 مشاركة رقم الهاتف للتحقق", request_contact: true }],
            ],
            resize_keyboard: true,
            one_time_keyboard: true,
          }
        );
        return new Response("OK", { status: 200 });
      }

      // Case B: User shared contact
      if (message.contact) {
        const contact = message.contact;
        console.log(`[TelegramAuth] Contact received from chat ${chatId}:`, {
          contactUserId: contact.user_id,
          fromId: fromId,
          phone: contact.phone_number,
        });

        // 1. CRITICAL SECURITY CHECK: contact.user_id must equal message.from.id
        if (contact.user_id && fromId && contact.user_id !== fromId) {
          console.warn(`[TelegramAuth] Security alert: contact.user_id (${contact.user_id}) !== fromId (${fromId})`);
          await sendTelegramMessage(
            botToken,
            chatId,
            "⚠️ *تنبيه أمني مشدد*:\n\nيجب مشاركة رقم هاتفك الحقيقي والخاص بهذا الحساب. لا يُسمح بإرسال جهة اتصال شخص آخر لأسباب أمنية.",
            {
              keyboard: [
                [{ text: "📱 مشاركة رقم الهاتف للتحقق", request_contact: true }],
              ],
              resize_keyboard: true,
              one_time_keyboard: true,
            }
          );
          return new Response("OK", { status: 200 });
        }

        const rawPhone = contact.phone_number || "";

        // 2. Query profiles to match phone
        const { data: profiles, error: profErr } = await serviceClient
          .from("profiles")
          .select("id, user_id, phone, full_name");

        if (profErr) {
          console.error("[TelegramAuth] Error querying profiles:", profErr);
        }

        const matchedProfile = (profiles || []).find((p: any) =>
          isPhoneMatch(p.phone, rawPhone)
        );

        if (matchedProfile) {
          console.log(`[TelegramAuth] Match found for user ${matchedProfile.user_id} (${matchedProfile.full_name})`);
          const chatIdStr = chatId.toString();

          // Save telegram_chat_id in profiles
          const { error: updateProfErr } = await serviceClient
            .from("profiles")
            .update({ telegram_chat_id: chatIdStr })
            .eq("user_id", matchedProfile.user_id);

          if (updateProfErr) {
            console.warn("[TelegramAuth] Note: profiles.telegram_chat_id update result:", updateProfErr.message);
          }

          // Also save in user_metadata for resilience
          try {
            await serviceClient.auth.admin.updateUserById(matchedProfile.user_id, {
              user_metadata: { telegram_chat_id: chatIdStr },
            });
          } catch (metaErr) {
            console.warn("[TelegramAuth] Warning updating user_metadata:", metaErr);
          }

          const userName = matchedProfile.full_name || "مستخدم النظام";
          await sendTelegramMessage(
            botToken,
            chatId,
            `✅ *تم ربط حسابك بنجاح!*\n\nأهلاً بك يا *${userName}* في نظام *Flow POS Pro*.\n\nتم اعتماد هذا الحساب لاستلام رموز استعادة كلمة المرور والتنبيهات الأمنية لحسابك بنجاح.`,
            { remove_keyboard: true }
          );
        } else {
          console.log(`[TelegramAuth] No profile matched for phone: ${rawPhone}`);
          await sendTelegramMessage(
            botToken,
            chatId,
            `❌ *لم يتم العثور على حساب مسجل بهذا الرقم* (\`${rawPhone}\`).\n\nيرجى التأكد من تسجيل رقم هاتفك داخل ملفك الشخصي في نظام Flow POS Pro، أو التواصل مع مدير النظام لتحديث رقم هاتفك.`,
            { remove_keyboard: true }
          );
        }

        return new Response("OK", { status: 200 });
      }

      // Default reply for any other text
      await sendTelegramMessage(
        botToken,
        chatId,
        "مرحباً بك! لاستخدام هذا البوت للتحقق واستعادة كلمة المرور، يرجى إرسال الأمر /start ثم الضغط على زر مشاركة رقم الهاتف."
      );
      return new Response("OK", { status: 200 });
    }

    // =========================================================================
    // 2. CLIENT API ENDPOINTS
    // =========================================================================
    const action = body.action;

    // --- Action: get_bot_info ---
    if (action === "get_bot_info") {
      return new Response(
        JSON.stringify({
          bot_username: botUsername,
          bot_link: `https://t.me/${botUsername}`,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // --- Action: request_otp ---
    if (action === "request_otp") {
      const identifier = typeof body.identifier === "string" ? body.identifier.trim() : "";
      if (!identifier) {
        return new Response(
          JSON.stringify({ error: "يرجى إدخال البريد الإلكتروني أو رقم الهاتف المسجل" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!botToken) {
        return new Response(
          JSON.stringify({ error: "خدمة بوت تيليغرام غير مهيأة في الخادم (الاتصال بالبوت مفقود)" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      let targetUserId: string | null = null;
      let targetUserEmail: string | null = null;
      let targetUserName: string = "المستخدم";
      let telegramChatId: string | null = null;

      // A. If identifier is email
      if (identifier.includes("@")) {
        const { data: usersData, error: listErr } = await serviceClient.auth.admin.listUsers({
          page: 1,
          perPage: 1000,
        });

        if (listErr) {
          console.error("[TelegramAuth] listUsers error:", listErr);
        }

        const foundUser = (usersData?.users || []).find(
          (u) => u.email?.toLowerCase() === identifier.toLowerCase()
        );

        if (foundUser) {
          targetUserId = foundUser.id;
          targetUserEmail = foundUser.email || null;
          telegramChatId = (foundUser.user_metadata?.telegram_chat_id as string) || null;
        }
      }

      // B. If not found or identifier is phone, check profiles
      if (!targetUserId) {
        const { data: profiles, error: pErr } = await serviceClient
          .from("profiles")
          .select("id, user_id, phone, full_name, telegram_chat_id");

        if (pErr) {
          console.error("[TelegramAuth] profiles query error:", pErr);
        }

        const matched = (profiles || []).find((p: any) =>
          isPhoneMatch(p.phone, identifier)
        );

        if (matched) {
          targetUserId = matched.user_id;
          targetUserName = matched.full_name || targetUserName;
          telegramChatId = matched.telegram_chat_id || null;
        }
      }

      if (!targetUserId) {
        return new Response(
          JSON.stringify({ error: "لم يتم العثور على أي حساب مسجل بهذا البريد أو الهاتف" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // If telegramChatId wasn't found in profile, check user_metadata
      if (!telegramChatId) {
        try {
          const { data: uData } = await serviceClient.auth.admin.getUserById(targetUserId);
          if (uData?.user?.user_metadata?.telegram_chat_id) {
            telegramChatId = uData.user.user_metadata.telegram_chat_id;
          }
          if (uData?.user?.email) {
            targetUserEmail = uData.user.email;
          }
        } catch {}
      }

      // If still not linked to Telegram
      if (!telegramChatId) {
        return new Response(
          JSON.stringify({
            error: "حسابك غير مربوط ببوت تيليغرام حتى الآن. يرجى فتح البوت أولاً ومشاركة رقم هاتفك للربط.",
            not_linked: true,
            bot_username: botUsername,
            bot_link: `https://t.me/${botUsername}`,
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Generate 6-digit OTP code
      const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
      const codeHash = await sha256(otpCode);
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes

      // Store in auth_recovery_codes
      try {
        await serviceClient.from("auth_recovery_codes").delete().eq("user_id", targetUserId);
        const { error: insErr } = await serviceClient.from("auth_recovery_codes").insert({
          user_id: targetUserId,
          code_hash: codeHash,
          attempts: 0,
          expires_at: expiresAt,
        });

        if (insErr) {
          console.warn("[TelegramAuth] Note inserting auth_recovery_codes:", insErr.message);
          // Fallback to user_metadata if table is missing or restricted
          await serviceClient.auth.admin.updateUserById(targetUserId, {
            user_metadata: {
              recovery_code_hash: codeHash,
              recovery_expires_at: expiresAt,
              recovery_attempts: 0,
            },
          });
        }
      } catch (storeErr) {
        console.error("[TelegramAuth] Error storing recovery code:", storeErr);
      }

      // Send code via Telegram
      const otpMessage = `🔐 *رمز استعادة كلمة المرور*\n\nالرمز الخاص بحسابك في *Flow POS Pro* هو:\n\n\`${otpCode}\`\n\n⏳ هذا الرمز صالح لمدة *10 دقائق* فقط.\n⚠️ *تحذير أمني*: لا تشارك هذا الرمز مع أي شخص. موظفو Flow POS Pro لن يطلبوا منك هذا الرمز أبداً.`;

      const tgResult = await sendTelegramMessage(botToken, telegramChatId, otpMessage);
      console.log(`[TelegramAuth] OTP sent to Telegram chat ${telegramChatId}, result:`, tgResult?.ok);

      return new Response(
        JSON.stringify({
          success: true,
          message: "تم إرسال رمز التحقق إلى حسابك في تيليغرام بنجاح",
          identifier,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // --- Action: verify_and_reset ---
    if (action === "verify_and_reset") {
      const identifier = typeof body.identifier === "string" ? body.identifier.trim() : "";
      const code = typeof body.code === "string" ? body.code.trim() : "";
      const newPassword = typeof body.new_password === "string" ? body.new_password : "";

      if (!identifier || !code || !newPassword) {
        return new Response(
          JSON.stringify({ error: "جميع الحقول مطلوبة (البريد/الهاتف، الرمز، وكلمة المرور الجديدة)" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (code.length !== 6 || !/^\d{6}$/.test(code)) {
        return new Response(
          JSON.stringify({ error: "رمز التحقق يجب أن يتكون من 6 أرقام دقيقة" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (newPassword.length < 6) {
        return new Response(
          JSON.stringify({ error: "كلمة المرور الجديدة يجب أن تكون 6 خانات على الأقل" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Find user by identifier
      let targetUserId: string | null = null;
      let telegramChatId: string | null = null;

      if (identifier.includes("@")) {
        const { data: usersData } = await serviceClient.auth.admin.listUsers({
          page: 1,
          perPage: 1000,
        });
        const found = (usersData?.users || []).find(
          (u) => u.email?.toLowerCase() === identifier.toLowerCase()
        );
        if (found) {
          targetUserId = found.id;
          telegramChatId = (found.user_metadata?.telegram_chat_id as string) || null;
        }
      }

      if (!targetUserId) {
        const { data: profiles } = await serviceClient
          .from("profiles")
          .select("id, user_id, phone, telegram_chat_id");
        const matched = (profiles || []).find((p: any) =>
          isPhoneMatch(p.phone, identifier)
        );
        if (matched) {
          targetUserId = matched.user_id;
          telegramChatId = matched.telegram_chat_id || null;
        }
      }

      if (!targetUserId) {
        return new Response(
          JSON.stringify({ error: "الحساب غير موجود أو تم تغييره" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verify recovery code from table
      let validCode = false;
      const inputHash = await sha256(code);

      const { data: recData } = await serviceClient
        .from("auth_recovery_codes")
        .select("*")
        .eq("user_id", targetUserId)
        .maybeSingle();

      if (recData) {
        // Check expiration
        if (new Date(recData.expires_at).getTime() < Date.now()) {
          await serviceClient.from("auth_recovery_codes").delete().eq("user_id", targetUserId);
          return new Response(
            JSON.stringify({ error: "انتهت صلاحية رمز التحقق. يرجى طلب رمز جديد." }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Check attempts
        if ((recData.attempts || 0) >= 5) {
          await serviceClient.from("auth_recovery_codes").delete().eq("user_id", targetUserId);
          return new Response(
            JSON.stringify({ error: "تم تجاوز الحد الأقصى للمحاولات الخاطئة. تم إلغاء الرمز لأسباب أمنية." }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        if (recData.code_hash === inputHash) {
          validCode = true;
          // Delete used code
          await serviceClient.from("auth_recovery_codes").delete().eq("user_id", targetUserId);
        } else {
          // Increment attempts
          await serviceClient
            .from("auth_recovery_codes")
            .update({ attempts: (recData.attempts || 0) + 1 })
            .eq("id", recData.id);

          return new Response(
            JSON.stringify({ error: `رمز التحقق غير صحيح. تبقى لك ${4 - (recData.attempts || 0)} محاولات.` }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      } else {
        // Fallback check in user_metadata
        const { data: uData } = await serviceClient.auth.admin.getUserById(targetUserId);
        const meta = uData?.user?.user_metadata;
        if (meta?.recovery_code_hash) {
          if (new Date(meta.recovery_expires_at).getTime() < Date.now()) {
            return new Response(
              JSON.stringify({ error: "انتهت صلاحية رمز التحقق. يرجى طلب رمز جديد." }),
              { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          if (meta.recovery_code_hash === inputHash) {
            validCode = true;
            await serviceClient.auth.admin.updateUserById(targetUserId, {
              user_metadata: {
                recovery_code_hash: null,
                recovery_expires_at: null,
                recovery_attempts: null,
              },
            });
          }
        }
      }

      if (!validCode) {
        return new Response(
          JSON.stringify({ error: "رمز التحقق غير صحيح أو تم استخدامه مسبقاً" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Officially update password
      const { error: resetErr } = await serviceClient.auth.admin.updateUserById(targetUserId, {
        password: newPassword,
      });

      if (resetErr) {
        console.error("[TelegramAuth] Error updating password:", resetErr);
        return new Response(
          JSON.stringify({ error: `فشل تحديث كلمة المرور: ${resetErr.message}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Send security alert on Telegram
      if (botToken && telegramChatId) {
        const securityAlert = `🛡️ *تنبيه أمني - Flow POS Pro*\n\nتم تغيير كلمة المرور لحسابك بنجاح الآن (${new Date().toLocaleTimeString("ar-SA")}).\n\nإذا لم تكن أنت من قام بهذا التغيير، يرجى التواصل فوراً مع إدارة النظام لتأمين حسابك.`;
        await sendTelegramMessage(botToken, telegramChatId, securityAlert);
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: "تم تغيير كلمة المرور بنجاح! يمكنك الآن تسجيل الدخول بكلمة المرور الجديدة.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "إجراء غير معروف" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("[TelegramAuth] Unhandled error:", errorMsg);
    return new Response(
      JSON.stringify({ error: `حدث خطأ في معالجة الطلب: ${errorMsg}` }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
