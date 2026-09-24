import * as child_process from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import * as vscode from 'vscode';
import * as readline from 'readline';
import { PythonExtension } from '@vscode/python-extension';
import { NamespaceView, Detail } from '../types';
import { getBootstrapSnippet, getViewSnippet, getDetailSnippet } from './snippets';

export interface KernelExecutionListener {
  onOutput?: (type: 'stdout' | 'stderr' | 'result', text: string) => void;
  onError?: (ename: string, evalue: string, traceback: string[]) => void;
  onStatusChange?: (status: 'starting' | 'ready' | 'busy' | 'idle') => void;
  onNamespaceUpdated?: (variables: NamespaceView) => void;
  onDetailReceived?: (detail: Detail) => void;
  onInput?: (code: string, executionCount: number) => void;
}

export class KernelManager {
  private process: child_process.ChildProcess | null = null;
  private status: 'starting' | 'ready' | 'busy' | 'idle' = 'starting';
  private listeners: Set<KernelExecutionListener> = new Set();
  private bootstrapSucceeded = false;

  // Introspection tags
  private viewTag: string;
  private detailTag: string;

  // Track pending executions
  private pendingExecutions: Map<string, {
    resolve: (value: any) => void;
    reject: (err: any) => void;
    outputs: string[];
  }> = new Map();

  // Map of client request index/identifier to msg_id once we get "execute_sent"
  private nextRequestId = 1;
  private pendingRequestMap: Map<number, string> = new Map(); // requestId -> msg_id
  private requestResolveMap: Map<string, () => void> = new Map(); // msg_id -> resolve function

  // Debounced refresh trigger
  private refreshDebounceTimeout: NodeJS.Timeout | null = null;

  // Bootstrap msg_id — used to detect errors on the bootstrap execution
  private bootstrapMsgId: string | null = null;
  private silentMsgIds: Set<string> = new Set();

  constructor(private context: vscode.ExtensionContext) {
    const sessionToken = Math.random().toString(36).substring(2, 10);
    this.viewTag = `@@VEXP_VIEW_${sessionToken}@@`;
    this.detailTag = `@@VEXP_DETAIL_${sessionToken}@@`;
  }

  public registerListener(listener: KernelExecutionListener): vscode.Disposable {
    this.listeners.add(listener);
    // Send current status immediately
    if (listener.onStatusChange) {
      listener.onStatusChange(this.status);
    }
    return new vscode.Disposable(() => {
      this.listeners.delete(listener);
    });
  }

  private updateStatus(newStatus: 'starting' | 'ready' | 'busy' | 'idle') {
    this.status = newStatus;
    for (const listener of this.listeners) {
      if (listener.onStatusChange) {
        listener.onStatusChange(newStatus);
      }
    }
  }

  private resolvedPythonPath = 'python';
  private workingDirectory: string | null = null;

  public getPythonPath(): string {
    return this.resolvedPythonPath;
  }

  public getWorkingDirectory(): string {
    if (this.workingDirectory) {
      return this.workingDirectory;
    }
    return this.resolveWorkingDirectory();
  }

  public resolveWorkingDirectory(): string {
    const config = vscode.workspace.getConfiguration('varexp');
    const customCwd = config.get<string>('workingDirectory')?.trim();

    const activeEditor = vscode.window.activeTextEditor;
    const activeFileUri = activeEditor?.document?.uri;

    let workspaceFolder: string | undefined;
    if (activeFileUri && activeFileUri.scheme === 'file') {
      workspaceFolder = vscode.workspace.getWorkspaceFolder(activeFileUri)?.uri.fsPath;
    }
    if (!workspaceFolder && vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
      workspaceFolder = vscode.workspace.workspaceFolders[0].uri.fsPath;
    }

    let fileDirname: string | undefined;
    if (activeFileUri && activeFileUri.scheme === 'file') {
      fileDirname = path.dirname(activeFileUri.fsPath);
    }

    if (customCwd) {
      let resolved = customCwd;
      if (workspaceFolder) {
        resolved = resolved.replace(/\$\{workspaceFolder\}/g, workspaceFolder);
      }
      if (fileDirname) {
        resolved = resolved.replace(/\$\{fileDirname\}/g, fileDirname);
      }
      if (resolved.startsWith('~/') || resolved === '~') {
        resolved = path.join(os.homedir(), resolved.slice(1));
      }
      resolved = path.normalize(resolved);
      if (fs.existsSync(resolved)) {
        return resolved;
      }
      if (customCwd !== '${workspaceFolder}' || workspaceFolder) {
        console.warn(`[Variable Explorer] Configured workingDirectory "${customCwd}" resolved to "${resolved}" which does not exist. Falling back.`);
      }
    }

    if (workspaceFolder && fs.existsSync(workspaceFolder)) {
      return workspaceFolder;
    }

    if (fileDirname && fs.existsSync(fileDirname)) {
      return fileDirname;
    }

    const home = os.homedir();
    if (home && fs.existsSync(home)) {
      return home;
    }

    return this.context.extensionPath;
  }

