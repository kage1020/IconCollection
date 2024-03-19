const fs = require('fs');
const { JSDOM } = require('jsdom');
const { locate } = require('@iconify/json');

const json = JSON.parse(fs.readFileSync('node_modules/@iconify/json/collections.json', 'utf8'));

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

const libBar = bar.create(Object.keys(json).length, 0, { name: 'Libraries' });
libBar.start(Object.keys(json).length, 0, { name: 'Libraries' });
for (const [lib, value] of Object.entries(json)) {
  libBar.increment();
  bar.update();

  const title = value.name.replace('Devicon', 'Devicons');
  if (fs.existsSync(`./out/svg/${title}`)) continue;

  fs.mkdirSync(`./out/svg/${title}`, { recursive: true });

  const icons = JSON.parse(fs.readFileSync(locate(lib), 'utf8'));

  const iconBar = bar.create(Object.keys(icons.icons).length, 0, { name: title });
  iconBar.start(Object.keys(icons.icons).length, 0, { name: title });
  for (const [key, body] of Object.entries(icons.icons)) {
    iconBar.increment();
    bar.update();

    const svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svgEl.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    svgEl.setAttribute(
      'viewBox',
      `0 0 ${body.width ?? icons.width ?? 16} ${body.height ?? icons.height ?? 16}`
    );
    svgEl.innerHTML = body.body;
    const styleEl = document.createElement('style');
    styleEl.innerHTML =
      'g { stroke: currentColor; stroke-linecap: round; stroke-linejoin: round; stroke-width: 2 }';
    svgEl.appendChild(styleEl);

    fs.writeFileSync(`./out/svg/${title}/${key}.svg`, svgEl.outerHTML);
  }
  bar.remove(iconBar);
}
bar.stop();
