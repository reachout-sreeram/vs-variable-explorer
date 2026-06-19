# Variable Explorer & IPython Console for VSCode

**Spyder-style variable inspection, without leaving your editor.**

A live variable explorer in the sidebar and a real IPython console in the panel — so you can run a script, watch your variables populate, and click into any DataFrame, array, or nested dict the moment it exists.

> **Requires:** VSCode `^1.90` · the `ms-python.python` extension · a Python environment with `jupyter_client`, `ipykernel`, `pyzmq`, and `spyder-kernels` · MIT licensed · contributions welcome.

---

## Why this exists

VSCode has a first-class debugger and a great Jupyter story — but neither covers the everyday loop that Spyder users rely on: open a plain `.py` file, run it top-to-bottom or line-by-line, and *keep poking at the resulting state* in an explorer that's always on screen. The debugger only shows variables while you're paused on a breakpoint; notebooks force you to restructure your code into cells.

This extension brings that variable-inspection loop to VSCode. It runs your scripts in a persistent IPython kernel, surfaces every variable in a sortable sidebar, and lets you open a spreadsheet-style grid for any DataFrame, `ndarray`, or Series — all against ordinary script files, no `.ipynb` required.

> **Scope:** this is a variable explorer and console, not a full Spyder replacement. It focuses on inspecting data and namespace state — there is no plot pane, profiler, or debugger of its own.

## Highlights

- **Always-on variable explorer** — a sidebar table of names, types, sizes, and value previews that refreshes automatically as code runs, with a live filter and color-coded type badges.
- **A genuine IPython console** — full `In [N]:` / `Out[N]:` prompts docked next to the integrated terminal, with command history (Up/Down), streamed stdout/stderr, and real tracebacks.
- **Click-to-inspect data** — open DataFrames, Series, and 2-D NumPy arrays in a sortable grid with sticky headers; explore dicts, lists, and JSON-like objects as a collapsible tree.
- **Built for big data** — a 2-axis pager (200 rows × 50 columns per slice) keeps million-cell matrices responsive instead of freezing the webview.
- **Run the way you think** — right-click any selection to *Run Selection/Line*, or hit the editor toolbar button to *Run File* via a clean `runfile(path, wdir=...)` that doesn't echo the whole script back at you.
- **State that survives tab switches** — `retainContextWhenHidden` keeps console output, scroll position, and active pagination intact when you flip between the explorer and the file tree.
- **Independent clears** — wipe console history (`Cmd/Ctrl+K`) and reset the kernel namespace (`%reset -f`) separately, each with its own toolbar action.

## How it works

To avoid native ZeroMQ builds inside Node, the extension uses a **TypeScript + Python IPC gateway** design:

```
 VSCode Extension (TypeScript)                stdin/stdout
 ┌───────────────┐  ┌──────────────────┐      (JSON lines)     ┌────────────────────┐
 │  Console UI   │  │ Variables / Detail│  ───────────────────▶│  python/gateway.py │
 │  (webview)    │  │   panels (webview)│  ◀───────────────────│  jupyter_client +  │
 └───────┬───────┘  └─────────┬─────────┘                      │  local ipykernel   │
         └────── KernelManager ┘                               └─────────┬──────────┘
                                                                  ZeroMQ │ TCP
                                                               IPython kernel process
```

The extension host spawns `python/gateway.py`, which connects to a local IPython kernel over ZMQ and relays Jupyter messages back as newline-delimited JSON. Introspection is delegated to `spyder-kernels` (`make_remote_view`, `value_to_display`) so variable metadata is read safely without polluting user output. Full details — IPC protocol, bootstrapping, and pagination internals — live in [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md).

## Requirements

| Requirement | Notes |
| --- | --- |
| VSCode | `^1.90.0` |
| [`ms-python.python`](https://marketplace.visualstudio.com/items?itemName=ms-python.python) | Used to resolve the active interpreter (declared as an extension dependency) |
| Python packages | `jupyter_client`, `ipykernel`, `pyzmq`, and `spyder-kernels==3.1.4` (recommended) for introspection |

Install the Python side into your selected environment:

```bash
pip install jupyter_client ipykernel pyzmq spyder-kernels==3.1.4
```

## Getting started

This repo currently runs from source via the Extension Development Host:

```bash
git clone https://github.com/reachout-sreeram/vs-variable-explorer.git
cd vs-variable-explorer
npm install
npm run compile      # or `npm run watch` for rebuilds on save
```

1. Open the folder in VSCode and press <kbd>F5</kbd> to launch the Extension Development Host.
2. In the new window, open a Python file and run **`Variables: Start Console`** from the Command Palette (<kbd>Cmd/Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd>).
3. Start exploring:

```python
import pandas as pd
import numpy as np

x = 42
data = {"names": ["Alice", "Bob"], "scores": [95, 88]}
df = pd.DataFrame(data)
arr = np.random.rand(1000, 100)   # paginated grid keeps this snappy
```

Variables appear in the sidebar as they're created — click any row to open its detail view.

## Commands & shortcuts

| Action | Command | Where |
| --- | --- | --- |
| Start the kernel + panels | `Variables: Start Console` | Command Palette |
| Run selection or current line | `Variables: Run Selection/Line in IPython Console` | Editor right-click |
| Run the whole file | `Variables: Run File in IPython Console` | Editor toolbar (▶) |
| Refresh the explorer | `Variables: Refresh` | Explorer title bar |
| Clear console + reset prompt | `Variables: Clear Console` · <kbd>Cmd/Ctrl</kbd>+<kbd>K</kbd> | Console title bar |
| Reset kernel namespace (`%reset -f`) | `Variables: Clear Variables` | Explorer title bar |

## Contributing

Contributions are welcome — see [`CONTRIBUTING.md`](./CONTRIBUTING.md) for environment setup, the build/test loop (`npm run compile`, `python test/snippet_smoke_test.py`), and PR conventions. Issues and feature ideas are equally valued.

## License

Released under the [MIT License](./LICENSE).
