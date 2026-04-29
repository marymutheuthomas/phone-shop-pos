const fs = require('fs');
const path = require('path');

function processDirectory(dir) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processDirectory(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      
      // 1. Remove framer-motion components
      content = content.replace(/<motion\.([a-z]+)/g, '<$1');
      content = content.replace(/<\/motion\.([a-z]+)>/g, '</$1>');
      content = content.replace(/import.*?framer-motion['"];?\s*/g, '');
      
      // Remove framer-motion attributes
      content = content.replace(/\s(initial|animate|transition|whileHover|whileTap|variants|exit)=\{.*?\}/g, '');
      
      // 2. Remove inline styles
      content = content.replace(/style=\{\{.*?\}\}/g, '');

      // 3. Purge CSS from className=""
      content = content.replace(/className=[\"'\`]([^\`\"']+)[\"'\`]/g, (match, classes) => {
          let keep = classes.split(/\s+/).filter(cls => {
              // Structural prefixes we want to keep
              if (/^(flex|grid|flex-col|flex-row|items-|justify-|gap-|p\w?-|m\w?-|w-|h-|min-h-|max-w-|col-span-|grid-cols-|lg:|md:|sm:)/.test(cls)) {
                  // Make sure things like bg- inside them are still stripped if somehow prefixed, but wait, usually standard responsive modifiers exist like md:grid-cols-2.
                  // Just filter out standard decorative patterns even if they are prefixed
                  if (/(bg-|text-|border|shadow-|rounded-|ring-|hover:|transition|outline|cursor-|font-|tracking-|animate-|opacity-|backdrop-)/.test(cls)) {
                      return false;
                  }
                  return true;
              }
              // Specific exceptions that are structural
              if (['hidden', 'relative', 'absolute', 'inset-0', 'overflow-x-auto', 'overflow-hidden', 'overflow-y-auto'].includes(cls)) return true;
              return false;
          });
          if (keep.length === 0) return '';
          return `className="${keep.join(' ')}"`;
      });

      fs.writeFileSync(fullPath, content, 'utf8');
    }
  });
}

// Strip Global CSS
fs.writeFileSync(path.join(__dirname, 'src/index.css'), `
*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}
html, body, #root {
  height: 100%;
  font-family: sans-serif;
}
.app-container {
  display: flex;
  height: 100vh;
  width: 100%;
}
.sidebar {
  width: 250px;
  display: flex;
  flex-direction: column;
}
.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
`.trim(), 'utf8');

fs.writeFileSync(path.join(__dirname, 'src/App.css'), `/* Nuclear Reset */`, 'utf8');

processDirectory('./src');
console.log('Nuclear sweep completed');
