(function () {
  const vscode = acquireVsCodeApi();
  let variables = {};
  let filterText = "";

  const searchInput = document.getElementById("search-input");
  const refreshBtn = document.getElementById("refresh-btn");
  const varsTable = document.getElementById("vars-table");
  const varsBody = document.getElementById("vars-body");
  const emptyState = document.getElementById("empty-state");

  // Handle message updates from extension host
  window.addEventListener("message", (event) => {
    const message = event.data;
    switch (message.command) {
      case "update":
        variables = message.variables || {};
        render();
        break;
    }
  });

  // Filter input logic
  searchInput.addEventListener("input", (e) => {
    filterText = e.target.value.toLowerCase().trim();
    render();
  });

  // Refresh command triggering
  refreshBtn.addEventListener("click", () => {
    vscode.postMessage({ command: "refresh" });
  });

  function formatSize(size) {
    if (size === undefined || size === null) {
      return "-";
    }
    if (Array.isArray(size)) {
      return size.join(" × "); // e.g. 100 x 5 for DataFrames
    }
    return size.toString();
  }

  function getTypeBadgeClass(type) {
    const t = type.toLowerCase();
    if (t === "dataframe") {
      return "badge badge-dataframe";
    }
    if (["list", "dict", "tuple", "set", "ndarray", "series"].includes(t)) {
      return "badge badge-collection";
    }
    return "badge badge-type";
  }

  function render() {
    varsBody.innerHTML = "";
    
    const keys = Object.keys(variables).filter((key) => {
      const nameMatch = key.toLowerCase().includes(filterText);
      const typeMatch = (variables[key].type || "").toLowerCase().includes(filterText);
      return nameMatch || typeMatch;
    });

    if (keys.length === 0) {
      varsTable.style.display = "none";
      emptyState.style.display = "flex";
      return;
    }

    varsTable.style.display = "table";
    emptyState.style.display = "none";

    keys.forEach((name) => {
      const meta = variables[name];
      const tr = document.createElement("tr");
      tr.className = "var-row";
      
      tr.addEventListener("click", () => {
        vscode.postMessage({
          command: "openDetail",
          name: name
        });
      });

      // Name Column
      const tdName = document.createElement("td");
      tdName.className = "var-name";
      tdName.innerText = name;
      tdName.title = name;
      tr.appendChild(tdName);

      // Type Column
      const tdType = document.createElement("td");
      const spanType = document.createElement("span");
      spanType.className = getTypeBadgeClass(meta.type);
      spanType.innerText = meta.type;
      tdType.appendChild(spanType);
      tr.appendChild(tdType);

      // Size Column
      const tdSize = document.createElement("td");
      const spanSize = document.createElement("span");
      spanSize.className = "badge-size";
      spanSize.innerText = formatSize(meta.size);
      tdSize.appendChild(spanSize);
      tr.appendChild(tdSize);

      // Value Preview Column
      const tdValue = document.createElement("td");
      tdValue.className = "var-value";
      tdValue.innerText = meta.view || "";
      tdValue.title = meta.view || "";
      tr.appendChild(tdValue);

      varsBody.appendChild(tr);
    });
  }
})();
