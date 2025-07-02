const fs = require('fs');
const { locate } = require('@iconify/json');

// Search more comprehensively for all SVG elements with currentColor
const collections = JSON.parse(fs.readFileSync('node_modules/@iconify/json/collections.json', 'utf8'));
const fillElements = new Set();
const strokeElements = new Set();
let totalIcons = 0;
let collectionsChecked = 0;
const maxCollections = 30; // Check more collections

for (const [lib, value] of Object.entries(collections)) {
  if (collectionsChecked >= maxCollections) break;
  collectionsChecked++;
  
  console.log(`Checking ${lib}: ${value.name}`);
  
  try {
    const icons = JSON.parse(fs.readFileSync(locate(lib), 'utf8'));
    let iconCount = 0;
    const maxIconsPerCollection = 200;
    
    for (const [key, icon] of Object.entries(icons.icons)) {
      if (iconCount >= maxIconsPerCollection) break;
      iconCount++;
      totalIcons++;
      
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

console.log(`\nChecked ${collectionsChecked} collections with ${totalIcons} total icons`);

console.log('\nElements with fill="currentColor":');
const fillElementsArray = Array.from(fillElements).sort();
fillElementsArray.forEach(el => console.log(` - ${el}`));

console.log('\nElements with stroke="currentColor":');
const strokeElementsArray = Array.from(strokeElements).sort();
strokeElementsArray.forEach(el => console.log(` - ${el}`));

console.log('\nCurrently handled by modifySvg: path, g, rect, circle, ellipse');
const unhandledFill = fillElementsArray.filter(el => !['path', 'g', 'rect', 'circle', 'ellipse'].includes(el));
const unhandledStroke = strokeElementsArray.filter(el => !['path', 'g', 'rect', 'circle', 'ellipse'].includes(el));

console.log('\nRemaining unhandled fill elements:', unhandledFill);
console.log('Remaining unhandled stroke elements:', unhandledStroke);

if (unhandledFill.length === 0 && unhandledStroke.length === 0) {
  console.log('\n✓ All SVG elements with currentColor are now handled!');
} else {
  console.log('\n⚠ There are still unhandled elements that may need support');
}