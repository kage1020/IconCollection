const yargs = require('yargs').scriptName('svg2mx').usage('$0 <category>').help();

const argv = yargs.argv;

if (argv._.length !== 1 || argv._[0] !== 'react-icons') {
  console.error('Usage: svg2mx <category of icon>\n\n category: react-icons');
  process.exit(1);
}

const category = argv._[0];

const { JSDOM } = require('jsdom');
global.window = new JSDOM().window;
global.document = window.document;
global.XMLSerializer = window.XMLSerializer;
global.navigator = window.navigator;

const { mxGraph, mxCodec, mxUtils, mxConstants } = require('mxgraph')();

let style = mxUtils.setStyle('', mxConstants.STYLE_SHAPE, mxConstants.SHAPE_IMAGE);
style = mxUtils.setStyle(
  style,
  mxConstants.STYLE_VERTICAL_LABEL_POSITION,
  mxConstants.ALIGN_BOTTOM
);
style = mxUtils.setStyle(style, mxConstants.STYLE_IMAGE_ALIGN, mxConstants.ALIGN_TOP);
style = mxUtils.setStyle(style, mxConstants.STYLE_IMAGE_ASPECT, 1);
style = mxUtils.setStyle(style, mxConstants.STYLE_ASPECT, 'fixed');

const fs = require('fs');

fs.mkdirSync(`./out/mx/${category}`, { recursive: true });

for (const theme of fs.readdirSync(`./out/svg/${category}`)) {
  const icons = fs.readdirSync(`./out/svg/${category}/${theme}`).map((file) => {
    const svg = fs.readFileSync(`./out/svg/${category}/${theme}/${file}`, 'utf8');

    const title = file.replace(/\.svg$/, '');
    const image = 'data:image/svg+xml,' + Buffer.from(svg).toString('base64');
    style = mxUtils.setStyle(style, mxConstants.STYLE_IMAGE, image);

    const graph = new mxGraph();
    const parent = graph.getDefaultParent();
    graph.getModel().beginUpdate();
    graph.insertVertex(parent, null, title, 0, 0, 48, 48, style);
    graph.getModel().endUpdate();
    const modelNode = new mxCodec().encode(graph.getModel());
    const modelXml = mxUtils.getXml(modelNode);
    const xml = Buffer.from(modelXml).toString('base64');

    return { title, xml, w: 48, h: 48 };
  });

  fs.writeFileSync(`./out/mx/${category}/${theme}.xml`, JSON.stringify(icons));
}
