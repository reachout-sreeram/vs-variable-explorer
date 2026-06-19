import * as vscode from 'vscode';
import { KernelManager } from '../kernel/KernelManager';
import { NamespaceView } from '../types';
import { DetailPanel } from './DetailPanel';

export class VariablesProvider implements vscode.WebviewViewProvider {
  private view?: vscode.WebviewView;
  private currentVariables: NamespaceView = {};

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly kernelManager: KernelManager
  ) {
    // Register listener for namespace updates
    this.kernelManager.registerListener({
      onNamespaceUpdated: (variables) => {
        this.currentVariables = variables;
        this.updateWebview();
      }
    });
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    token: vscode.CancellationToken
  ): void | Thenable<void> {
    this.view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.extensionUri, 'media')
      ]
    };

    webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);

    // Auto-start the kernel the first time the panel is opened
    if (!this.kernelManager.isRunning()) {
      vscode.commands.executeCommand('varexp.start');
    }

    // Listen for messages from the webview
    webviewView.webview.onDidReceiveMessage(async (message) => {
      switch (message.command) {
        case 'refresh':
          await this.kernelManager.refreshVariables();
          break;
        case 'openDetail':
          const varName = message.name;
          vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Loading details for ${varName}...`,
            cancellable: false
          }, async () => {
            try {
              const detail = await this.kernelManager.getVariableDetail(varName);
              DetailPanel.createOrShow(this.extensionUri, detail, this.kernelManager);
            } catch (err: any) {
              vscode.window.showErrorMessage(`Failed to load variable details: ${err.message}`);
            }
          });
          break;
      }
    });

    // Send initial variables if we have them
    this.updateWebview();
  }

  private updateWebview() {
    if (this.view) {
      this.view.webview.postMessage({
        command: 'update',
        variables: this.currentVariables
      });
    }
  }

  private getHtmlForWebview(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'media', 'variables.js'));
    const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'media', 'variables.css'));

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link href="${styleUri}" rel="stylesheet">
  <title>Variables</title>
</head>
<body>
  <div class="container">
    <div class="search-bar">
      <input type="text" id="search-input" placeholder="Filter variables by name or type..." />
      <button id="refresh-btn" title="Refresh list">&#x21bb;</button>
    </div>
    
    <div class="table-container">
      <table id="vars-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Type</th>
            <th>Size</th>
            <th>Value</th>
          </tr>
        </thead>
        <tbody id="vars-body">
          <!-- Dynamically populated -->
        </tbody>
      </table>
      
      <div id="empty-state" class="empty-state">
        <div class="empty-icon">&#128269;</div>
        <p>No active variables found in the kernel.</p>
        <p class="subtext">Run Python code in the console to inspect namespace variables.</p>
      </div>
    </div>
  </div>

  <script src="${scriptUri}"></script>
</body>
</html>`;
  }
}
