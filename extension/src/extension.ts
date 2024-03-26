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
          const width = svg.match(/width="(\d+)"/)?.[1] || '100';
          const height = svg.match(/height="(\d+)"/)?.[1] || '100';
          const diagram = encodeURIComponent(
            `<mxGraphModel><root><mxCell id="0" /><mxCell id="1" style="shape=image;verticalAlign=top;aspect=fixed;imageAspect=0;editableCssRules=.*;image=data:image/svg+xml,${base64Svg};" vertex="1" parent="0"><mxGeometry x="0" y="0" width="${width}" height="${height}" as="geometry" /></mxCell></root></mxGraphModel>`
          );
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
						display: grid;
						gap: 1rem;
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
            display: grid;
            gap: 0.5rem;
          }
          #icon-item {
            display: flex;
            gap: 0.5rem;
          }
          #icon-item button {
            background-color: transparent;
            color: rgba(255, 255, 255, 0.4);
            border: solid 2px;
            padding: 0.5rem;
            cursor: pointer;
            border-radius: 0.25rem;
            transition: 0.5s;
          }
          #icon-item button:hover {
            color: rgba(255, 255, 255, 0.8);
            background-color: rgba(255, 255, 255, 0.1);
          }
          #icon-wrapper {
            flex-grow: 1;
            display: flex;
            align-items: center;
            gap: 0.25rem;
            color: var(--vscode-foreground);
          }
          #icon-wrapper svg {
            width: 50px;
            height: 50px;
          }
          #info-wrapper {
            display: grid;
            gap: 0.25rem;
          }
				</style>
			</head>
			<body>
				<input type="text" id="input" value="${query}" placeholder="検索" autofocus />
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
              <button>diagram</button>
            </div>
          `
          )}
        </div>
				<script>
					const vscode = acquireVsCodeApi();

					const copySvg = (name) => {
						console.log('copy', name);
						vscode.postMessage({
							type: 'copySvg',
							value: name
						});
					}
          const copyDiagram = (name) => {
						console.log('copy', name);
						vscode.postMessage({
							type: 'copyDiagram',
							value: name
						});
					}

					const input = document.getElementById('input');
					const iconContainer = document.getElementById('icon-container');
					input.addEventListener('input', (e) => {
						const query = e.target.value;
						vscode.postMessage({
							type: 'search',
							value: query
						});
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
