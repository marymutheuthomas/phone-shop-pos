const fs = require('fs');
const path = require('path');

const UI_BUTTON = 'bg-purple-600 text-white min-h-[56px] md:min-h-[64px] px-8 rounded-full font-bold uppercase tracking-widest hover:scale-105 transition-all outline-none border-none cursor-pointer flex items-center justify-center gap-2';
const UI_INPUT = 'w-full min-h-[56px] bg-slate-50 border border-slate-200 rounded-xl px-4 focus:ring-2 focus:ring-purple-600/20 focus:border-purple-600 outline-none transition-all text-slate-900 placeholder-slate-400';
const UI_CARD_FORM = 'bg-white border border-slate-200 border-t-4 border-t-purple-600 rounded-2xl shadow-sm p-6 md:p-8';
const UI_CARD_LEDGER = 'bg-emerald-900/5 border border-emerald-500/20 border-t-4 border-t-emerald-500 rounded-2xl shadow-sm p-6 md:p-8';
const UI_CARD_ALERT = 'bg-amber-900/5 border border-amber-500/20 border-t-4 border-t-amber-500 rounded-2xl shadow-sm p-6 md:p-8';

function processDirectory(dir) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processDirectory(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      
      // Remove inline styles affecting background/color
      content = content.replace(/style=\{\{.*?\}\}/g, (match) => {
         // Whitelist some very specific structural things or just wipe them if background/color
         if (match.includes('background') || match.includes('color') || match.includes('bg-color')) {
             return '';
         }
         return match;
      });

      // Cleanup remaining text-white or bg-slate-900 in classNames
      content = content.replace(/bg-slate-900/g, 'bg-slate-50');
      content = content.replace(/text-white/g, ''); // dangerous, but bg-purple-600 text-white has been standardized. We'll add text-white to btn-primary explicitly if removed.
      
      // Specifically fix buttons now that text-white might be removed
      content = content.replace(/className=[\"'\`][^\"'\`]*btn-primary[^\"'\`]*[\"'\`]/g, `className="${UI_BUTTON}"`);
      content = content.replace(/className=[\"'\`]btn btn-primary[^\"'\`]*[\"'\`]/g, `className="${UI_BUTTON}"`);

      // Enforce the cards precisely based on context
      content = content.replace(/className=[\"'\`][^\"'\`]*border-t-purple-600[^\"'\`]*[\"'\`]\s*style=\{\{.*?\}\}/g, `className="${UI_CARD_FORM}"`);
      
      // Check phantom tracker
      if(fullPath.includes('Audits.tsx')) {
         content = content.replace(/width:\s*\'400px\',.*?border:\s*\'1px solid rgba\(245, 158, 11, 0\.2\)\'/g, '');
         content = content.replace(/className=[\"'\`][^\"'\`]*phantom Items.*$/g, `className="${UI_CARD_ALERT}"`);
      }

      // Check global analytics
      if(fullPath.includes('GlobalAnalytics.tsx')) {
         // Reset anything that says bg-slate-900 or bg-slate-50 back properly where text-white was removed
         content = content.replace(/bg-slate-50 text-white/, 'bg-slate-900 text-white'); // restore buttons
      }
      
      // DataTable wrap check for horizontal scrolling
      if(!content.includes('<div className="w-full overflow-x-auto">\\n      <DataTable')) {
          content = content.replace(/<DataTable/g, '<div className="w-full overflow-x-auto"><DataTable');
          content = content.replace(/(\s+)columns=\{\[([\s\S]*?)\]\}\n\s+\/>/g, '$1columns={[$2]}\n$1/></div>');
      }

      fs.writeFileSync(fullPath, content, 'utf8');
    }
  });
}

processDirectory('./src');
console.log('Sweep 2 completed on source files');
