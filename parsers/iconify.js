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

const progress = require('cli-progress');
const bar = new progress.MultiBar(
  {
    clearOnComplete: true,
    hideCursor: true,
    barsize: 50,
    format: ' {bar} | {percentage}% | {value}/{total} | {name}',
  },
  progress.Presets.shades_grey
);

const libBar = bar.create(Object.keys(json).length, 0, { name: 'Libraries' });
libBar.start(Object.keys(json).length, 0, { name: 'Libraries' });
for (const [lib, value] of Object.entries(json)) {
  libBar.increment();
  bar.update();

  const title = value.name;
  if (fs.existsSync(`./out/svg/${title.replace(/\s/g, '')}`)) continue;

  fs.mkdirSync(`./out/svg/${title.replace(/\s/g, '')}`, { recursive: true });

  const icons = JSON.parse(fs.readFileSync(locate(lib), 'utf8'));

  const iconBar = bar.create(Object.keys(icons.icons).length, 0, {
    name: title.replace(/\s/g, ''),
  });
  iconBar.start(Object.keys(icons.icons).length, 0, { name: title.replace(/\s/g, '') });
  for (const [key, body] of Object.entries(icons.icons)) {
    iconBar.increment();
    bar.update();

    const svgEl = createElementNS('svg');
    svgEl.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    svgEl.setAttribute(
      'viewBox',
      `0 0 ${body.width ?? icons.width ?? 16} ${body.height ?? icons.height ?? 16}`
    );
    svgEl.innerHTML = modifySvg(body.body);

    fs.writeFileSync(`./out/svg/${title.replace(/\s/g, '')}/${key}.svg`, svgEl.outerHTML);
  }
  bar.remove(iconBar);
}
bar.stop();
