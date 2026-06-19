import sys
import json
import threading
import queue
import time
import datetime
from jupyter_client import KernelManager

class CustomKernelManager(KernelManager):
    def _launch_kernel(self, kernel_cmd, **kw):
        # Force the kernel to launch with the same Python executable running this gateway.
        # argv typically has ['/path/to/python', '-m', 'ipykernel_launcher', ...]
        if kernel_cmd and len(kernel_cmd) > 0:
            kernel_cmd = [sys.executable] + kernel_cmd[1:]
        return super()._launch_kernel(kernel_cmd, **kw)

    async def _async_launch_kernel(self, kernel_cmd, **kw):
        if kernel_cmd and len(kernel_cmd) > 0:
            kernel_cmd = [sys.executable] + kernel_cmd[1:]
        return await super()._async_launch_kernel(kernel_cmd, **kw)

def json_default(obj):
    if isinstance(obj, (datetime.datetime, datetime.date)):
        return obj.isoformat()
    if isinstance(obj, bytes):
        return obj.decode('utf-8', errors='replace')
    return str(obj)

def print_json(data):
    try:
        print(json.dumps(data, default=json_default), flush=True)
    except Exception as e:
        sys.stderr.write(f"Error serialization JSON: {e}\n")
        sys.stderr.flush()

# Thread safety queue for execution requests
exec_queue = queue.Queue()
running = True

def read_stdin_thread():
    global running
    sys.stderr.write("Gateway stdin thread started\n")
    sys.stderr.flush()
    while running:
        try:
            line = sys.stdin.readline()
            if not line:
                # EOF, shutdown
                sys.stderr.write("Gateway stdin EOF reached. Initiating shutdown...\n")
                sys.stderr.flush()
                exec_queue.put({"action": "shutdown"})
                break
            line = line.strip()
            if not line:
                continue
            
            data = json.loads(line)
            action = data.get("action")
            if action == "execute":
                exec_queue.put(data)
            elif action == "shutdown":
                exec_queue.put({"action": "shutdown"})
                break
        except Exception as e:
            sys.stderr.write(f"Error reading stdin: {e}\n")
            sys.stderr.flush()

def main():
    global running
    sys.stderr.write("Starting Gateway...\n")
    sys.stderr.flush()
    
    # 1. Initialize Kernel Manager
    km = CustomKernelManager(kernel_name="python3")
    try:
        km.start_kernel()
    except Exception as e:
        print_json({"type": "error", "message": f"Failed to start IPython kernel: {str(e)}"})
        return

    # 2. Initialize Client
    kc = km.client()
    kc.start_channels()
    
    try:
        # Wait up to 10 seconds for kernel to start
        kc.wait_for_ready(timeout=10)
    except Exception as e:
        print_json({"type": "error", "message": f"IPython kernel not ready in time: {str(e)}"})
        kc.stop_channels()
        km.shutdown_kernel()
        return

    # 3. Notify that we are ready
    print_json({"type": "status", "status": "ready"})
    
    # 4. Start stdin reader thread
    t = threading.Thread(target=read_stdin_thread, daemon=True)
    t.start()

    # 5. Main loop to process messages and execute requests
    active_msg_id = None
    
    while running:
        # Check if we have an execution to launch
        try:
            # Non-blocking check of the queue
            req = exec_queue.get_nowait()
            action = req.get("action")
            if action == "shutdown":
                running = False
                break
            elif action == "execute":
                code = req.get("code")
                silent = req.get("silent", False)
                store_history = req.get("store_history", True)
                req_id = req.get("requestId")
                active_msg_id = kc.execute(code, silent=silent, store_history=store_history)
                print_json({"type": "execute_sent", "msg_id": active_msg_id, "requestId": req_id})
        except queue.Empty:
            pass

        # Poll iopub
        try:
            msg = kc.get_iopub_msg(timeout=0.01)
            print_json({
                "channel": "iopub",
                "msg_type": msg["msg_type"],
                "parent_header": msg.get("parent_header"),
                "content": msg["content"]
            })
        except queue.Empty:
            pass
        except Exception as e:
            sys.stderr.write(f"Error reading iopub: {e}\n")
            sys.stderr.flush()

        # Poll shell
        try:
            msg = kc.get_shell_msg(timeout=0.01)
            print_json({
                "channel": "shell",
                "msg_type": msg["msg_type"],
                "parent_header": msg.get("parent_header"),
                "content": msg["content"]
            })
        except queue.Empty:
            pass
        except Exception as e:
            sys.stderr.write(f"Error reading shell: {e}\n")
            sys.stderr.flush()

        # Small sleep to prevent 100% CPU usage
        time.sleep(0.005)

    # 6. Cleanup
    sys.stderr.write("Cleaning up gateway...\n")
    sys.stderr.flush()
    try:
        kc.stop_channels()
        km.shutdown_kernel(now=True)
    except Exception as e:
        sys.stderr.write(f"Error shutting down: {e}\n")
        sys.stderr.flush()
    sys.stderr.write("Gateway exited cleanly\n")
    sys.stderr.flush()

if __name__ == "__main__":
    main()
