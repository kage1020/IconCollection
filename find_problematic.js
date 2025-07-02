const fs = require('fs');
const { locate } = require('@iconify/json');

// Look for icons with elements not covered by modifySvg
const collections = JSON.parse(fs.readFileSync('node_modules/@iconify/json/collections.json', 'utf8'));
const problematicElements = new Set();
let count = 0;
const maxCheck = 10;

for (const [lib, value] of Object.entries(collections)) {
  if (count >= maxCheck) break;
  count++;
  console.log(`Checking ${lib}: ${value.name}`);
  
  try {
    const icons = JSON.parse(fs.readFileSync(locate(lib), 'utf8'));
    let iconCount = 0;
    for (const [key, icon] of Object.entries(icons.icons)) {
      if (iconCount > 50) break; // limit per collection
      iconCount++;
      
      if (!icon.body) continue;
      
      // Check for fill="currentColor" on elements other than path, g, rect
      if (icon.body.includes('fill="currentColor"')) {
        const body = icon.body;
        
        // Find all elements with fill="currentColor"
        const regex = /<(\w+)[^>]*fill="currentColor"/g;
        let match;
        while ((match = regex.exec(body)) !== null) {
          const elementType = match[1];
          if (!['path', 'g', 'rect'].includes(elementType)) {
            problematicElements.add(elementType);
            console.log(`  ${lib}/${key}: ${elementType} with fill="currentColor"`);
          }
        }
      }
      
      // Check for stroke="currentColor" on elements other than path, g, rect
      if (icon.body.includes('stroke="currentColor"')) {
        const body = icon.body;
        
        // Find all elements with stroke="currentColor"
        const regex = /<(\w+)[^>]*stroke="currentColor"/g;
        let match;
        while ((match = regex.exec(body)) !== null) {
          const elementType = match[1];
          if (!['path', 'g', 'rect'].includes(elementType)) {
            problematicElements.add(elementType);
            console.log(`  ${lib}/${key}: ${elementType} with stroke="currentColor"`);
          }
        }
      }
    }
  } catch (e) {
    console.log(`Error reading ${lib}:`, e.message);
  }
}

console.log('\nProblematic elements found:', Array.from(problematicElements));