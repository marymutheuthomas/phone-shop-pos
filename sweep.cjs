const fs = require('fs');
const path = require('path');

const UI_BUTTON = 'bg-purple-600 text-white min-h-[56px] md:min-h-[64px] px-8 rounded-full font-bold uppercase tracking-widest hover:scale-105 transition-all';
const UI_INPUT = 'w-full min-h-[56px] bg-slate-50 border border-slate-200 rounded-xl px-4 focus:ring-2 focus:ring-purple-600/20 focus:border-purple-600 outline-none transition-all';
const UI_CARD_FORM = 'bg-white border border-slate-200 border-t-4 border-t-purple-600 rounded-2xl shadow-sm p-6 md:p-8';
const UI_CARD_ALERT = 'bg-amber-900/5 border border-amber-500/20 border-t-4 border-t-amber-500 rounded-2xl shadow-sm p-6 md:p-8';

function processDirectory(dir) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processDirectory(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      
      // 1. Buttons
      content = content.replace(/className=[\"'\`]btn-primary[^\"'\`]*[\"'\`]/g, `className="${UI_BUTTON}"`);
      
      // 2. Inputs (input-field)
      content = content.replace(/className=[\"'\`]input-field[^\"'\`]*[\"'\`]/g, `className="${UI_INPUT}"`);
      
      // 3. Panels
      content = content.replace(/className=[\"'\`][^\"'\`]*card-panel[^\"'\`]*[\"'\`]/g, (match) => {
          if (match.includes('bg-danger') || match.includes('border-dashed')) return `className="${UI_CARD_ALERT} mb-6"`;
          return `className="${UI_CARD_FORM}"`;
      });
      content = content.replace(/className=[\"'\`][^\"'\`]*glass-panel[^\"'\`]*[\"'\`]/g, `className="${UI_CARD_FORM}"`);
      
      // Specific cleanup for Login.tsx explicit styles
      if (fullPath.includes('Login.tsx')) {
        content = content.replace(/style=\{\{\s*minHeight:\s*'100vh'.*?\}\}/g, 'className="bg-slate-50 min-h-screen flex items-center justify-center p-6"');
        content = content.replace(/<div style=\{\{\s*width:\s*'100%'.*?\}\}>/g, '<div className="w-full max-w-md">');
        content = content.replace(/style=\{\{.*?var\(--space-xl\).*?\}\}/g, '');
      }

      fs.writeFileSync(fullPath, content, 'utf8');
    }
  });
}

processDirectory('./src');
console.log('Sweep completed on source files');