  public async start(): Promise<void> {
    if (this.process) {
      return;
    }

    this.updateStatus('starting');
    
    // 1. Resolve Python path
    let pythonPath = 'python';
    try {
      const pythonApi = await PythonExtension.api();
      const activeEnv = pythonApi.environments.getActiveEnvironmentPath();
      const resolved = await pythonApi.environments.resolveEnvironment(activeEnv);
      if (resolved && resolved.executable && resolved.executable.uri) {
        pythonPath = resolved.executable.uri.fsPath;
      }
    } catch (e) {
      console.warn("Failed to retrieve Python path via Python extension, falling back to default 'python'", e);
    }
    this.resolvedPythonPath = pythonPath;

    const workingDir = this.resolveWorkingDirectory();
    this.workingDirectory = workingDir;

    const gatewayScript = path.join(this.context.extensionPath, 'python', 'gateway.py');
    console.log(`Spawning gateway: ${pythonPath} -u ${gatewayScript} --cwd ${workingDir}`);

    // 2. Spawn python gateway
    const proc = child_process.spawn(pythonPath, ['-u', gatewayScript, '--cwd', workingDir], {
      cwd: workingDir
    });
    this.process = proc;

    let stderrAccumulator = "";
    proc.stderr?.on('data', (data) => {
      const chunk = data.toString();
      console.error(`[Python Gateway stderr] ${chunk}`);
      stderrAccumulator += chunk;
    });

    // 3. Setup line-by-line listener
    const rl = readline.createInterface({
      input: proc.stdout!,
      terminal: false
    });

    return new Promise<void>((resolve, reject) => {
      let completed = false;

      const cleanup = () => {
        completed = true;
        clearTimeout(timeoutId);
        proc.off('close', onClose);
        proc.off('error', onError);
      };

      const timeoutId = setTimeout(() => {
        if (!completed) {
          cleanup();
          proc.kill();
          if (this.process === proc) {
            this.process = null;
            this.updateStatus('starting');
          }
          rl.close();
          
          let detail = "";
          if (stderrAccumulator.trim()) {
            detail = `\n\nDetails:\n${stderrAccumulator.trim()}`;
          }
          reject(new Error(`Gateway connection timed out. Make sure 'jupyter-client' and 'ipykernel' are installed in the selected environment.${detail}`));
        }
      }, 15000);

      const onClose = (code: number | null) => {
        if (!completed) {
          cleanup();
          if (this.process === proc) {
            this.process = null;
            this.updateStatus('starting');
          }
          rl.close();

          let detail = "";
          if (stderrAccumulator.trim()) {
            detail = `\n\nDetails:\n${stderrAccumulator.trim()}`;
          } else {
            detail = ` (exited with code ${code})`;
          }
          reject(new Error(`Gateway process exited unexpectedly.${detail}`));
        }
      };

      const onError = (err: Error) => {
        if (!completed) {
          cleanup();
          if (this.process === proc) {
            this.process = null;
            this.updateStatus('starting');
          }
          rl.close();
          reject(new Error(`Failed to spawn Python gateway process: ${err.message}`));
        }
      };

      proc.on('close', onClose);
      proc.on('error', onError);

      rl.on('line', (line) => {
        try {
          const payload = JSON.parse(line.trim());
          this.handleGatewayMessage(payload);
          
          if (!completed) {
            if (payload.type === 'status' && payload.status === 'ready') {
              completed = true;
              clearTimeout(timeoutId);
              proc.off('close', onClose);
              proc.off('error', onError);
              resolve();
            } else if (payload.type === 'error') {
              cleanup();
              proc.kill();
              if (this.process === proc) {
                this.process = null;
                this.workingDirectory = null;
                this.updateStatus('starting');
              }
              rl.close();
              reject(new Error(payload.message || "Failed to start IPython kernel."));
            }
          }
        } catch (e) {
          // Non-JSON output or parsing error
          console.debug(`[Gateway output non-JSON]: ${line}`);
        }
      });
    }).then(async () => {
      // Process has successfully declared it's ready.
      // Setup the long-running close handler for the process
      proc.on('close', (code) => {
        console.log(`Gateway process closed with code ${code}`);
        if (this.process === proc) {
          this.process = null;
          this.workingDirectory = null;
          this.updateStatus('starting');
        }
        rl.close();
      });

      this.updateStatus('ready');

      // Inject bootstrap
      await this.bootstrapKernel();
    });
  }

