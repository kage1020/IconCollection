const fs = require('fs');
const { JSDOM } = require('jsdom');
const { locate } = require('@iconify/json');

// Get an icon with circle element
const icons = JSON.parse(fs.readFileSync(locate('ic'), 'utf8'));
const testIcon = icons.icons['baseline-brightness-1'];

console.log('Original icon body:', testIcon.body);

// Reproduce the current modifySvg function
const { document } = new JSDOM('<!DOCTYPE html><html><body></body></html>').window;

function createElementNS(elementType) {
  return document.createElementNS('http://www.w3.org/2000/svg', elementType);
}

function modifySvg(svgEl) {
  const parent = createElementNS('g');
  parent.innerHTML = svgEl;
  const pathFills = parent.querySelectorAll('path[fill="currentColor"]');
  const pathStrokes = parent.querySelectorAll('path[stroke="currentColor"]');
  const gFills = parent.querySelectorAll('g[fill="currentColor"]');
  const gStrokes = parent.querySelectorAll('g[stroke="currentColor"]');
  const rectFills = parent.querySelectorAll('rect[fill="currentColor"]');
  const rectStrokes = parent.querySelectorAll('rect[stroke="currentColor"]');

  console.log('Found elements:');
  console.log('- path fills:', pathFills.length);
  console.log('- path strokes:', pathStrokes.length);
  console.log('- g fills:', gFills.length);
  console.log('- g strokes:', gStrokes.length);
  console.log('- rect fills:', rectFills.length);
  console.log('- rect strokes:', rectStrokes.length);
  
  // Check what circle elements exist
  const circleFills = parent.querySelectorAll('circle[fill="currentColor"]');
  const circleStrokes = parent.querySelectorAll('circle[stroke="currentColor"]');
  console.log('- circle fills (NOT HANDLED):', circleFills.length);
  console.log('- circle strokes (NOT HANDLED):', circleStrokes.length);

  let counter = 0;
  const pathFillStyle = document.createElement('style');
  for (const path of pathFills) {
    path.classList.add(`p${counter}-fill`);
    pathFillStyle.innerHTML += `.p${counter}-fill{fill:currentColor}`;
    counter++;
  }
  if (pathFills.length > 0) parent.appendChild(pathFillStyle);
  
  const pathStrokeStyle = document.createElement('style');
  for (const path of pathStrokes) {
    path.classList.add(`p${counter}-stroke`);
    pathStrokeStyle.innerHTML += `.p${counter}-stroke{stroke:currentColor}`;
    counter++;
  }
  if (pathStrokes.length > 0) parent.appendChild(pathStrokeStyle);
  
  counter = 0;
  const gFillStyle = document.createElement('style');
  for (const g of gFills) {
    g.classList.add(`g${counter}-fill`);
    gFillStyle.innerHTML += `.g${counter}-fill{fill:currentColor}`;
    counter++;
  }
  if (gFills.length > 0) parent.appendChild(gFillStyle);
  
  const gStrokeStyle = document.createElement('style');
  for (const g of gStrokes) {
    g.classList.add(`g${counter}-stroke`);
    gStrokeStyle.innerHTML += `.g${counter}-stroke{stroke:currentColor}`;
    counter++;
  }
  if (gStrokes.length > 0) parent.appendChild(gStrokeStyle);
  
  counter = 0;
  const rectFillStyle = document.createElement('style');
  for (const rect of rectFills) {
    rect.classList.add(`r${counter}-fill`);
    rectFillStyle.innerHTML += `.r${counter}-fill{fill:currentColor}`;
    counter++;
  }
  if (rectFills.length > 0) parent.appendChild(rectFillStyle);
  
  const rectStrokeStyle = document.createElement('style');
  for (const rect of rectStrokes) {
    rect.classList.add(`r${counter}-stroke`);
    rectStrokeStyle.innerHTML += `.r${counter}-stroke{stroke:currentColor}`;
    counter++;
  }
  if (rectStrokes.length > 0) parent.appendChild(rectStrokeStyle);

  console.log('Processed HTML:', parent.outerHTML);
  return parent.outerHTML;
}

const result = modifySvg(testIcon.body);

// Create the full SVG
const svgEl = createElementNS('svg');
svgEl.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
svgEl.setAttribute('viewBox', `0 0 ${testIcon.width || icons.width || 16} ${testIcon.height || icons.height || 16}`);
svgEl.innerHTML = result;

console.log('\nFinal SVG:', svgEl.outerHTML);