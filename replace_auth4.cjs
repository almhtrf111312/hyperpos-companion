const fs = require('fs');
let content = fs.readFileSync('src/hooks/use-auth.tsx', 'utf8');

const regex = /if \(userError \|\| !currentUser\) \{[\s\S]*?await supabase\.auth\.signOut\(\);[\s\S]*?cacheSession\(null\);[\s\S]*?setUser\(null\);[\s\S]*?setSession\(null\);[\s\S]*?return;\s*\}/;

const newStr = `if (userError || !currentUser) {
          console.log('[Auth] Error verifying user in background, trusting existing local session. Error:', userError?.message);
          // Strict Offline-First: Never sign out or clear session on background user check failure
          return;
        }`;

if (regex.test(content)) {
    content = content.replace(regex, newStr);
    fs.writeFileSync('src/hooks/use-auth.tsx', content);
    console.log('Regex matched and replaced');
} else {
    console.log('Regex did not match!');
}
