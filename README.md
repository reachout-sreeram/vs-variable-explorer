<p align="center">
  <img src="media/icon-256.png" width="120" alt="Variable Explorer logo" />
</p>

<h1 align="center">Variable Explorer & IPython Console</h1>

<p align="center">Spyder-style variable inspection inside VS Code.</p>

---

A live **variable explorer** in the sidebar and a real **IPython console** in the panel. Run a plain `.py` file, watch your variables populate, and click into any DataFrame, array, or nested dict — no notebook required.

## Features

- **Variable explorer** — a sidebar table of names, types, sizes, and value previews that refreshes as your code runs, with live filtering and color-coded type badges.
- **IPython console** — full `In [N]:` / `Out[N]:` prompts next to the integrated terminal, with command history, streamed output, and real tracebacks.
- **Click to inspect** — open DataFrames, Series, and 2-D NumPy arrays in a sortable grid; explore dicts and lists as a collapsible tree.
- **Handles big data** — paged grids keep large matrices responsive.
- **Run your way** — *Run Selection/Line* from the right-click menu, or *Run File* from the editor toolbar.

## Requirements

- VS Code `^1.90.0`
- The [Python extension](https://marketplace.visualstudio.com/items?itemName=ms-python.python) (`ms-python.python`)
- A Python environment with the introspection packages:

```bash
pip install jupyter_client ipykernel pyzmq spyder-kernels==3.1.4
```

## Getting started

1. Open a Python file.
2. Run **`Variables: Start Console`** from the Command Palette (`Ctrl/Cmd+Shift+P`).
3. Run your code — variables appear in the sidebar as they're created. Click any row to inspect it.

## Commands

| Action | Command |
| --- | --- |
| Start the kernel + panels | `Variables: Start Console` |
| Run selection or current line | `Variables: Run Selection/Line in IPython Console` |
| Run the whole file | `Variables: Run File in IPython Console` |
| Refresh the explorer | `Variables: Refresh` |
| Clear console (`Ctrl/Cmd+K`) | `Variables: Clear Console` |
| Reset kernel namespace | `Variables: Clear Variables` |

## Issues & contributing

Contributions are welcome — see [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

[MIT](./LICENSE) © Saketh Sreeram
