import * as vscode from 'vscode';
import * as path from 'path';
import { KernelManager } from './kernel/KernelManager';
import { VariablesProvider } from './panels/VariablesProvider';
import { ConsolePanel } from './panels/ConsolePanel';

export function activate(context: vscode.ExtensionContext) {
  console.log('Activating VSCode Variable Explorer...');

  // Initialize KernelManager
  const kernelManager = new KernelManager(context);

  // Initialize VariablesProvider (Side panel)
  const variablesProvider = new VariablesProvider(context.extensionUri, kernelManager);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      'varexp.variables',
      variablesProvider,
      {
        webviewOptions: {
          retainContextWhenHidden: true
        }
      }
    )
  );

  // Initialize ConsolePanel (Bottom panel view)
  const consolePanel = new ConsolePanel(context.extensionUri, kernelManager);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      'varexp.console',
      consolePanel,
      {
        webviewOptions: {
          retainContextWhenHidden: true
        }
      }
    )
  );

  // Register Start Command
  context.subscriptions.push(
    vscode.commands.registerCommand('varexp.start', async () => {
      vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "Starting variable explorer IPython kernel...",
        cancellable: false
      }, async (progress) => {
        try {
          await kernelManager.start();
          
          // Focus the Console UI at the bottom
          vscode.commands.executeCommand('varexp.console.focus');
        } catch (err: any) {
          const installCmd = "Install Dependencies";
          const selectInt = "Select Python Interpreter";
          vscode.window.showErrorMessage(
            `Failed to start kernel: ${err.message}`,
            installCmd,
            selectInt
          ).then(choice => {
            if (choice === installCmd) {
              const pythonPath = kernelManager.getPythonPath();
              const terminal = vscode.window.createTerminal("Install Variable Explorer Dependencies");
              terminal.sendText(`"${pythonPath}" -m pip install jupyter_client ipykernel pyzmq spyder-kernels==3.1.4`);
              terminal.show();
            } else if (choice === selectInt) {
              vscode.commands.executeCommand('python.setInterpreter');
            }
          });
        }
      });
    })
  );

  // Register Refresh Command
  context.subscriptions.push(
    vscode.commands.registerCommand('varexp.refresh', async () => {
      try {
        await kernelManager.refreshVariables();
      } catch (err: any) {
        vscode.window.showErrorMessage(`Failed to refresh variables: ${err.message}`);
      }
    })
  );

  // Register Run Selection Command
  context.subscriptions.push(
    vscode.commands.registerCommand('varexp.runSelection', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        return;
      }
      const selection = editor.selection;
      let code = "";
      if (selection.isEmpty) {
        const line = editor.document.lineAt(selection.active.line);
        code = line.text;
      } else {
        code = editor.document.getText(selection);
      }
      if (code.trim()) {
        if (!kernelManager.isRunning()) {
          await vscode.commands.executeCommand('varexp.start');
        }
        await kernelManager.execute(code);
      }
    })
  );

  // Register Run File Command
  context.subscriptions.push(
    vscode.commands.registerCommand('varexp.runFile', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        return;
      }
      const filePath = editor.document.uri.fsPath;
      if (filePath) {
        if (!kernelManager.isRunning()) {
          await vscode.commands.executeCommand('varexp.start');
        }
        const fileDir = path.dirname(filePath);
        const escapedFilePath = filePath.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
        const escapedFileDir = fileDir.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
        const runCommand = `runfile("${escapedFilePath}", wdir="${escapedFileDir}")`;
        await kernelManager.execute(runCommand);
      }
    })
  );

  // Register Clear Variables Command
  context.subscriptions.push(
    vscode.commands.registerCommand('varexp.clearVariables', async () => {
      try {
        if (kernelManager.isRunning()) {
          await kernelManager.executeSilent('%reset -f');
          await kernelManager.refreshVariables();
        }
      } catch (err: any) {
        vscode.window.showErrorMessage(`Failed to clear variables: ${err.message}`);
      }
    })
  );

  // Register Clear Console Command
  context.subscriptions.push(
    vscode.commands.registerCommand('varexp.clearConsole', () => {
      consolePanel.clear();
    })
  );

  // Cleanup on deactivation
  context.subscriptions.push(
    new vscode.Disposable(() => {
      kernelManager.shutdown();
    })
  );
}

export function deactivate() {}
