const { JSDOM } = require('jsdom');
const fs = require('fs');

const libs = [
  { key: 'Ai', name: 'Ant Design Icons' },
  { key: 'Bs', name: 'Bootstrap Icons' },
  { key: 'Bi', name: 'BoxIcons' },
  { key: 'Cg', name: 'css.gg' },
  { key: 'Ci', name: 'Circum Icons' },
  { key: 'Ci', name: 'Devicons' },
  { key: 'Fa', name: 'Font Awesome 5' },
  { key: 'Fc', name: 'Flat Color Icons' },
  { key: 'Fi', name: 'Feather Icon' },
  { key: 'Gi', name: 'Game Icons' },
  { key: 'Go', name: 'Github Octicons icons' },
  { key: 'Gr', name: 'Grommet Icons' },
  { key: 'Hi', name: 'Heroicons' },
  { key: 'Hi2', name: 'Heroicons 2' },
  { key: 'Im', name: 'IcoMoon Free' },
  { key: 'Io', name: 'Ionicons 4' },
  { key: 'Io5', name: 'Ionicons 5' },
  { key: 'Lu', name: 'Lucide' },
  { key: 'Md', name: 'Material Design Icons' },
  { key: 'Ri', name: 'Remix Icon' },
  { key: 'Rx', name: 'Radix Icons' },
  { key: 'Si', name: 'Simple Icons' },
  { key: 'Sl', name: 'Simple Line Icons' },
  { key: 'Tb', name: 'Tabler Icons' },
  { key: 'Tfi', name: 'Themify Icons' },
  { key: 'Ti', name: 'Typicons' },
  { key: 'Vsc', name: 'VS Code Icons' },
  { key: 'Wi', name: 'Weather Icons' },
];

function modifySvg(svgEl) {
  const parent = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  parent.innerHTML = svgEl;
  const pathFills = parent.querySelectorAll('path[fill="currentColor"]');
  const pathStrokes = parent.querySelectorAll('path[stroke="currentColor"]');
  const gFills = parent.querySelectorAll('g[fill="currentColor"]');
  const gStrokes = parent.querySelectorAll('g[stroke="currentColor"]');
  const rectFills = parent.querySelectorAll('rect[fill="currentColor"]');
  const rectStrokes = parent.querySelectorAll('rect[stroke="currentColor"]');

  let counter = 0;
  const pathFillStyle = document.createElement('style');
  for (const path of pathFills) {
    path.classList.add(`p${counter}`);
    pathFillStyle.innerHTML += `.p${counter} { fill: currentColor }`;
    counter++;
  }
  if (pathFills.length > 0) parent.appendChild(pathFillStyle);
  const pathStrokeStyle = document.createElement('style');
  for (const path of pathStrokes) {
    path.classList.add(`p${counter}`);
    pathStrokeStyle.innerHTML += `.p${counter} { stroke: currentColor }`;
    counter++;
  }
  if (pathStrokes.length > 0) parent.appendChild(pathStrokeStyle);
  counter = 0;
  const gFillStyle = document.createElement('style');
  for (const g of gFills) {
    g.classList.add(`g${counter}`);
    gFillStyle.innerHTML += `.g${counter} { fill: currentColor }`;
    counter++;
  }
  if (gFills.length > 0) parent.appendChild(gFillStyle);
  const gStrokeStyle = document.createElement('style');
  for (const g of gStrokes) {
    g.classList.add(`g${counter}`);
    gStrokeStyle.innerHTML += `.g${counter} { stroke: currentColor }`;
    counter++;
  }
  if (gStrokes.length > 0) parent.appendChild(gStrokeStyle);
  counter = 0;
  const rectFillStyle = document.createElement('style');
  for (const rect of rectFills) {
    rect.classList.add(`r${counter}`);
    rectFillStyle.innerHTML += `.r${counter} { fill: currentColor }`;
    counter++;
  }
  if (rectFills.length > 0) parent.appendChild(rectFillStyle);
  const rectStrokeStyle = document.createElement('style');
  for (const rect of rectStrokes) {
    rect.classList.add(`r${counter}`);
    rectStrokeStyle.innerHTML += `.r${counter} { stroke: currentColor }`;
    counter++;
  }
  if (rectStrokes.length > 0) parent.appendChild(rectStrokeStyle);

  const style = document.createElement('style');
  style.innerHTML = `path { fill: currentColor; stroke: currentColor; }`;
  parent.appendChild(style);

  return parent.outerHTML;
}

