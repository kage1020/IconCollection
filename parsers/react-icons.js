const { JSDOM } = require('jsdom');
const fs = require('fs');

const themes = [
  'Ai',
  'Bi',
  'Bs',
  'Cg',
  'Ci',
  'Di',
  'Fa',
  'Fc',
  'Fi',
  'Gi',
  'Go',
  'Gr',
  'Hi',
  'Hi2',
  'Im',
  'Io',
  'Io5',
  'Lu',
  'Md',
  'Ri',
  'Rx',
  'Si',
  'Tb',
  'Tfi',
  'Ti',
  'Vsc',
  'Wi',
];

for (const theme of themes) {
  const icons = require(`react-icons/${theme.toLowerCase()}`);
  console.info(`Processing ${theme}...`);

  const { document } = new JSDOM('<!DOCTYPE html><html><body></body></html>').window;

  for (const [key, maker] of Object.entries(icons)) {
    const svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const data = maker();
    svgEl.setAttribute('viewBox', data.props.attr.viewBox);

    if (Array.isArray(data.props.children)) {
      for (const item of data.props.children) {
        const childEl = document.createElementNS('http://www.w3.org/2000/svg', item.type);
        childEl.setAttribute('d', item.props.d);
        childEl.setAttribute('fill', 'currentColor');
        svgEl.appendChild(childEl);
      }
    } else if (Array.isArray(data.props.child)) {
      for (const item of data.props.children) {
        const childEl = document.createElementNS('http://www.w3.org/2000/svg', item.type);
        childEl.setAttribute('d', item.props.d);
        childEl.setAttribute('fill', 'currentColor');
        svgEl.appendChild(childEl);
      }
    }

    const themeName = `${theme.replace(/[0-9]/g, '')}`;
    const filename = key.replace(
      new RegExp(`${themeName}Outline|${themeName}Fill|${themeName}`),
      ''
    );
    fs.mkdirSync(`./out/svg/react-icons/${theme}`, { recursive: true });
    fs.writeFileSync(`./out/svg/react-icons/${theme}/${filename}.svg`, svgEl.outerHTML);
  }
}
