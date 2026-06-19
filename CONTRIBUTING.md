# Contributing to Variable Explorer & IPython Console for VSCode

Thank you for your interest in contributing to this project! Contributions are welcomed from the community, and the following guidelines are intended to ensure that the contribution process remains consistent, efficient, and maintainable.

---

## 1. Development Environment Setup

Assuming you have already cloned the repository and opened it in your terminal or editor, follow these steps to set up your local development environment:

1. **Install Node.js dependencies**:
   ```bash
   npm install
   ```

2. **Install Python dependencies**:
   Ensure you have a Python environment selected. The extension interacts with the Python kernel, which requires `jupyter_client`, `ipykernel`, and `pyzmq` installed in your environment. For full variable introspection, you must also install `spyder-kernels`:
   ```bash
   pip install jupyter_client ipykernel pyzmq spyder-kernels==3.1.4 pandas numpy
   ```

3. **Compile TypeScript sources**:
   Build the extension using the esbuild bundler:
   ```bash
   npm run compile
   ```
   Or run the compiler in watch mode to automatically rebuild on every file save:
   ```bash
   npm run watch
   ```

4. **Launch the Extension**:
   - Open this project directory in VSCode.
   - Press `F5` (or go to the Run and Debug view and select **Launch Extension**) to open the VSCode Extension Development Host.

---

## 2. Pull Request Guidelines

All contributions should be submitted via a Pull Request (PR). To ensure a fast and smooth review:

### Branching
- Create a new branch off `main` for your work.
- Use descriptive branch prefixes:
  - `feat/` for new features (e.g., `feat/dataframe-sorting`)
  - `fix/` for bug fixes (e.g., `fix/console-focus`)
  - `docs/` for documentation updates

### Code Quality & Standards
- **TypeScript**: Keep code modular, separate UI view logic (webviews in `media/`) from extension control logic (`src/panels/` and `src/kernel/`).
- **Python**: Maintain clean, minimal code in the IPC gateway (`python/gateway.py`) and introspection snippets (`src/kernel/snippets.ts`). Avoid external package imports other than standard Jupyter/IPython libraries.

### Verification & Testing
Before submitting a PR, make sure to test your code:
1. Run compilation to ensure no TypeScript compilation or bundling errors exist:
   ```bash
   npm run compile
   ```
2. Run the Python introspection test suite:
   ```bash
   python test/snippet_smoke_test.py
   ```
3. Perform manual verification in the Extension Development Host:
   - Verify that standard variables are displayed.
   - Verify that console commands execute and outputs flow correctly.
   - Verify that dataframes paginate and detail trees load without errors.

### Commit Guidelines
We follow the **Conventional Commits** specification:
- `feat`: A new feature (e.g., `feat: support NumPy array details`)
- `fix`: A bug fix (e.g., `fix: clear console resets prompt count`)
- `docs`: Documentation changes (e.g., `docs: update troubleshooting guide`)
- `chore`: Build process or auxiliary tool changes (e.g., `chore: update tsconfig`)

---

## 3. Reporting Issues & Feedback

If you find a bug or have a feature request:
1. Search the open issues to see if it has already been reported.
2. If not, open a new issue. Please include:
   - Clear steps to reproduce the issue.
   - Expected vs. actual behavior.
   - System details: VSCode version, Python version, installed `spyder-kernels` version, and Operating System.
