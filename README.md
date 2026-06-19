# Spyder-style Variable Explorer & IPython Console for VSCode

A Visual Studio Code extension that provides a read-only variable explorer side-panel and a bottom-docked IPython console, bringing Spyder's interactive data exploration workflow directly into VSCode.

---

## Features

- **Variables Explorer Sidebar**:
  - Automatically updates as you execute code in the console.
  - Interactive table displaying variable names, types, sizes, and value previews.
  - Quick filter-by-name/type search bar.
  - Color-coded badges for common data types.
- **IPython Console**:
  - Full IPython prompt (`In [N]:` / `Out[N]:`) in the bottom panel next to VSCode Terminal.
  - Keeps command history (use Up/Down arrow keys to recall previous commands).
  - Streams prints, logs, execution results, and runtime errors in real time.
- **DataFrame Grid & JSON Tree Details**:
  - Inspect DataFrames, Series, and 2D NumPy arrays in a tabular grid with sorting and sticky headers.
  - Explore dictionaries, lists, and JSON-like objects in a collapsible tree representation.
  - Dynamic 2-axis paging (200 rows × 50 columns) for high-performance matrix viewing.
- **Run Selections and Files**:
  - **Run Selection**: Highlight any Python code block, right-click, and select `Variables: Run Selection/Line in IPython Console` to run it.
  - **Run File**: Click the play-circle button in the editor toolbar. Executes via a clean `runfile('path', wdir='dir')` command without echoing the entire file text inside the console.
- **Context Preservation**:
  - Changing tabs (e.g. from Variable Explorer to File Explorer, or from IPython Console to Terminal) does not reset console outputs, scroll positions, or active paginations.
- **Independent Clear Actions**:
  - **Clear Console**: Click the trash icon in the console panel or press `Cmd+K` (macOS) / `Ctrl+K` (Windows/Linux) to clear console logs and reset prompt counters back to `In [1]:`.
  - **Clear Variables**: Click the trash icon in the variables sidebar to wipe the IPython kernel's user namespace (`%reset -f`).

---

## Dependencies

1. **VSCode Python Extension**:
   - The extension relies on `ms-python.python` to resolve python environments.
2. **Python Packages**:
   - The active Python environment must have `jupyter_client`, `ipykernel`, and `pyzmq` installed.
   - For introspection capabilities, install `spyder-kernels` (version `3.1.4` is recommended):
     ```bash
     pip install jupyter_client ipykernel pyzmq spyder-kernels==3.1.4
     ```

---

## Getting Started

1. **Launch the Extension**:
   - Open this directory in VSCode.
   - Press `F5` to start a new VSCode Extension Development Host instance.
2. **Boot the Console**:
   - In the Extension Development Host window, open a Python file.
   - Run the command `Variables: Start Console` from the VSCode Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`).
   - The sidebar variable explorer and the bottom IPython console panel will activate.
3. **Explore Data**:
   - Run a script or enter commands directly in the console input box:
     ```python
     import pandas as pd
     import numpy as np
     
     # Create some variables
     x = 42
     data = {'names': ['Alice', 'Bob'], 'scores': [95, 88]}
     df = pd.DataFrame(data)
     arr = np.random.rand(1000, 100) # Grid detail supports pagination!
     ```
   - Watch the variables pop up in the sidebar. Click a row to open its detail panel!
