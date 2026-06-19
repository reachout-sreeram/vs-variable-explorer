# Architecture of Spyder-style Variable Explorer

This document explains the technical architecture, design decisions, and data flow of the Variable Explorer and IPython Console extension for Visual Studio Code.

---

## 1. High-Level Architecture

To avoid complex native C++ builds in Node.js for ZeroMQ communication with IPython kernels, this extension uses a hybrid **TypeScript + Python IPC Gateway** architecture:

```
┌─────────────────────────────────────────────┐
│ VSCode Extension (TypeScript)                │
│                                              │
│  ┌────────────┐   ┌──────────────────────┐   │
│  │ Console UI │   │ Variables Panel       │  │
│  │ (webview)  │   │ (webview, tree+table) │  │
│  └─────┬──────┘   └──────────┬───────────┘   │
│        │                     │               │
│  ┌─────┴─────────────────────┴──────────┐    │
│  │ KernelManager (TypeScript)            │    │
│  │  - spawns python -u python/gateway.py │    │
│  │  - writes JSON lines to stdin         │    │
│  │  - reads JSON lines from stdout       │    │
│  └──────────────┬────────────────────────┘    │
└─────────────────────────────────────────────┘
                  │ stdin/stdout (JSON lines)
        ┌─────────┴─────────┐
        │ python/gateway.py │
        │  - uses jupyter_client in python
        │  - starts & connects to local ipykernel
        │  - sends requests over ZMQ
        │  - streams IOPub/Shell events to stdout
        └───────────────────┘
```

The extension comprises three main layers:
1. **VSCode Extension Host (TypeScript)**: Coordinates lifetime events, manages command palette actions, selects active Python interpreter environments, and registers webviews.
2. **Python IPC Gateway (`python/gateway.py`)**: A standalone virtual-environment python script launched by the extension host that talks directly to the IPython Jupyter kernel over standard ZeroMQ TCP sockets.
3. **Webview UI Components**:
   - **Variables panel** (`varexp.variables`): Sidebar listing active namespace variables.
   - **IPython Console panel** (`varexp.console`): Bottom pane panel running interactive commands.
   - **Detail Panel**: Popup pane showing detailed variable matrices (DataFrames, Lists, Dicts).

---

## 2. IPC Protocol (JSON Lines)

Communication between the TypeScript Extension Host and the Python Gateway occurs over standard `stdin`/`stdout` streams using newline-separated JSON lines.

### TypeScript to Python Gateway (stdin)
Requests are formatted as:
```json
{"action": "execute", "code": "print(123)", "silent": false, "store_history": true, "requestId": 1}
```

### Python Gateway to TypeScript (stdout)
Gateway streams standard Jupyter messages to stdout:
- **`execute_sent`**: Emitted once a request is queued and accepted by the client.
- **`iopub` stream / execute_result / error**: Raw output streams from the kernel.
- **`shell` reply**: Execution completes or returns traceback errors.

---

## 3. Variable Introspection & Bootstrapping

When the gateway reports `ready`, the TypeScript host runs an internal bootstrapping script:
1. Registers `__vexp_view()` and `__vexp_detail()` inside python `builtins`.
2. Binds introspection to `spyder_kernels` APIs (specifically `make_remote_view` and `value_to_display`) to parse metadata safely without polluting the user stdout or importing excessive libraries.
3. Registers a custom `runfile(filename, wdir)` fallback function in `builtins` (if not already defined by `spyder-kernels`). This matches Spyder's native `runfile` signature, ensuring clean, directory-aware execution of files and script segments.

---

## 4. UI Design & State Management

### Context Preservation
Webviews in VSCode destroy their DOM and context when hidden (e.g. when switching sidebar tabs). To prevent loss of active consoles or DataFrame paginations:
- We set `retainContextWhenHidden: true` on both the console panel and the variables sidebar.
- Variables and history lists stay fully preserved and scroll positions are maintained during context transitions.

### 2D DataFrame Pagination & Coercion
- **Coercion**: Non-DataFrame structures like `pandas.Series` and `numpy.ndarray` (under 2 dimensions) are coerced to `pandas.DataFrame` on details request.
- **Pagination**: Slices of `200 rows × 50 columns` are requested via JSON postMessages. Page controls (stacked vertical triangles for rows, double angle chevrons `«`/`»` for columns) are placed inline inside the variable detail header, aligned to the right next to metadata badges.
