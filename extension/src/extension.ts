import * as vscode from 'vscode';
import algolia from 'algoliasearch';

type IconType = {
  name: string;
  collection: string;
  svg: string;
};

class IconCollectionProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'iconCollection.IconCollection';

  private _view?: vscode.WebviewView;
  private _context: vscode.ExtensionContext;
  private _query = '';
  private _hits: any[] = [];
  private algolia = algolia('542UAQQJ7C', '087f5825c15920e443cf4ffb49375a3a');
  private index = this.algolia.initIndex('icons');

  constructor(private readonly context: vscode.ExtensionContext) {
    context.globalState.update('query', '');
    context.globalState.update('hits', []);
    this._context = context;
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
    };

    webviewView.webview.html = this._getHtmlForWebview();

    webviewView.webview.onDidReceiveMessage(async (data) => {
      let url, svg;
      switch (data.type) {
        case 'alert':
          vscode.window.showErrorMessage(data.value);
          return;
        case 'search':
          this._query = data.value;
          this._context.globalState.update('query', this._query);
          this.search(webviewView.webview);
          return;
        case 'copySvg':
          url = `https://icons.kage1020.com/${data.value.collection}/${data.value.name}.svg`;
          svg = await fetch(url).then((res) => res.text());
          vscode.env.clipboard.writeText(svg);
          vscode.window.showInformationMessage('Copied to clipboard!');
          return;
        case 'copyDiagram':
          url = `https://icons.kage1020.com/${data.value.collection}/${data.value.name}.svg`;
          svg = await fetch(url).then((res) => res.text());
          const base64Svg = btoa(svg);
          const width = svg.match(/viewBox="0 0 (\d+) (\d+)"/)?.[1] || 100;
          const height = svg.match(/viewBox="0 0 (\d+) (\d+)"/)?.[2] || 100;
          const diagram = `<mxGraphModel><root><mxCell id="0" /><mxCell id="1" parent="0" /><mxCell id="2" style="shape=image;verticalAlign=top;aspect=fixed;imageAspect=0;editableCssRules=.*;image=data:image/svg+xml,${base64Svg};" vertex="1" parent="1"><mxGeometry x="0" y="0" width="${width}" height="${height}" as="geometry" /></mxCell></root></mxGraphModel>`;
          vscode.env.clipboard.writeText(diagram);
          vscode.window.showInformationMessage('Copied to clipboard!');
      }
    });
  }

  private _getHtmlForWebview() {
    const query = (this._context.globalState.get('query') || '') as string;
    const hits = (this._context.globalState.get('hits') || []) as IconType[];

    return `<!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Icon Collection</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            display: flex;
            flex-direction: column;
            gap: 1rem;
            height: 100vh;
          }
          #input {
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            height: 24px;
            border: none;
            padding: 3px 0 3px 6px;
            outline-color: var(--vscode-focusBorder);
          }
          #icon-container {
            display: flex;
            gap: 0.5rem;
            flex-grow: 1;
            flex-direction: column;
          }
          #icon-item {
            display: flex;
            gap: 0.5rem;
          }
          #icon-item button {
            background-color: transparent;
            color: rgba(255, 255, 255, 0.4);
            border: solid 1px;
            padding: 0.5rem;
            cursor: pointer;
            border-radius: 0.125rem;
            transition: 0.3s;
            word-break: keep-all;
          }
          #icon-item button:hover {
            color: rgba(255, 255, 255, 0.8);
            background-color: rgba(255, 255, 255, 0.1);
          }
          #icon-wrapper {
            flex-grow: 1;
            display: grid;
            align-items: center;
            gap: 0.25rem;
            color: var(--vscode-foreground);
            grid-template-columns: repeat(4, minmax(0, 1fr));
          }
          #icon-wrapper svg {
            width: 50px;
            height: 50px;
          }
          #info-wrapper {
            display: grid;
            gap: 0.25rem;
            word-break: break-all;
            grid-column: span 3;
          }
          #not-found-container {
            display: flex;
            flex-direction: column;
            height: 100%;
            justify-content: center;
          }
          #not-found-container svg {
            margin: 0 auto;
            color: gray;
          }
          #not-found-container span {
            text-align: center;
          }
        </style>
      </head>
      <body>
        <input type="text" id="input" value="${query}" placeholder="検索" />
        <div id="icon-container">
          ${hits.map(
            (hit) => `
            <div id="icon-item">
              <div id="icon-wrapper">
                ${hit.svg}
                <div id="info-wrapper">
                  <span>${hit.name}</span>
                  <span>${hit.collection}</span>
                </div>
              </div>
              <button>SVG</button>
              <button>Diagram</button>
            </div>
          `
          )}
        </div>
        <script>
          const vscode = acquireVsCodeApi();
          let id;

          const copySvg = (name) => {
            vscode.postMessage({
              type: 'copySvg',
              value: name
            });
          }
          const copyDiagram = (name) => {
            vscode.postMessage({
              type: 'copyDiagram',
              value: name
            });
          }

          const input = document.getElementById('input');
          const iconContainer = document.getElementById('icon-container');
          input.addEventListener('input', (e) => {
            clearTimeout(id);
            id = setTimeout(() => {
              const query = e.target.value;
              vscode.postMessage({
                type: 'search',
                value: query
              });
            }, 250);
          });

          window.addEventListener('message', event => {
            const message = event.data;
            switch (message.type) {
              case 'search':
                iconContainer.innerHTML = '';
                message.value.forEach((icon) => {
                  const iconItem = document.createElement('div');
                  iconItem.id = 'icon-item';
                  const iconWrapper = document.createElement('div');
                  iconWrapper.id = 'icon-wrapper';
                  iconWrapper.innerHTML = icon.svg;

                  const infoWrapper = document.createElement('div');
                  infoWrapper.id = 'info-wrapper';
                  infoWrapper.innerHTML = '<span>' + icon.name + '</span><span>' + icon.collection + '</span>';
                  iconWrapper.appendChild(infoWrapper);
                  iconItem.appendChild(iconWrapper);

                  const svgButton = document.createElement('button');
                  svgButton.innerHTML = 'SVG';
                  svgButton.addEventListener('click', () => copySvg(icon));
                  iconItem.appendChild(svgButton);
                  const diagramButton = document.createElement('button');
                  diagramButton.innerHTML = 'diagram';
                  diagramButton.addEventListener('click', () => copyDiagram(icon));
                  iconItem.appendChild(diagramButton);
                  iconContainer.appendChild(iconItem);
                });
                if (message.value.length === 0) {
                  iconContainer.innerHTML = '<div id="not-found-container"><svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 512 512"><path fill="currentColor" fill-rule="evenodd" d="M213.334 42.667C307.438 42.667 384 119.23 384 213.334c0 39.373-13.534 75.573-36.018 104.481l121.315 121.316l-30.166 30.166l-121.316-121.315C288.907 370.466 252.707 384 213.334 384c-94.104 0-170.667-76.562-170.667-170.666S119.23 42.667 213.334 42.667m0 42.667c-70.584 0-128 57.416-128 128c0 70.583 57.416 128 128 128c70.583 0 128-57.417 128-128c0-70.584-57.417-128-128-128m0 160c17.673 0 32 14.327 32 32s-14.327 32-32 32s-32-14.327-32-32s14.327-32 32-32m21.333-138.667v106.667H192V106.667z"/></svg><span>探しているアイコンは旅行中です。</span><span><a href="https://github.com/kage1020/IconCollection/issues">ここ</a>に手紙を送ると返ってくるかもしれません。</span></div>';
                }
                break;
            }
          });
        </script>
      </body>
      </html>`;
  }

  private async search(webview: vscode.Webview) {
    try {
      if (!this._query) {
        return;
      }

      const { hits } = await this.index.search<IconType>(this._query, {
        hitsPerPage: 100,
      });
      const hitsWithSvg = await Promise.all(
        hits.map(async (hit) => {
          const url = `https://icons.kage1020.com/${hit.collection}/${hit.name}.svg`;
          const svg = await fetch(url).then((res) => res.text());
          return { ...hit, svg, url };
        })
      );
      this._hits = hits;
      this._context.globalState.update('hits', this._hits);
      webview.postMessage({
        type: 'search',
        value: hitsWithSvg,
      });
    } catch (error) {
      console.error(error);
    }
  }
}

export function activate(context: vscode.ExtensionContext) {
  const provider = new IconCollectionProvider(context);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(IconCollectionProvider.viewType, provider)
  );
}

export function deactivate() {}
