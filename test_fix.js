const fs = require('fs');
const { JSDOM } = require('jsdom');
const { locate } = require('@iconify/json');

// Test the fixed modifySvg function
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
  const circleFills = parent.querySelectorAll('circle[fill="currentColor"]');
  const circleStrokes = parent.querySelectorAll('circle[stroke="currentColor"]');

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
  counter = 0;
  const circleFillStyle = document.createElement('style');
  for (const circle of circleFills) {
    circle.classList.add(`c${counter}-fill`);
    circleFillStyle.innerHTML += `.c${counter}-fill{fill:currentColor}`;
    counter++;
  }
  if (circleFills.length > 0) parent.appendChild(circleFillStyle);
  const circleStrokeStyle = document.createElement('style');
  for (const circle of circleStrokes) {
    circle.classList.add(`c${counter}-stroke`);
    circleStrokeStyle.innerHTML += `.c${counter}-stroke{stroke:currentColor}`;
    counter++;
  }
  if (circleStrokes.length > 0) parent.appendChild(circleStrokeStyle);

  return parent.outerHTML;
}

// Test with the problematic icon
const icons = JSON.parse(fs.readFileSync(locate('ic'), 'utf8'));
const testIcon = icons.icons['baseline-brightness-1'];

console.log('Original icon body:', testIcon.body);

const result = modifySvg(testIcon.body);
console.log('Processed result:', result);

// Create the full SVG
const svgEl = createElementNS('svg');
svgEl.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
svgEl.setAttribute('viewBox', `0 0 ${testIcon.width || icons.width || 16} ${testIcon.height || icons.height || 16}`);
svgEl.innerHTML = result;

console.log('\nFinal SVG:');
console.log(svgEl.outerHTML);

// Check if the circle has the correct class applied
console.log('\nCircle class verification:');
if (result.includes('class="c0-fill"')) {
  console.log('✓ Circle element has c0-fill class applied');
}
if (result.includes('.c0-fill{fill:currentColor}')) {
  console.log('✓ CSS style for c0-fill is present');
}

// Test another icon with both fill and stroke
console.log('\n--- Testing icon with stroke ---');
// Create a test case with stroke
const testStroke = '<circle cx="10" cy="10" r="5" stroke="currentColor" fill="none"/>';
const strokeResult = modifySvg(testStroke);
console.log('Stroke test result:', strokeResult);

if (strokeResult.includes('class="c0-stroke"')) {
  console.log('✓ Circle stroke element has c0-stroke class applied');
}
if (strokeResult.includes('.c0-stroke{stroke:currentColor}')) {
  console.log('✓ CSS style for c0-stroke is present');
}