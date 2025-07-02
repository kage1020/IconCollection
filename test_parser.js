const fs = require('fs');
const { JSDOM } = require('jsdom');
const { locate } = require('@iconify/json');

const json = JSON.parse(fs.readFileSync('node_modules/@iconify/json/collections.json', 'utf8'));

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

// Test with the Google Material Icons (ic) collection that has circle elements
const lib = 'ic';
const value = json[lib];
const title = value.name;

console.log(`Processing ${title}...`);

fs.mkdirSync(`./out/svg/${title.replace(/\s/g, '')}`, { recursive: true });

const icons = JSON.parse(fs.readFileSync(locate(lib), 'utf8'));

// Process just a few test icons
const testIcons = ['baseline-brightness-1', 'baseline-circle', 'baseline-radio-button-checked'];
let foundIcons = 0;

for (const [key, body] of Object.entries(icons.icons)) {
  if (!testIcons.includes(key)) continue;
  
  foundIcons++;
  console.log(`Processing icon: ${key}`);
  console.log(`Original body: ${body.body}`);

  const svgEl = createElementNS('svg');
  svgEl.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  svgEl.setAttribute(
    'viewBox',
    `0 0 ${body.width ?? icons.width ?? 16} ${body.height ?? icons.height ?? 16}`
  );
  svgEl.innerHTML = modifySvg(body.body);

  const outputPath = `./out/svg/${title.replace(/\s/g, '')}/${key}.svg`;
  fs.writeFileSync(outputPath, svgEl.outerHTML);
  
  console.log(`Generated SVG: ${svgEl.outerHTML}`);
  console.log(`Saved to: ${outputPath}\n`);
}

console.log(`Found and processed ${foundIcons} test icons`);