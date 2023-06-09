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

    shapeEl.setAttribute('fill', props.fill ?? 'none');
    shapeEl.setAttribute('stroke', props.stroke ?? 'none');
    shapeEl.setAttribute('stroke-width', props.strokeWidth ?? '1');
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

  if (fs.existsSync(`./out/svg/${lib.name}`)) continue;
  const libName = `${lib.key.replace(/[0-9]/g, '')}`;

  const iconBar = bar.create(Object.entries(icons).length, 0, { name: lib.name });
  iconBar.start(Object.entries(icons).length, 0, { name: lib.name });
  for (const [key, maker] of Object.entries(icons)) {
    iconBar.increment();
    bar.update();

    let svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const data = maker();
    svgEl.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    svgEl.setAttribute('viewBox', data.props.attr.viewBox);

    svgEl = constructSVG(svgEl, data);

    const filename = key.replace(
      new RegExp(`^${libName}Outline(\\S+)$|^${libName}Fill(\\S+)$|^${libName}(\\S+)$`),
      '$1$2$3'
    );
    fs.mkdirSync(`./out/svg/${lib.name}`, { recursive: true });
    fs.writeFileSync(`./out/svg/${lib.name}/${filename}.svg`, svgEl.outerHTML);
  }
  bar.remove(iconBar);
}
bar.stop();
