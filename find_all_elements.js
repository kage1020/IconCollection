const fs = require('fs');
const { locate } = require('@iconify/json');

// Look for all SVG elements with fill="currentColor" or stroke="currentColor"
const collections = JSON.parse(fs.readFileSync('node_modules/@iconify/json/collections.json', 'utf8'));
const fillElements = new Set();
const strokeElements = new Set();
let count = 0;
const maxCheck = 15;

for (const [lib, value] of Object.entries(collections)) {
  if (count >= maxCheck) break;
  count++;
  console.log(`Checking ${lib}: ${value.name}`);
  
  try {
    const icons = JSON.parse(fs.readFileSync(locate(lib), 'utf8'));
    let iconCount = 0;
    for (const [key, icon] of Object.entries(icons.icons)) {
      if (iconCount > 100) break; // limit per collection
      iconCount++;
      
      if (!icon.body) continue;
      
      // Check for fill="currentColor"
      if (icon.body.includes('fill="currentColor"')) {
        const regex = /<(\w+)[^>]*fill="currentColor"/g;
        let match;
        while ((match = regex.exec(icon.body)) !== null) {
          fillElements.add(match[1]);
        }
      }
      
      // Check for stroke="currentColor" 
      if (icon.body.includes('stroke="currentColor"')) {
        const regex = /<(\w+)[^>]*stroke="currentColor"/g;
        let match;
        while ((match = regex.exec(icon.body)) !== null) {
          strokeElements.add(match[1]);
        }
      }
    }
  } catch (e) {
    console.log(`Error reading ${lib}:`, e.message);
  }
}

console.log('\nElements with fill="currentColor":');
Array.from(fillElements).sort().forEach(el => console.log(` - ${el}`));

console.log('\nElements with stroke="currentColor":');
Array.from(strokeElements).sort().forEach(el => console.log(` - ${el}`));

console.log('\nCurrently handled by modifySvg: path, g, rect');
const unhandledFill = Array.from(fillElements).filter(el => !['path', 'g', 'rect'].includes(el));
const unhandledStroke = Array.from(strokeElements).filter(el => !['path', 'g', 'rect'].includes(el));

console.log('\nUnhandled fill elements:', unhandledFill);
console.log('Unhandled stroke elements:', unhandledStroke);