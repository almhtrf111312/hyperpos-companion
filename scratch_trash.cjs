const fs = require('fs');
let path = 'src/components/pos/CartPanel.tsx';
let code = fs.readFileSync(path, 'utf8');

const regexTrash = /<button[\s\S]*?onClick=\{\(\) => onRemoveItem\(item\.id, item\.unit\)\}[\s\S]*?<Trash2 className="w-3\.5 h-3\.5" \/>[\s\S]*?<\/button>/;
const newTrash = `{/* زر حذف مكبّر ومريح للمس السريع */}
                <button
                  type="button"
                  onClick={() => onRemoveItem(item.id, item.unit)}
                  className="w-8 h-8 rounded-lg text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 flex items-center justify-center shrink-0 transition-all active:scale-90"
                  title="حذف من السلة"
                >
                  <Trash2 className="w-4 h-4" />
                </button>`;
code = code.replace(regexTrash, newTrash);
fs.writeFileSync(path, code);
console.log('Trash fixed!');
