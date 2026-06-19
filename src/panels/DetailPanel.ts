import * as vscode from 'vscode';
import { Detail } from '../types';
import { KernelManager } from '../kernel/KernelManager';

export class DetailPanel {
  public static currentPanel: DetailPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private disposables: vscode.Disposable[] = [];

  public static createOrShow(extensionUri: vscode.Uri, detail: Detail, kernelManager: KernelManager) {
    const name = 'error' in detail ? 'Error' : detail.name;
    const title = `Variable: ${name}`;

    if (DetailPanel.currentPanel) {
      DetailPanel.currentPanel.panel.title = title;
      DetailPanel.currentPanel.panel.reveal(vscode.ViewColumn.Active);
      DetailPanel.currentPanel.update(detail);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'varexp.detail',
      title,
      vscode.ViewColumn.Active,
      {
        enableScripts: true,
        localResourceRoots: [
          vscode.Uri.joinPath(extensionUri, 'media')
        ]
      }
    );

    DetailPanel.currentPanel = new DetailPanel(panel, extensionUri, detail, kernelManager);
  }

  private constructor(
    panel: vscode.WebviewPanel,
    private readonly extensionUri: vscode.Uri,
    detail: Detail,
    private readonly kernelManager: KernelManager
  ) {
    this.panel = panel;
    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
    
    this.panel.webview.html = this.getHtmlForWebview(this.panel.webview);
    
    // Once the webview has loaded, push the details data to it
    this.panel.webview.onDidReceiveMessage(async (msg) => {
      if (msg.command === 'ready') {
        this.update(detail);
      } else if (msg.command === 'loadPage') {
        const name = msg.name;
        const rowOffset = msg.rowOffset;
        const rowLimit = msg.rowLimit;
        const colOffset = msg.colOffset;
        const colLimit = msg.colLimit;
        
        vscode.window.withProgress({
          location: vscode.ProgressLocation.Notification,
          title: `Loading variable data for ${name}...`,
          cancellable: false
        }, async () => {
          try {
            const newDetail = await this.kernelManager.getVariableDetail(name, rowOffset, rowLimit, colOffset, colLimit);
            this.update(newDetail);
          } catch (err: any) {
            vscode.window.showErrorMessage(`Failed to load page: ${err.message}`);
          }
        });
      }
    }, null, this.disposables);
  }

  public update(detail: Detail) {
    this.panel.webview.postMessage({
      command: 'show',
      detail: detail
    });
  }

  public dispose() {
    DetailPanel.currentPanel = undefined;
    this.panel.dispose();
    while (this.disposables.length) {
      const x = this.disposables.pop();
      if (x) {
        x.dispose();
      }
    }
  }

  private getHtmlForWebview(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'media', 'detail.js'));
    const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'media', 'detail.css'));

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link href="${styleUri}" rel="stylesheet">
  <title>Variable Detail</title>
</head>
<body>
  <div id="content" class="container">
    <div class="loading-state">Loading details...</div>
  </div>

  <script src="${scriptUri}"></script>
</body>
</html>`;
  }
}
