# تفعيل ربط واستعادة الحساب عبر Telegram

The explanation you pasted has not been checked yet. The first step is to check what actually exists, then finish only what is missing.

## 1. Check the current state (first step)
- Check that the database has the `telegram_chat_id` column on profiles and the `auth_recovery_codes` table, with security rules turned on.
- Check whether the `telegram-auth` server function is live, and read its logs for the error behind "تعذر الاتصال بخدمة تيليغرام".
- Check whether the bot details have been saved.

## 2. Fill in whatever is missing
- **Database:** if the column or table is missing, I add them myself, with security rules. You will not need to run any SQL.
- **Server function:** I publish `telegram-auth` from inside the project. You do not need the command line.
- **Bot connection:** Lovable has a built-in Telegram connector, so you don't have to paste the token by hand. A card will appear for you to link your bot (you get the token from BotFather once). I will only save the bot's username (without @) if the code needs it.
- **Bot address (Webhook):** I register it automatically through the connector, using a secret key that blocks fake requests. You don't need to open any link with your token in it.

## 3. Test
- Send a test message and check that the bot replies, and that phone sharing links the account.
- Run the recovery flow from the sign-in screen and confirm the code arrives and the password changes.
- Make sure the error message shows the real reason (for example "number not linked") and not only the general fallback message.

## 4. Record the change
- Bump the app version and add an entry to the changelog.

## Technical details
- Change the function to call Telegram through the connector gateway (`connector-gateway.lovable.dev/telegram`) with `LOVABLE_API_KEY` + `TELEGRAM_API_KEY`, and remove the direct use of `TELEGRAM_BOT_TOKEN`.
- Check the `X-Telegram-Bot-Api-Secret-Token` header with a value derived from the connection key, using `setWebhook` with `secret_token`.
- `verify_jwt = false` is already set for `telegram-auth` in config.toml.
- Recovery codes: hashed, expire, single-use, with a limit on attempts.
