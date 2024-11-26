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
              <button>diagram</button>
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

// %3CmxGraphModel%3E%3Croot%3E%3CmxCell%20id%3D%220%22%2F%3E%3CmxCell%20id%3D%221%22%20parent%3D%220%22%2F%3E%3CmxCell%20id%3D%222%22%20value%3D%22%22%20style%3D%22shape%3Dimage%3BverticalLabelPosition%3Dbottom%3BlabelBackgroundColor%3Ddefault%3BverticalAlign%3Dtop%3Baspect%3Dfixed%3BimageAspect%3D0%3Bimage%3Ddata%3Aimage%2Fsvg%2Bxml%2CPHN2ZyB4bWxuczp4bGluaz0iaHR0cDovL3d3dy53My5vcmcvMTk5OS94bGluayIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiB2aWV3Qm94PSIwIDAgNDQ4IDUxMiIgdmVyc2lvbj0iMS4xIj48Zz48cGF0aCBjbGFzcz0icDAiIGQ9Ik00OCAzMkMyMS41IDMyIDAgNTMuNSAwIDgwdjM1MmMwIDI2LjUgMjEuNSA0OCA0OCA0OGgzNTJjMjYuNSAwIDQ4LTIxLjUgNDgtNDhWODBjMC0yNi41LTIxLjUtNDgtNDgtNDhINDh6bTE1OS43OTMgNjRjMTMuODUtLjAxIDI3LjY5OS4wNjUgNDEuNTQ5LjMwNWMzNy45MDIgOTUuNzcgNzYuODc1IDE5MS4xNzEgMTE1LjI5MyAyODYuNzU3YzMuODY3IDEwLjk0IDE2LjI4MiAxMy43NzcgMjYuMzM4IDE1LjgwM2MwIDUuNzA5LjAzNSAxMS40MTcuMDM1IDE3LjEyN2MtNTAuMDItLjAzOC0xMDAuMDQuMDM3LTE1MC4wNjMtLjAzN2MwLTUuNzQ1LjAzNS0xMS40NTUuMDM1LTE3LjE2NGMxMi41MjUtLjk1NiAyOC42NTgtLjIxOCAzNi4xLTEyLjU2YzIuODc0LTkuNTc3LS4zMy0xOS41Ni0zLjg2Ny0yOC40NzNhNDAyNDUuMTUgNDAyNDUuMTUgMCAwIDAtMTUuOTE0LTM5LjYzNWMtMzguNjQtLjE0Ni03Ny4yNC4xMTItMTE1Ljg4MS0uMTFjLTYuOTYxIDE2LjI0NS0xMy4wMDQgMzIuODU5LTE5LjM3NyA0OS4zMjNjLTIuNjUxIDcuMjU2LTUuNDg3IDE2LjkwOC45MjIgMjMuMDk2YzguMTQgNi45MjUgMTkuNjMzIDYuNzQgMjkuNjUyIDguMjg3Yy4wMzYgNS43NDYuMDM2IDExLjQ5My4wNzIgMTcuMjc1Yy0zMS44OTgtLjAzNy02My43OTYuMDc0LTk1LjY5NS0uMDc0YzAtNS42NzMuMDM1LTExLjM0NC4wMzUtMTYuOThjOS43Ni0yLjAyNSAyMS45NTQtNC40MjIgMjUuNjc0LTE1LjE0MWMzMi45MzEtODQuMTMxIDY1Ljg5OC0xNjguMjk3IDk4LjM1LTI1Mi42MTFjLTUuMzQyLTExLjQ5NC05LjY1Mi0yMy40MjYtMTQuODA5LTM0Ljk5M2MxMy44NS0uMDkyIDI3LjcwMS0uMTg2IDQxLjU1MS0uMTk1em0tOS44MzYgNzMuNTMzYy0xNC41MTMgMzkuNDUtMzAuMjA0IDc4LjQ5NC00NS4wMTIgMTE3LjgzNGE5Njc5LjI5IDk2NzkuMjkgMCAwIDAgOTIuMTIzIDBjLTE1LjY5MS0zOS4yNjYtMzEuNDU1LTc4LjUzLTQ3LjExMS0xMTcuODM0eiIgZmlsbD0iY3VycmVudENvbG9yIi8%2BPHN0eWxlPi5wMCB7IGZpbGw6IGN1cnJlbnRDb2xvciB9PC9zdHlsZT48L2c%2BPC9zdmc%2B%3B%22%20vertex%3D%221%22%20parent%3D%221%22%3E%3CmxGeometry%20x%3D%22240%22%20y%3D%22240%22%20width%3D%22448%22%20height%3D%22512%22%20as%3D%22geometry%22%2F%3E%3C%2FmxCell%3E%3C%2Froot%3E%3C%2FmxGraphModel%3E

