const fs = require('fs');
const { JSDOM } = require('jsdom');

// Test the updated modifySvg function with ellipse support
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
  const ellipseFills = parent.querySelectorAll('ellipse[fill="currentColor"]');
  const ellipseStrokes = parent.querySelectorAll('ellipse[stroke="currentColor"]');

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
  counter = 0;
  const ellipseFillStyle = document.createElement('style');
  for (const ellipse of ellipseFills) {
    ellipse.classList.add(`e${counter}-fill`);
    ellipseFillStyle.innerHTML += `.e${counter}-fill{fill:currentColor}`;
    counter++;
  }
  if (ellipseFills.length > 0) parent.appendChild(ellipseFillStyle);
  const ellipseStrokeStyle = document.createElement('style');
  for (const ellipse of ellipseStrokes) {
    ellipse.classList.add(`e${counter}-stroke`);
    ellipseStrokeStyle.innerHTML += `.e${counter}-stroke{stroke:currentColor}`;
    counter++;
  }
  if (ellipseStrokes.length > 0) parent.appendChild(ellipseStrokeStyle);

  return parent.outerHTML;
}

// Test ellipse with fill
console.log('Testing ellipse with fill="currentColor":');
const ellipseFillTest = '<ellipse cx="50" cy="25" rx="40" ry="20" fill="currentColor"/>';
const ellipseFillResult = modifySvg(ellipseFillTest);
console.log('Result:', ellipseFillResult);

if (ellipseFillResult.includes('class="e0-fill"')) {
  console.log('✓ Ellipse fill element has e0-fill class applied');
}
if (ellipseFillResult.includes('.e0-fill{fill:currentColor}')) {
  console.log('✓ CSS style for e0-fill is present');
}

// Test ellipse with stroke
console.log('\nTesting ellipse with stroke="currentColor":');
const ellipseStrokeTest = '<ellipse cx="50" cy="25" rx="40" ry="20" stroke="currentColor" fill="none"/>';
const ellipseStrokeResult = modifySvg(ellipseStrokeTest);
console.log('Result:', ellipseStrokeResult);

if (ellipseStrokeResult.includes('class="e0-stroke"')) {
  console.log('✓ Ellipse stroke element has e0-stroke class applied');
}
if (ellipseStrokeResult.includes('.e0-stroke{stroke:currentColor}')) {
  console.log('✓ CSS style for e0-stroke is present');
}

// Test mixed elements
console.log('\nTesting mixed elements:');
const mixedTest = '<circle cx="10" cy="10" r="5" fill="currentColor"/><ellipse cx="30" cy="10" rx="8" ry="5" fill="currentColor"/><path d="M50,10 L60,20" stroke="currentColor"/>';
const mixedResult = modifySvg(mixedTest);
console.log('Result:', mixedResult);

console.log('\nChecking all elements are handled:');
if (mixedResult.includes('c0-fill')) console.log('✓ Circle handled');
if (mixedResult.includes('e0-fill')) console.log('✓ Ellipse handled');
if (mixedResult.includes('p0-stroke')) console.log('✓ Path handled');