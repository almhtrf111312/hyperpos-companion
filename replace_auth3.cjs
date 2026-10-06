const fs = require('fs');
let content = fs.readFileSync('src/hooks/use-auth.tsx', 'utf8');

// 1. Remove cacheSession(null) from attemptDeviceAutoLogin failure
content = content.replace(
  `const autoLoginSuccess = await attemptDeviceAutoLogin();
        if (!autoLoginSuccess) {
          setIsLoading(false);
          cacheSession(null);
        }`,
  `const autoLoginSuccess = await attemptDeviceAutoLogin();
        if (!autoLoginSuccess) {
          setIsLoading(false);
          // Strict Offline-First: never clear session here
        }`
);

// 2. Fix onAuthStateChange
content = content.replace(
  `const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {`,
  `const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        // Strict Offline-First: If supabase reports no session but we have a cache, ignore the empty session event
        if (!currentSession?.user && getCachedSession() && event !== 'SIGNED_OUT') {
          return;
        }`
);

content = content.replace(
  `} else {
          setProfile(null);
          setIsLoading(false);
        }`,
  `} else {
          setProfile(null);
          if (!getCachedSession()) {
            setIsLoading(false);
          }
        }`
);

content = content.replace(
  `if (event === 'SIGNED_OUT') {
          cacheSession(null);
        }`,
  `if (event === 'SIGNED_OUT') {
          // Explicitly keeping this for actual sign outs. But if triggered by timeout, we don't clear it.
          // Since signOut clears cache directly, we don't rely on this event anymore.
        }`
);

// 3. Set user, session and isLoading based on cache
content = content.replace(
  `const cachedData = getCachedSession();
    if (cachedData && getStayLoggedInPreference()) {
      setUser(cachedData.user);
    }`,
  `const cachedData = getCachedSession();
    if (cachedData && getStayLoggedInPreference()) {
      setUser(cachedData.user);
      setSession(cachedData as unknown as Session);
      setIsLoading(false);
    }`
);

// 4. Update the user verification to never sign out on failure
const verifyBlockStr = `        if (userError || !currentUser) {
          const isNetworkError = userError?.message?.includes('fetch') || 
                                 userError?.message?.includes('network') ||
                                 userError?.message?.includes('Failed') ||
                                 userError?.message?.includes('timeout') ||
                                 userError?.message?.includes('abort');
          
          if (isNetworkError) {
            console.log('[Auth] Network timeout or error verifying user, keeping existing session');
            return;
          }
          
          // User genuinely doesn't exist anymore on server
          console.log('User from session does not exist, signing out...');
          await supabase.auth.signOut();
          cacheSession(null);
          setUser(null);
          setSession(null);
          return;
        }`;

const verifyBlockNewStr = `        if (userError || !currentUser) {
          console.log('[Auth] Error verifying user in background, trusting existing local session. Error:', userError?.message);
          // Strict Offline-First: Never sign out or clear session on background user check failure
          return;
        }`;
        
if(content.includes(verifyBlockStr)) {
    content = content.replace(verifyBlockStr, verifyBlockNewStr);
} else {
    console.log("verify block not found exactly as requested!");
}

fs.writeFileSync('src/hooks/use-auth.tsx', content);
console.log('Replacements done');
