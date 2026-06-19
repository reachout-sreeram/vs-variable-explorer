(function () {
  const vscode = acquireVsCodeApi();
  const contentContainer = document.getElementById("content");

  // Tell the extension we are loaded and ready for data
  vscode.postMessage({ command: "ready" });

  window.addEventListener("message", (event) => {
    const message = event.data;
    switch (message.command) {
      case "show":
        render(message.detail);
        break;
    }
  });

  function render(detail) {
    contentContainer.innerHTML = "";

    if (detail.error) {
      renderError(detail.error);
      return;
    }

    // 1. Render Header
    const header = document.createElement("div");
    header.className = "detail-header";

    const title = document.createElement("div");
    title.className = "detail-title";
    title.innerText = detail.name;
    header.appendChild(title);

    const typeBadge = document.createElement("span");
    typeBadge.className = "badge";
    typeBadge.innerText = detail.type;
    header.appendChild(typeBadge);

    if (detail.kind === "dataframe" && detail.shape) {
      const shapeBadge = document.createElement("span");
      shapeBadge.className = "badge badge-shape";
      shapeBadge.innerText = `${detail.shape[0]} rows × ${detail.shape[1]} cols`;
      header.appendChild(shapeBadge);
    }

    contentContainer.appendChild(header);

    // 2. Render Body
    if (detail.kind === "dataframe") {
      renderDataFrame(detail);
    } else if (detail.kind === "json") {
      renderJSONTree(detail.data);
    } else if (detail.kind === "scalar") {
      renderScalar(detail.data);
    }
  }

  function renderError(error) {
    const errContainer = document.createElement("div");
    errContainer.className = "error-container";

    const title = document.createElement("div");
    title.className = "error-title";
    title.innerText = "Failed to load variable details";
    errContainer.appendChild(title);

    const msg = document.createElement("div");
    msg.innerText = error;
    errContainer.appendChild(msg);

    contentContainer.appendChild(errContainer);
  }

  function loadPage(name, rowOffset, rowLimit, colOffset, colLimit) {
    vscode.postMessage({
      command: "loadPage",
      name: name,
      rowOffset: rowOffset,
      rowLimit: rowLimit,
      colOffset: colOffset,
      colLimit: colLimit
    });
  }

  function renderDataFrame(detail) {
    const totalRows = detail.shape[0];
    const totalCols = detail.shape[1];
    const rowOffset = detail.row_offset !== undefined ? detail.row_offset : 0;
    const rowLimit = detail.row_limit !== undefined ? detail.row_limit : 200;
    const colOffset = detail.col_offset !== undefined ? detail.col_offset : 0;
    const colLimit = detail.col_limit !== undefined ? detail.col_limit : 50;

    const needRowPages = totalRows > rowLimit;
    const needColPages = totalCols > colLimit;

    // Render Pagination controls if either rows or columns exceed limits
    if (needRowPages || needColPages) {
      const paginationDiv = document.createElement("div");
      paginationDiv.className = "pagination-container";

      // --- Row Pagination Group (Vertical Page controls using Up/Down indicators) ---
      if (needRowPages) {
        const rowGroup = document.createElement("div");
        rowGroup.className = "pagination-group row-group";

        const rowLabel = document.createElement("span");
        rowLabel.className = "pagination-label";
        rowLabel.innerText = "Rows:";
        rowGroup.appendChild(rowLabel);

        const rowFirst = document.createElement("button");
        rowFirst.className = "pagination-btn row-btn";
        rowFirst.innerHTML = '<div class="btn-stack"><span>▲</span><span>▲</span></div>';
        rowFirst.title = "First Page (Rows)";
        rowFirst.disabled = (rowOffset === 0);
        rowFirst.addEventListener("click", () => {
          loadPage(detail.name, 0, rowLimit, colOffset, colLimit);
        });
        rowGroup.appendChild(rowFirst);

        const rowPrev = document.createElement("button");
        rowPrev.className = "pagination-btn row-btn";
        rowPrev.innerText = "▲";
        rowPrev.title = "Previous Page (Rows)";
        rowPrev.disabled = (rowOffset === 0);
        rowPrev.addEventListener("click", () => {
          loadPage(detail.name, Math.max(0, rowOffset - rowLimit), rowLimit, colOffset, colLimit);
        });
        rowGroup.appendChild(rowPrev);

        const rowEnd = Math.min(rowOffset + rowLimit, totalRows);
        const rowInfo = document.createElement("span");
        rowInfo.className = "pagination-info";
        rowInfo.innerText = `${rowOffset + 1} – ${rowEnd} of ${totalRows}`;
        rowGroup.appendChild(rowInfo);

        const rowNext = document.createElement("button");
        rowNext.className = "pagination-btn row-btn";
        rowNext.innerText = "▼";
        rowNext.title = "Next Page (Rows)";
        rowNext.disabled = (rowOffset + rowLimit >= totalRows);
        rowNext.addEventListener("click", () => {
          loadPage(detail.name, rowOffset + rowLimit, rowLimit, colOffset, colLimit);
        });
        rowGroup.appendChild(rowNext);

        const rowLast = document.createElement("button");
        rowLast.className = "pagination-btn row-btn";
        rowLast.innerHTML = '<div class="btn-stack"><span>▼</span><span>▼</span></div>';
        rowLast.title = "Last Page (Rows)";
        rowLast.disabled = (rowOffset + rowLimit >= totalRows);
        rowLast.addEventListener("click", () => {
          const remainder = totalRows % rowLimit;
          const lastOffset = remainder === 0 ? totalRows - rowLimit : totalRows - remainder;
          loadPage(detail.name, Math.max(0, lastOffset), rowLimit, colOffset, colLimit);
        });
        rowGroup.appendChild(rowLast);

        paginationDiv.appendChild(rowGroup);
      }

      if (needRowPages && needColPages) {
        const divider = document.createElement("div");
        divider.className = "pagination-divider";
        paginationDiv.appendChild(divider);
      }

      // --- Column Pagination Group (Horizontal Page controls using Left/Right indicators) ---
      if (needColPages) {
        const colGroup = document.createElement("div");
        colGroup.className = "pagination-group col-group";

        const colLabel = document.createElement("span");
        colLabel.className = "pagination-label";
        colLabel.innerText = "Columns:";
        colGroup.appendChild(colLabel);

        const colFirst = document.createElement("button");
        colFirst.className = "pagination-btn col-btn";
        colFirst.innerText = "«";
        colFirst.title = "First Page (Columns)";
        colFirst.disabled = (colOffset === 0);
        colFirst.addEventListener("click", () => {
          loadPage(detail.name, rowOffset, rowLimit, 0, colLimit);
        });
        colGroup.appendChild(colFirst);

        const colPrev = document.createElement("button");
        colPrev.className = "pagination-btn col-btn";
        colPrev.innerText = "◀";
        colPrev.title = "Previous Page (Columns)";
        colPrev.disabled = (colOffset === 0);
        colPrev.addEventListener("click", () => {
          loadPage(detail.name, rowOffset, rowLimit, Math.max(0, colOffset - colLimit), colLimit);
        });
        colGroup.appendChild(colPrev);

        const colEnd = Math.min(colOffset + colLimit, totalCols);
        const colInfo = document.createElement("span");
        colInfo.className = "pagination-info";
        colInfo.innerText = `${colOffset + 1} – ${colEnd} of ${totalCols}`;
        colGroup.appendChild(colInfo);

        const colNext = document.createElement("button");
        colNext.className = "pagination-btn col-btn";
        colNext.innerText = "▶";
        colNext.title = "Next Page (Columns)";
        colNext.disabled = (colOffset + colLimit >= totalCols);
        colNext.addEventListener("click", () => {
          loadPage(detail.name, rowOffset, rowLimit, colOffset + colLimit, colLimit);
        });
        colGroup.appendChild(colNext);

        const colLast = document.createElement("button");
        colLast.className = "pagination-btn col-btn";
        colLast.innerText = "»";
        colLast.title = "Last Page (Columns)";
        colLast.disabled = (colOffset + colLimit >= totalCols);
        colLast.addEventListener("click", () => {
          const remainder = totalCols % colLimit;
          const lastOffset = remainder === 0 ? totalCols - colLimit : totalCols - remainder;
          loadPage(detail.name, rowOffset, rowLimit, Math.max(0, lastOffset), colLimit);
        });
        colGroup.appendChild(colLast);

        paginationDiv.appendChild(colGroup);
      }

      const header = document.querySelector(".detail-header");
      if (header) {
        header.appendChild(paginationDiv);
      } else {
        contentContainer.appendChild(paginationDiv);
      }
    }

    const gridContainer = document.createElement("div");
    gridContainer.className = "grid-container";

    const table = document.createElement("table");
    table.className = "dataframe-table";

    // Table Header
    const thead = document.createElement("thead");
    const headerTr = document.createElement("tr");

    // Corner Empty Header for Index
    const cornerTh = document.createElement("th");
    cornerTh.className = "index-header";
    cornerTh.innerText = "index";
    headerTr.appendChild(cornerTh);

    detail.columns.forEach((colName) => {
      const th = document.createElement("th");
      th.innerText = colName;
      headerTr.appendChild(th);
    });

    thead.appendChild(headerTr);
    table.appendChild(thead);

    // Table Body
    const tbody = document.createElement("tbody");
    detail.data.forEach((row, rowIdx) => {
      const tr = document.createElement("tr");

      // Index Cell
      const indexTd = document.createElement("td");
      indexTd.className = "index-cell";
      indexTd.innerText = detail.index[rowIdx] !== undefined ? detail.index[rowIdx] : (rowOffset + rowIdx).toString();
      tr.appendChild(indexTd);

      row.forEach((val) => {
        const td = document.createElement("td");
        if (val === null || val === undefined) {
          td.innerHTML = `<span style="opacity: 0.4; font-style: italic;">NaN</span>`;
        } else {
          td.innerText = val.toString();
        }
        tr.appendChild(td);
      });

      tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    gridContainer.appendChild(table);
    contentContainer.appendChild(gridContainer);
  }

  function renderJSONTree(data) {
    const treeContainer = document.createElement("div");
    treeContainer.className = "tree-container";

    const rootNode = buildTreeDOM("Root", data, true);
    treeContainer.appendChild(rootNode);
    contentContainer.appendChild(treeContainer);
  }

  function buildTreeDOM(key, val, isLast = true) {
    const node = document.createElement("div");
    node.className = "tree-node";

    const row = document.createElement("div");
    row.className = "tree-row";

    const keySpan = document.createElement("span");
    keySpan.className = "tree-key";
    keySpan.innerText = key;

    const valueSpan = document.createElement("span");
    valueSpan.className = "tree-value";

    const isExpandable = val !== null && typeof val === "object";

    if (isExpandable) {
      row.classList.add("expandable");
      row.classList.add("expanded"); // Starts expanded

      const toggle = document.createElement("span");
      toggle.className = "tree-toggle";
      row.appendChild(toggle);
      row.appendChild(keySpan);

      const isArray = Array.isArray(val);
      const size = isArray ? val.length : Object.keys(val).length;
      const typeDesc = document.createElement("span");
      typeDesc.className = "tree-value type-desc";
      typeDesc.innerText = isArray ? `list (${size} items)` : `dict (${size} items)`;
      row.appendChild(typeDesc);

      node.appendChild(row);

      // Render Children
      const childrenContainer = document.createElement("div");
      childrenContainer.className = "tree-children";

      if (isArray) {
        val.forEach((item, idx) => {
          childrenContainer.appendChild(buildTreeDOM(idx.toString(), item, idx === val.length - 1));
        });
      } else {
        const keys = Object.keys(val);
        keys.forEach((k, idx) => {
          childrenContainer.appendChild(buildTreeDOM(k, val[k], idx === keys.length - 1));
        });
      }

      node.appendChild(childrenContainer);

      // Handle toggle expand/collapse clicks
      row.addEventListener("click", (e) => {
        e.stopPropagation();
        if (row.classList.contains("expanded")) {
          row.classList.remove("expanded");
          row.classList.add("collapsed");
        } else {
          row.classList.remove("collapsed");
          row.classList.add("expanded");
        }
      });
    } else {
      // Leaf Node (Scalar)
      const spacer = document.createElement("span");
      spacer.className = "tree-toggle"; // spacer
      row.appendChild(spacer);
      row.appendChild(keySpan);

      if (val === null) {
        valueSpan.className = "tree-value null";
        valueSpan.innerText = "None";
      } else {
        const type = typeof val;
        valueSpan.className = `tree-value ${type}`;
        if (type === "string") {
          valueSpan.innerText = `"${val}"`;
        } else {
          valueSpan.innerText = val.toString();
        }
      }
      row.appendChild(valueSpan);
      node.appendChild(row);
    }

    return node;
  }

  function renderScalar(data) {
    const scalarContainer = document.createElement("div");
    scalarContainer.className = "scalar-container";
    scalarContainer.innerText = data;
    contentContainer.appendChild(scalarContainer);
  }
})();
