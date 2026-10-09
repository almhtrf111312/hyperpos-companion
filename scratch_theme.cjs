const fs = require('fs');
let path = 'src/hooks/use-theme.tsx';
let code = fs.readFileSync(path, 'utf8');

const regexApplyBlur = /function applyBlurTheme\([\s\S]*?\}\s*\}/;
const newApplyBlur = `function applyBlurTheme(enabled: boolean, mode: ThemeMode, transparency: number = 0) {
  const root = document.documentElement;
  if (enabled && transparency > 0) {
    root.classList.add('blur-theme');
    
    // حساب الألفا بطريقة غير مقيدة، مع دعم الشفافية القوية جداً عند 90% و 100%
    let alpha = (100 - transparency) / 100;
    if (transparency >= 100) alpha = 0.05;
    else if (transparency >= 90) alpha = 0.08;
    
    root.style.setProperty('--glass-opacity', \`\${alpha}\`);
    root.style.setProperty('--glass-bg', mode === 'dark' ? \`rgba(18, 18, 18, \${alpha})\` : \`rgba(255, 255, 255, \${alpha})\`);
    
    // رفع درجة التعتيم تدريجياً لتصل إلى 28px عند الشفافية القصوى للحفاظ على وضوح النصوص
    const blurPx = Math.min(28, 8 + (transparency / 100) * 20);
    root.style.setProperty('--blur-intensity', \`\${blurPx}px\`);

    if (mode === 'dark') {
      root.style.setProperty('--glass-border', \`rgba(255, 255, 255, 0.18)\`);
      root.style.setProperty('--glass-highlight', \`rgba(255, 255, 255, 0.08)\`);
      root.style.setProperty('--glass-shadow', \`0 8px 32px rgba(0, 0, 0, 0.35)\`);
    } else {
      root.style.setProperty('--glass-border', \`rgba(0, 0, 0, 0.12)\`);
      root.style.setProperty('--glass-highlight', \`rgba(255, 255, 255, 0.4)\`);
      root.style.setProperty('--glass-shadow', \`0 8px 32px rgba(0, 0, 0, 0.08)\`);
    }
    root.style.setProperty('--glass-inset-shadow', mode === 'dark' 
      ? 'inset 0 1px 1px rgba(255, 255, 255, 0.1)' 
      : 'inset 0 1px 1px rgba(255, 255, 255, 0.5)'
    );
  } else {
    root.classList.remove('blur-theme');
    root.style.removeProperty('--glass-opacity');
    root.style.removeProperty('--glass-bg');
    root.style.removeProperty('--blur-intensity');
    root.style.removeProperty('--glass-border');
    root.style.removeProperty('--glass-highlight');
    root.style.removeProperty('--glass-shadow');
    root.style.removeProperty('--glass-inset-shadow');
  }
}`;

code = code.replace(regexApplyBlur, newApplyBlur);
fs.writeFileSync(path, code);
console.log('use-theme updated!');