  public shutdown() {
    if (this.process) {
      this.process.stdin?.write(JSON.stringify({ action: 'shutdown' }) + '\n');
      this.process = null;
      this.workingDirectory = null;
    }
  }

  public isRunning(): boolean {
    return this.process !== null;
  }

  private async bootstrapKernel(): Promise<void> {
    console.log("Bootstrapping kernel with spyder-kernels helper functions...");
    const bootstrapCode = getBootstrapSnippet(this.viewTag, this.detailTag);

    this.bootstrapMsgId = null;
    this.bootstrapSucceeded = true;

    try {
      await this.executeRaw(bootstrapCode, true, false, (msgId) => {
        this.bootstrapMsgId = msgId;
      });
    } catch (e) {
      this.bootstrapSucceeded = false;
      console.warn("Bootstrap execution failed:", e);
    }

    if (this.bootstrapSucceeded) {
      console.log("Bootstrap complete. Refreshing initial variables view.");
      await this.refreshVariables();
    }
  }

  /**
   * Executes Python code on the kernel and resolves when execution is complete.
   * Outputs are streamed to registered listeners in real time.
   */
  public async execute(code: string): Promise<void> {
    this.updateStatus('busy');
    try {
      await this.executeRaw(code, false, true);
    } finally {
      this.updateStatus('idle');
      // Trigger debounced refresh of variables after user execution
      this.triggerDebouncedRefresh();
    }
  }

  /**
   * Directly executes code and returns a promise resolving when execution completes.
   */
  private executeRaw(
    code: string,
    silent: boolean,
    storeHistory: boolean,
    onMsgId?: (msgId: string) => void
  ): Promise<void> {
    if (!this.process) {
      return Promise.reject(new Error("Kernel is not running."));
    }

    const requestId = this.nextRequestId++;

    return new Promise<void>((resolve, reject) => {
      let timeoutHandle: NodeJS.Timeout | null = null;
      let assignedMsgId: string | null = null;

      const cleanup = (msgId?: string) => {
        if (timeoutHandle) {
          clearTimeout(timeoutHandle);
          timeoutHandle = null;
        }
        const id = msgId || assignedMsgId;
        if (id) {
          this.requestResolveMap.delete(id);
          this.silentMsgIds.delete(id);
        }
      };

      const onSent = (msgId: string) => {
        assignedMsgId = msgId;
        if (silent) {
          this.silentMsgIds.add(msgId);
        }
        if (onMsgId) {
          onMsgId(msgId);
        }

        // Start the 30s timeout once we know the kernel accepted the request
        timeoutHandle = setTimeout(() => {
          cleanup(msgId);
          reject(new Error("Execution timed out after 30s — kernel may have crashed."));
        }, 30_000);

        this.requestResolveMap.set(msgId, () => {
          cleanup(msgId);
          resolve();
        });
      };

      (this as any)[`req_sent_${requestId}`] = onSent;

      this.process?.stdin?.write(JSON.stringify({
        action: 'execute',
        code: code,
        silent: silent,
        store_history: storeHistory,
        requestId: requestId
      }) + '\n');
    });
  }

  public async executeSilent(code: string): Promise<void> {
    await this.executeRaw(code, true, false);
  }

  public async refreshVariables(): Promise<void> {
    if (!this.bootstrapSucceeded) {
      return; // Don't attempt refresh if bootstrap hasn't completed
    }
    const viewCode = getViewSnippet();
    await this.executeRaw(viewCode, true, false);
  }

  public async getVariableDetail(
    name: string,
    rowOffset: number = 0,
    rowLimit: number = 200,
    colOffset: number = 0,
    colLimit: number = 50
  ): Promise<Detail> {
    const detailCode = getDetailSnippet(name, rowOffset, rowLimit, colOffset, colLimit);
    
    return new Promise<Detail>((resolve) => {
      const listener: KernelExecutionListener = {
        onDetailReceived: (detail) => {
          if ('name' in detail && detail.name === name || 'error' in detail) {
            resolve(detail);
            disposable.dispose();
          }
        }
      };
      const disposable = this.registerListener(listener);
      this.executeRaw(detailCode, true, false).catch((err) => {
        resolve({ error: err.message });
        disposable.dispose();
      });
    });
  }

  private triggerDebouncedRefresh() {
    if (this.refreshDebounceTimeout) {
      clearTimeout(this.refreshDebounceTimeout);
    }
    this.refreshDebounceTimeout = setTimeout(() => {
      this.refreshVariables().catch(console.error);
    }, 100);
  }

