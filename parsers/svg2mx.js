const { JSDOM } = require('jsdom');
global.window = new JSDOM().window;
global.document = window.document;
global.XMLSerializer = window.XMLSerializer;
global.navigator = window.navigator;

const { mxGraph, mxCodec, mxUtils, mxConstants } = require('mxgraph')();

let defaultStyle = '';
defaultStyle = mxUtils.setStyle(defaultStyle, mxConstants.STYLE_SHAPE, mxConstants.SHAPE_IMAGE);
defaultStyle = mxUtils.setStyle(
  defaultStyle,
  mxConstants.STYLE_VERTICAL_LABEL_POSITION,
  mxConstants.ALIGN_BOTTOM
);
defaultStyle = mxUtils.setStyle(
  defaultStyle,
  mxConstants.STYLE_VERTICAL_ALIGN,
  mxConstants.ALIGN_TOP
);
defaultStyle = mxUtils.setStyle(defaultStyle, mxConstants.STYLE_IMAGE_ASPECT, 1);
defaultStyle = mxUtils.setStyle(defaultStyle, mxConstants.STYLE_ASPECT, 'fixed');

const fs = require('fs');
const pako = require('pako');

fs.mkdirSync(`./out/mx`, { recursive: true });

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

const libs = fs.readdirSync(`./out/svg`);

const libBar = bar.create(libs.length, 0, { name: 'Libraries' });
libBar.start(libs.length, 0, { name: 'Libraries' });
for (const lib of libs) {
  libBar.increment();
  bar.update();

  if (fs.existsSync(`./out/mx/${lib}.xml`) || fs.existsSync(`./out/mx/${lib}-1.xml`)) continue;

  const files = fs.readdirSync(`./out/svg/${lib}`);

  const iconBar = bar.create(files.length, 0, { name: lib });
  iconBar.start(files.length, 0, { name: lib });
  const icons = files.map((file) => {
    iconBar.increment();
    bar.update();

    const svg = fs.readFileSync(`./out/svg/${lib}/${file}`, 'utf8');

    const title = file.replace(/\.svg$/, '');
    const image = 'data:image/svg+xml,' + Buffer.from(svg).toString('base64');
    const style = mxUtils.setStyle(defaultStyle, mxConstants.STYLE_IMAGE, image);

    const graph = new mxGraph();
    const parent = graph.getDefaultParent();
    graph.getModel().beginUpdate();
    graph.insertVertex(parent, null, '', 0, 0, 48, 48, style);
    graph.getModel().endUpdate();
    const modelNode = new mxCodec().encode(graph.getModel());
    const modelXml = mxUtils.getXml(modelNode);
    const xml = Buffer.from(pako.deflateRaw(encodeURIComponent(modelXml))).toString('base64');

    return { title, xml, w: 48, h: 48 };
  });
  bar.remove(iconBar);

  if (icons.length > 1000) {
    const chunks = [];
    for (let i = 0; i < icons.length; i += 1000) {
      chunks.push(icons.slice(i, i + 1000));
    }

    for (let i = 0; i < chunks.length; i++) {
      fs.writeFileSync(
        `./out/mx/${lib}-${i + 1}.xml`,
        '<mxlibrary>' + JSON.stringify(chunks[i]) + '</mxlibrary>'
      );
    }
  } else
    fs.writeFileSync(`./out/mx/${lib}.xml`, '<mxlibrary>' + JSON.stringify(icons) + '</mxlibrary>');
}
bar.stop();