// <mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/><mxCell id="6" value="" style="shape=image;verticalLabelPosition=bottom;labelBackgroundColor=default;verticalAlign=top;aspect=fixed;imageAspect=0;image=data:image/svg+xml,PHN2ZyB4bWxuczp4bGluaz0iaHR0cDovL3d3dy53My5vcmcvMTk5OS94bGluayIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiB2aWV3Qm94PSIwIDAgNDQ4IDUxMiIgdmVyc2lvbj0iMS4xIj48Zz48cGF0aCBjbGFzcz0icDAiIGQ9Ik00OCAzMkMyMS41IDMyIDAgNTMuNSAwIDgwdjM1MmMwIDI2LjUgMjEuNSA0OCA0OCA0OGgzNTJjMjYuNSAwIDQ4LTIxLjUgNDgtNDhWODBjMC0yNi41LTIxLjUtNDgtNDgtNDhINDh6bTE1OS43OTMgNjRjMTMuODUtLjAxIDI3LjY5OS4wNjUgNDEuNTQ5LjMwNWMzNy45MDIgOTUuNzcgNzYuODc1IDE5MS4xNzEgMTE1LjI5MyAyODYuNzU3YzMuODY3IDEwLjk0IDE2LjI4MiAxMy43NzcgMjYuMzM4IDE1LjgwM2MwIDUuNzA5LjAzNSAxMS40MTcuMDM1IDE3LjEyN2MtNTAuMDItLjAzOC0xMDAuMDQuMDM3LTE1MC4wNjMtLjAzN2MwLTUuNzQ1LjAzNS0xMS40NTUuMDM1LTE3LjE2NGMxMi41MjUtLjk1NiAyOC42NTgtLjIxOCAzNi4xLTEyLjU2YzIuODc0LTkuNTc3LS4zMy0xOS41Ni0zLjg2Ny0yOC40NzNhNDAyNDUuMTUgNDAyNDUuMTUgMCAwIDAtMTUuOTE0LTM5LjYzNWMtMzguNjQtLjE0Ni03Ny4yNC4xMTItMTE1Ljg4MS0uMTFjLTYuOTYxIDE2LjI0NS0xMy4wMDQgMzIuODU5LTE5LjM3NyA0OS4zMjNjLTIuNjUxIDcuMjU2LTUuNDg3IDE2LjkwOC45MjIgMjMuMDk2YzguMTQgNi45MjUgMTkuNjMzIDYuNzQgMjkuNjUyIDguMjg3Yy4wMzYgNS43NDYuMDM2IDExLjQ5My4wNzIgMTcuMjc1Yy0zMS44OTgtLjAzNy02My43OTYuMDc0LTk1LjY5NS0uMDc0YzAtNS42NzMuMDM1LTExLjM0NC4wMzUtMTYuOThjOS43Ni0yLjAyNSAyMS45NTQtNC40MjIgMjUuNjc0LTE1LjE0MWMzMi45MzEtODQuMTMxIDY1Ljg5OC0xNjguMjk3IDk4LjM1LTI1Mi42MTFjLTUuMzQyLTExLjQ5NC05LjY1Mi0yMy40MjYtMTQuODA5LTM0Ljk5M2MxMy44NS0uMDkyIDI3LjcwMS0uMTg2IDQxLjU1MS0uMTk1em0tOS44MzYgNzMuNTMzYy0xNC41MTMgMzkuNDUtMzAuMjA0IDc4LjQ5NC00NS4wMTIgMTE3LjgzNGE5Njc5LjI5IDk2NzkuMjkgMCAwIDAgOTIuMTIzIDBjLTE1LjY5MS0zOS4yNjYtMzEuNDU1LTc4LjUzLTQ3LjExMS0xMTcuODM0eiIgZmlsbD0iY3VycmVudENvbG9yIi8+PHN0eWxlPi5wMCB7IGZpbGw6IGN1cnJlbnRDb2xvciB9PC9zdHlsZT48L2c+PC9zdmc+;" vertex="1" parent="1"><mxGeometry x="240" y="240" width="448" height="512" as="geometry"/></mxCell></root></mxGraphModel>
