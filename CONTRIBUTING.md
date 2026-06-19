# Contributing to Spyder-style Variable Explorer

Thank you for your interest in contributing to this project! Contributions are welcome from everyone. Please follow these guidelines to make the contribution process smooth and productive.

---

## 1. Setting Up the Development Environment

1. **Clone the repository**:
   ```bash
   git clone https://github.com/reachout-sreeram/vs-variable-explorer.git
   cd vs-variable-explorer
   ```

2. **Install Node.js dependencies**:
   ```bash
   npm install
   ```

3. **Install Python dependencies**:
   Ensure you have a Python environment selected in VSCode, then run:
   ```bash
   pip install jupyter_client ipykernel pyzmq spyder-kernels==3.1.4 pandas numpy
   ```

4. **Compile TypeScript**:
   To compile the codebase using esbuild:
   ```bash
   npm run compile
   ```
   Or use the watch task for automatic builds:
   ```bash
   npm run watch
   ```

5. **Run the Extension**:
   - Open the workspace in VSCode.
   - Press `F5` (or run `Launch Extension` launch configuration) to start the Extension Development Host.

---

## 2. Pull Request Guidelines

1. **Create a branch**: Use descriptive branch names like `feature/some-feature` or `bugfix/issue-description`.
2. **Write clean code**:
   - Maintain uniform styling in TypeScript and Python files.
   - Preserve existing comments and architecture boundaries.
3. **Verify changes**:
   - Build using `npm run compile`.
   - Run the smoke test using `python test/snippet_smoke_test.py`.
   - Perform manual verification in the Extension Host.
4. **Commit messages**: Write clear, imperative commits (e.g. `feat: ...`, `fix: ...`, `docs: ...`).
5. **Open a PR**: Submit a pull request detailing your changes, motivation, and how they were tested.