const constructSVG = (svgEl, data) => {
  const { type, props } = data;

  if (!props.children && !props.child) {
    const createElementNS = (elementType) =>
      document.createElementNS('http://www.w3.org/2000/svg', elementType);

    let shapeEl;

    switch (type) {
      case 'path':
        shapeEl = createElementNS('path');
        shapeEl.setAttribute('d', props.d);
        break;
      case 'circle':
        shapeEl = createElementNS('circle');
        shapeEl.setAttribute('cx', props.cx);
        shapeEl.setAttribute('cy', props.cy);
        shapeEl.setAttribute('r', props.r);
        break;
      case 'rect':
        shapeEl = createElementNS('rect');
        shapeEl.setAttribute('width', props.width);
        shapeEl.setAttribute('height', props.height);
        shapeEl.setAttribute('x', props.x);
        shapeEl.setAttribute('y', props.y);
        shapeEl.setAttribute('rx', props.rx);
        break;
      case 'ellipse':
        shapeEl = createElementNS('ellipse');
        shapeEl.setAttribute('cx', props.cx);
        shapeEl.setAttribute('cy', props.cy);
        shapeEl.setAttribute('rx', props.rx);
        shapeEl.setAttribute('ry', props.ry);
        break;
      case 'polygon':
        shapeEl = createElementNS('polygon');
        shapeEl.setAttribute('points', props.points);
        break;
      case 'line':
        shapeEl = createElementNS('line');
        shapeEl.setAttribute('x1', props.x1);
        shapeEl.setAttribute('y1', props.y1);
        shapeEl.setAttribute('x2', props.x2);
        shapeEl.setAttribute('y2', props.y2);
        shapeEl.setAttribute('stroke-linecap', props.strokeLinecap ?? 'round');
        break;
      case 'polyline':
        shapeEl = createElementNS('polyline');
        shapeEl.setAttribute('points', props.points);
        break;
      default:
        return svgEl;
    }

    svgEl.appendChild(shapeEl);
  } else {
    const children = props.children || props.child;
    for (const child of children) {
      svgEl = constructSVG(svgEl, child);
    }
  }

  return svgEl;
};

const { document } = new JSDOM('<!DOCTYPE html><html><body></body></html>').window;

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

const libBar = bar.create(libs.length, 0, { name: 'Libraries' });
libBar.start(libs.length, 0, { name: 'Libraries' });
for (const lib of libs) {
  libBar.increment();
  bar.update();

  const icons = require(`react-icons/${lib.key.toLowerCase()}`);

  if (fs.existsSync(`./out/svg/${lib.name.replace(/\s/g, '')}`)) continue;
  const libName = `${lib.key.replace(/[0-9]/g, '')}`;
  fs.mkdirSync(`./out/svg/${lib.name.replace(/\s/g, '')}`, { recursive: true });

  const iconBar = bar.create(Object.entries(icons).length, 0, {
    name: lib.name.replace(/\s/g, ''),
  });
  iconBar.start(Object.entries(icons).length, 0, { name: lib.name.replace(/\s/g, '') });
  for (const [key, maker] of Object.entries(icons)) {
    iconBar.increment();
    bar.update();

    let svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const data = maker();
    svgEl.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    svgEl.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
    svgEl.setAttribute('version', '1.1');
    svgEl.setAttribute('viewBox', data.props.attr.viewBox);

    svgEl = constructSVG(svgEl, data);
    svgEl.innerHTML += modifySvg(svgEl.innerHTML);

    const filename = key.replace(
      new RegExp(`^${libName}Outline(\\S+)$|^${libName}Fill(\\S+)$|^${libName}(\\S+)$`),
      '$1$2$3'
    );

    fs.writeFileSync(`./out/svg/${lib.name.replace(/\s/g, '')}/${filename}.svg`, svgEl.outerHTML);
  }
  bar.remove(iconBar);
}
bar.stop();
