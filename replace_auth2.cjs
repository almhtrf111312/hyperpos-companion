const fs = require('fs');
let content = fs.readFileSync('src/hooks/use-auth.tsx', 'utf8');

// 1. Remove cacheSession(null) from attemptDeviceAutoLogin failure
content = content.replace(
  /const autoLoginSuccess = await attemptDeviceAutoLogin\(\);\s*if \(!autoLoginSuccess\) \{\s*setIsLoading\(false\);\s*cacheSession\(null\);\s*\}/,
  `const autoLoginSuccess = await attemptDeviceAutoLogin();
        if (!autoLoginSuccess) {
          setIsLoading(false);
          // Strict Offline-First: never clear session here
        }`
);

// 2. Fix onAuthStateChange
content = content.replace(
  /const \{ data: \{ subscription \} \} = supabase\.auth\.onAuthStateChange\(\s*async \(event, currentSession\) => \{/,
  `const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        // Strict Offline-First: If supabase reports no session but we have a cache, ignore the empty session event
        if (!currentSession?.user && getCachedSession() && event !== 'SIGNED_OUT') {
          return;
        }`
);

content = content.replace(
  /\} else \{\s*setProfile\(null\);\s*setIsLoading\(false\);\s*\}/,
  `} else {
          setProfile(null);
          if (!getCachedSession()) {
            setIsLoading(false);
          }
        }`
);

content = content.replace(
  /if \(event === 'SIGNED_OUT'\) \{\s*cacheSession\(null\);\s*\}/,
  `if (event === 'SIGNED_OUT') {
          // Explicitly keeping this for actual sign outs. But if triggered by timeout, we don't clear it.
          // Since signOut clears cache directly, we don't rely on this event anymore.
        }`
);

// 3. Set user, session and isLoading based on cache
content = content.replace(
  /const cachedData = getCachedSession\(\);\s*if \(cachedData && getStayLoggedInPreference\(\)\) \{\s*setUser\(cachedData\.user\);\s*\}/,
  `const cachedData = getCachedSession();
    if (cachedData && getStayLoggedInPreference()) {
      setUser(cachedData.user);
      setSession(cachedData);
      setIsLoading(false);
    }`
);

// 4. Update the user verification to never sign out on failure
content = content.replace(
  /        if \(userError \|\| !currentUser\) \{([\s\S]*?)return;\s*\}/,
  `        if (userError || !currentUser) {
          console.log('[Auth] Error verifying user in background, trusting existing local session. Error:', userError?.message);
          // Strict Offline-First: Never sign out or clear session on background user check failure
          return;
        }`
);

fs.writeFileSync('src/hooks/use-auth.tsx', content);
console.log('Replacements done');