  private handleGatewayMessage(payload: any) {
    if (payload.type === 'execute_sent') {
      // Match python requestId back to wait block
      // Wait, python gateway needs to send back the requestId! Let's ensure it does.
      // Let's modify gateway.py to forward the requestId if passed.
      const requestId = payload.requestId;
      const msgId = payload.msg_id;
      if (requestId && (this as any)[`req_sent_${requestId}`]) {
        (this as any)[`req_sent_${requestId}`](msgId);
        delete (this as any)[`req_sent_${requestId}`];
      }
      return;
    }

    if (payload.channel === 'shell' && payload.msg_type === 'execute_reply') {
      const msgId = payload.parent_header?.msg_id;
      if (msgId && this.requestResolveMap.has(msgId)) {
        const resolve = this.requestResolveMap.get(msgId);
        this.requestResolveMap.delete(msgId);
        if (resolve) {
          resolve();
        }
      }
      
      const content = payload.content;
      if (content && content.status === 'error') {
        // Detect bootstrap failure (spyder_kernels not installed or import error)
        if (msgId && msgId === this.bootstrapMsgId) {
          this.bootstrapSucceeded = false;
          vscode.window.showErrorMessage(
            "spyder-kernels not found in the selected Python environment. " +
            "Install it with: pip install spyder-kernels==3.1.4",
            "Copy Command"
          ).then(selection => {
            if (selection === "Copy Command") {
              vscode.env.clipboard.writeText("pip install spyder-kernels==3.1.4");
            }
          });
          return;
        }

        // Suppress errors from internal silent commands from leaking into the console
        if (msgId && this.silentMsgIds.has(msgId)) {
          return;
        }

        for (const listener of this.listeners) {
          if (listener.onError) {
            listener.onError(content.ename, content.evalue, content.traceback || []);
          }
        }
      }
      return;
    }

    if (payload.channel === 'iopub') {
      const msgType = payload.msg_type;
      const content = payload.content;
      const msgId = payload.parent_header?.msg_id;

      if (msgType === 'status') {
        const executionState = content.execution_state; // 'busy', 'idle'
        if (executionState === 'busy' || executionState === 'idle') {
          // Only update status if it's not starting/ready transitions
          if (this.status !== 'starting') {
            this.updateStatus(executionState);
          }
        }
      } else if (msgType === 'stream') {
        const name = content.name; // 'stdout', 'stderr'
        const text = content.text;

        // Check for introspection updates first
        if (text.includes(this.viewTag)) {
          const parsed = this.extractTaggedPayload(text, this.viewTag);
          if (parsed) {
            for (const listener of this.listeners) {
              if (listener.onNamespaceUpdated) {
                listener.onNamespaceUpdated(parsed);
              }
            }
          }
          return; // Suppress from console stream output
        }

        if (text.includes(this.detailTag)) {
          const parsed = this.extractTaggedPayload(text, this.detailTag);
          if (parsed) {
            for (const listener of this.listeners) {
              if (listener.onDetailReceived) {
                listener.onDetailReceived(parsed);
              }
            }
          }
          return; // Suppress from console stream output
        }

        // Standard stream output
        for (const listener of this.listeners) {
          if (listener.onOutput) {
            listener.onOutput(name === 'stdout' ? 'stdout' : 'stderr', text);
          }
        }
      } else if (msgType === 'execute_result' || msgType === 'display_data') {
        const data = content.data;
        const text = data['text/plain'] || '';
        for (const listener of this.listeners) {
          if (listener.onOutput) {
            listener.onOutput('result', text);
          }
        }
      } else if (msgType === 'error') {
        // Suppress internal silent or bootstrap errors from leaking into the user console
        if (msgId && (this.silentMsgIds.has(msgId) || msgId === this.bootstrapMsgId)) {
          return;
        }
        for (const listener of this.listeners) {
          if (listener.onError) {
            listener.onError(content.ename, content.evalue, content.traceback || []);
          }
        }
      } else if (msgType === 'execute_input') {
        const code = content.code;
        const executionCount = content.execution_count;
        for (const listener of this.listeners) {
          if (listener.onInput) {
            listener.onInput(code, executionCount);
          }
        }
      }
    }
  }

  private extractTaggedPayload(text: string, tag: string): any {
    const firstIdx = text.indexOf(tag);
    const lastIdx = text.lastIndexOf(tag);
    if (firstIdx !== -1 && lastIdx !== -1 && firstIdx !== lastIdx) {
      const payloadStr = text.substring(firstIdx + tag.length, lastIdx);
      try {
        return JSON.parse(payloadStr);
      } catch (e) {
        console.error("Failed to parse tagged introspection JSON", e);
      }
    }
    return null;
  }
}
