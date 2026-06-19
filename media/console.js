(function () {
  const vscode = acquireVsCodeApi();
  let executionCount = 1;
  let executionCountOffset = 0;
  const history = [];
  let historyIndex = -1;
  let currentInputDraft = "";

  const consoleInput = document.getElementById("console-input");
  const consoleOutput = document.getElementById("console-output");
  const outputRows = document.getElementById("output-rows");
  const statusIndicator = document.getElementById("status-indicator");
  const statusText = document.getElementById("status-text");

  // Keep track of the last created output container to stream text into it
  let currentOutputRow = null;
  let currentStreamContainer = null;

  // Set up message listeners
  window.addEventListener("message", (event) => {
    const message = event.data;
    switch (message.command) {
      case "output":
        appendStreamOutput(message.type, message.text);
        break;
      case "error":
        appendErrorOutput(message.ename, message.evalue, message.traceback);
        break;
      case "status":
        updateStatus(message.status);
        break;
      case "input_echo":
        createInputEchoRow(message.code, message.executionCount);
        break;
      case "clear":
        outputRows.innerHTML = "";
        currentOutputRow = null;
        currentStreamContainer = null;
        executionCountOffset = executionCount - 1;
        updatePromptLabel();
        break;
    }
  });

  // Automatically focus on the console input on load
  consoleInput.focus();

  // Handle Cmd+K / Ctrl+K clearing shortcut
  window.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "k") {
      e.preventDefault();
      outputRows.innerHTML = "";
      currentOutputRow = null;
      currentStreamContainer = null;
      executionCountOffset = executionCount - 1;
      updatePromptLabel();
    }
  });

  // Dynamic autogrow textarea
  consoleInput.addEventListener("input", () => {
    autoGrow(consoleInput);
  });

  function autoGrow(element) {
    element.style.height = "auto";
    element.style.height = (element.scrollHeight) + "px";
  }

  // Handle keystroke navigation & execution
  consoleInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const code = consoleInput.value;
      if (!code.trim()) {
        return;
      }
      
      executeCode(code);
    } else if (e.key === "ArrowUp") {
      // Recall previous command from history
      const cursorPosition = consoleInput.selectionStart;
      const lines = consoleInput.value.split("\n");
      const currentLineIndex = consoleInput.value.substring(0, cursorPosition).split("\n").length - 1;
      
      if (currentLineIndex === 0 && history.length > 0) {
        e.preventDefault();
        if (historyIndex === -1) {
          currentInputDraft = consoleInput.value;
          historyIndex = history.length - 1;
        } else if (historyIndex > 0) {
          historyIndex--;
        }
        consoleInput.value = history[historyIndex];
        autoGrow(consoleInput);
        // Move cursor to start
        consoleInput.setSelectionRange(0, 0);
      }
    } else if (e.key === "ArrowDown") {
      // Recall next command from history
      const cursorPosition = consoleInput.selectionStart;
      const lines = consoleInput.value.split("\n");
      const currentLineIndex = consoleInput.value.substring(0, cursorPosition).split("\n").length - 1;
      
      if (currentLineIndex === lines.length - 1 && historyIndex !== -1) {
        e.preventDefault();
        if (historyIndex < history.length - 1) {
          historyIndex++;
          consoleInput.value = history[historyIndex];
        } else {
          historyIndex = -1;
          consoleInput.value = currentInputDraft;
        }
        autoGrow(consoleInput);
      }
    }
  });

  function updatePromptLabel() {
    const label = document.getElementById("input-prompt-label");
    if (label) {
      const displayCount = executionCount - executionCountOffset;
      label.innerText = `In [${displayCount}]:`;
    }
  }

  function executeCode(code) {
    // 1. Add to history
    history.push(code);
    historyIndex = -1;
    currentInputDraft = "";

    // 2. Post execute command to extension host
    vscode.postMessage({
      command: "execute",
      code: code
    });

    // 3. Reset input
    consoleInput.value = "";
    consoleInput.style.height = "auto";
    updatePromptLabel();

    // Auto scroll to bottom
    consoleOutput.scrollTop = consoleOutput.scrollHeight;
  }

  function createInputEchoRow(code, count) {
    executionCount = count + 1;
    updatePromptLabel();

    // Create new output row container
    currentOutputRow = document.createElement("div");
    currentOutputRow.className = "output-row";

    const echoDiv = document.createElement("div");
    echoDiv.className = "input-echo";

    const promptSymbol = document.createElement("div");
    promptSymbol.className = "prompt-symbol";
    const displayCount = count - executionCountOffset;
    promptSymbol.innerText = `In [${displayCount}]:`;

    const codeContent = document.createElement("div");
    codeContent.className = "code-content";
    codeContent.innerText = code;

    echoDiv.appendChild(promptSymbol);
    echoDiv.appendChild(codeContent);
    currentOutputRow.appendChild(echoDiv);
    
    outputRows.appendChild(currentOutputRow);
    currentStreamContainer = null; // Reset current stream receiver for this block
    consoleOutput.scrollTop = consoleOutput.scrollHeight;
  }

  function appendStreamOutput(type, text) {
    if (!currentOutputRow) {
      // Fallback if somehow output is received before user hits enter
      currentOutputRow = document.createElement("div");
      currentOutputRow.className = "output-row";
      outputRows.appendChild(currentOutputRow);
    }

    // Check if we can append to the existing stream container in this row
    if (currentStreamContainer && currentStreamContainer.dataset.type === type) {
      const textNode = document.createTextNode(text);
      currentStreamContainer.querySelector(".stream-content").appendChild(textNode);
    } else {
      const streamDiv = document.createElement("div");
      streamDiv.className = "output-stream";

      // If it's a direct result Out[N], add the Out prompt symbol
      const prompt = document.createElement("div");
      if (type === "result") {
        prompt.className = "prompt-out-symbol";
        const displayOutCount = executionCount - 1 - executionCountOffset;
        prompt.innerText = `Out[${displayOutCount}]:`;
      } else {
        prompt.className = "prompt-symbol"; // blank space
        prompt.innerText = "";
      }

      const content = document.createElement("div");
      content.className = `stream-content ${type}`;
      content.innerText = text;

      streamDiv.appendChild(prompt);
      streamDiv.appendChild(content);
      currentOutputRow.appendChild(streamDiv);

      // Keep reference to append further text streams
      currentStreamContainer = streamDiv;
      currentStreamContainer.dataset.type = type;
    }

    consoleOutput.scrollTop = consoleOutput.scrollHeight;
  }

  function appendErrorOutput(ename, evalue, traceback) {
    if (!currentOutputRow) {
      currentOutputRow = document.createElement("div");
      currentOutputRow.className = "output-row";
      outputRows.appendChild(currentOutputRow);
    }

    const tracebackDiv = document.createElement("div");
    tracebackDiv.className = "error-traceback";
    
    if (traceback && traceback.length > 0) {
      tracebackDiv.innerText = traceback.join("\n");
    } else {
      tracebackDiv.innerText = `${ename}: ${evalue}`;
    }

    currentOutputRow.appendChild(tracebackDiv);
    consoleOutput.scrollTop = consoleOutput.scrollHeight;
  }

  function updateStatus(status) {
    // status: 'starting' | 'ready' | 'busy' | 'idle'
    statusIndicator.className = `status-indicator ${status}`;
    statusText.innerText = status;
  }
})();
