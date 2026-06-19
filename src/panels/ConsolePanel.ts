import * as vscode from 'vscode';
import { KernelManager, KernelExecutionListener } from '../kernel/KernelManager';

export class ConsolePanel implements vscode.WebviewViewProvider {
  private view?: vscode.WebviewView;
  private messageBuffer: any[] = [];

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly kernelManager: KernelManager
  ) {
    // Set up listeners for kernel events immediately so we capture early outputs
    const executionListener: KernelExecutionListener = {
      onOutput: (type, text) => {
        this.postMessage({
          command: 'output',
          type,
          text
        });
      },
      onError: (ename, evalue, traceback) => {
        this.postMessage({
          command: 'error',
          ename,
          evalue,
          traceback
        });
      },
      onStatusChange: (status) => {
        this.postMessage({
          command: 'status',
          status
        });
      },
      onInput: (code, executionCount) => {
        this.postMessage({
          command: 'input_echo',
          code,
          executionCount
        });
      }
    };

    this.kernelManager.registerListener(executionListener);
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

    // Flush any buffered messages
    while (this.messageBuffer.length > 0) {
      const msg = this.messageBuffer.shift();
      if (msg) {
        webviewView.webview.postMessage(msg);
      }
    }

    // Listen for messages from the webview console
    webviewView.webview.onDidReceiveMessage(async (message) => {
      switch (message.command) {
        case 'execute':
          const code = message.code;
          try {
            await this.kernelManager.execute(code);
          } catch (err: any) {
            vscode.window.showErrorMessage(`Execution failed: ${err.message}`);
          }
          break;
      }
    });
  }

  public clear() {
    this.postMessage({
      command: 'clear'
    });
  }

  private postMessage(message: any) {
    if (this.view) {
      this.view.webview.postMessage(message);
    } else {
      this.messageBuffer.push(message);
    }
  }

  private getHtmlForWebview(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'media', 'console.js'));
    const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'media', 'console.css'));

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link href="${styleUri}" rel="stylesheet">
  <title>IPython Console</title>
</head>
<body>
  <div class="console-container">
    <div class="console-header">
      <div class="title">IPython Console</div>
      <div id="status-indicator" class="status-indicator idle">
        <span class="indicator-dot"></span>
        <span id="status-text" class="status-text">idle</span>
      </div>
    </div>
    
    <div id="console-output" class="console-output">
      <div id="output-rows">
        <div class="system-message">IPython Console initialized. Welcome!</div>
      </div>
      
      <div class="console-input-area">
        <span class="prompt-label" id="input-prompt-label">In [1]:</span>
        <textarea id="console-input" rows="1" spellcheck="false" autocorrect="off" autocapitalize="off"></textarea>
      </div>
    </div>
  </div>

  <script src="${scriptUri}"></script>
</body>
</html>`;
  }
}
