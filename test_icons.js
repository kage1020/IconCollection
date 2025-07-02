const fs = require('fs');
const { locate } = require('@iconify/json');

// Look for icons with direct d attribute (not wrapped in path)
const collections = JSON.parse(fs.readFileSync('node_modules/@iconify/json/collections.json', 'utf8'));
let found = false;
let count = 0;

for (const [lib, value] of Object.entries(collections)) {
  if (found || count > 5) break; // limit search
  count++;
  console.log(`Checking ${lib}: ${value.name}`);
  
  try {
    const icons = JSON.parse(fs.readFileSync(locate(lib), 'utf8'));
    for (const [key, icon] of Object.entries(icons.icons)) {
      if (icon.body && icon.body.includes(' d=') && !icon.body.includes('<path')) {
        console.log('Found icon with direct d attribute:', lib, key);
        console.log('Body:', icon.body);
        found = true;
        break;
      }
      
      // Also check for fill="currentColor" that's not on path/g/rect
      if (icon.body && icon.body.includes('fill="currentColor"') && 
          !icon.body.includes('<path') && !icon.body.includes('<g') && !icon.body.includes('<rect')) {
        console.log('Found icon with fill="currentColor" not on supported element:', lib, key);
        console.log('Body:', icon.body);
        found = true;
        break;
      }
    }
  } catch (e) {
    console.log(`Error reading ${lib}:`, e.message);
  }
}

if (!found) {
  console.log('No problematic icons found in first few collections');
}