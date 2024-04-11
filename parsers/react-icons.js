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

function createElementNS(elementType) {
  return document.createElementNS('http://www.w3.org/2000/svg', elementType);
}

function modifySvg(childrenEl) {
  const parent = createElementNS('g');
  parent.innerHTML = childrenEl;
  const paths = parent.querySelectorAll('path');
  const gs = parent.querySelectorAll('g');
  const rects = parent.querySelectorAll('rect');

  let counter = 0;
  const pathFillStyle = document.createElement('style');
  for (const path of paths) {
    path.classList.add(`p${counter}-fill`);
    pathFillStyle.innerHTML += `.p${counter}-fill{fill:${
      path.getAttribute('fill') || 'currentColor'
    }}`;
  }
  if (paths.length > 0) parent.appendChild(pathFillStyle);
  counter = 0;
  const pathStrokeStyle = document.createElement('style');
  for (const path of paths) {
    path.classList.add(`p${counter}-stroke`);
    pathStrokeStyle.innerHTML += `.p${counter}-stroke{stroke:${
      path.getAttribute('stroke') || 'currentColor'
    }}`;
  }
  if (paths.length > 0) parent.appendChild(pathStrokeStyle);

  counter = 0;
  const gFillStyle = document.createElement('style');
  for (const g of gs) {
    g.classList.add(`g${counter}-fill`);
    gFillStyle.innerHTML += `.g${counter}-fill{fill:${g.getAttribute('fill') || 'currentColor'}}`;
  }
  if (gs.length > 0) parent.appendChild(gFillStyle);
  counter = 0;
  const gStrokeStyle = document.createElement('style');
  for (const g of gs) {
    g.classList.add(`g${counter}-stroke`);
    gStrokeStyle.innerHTML += `.g${counter}-stroke{stroke:${
      g.getAttribute('stroke') || 'currentColor'
    }}`;
  }
  if (gs.length > 0) parent.appendChild(gStrokeStyle);

  counter = 0;
  const rectFillStyle = document.createElement('style');
  for (const rect of rects) {
    rect.classList.add(`r${counter}-fill`);
    rectFillStyle.innerHTML += `.r${counter}-fill{fill:${
      rect.getAttribute('fill') || 'currentColor'
    }}`;
  }
  if (rects.length > 0) parent.appendChild(rectFillStyle);
  counter = 0;
  const rectStrokeStyle = document.createElement('style');
  for (const rect of rects) {
    rect.classList.add(`r${counter}-stroke`);
    rectStrokeStyle.innerHTML += `.r${counter}-stroke{stroke:${
      rect.getAttribute('stroke') || 'currentColor'
    }}`;
  }
  if (rects.length > 0) parent.appendChild(rectStrokeStyle);

  return parent.outerHTML;
}

const constructSVG = (svgEl, data) => {
  const { attr, child, children, ...props } = data.props;

  if (attr) {
    for (const [key, value] of Object.entries(attr)) {
      svgEl.setAttribute(key, value);
    }
  }

  if (child || children) {
    for (const c of child || children) {
      svgEl = constructSVG(svgEl, c);
    }
  } else {
    const { type, props } = data;
    const el = createElementNS(type);

    for (const [key, value] of Object.entries(props)) {
      if (!value) continue;
      el.setAttribute(key, value);
    }
    svgEl.appendChild(el);
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

    let svgEl = createElementNS('svg');
    const data = maker();
    svgEl.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    svgEl.setAttribute('width', '1rem');
    svgEl.setAttribute('height', '1rem');

    svgEl = constructSVG(svgEl, data);
    svgEl.innerHTML = modifySvg(svgEl.innerHTML);

    const filename = key.replace(
      new RegExp(`^${libName}Outline(\\S+)$|^${libName}Fill(\\S+)$|^${libName}(\\S+)$`),
      '$1$2$3'
    );

    fs.writeFileSync(`./out/svg/${lib.name.replace(/\s/g, '')}/${filename}.svg`, svgEl.outerHTML);
  }
  bar.remove(iconBar);
}
bar.stop();
