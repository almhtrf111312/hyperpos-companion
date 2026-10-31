const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const v = require(path.join(root, 'version.json'));
const changelog = require(path.join(root, 'public/changelog.json'));

const entry = (Array.isArray(changelog) ? changelog : []).find(
  (e) => Number(e.versionCode ?? e.build) === Number(v.versionCode)
) || changelog[0] || {};

const INTERNAL = /boss|github|public-release|telegram|بوت|bot|فرع|خادم|server|sql|rpc|build|commit|سكربت|workflow/i;
const clean = (arr) => (arr || []).map(String).filter((x) => x.trim() && !INTERNAL.test(x));

const pub = entry.public || { new: clean(entry.changes) };
const sections = [
  ['✨ جديد', clean(pub.new)],
  ['⚡ تحسينات', clean(pub.improved)],
  ['🛠️ إصلاحات', clean(pub.fixed)],
].filter(([, items]) => items.length);

let text = `🚀 تحديث جديد - Flow POS Pro\n🏷️ الإصدار v${v.versionName} (Build ${v.versionCode})`;
for (const [title, items] of sections) text += `\n\n${title}:\n` + items.map((x) => '• ' + x).join('\n');
process.stdout.write(text);
