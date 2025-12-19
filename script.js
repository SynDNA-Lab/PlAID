// Data structures
let protocol = [];
let currentStep = 0;
let plateScale = 1.0; // Scale factor for plate size

// DOM Elements
const fileInput = document.getElementById("csvFile");
const sourcePlate = document.getElementById("sourcePlate");
const targetPlate = document.getElementById("targetPlate");
const infoSection = document.getElementsByClassName("info-section")[0];
const stepInfo = document.getElementById("stepInfo");
const prevStepBtn = document.getElementById("prevStep");
const nextStepBtn = document.getElementById("nextStep");
const stepCounter = document.getElementById("stepCounter");
const protocolTable = document.getElementById("protocolTable");
const tableContainer = document.getElementsByClassName("table-container")[0];
const plateChangeModal = document.getElementById("plateChangeModal");
const plateChangeMessage = document.getElementById("plateChangeMessage");
const confirmPlateChangeBtn = document.getElementById("confirmPlateChange");
const plusZoomBtn = document.getElementById("plusZoom");
const minusZoomBtn = document.getElementById("minusZoom");

let lastLayoutMode = "horizontal";

// Event Listeners
fileInput.addEventListener("change", handleFileUpload);
prevStepBtn.addEventListener("click", () => navigateStep(-1));
nextStepBtn.addEventListener("click", () => navigateStep(1));
confirmPlateChangeBtn.addEventListener("click", confirmPlateChange);

//--------------------------------------EVENT--------------------------------------
document.addEventListener("keydown", (e) => {
  // compute limit once per keypress
  const limit = computeScaleLimit();

  if (e.key === "+" || e.key === "=") {
    plateScale = Math.min(plateScale + 0.02, 2);
    updatePlateScales();
    updateZoomCounter();
  } else if (e.key === "-") {
    const min = computeMinScale();
    plateScale = Math.max(plateScale - 0.02, min);
    updatePlateScales();
    updateZoomCounter();
  }
});
//-------------------------------------------Button control-------------------------------
function updateZoomCounter() {
  document.getElementById("zoomCounter").textContent =
    `${Math.round(plateScale * 100)} %`;
}

plusZoomBtn.addEventListener("click", () => {
  const limit = computeScaleLimit();
  plateScale = Math.min(plateScale + 0.02, 2);
  updatePlateScales();
  updateZoomCounter();
});

minusZoomBtn.addEventListener("click", () => {
  const min = computeMinScale();
  plateScale = Math.max(plateScale - 0.02, min);
  updatePlateScales();
  updateZoomCounter();
});
//---------------------------------Modify layout from vertical to horizontal--------------
window.addEventListener("resize", updatePlateLayoutMode);

//---------------------------------------Compute scale-----------------------------------
function computeMinScale() {
  const containerWidth =
    document.querySelector(".plates-container").clientWidth;

  const sWidth = sourcePlate.offsetWidth;
  const tWidth = targetPlate.offsetWidth;

  const needed = sWidth + tWidth + 30; // gap

  return Math.min(1, containerWidth / needed);
}

function computeScaleLimit() {
  const container = document.querySelector(".plates-container");
  const plate1 = getUnscaledSize(sourcePlate);
  const plate2 = getUnscaledSize(targetPlate);

  const availableWidth = container.clientWidth;

  const availableHeight = window.innerHeight * 0.9;

  if (container.classList.contains("vertical")) {
    const gap = 20;

    const scaleX = availableWidth / Math.max(plate1.width, plate2.width);

    const scaleY = (availableHeight - gap) / (plate1.height + plate2.height);

    return Math.min(scaleX, 1.5);
  } else {
    const gap = 80;

    const scaleX = (availableWidth - gap) / (plate1.width + plate2.width);

    const scaleY = availableHeight / Math.max(plate1.height, plate2.height);

    return Math.min(scaleX, scaleY, 3);
  }
}

function getUnscaledSize(plate) {
  const prevTransform = plate.style.transform;

  // Temporarily remove transform
  plate.style.transform = "none";

  // Force a reflow (important!)
  const rect = plate.getBoundingClientRect();

  // Restore previous transform
  plate.style.transform = prevTransform;

  return { width: rect.width, height: rect.height };
}

function updatePlateLayoutMode() {
  const container = document.querySelector(".plates-container");
  const gap = 80;

  const rect1 = sourcePlate.getBoundingClientRect();
  const rect2 = targetPlate.getBoundingClientRect();

  const totalWidth = rect1.width + rect2.width + gap;
  const containerWidth = container.clientWidth;

  const shouldBeVertical = totalWidth > containerWidth;
  const currentMode = container.classList.contains("vertical")
    ? "vertical"
    : "horizontal";

  // --- SWITCH MODE ---
  if (shouldBeVertical && currentMode !== "vertical") {
    container.classList.add("vertical");
  } else if (!shouldBeVertical && currentMode !== "horizontal") {
    container.classList.remove("vertical");
    container.style.gap = `${gap}px`;
  }

  const newMode = container.classList.contains("vertical")
    ? "vertical"
    : "horizontal";

  if (newMode !== lastLayoutMode) {
    requestAnimationFrame(() => {
      if (newMode === "vertical") {
        updateVerticalLayoutStable();
      } else {
        updateHorizontalLayoutStable();
      }
    });

    lastLayoutMode = newMode;
  }
}

function getRenderedRect(el) {
  if (!el) return { width: 0, height: 0 };
  return el.getBoundingClientRect();
}

function updateVerticalLayoutStable() {
  const container = document.querySelector(".plates-container");

  const rect1 = sourcePlate.getBoundingClientRect();
  const rect2 = targetPlate.getBoundingClientRect();

  const gap = 10;
  const totalHeight = (rect1.height + rect2.height) * 1.1 + gap;

  container.style.height = `${Math.ceil(totalHeight)}px`;
}

const MIN_GAP = 40; // Minimum vertical gap between plates

function updatePlateScales() {
  const container = document.querySelector(".plates-container");

  sourcePlate.style.transform = `scale(${plateScale})`;
  targetPlate.style.transform = `scale(${plateScale})`;

  requestAnimationFrame(() => {
    updatePlateLayoutMode();

    requestAnimationFrame(() => {
      const max = computeScaleLimit();

      if (container.classList.contains("vertical")) {
        updateVerticalLayoutStable();
      } else {
        updateHorizontalLayoutStable();
      }
    });
  });
}

function updateHorizontalLayoutStable() {
  const container = document.querySelector(".plates-container");
  if (!container) return;

  const rect1 = sourcePlate.getBoundingClientRect();
  const rect2 = targetPlate.getBoundingClientRect();

  const newHeight = Math.max(rect1.height, rect2.height);

  container.style.height = `${Math.ceil(newHeight)}px`;
  container.dataset.debugHeight = Math.ceil(newHeight);

  // fixed horizontal gap — no bouncing
  container.style.gap = "80px";
}

async function handleFileUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  const text = await file.text();
  const rows = text
    .split("\n")
    .map((row) => row.trim())
    .filter((row) => row);

  const header = rows[0].split(",").map((h) => h.trim());

  protocol = rows.slice(1).map((row) => {
    const values = row.split(",");
    const step = {
      source_plate_name: values[0],
      source_plate_density: values[1],
      source_plate_row: values[2],
      source_plate_column: values[3],
      target_plate_name: values[4],
      target_plate_density: values[5],
      target_plate_row: values[6],
      target_plate_column: values[7],

      // Everything after column index 7 is an extra column
      extra: {},
    };

    for (let i = 8; i < values.length; i++) {
      const colName = header[i] || `extra_${i}`;
      step.extra[colName] = values[i];
    }

    return step;
  });

  initializeProtocol();
}

// Protocol initialization
function initializeProtocol() {
  if (protocol.length === 0) return;

  currentStep = 0;
  updateNavigationButtons();
  displayProtocolTable();
  showStep(currentStep);
}

// Navigation
function navigateStep(delta) {
  const nextStep = currentStep + delta;
  if (nextStep < 0 || nextStep >= protocol.length) return;

  const currentPlates = {
    source: protocol[currentStep].source_plate_name,
    target: protocol[currentStep].target_plate_name,
  };

  const nextPlates = {
    source: protocol[nextStep].source_plate_name,
    target: protocol[nextStep].target_plate_name,
  };

  if (
    currentPlates.source !== nextPlates.source ||
    currentPlates.target !== nextPlates.target
  ) {
    showPlateChangeModal(currentPlates, nextPlates, nextStep);
  } else {
    currentStep = nextStep;
    showStep(currentStep);
  }
}

// Plate change handling
function showPlateChangeModal(currentPlates, nextPlates, nextStep) {
  let changes = [];

  if (currentPlates.source !== nextPlates.source) {
    changes.push(
      `Source plate change: ${currentPlates.source} → ${nextPlates.source}`
    );
  }
  if (currentPlates.target !== nextPlates.target) {
    changes.push(
      `Target plate change: ${currentPlates.target} → ${nextPlates.target}`
    );
  }

  plateChangeMessage.textContent = changes.join("\n");
  plateChangeModal.classList.add("active");

  confirmPlateChangeBtn.onclick = () => {
    plateChangeModal.classList.remove("active");
    currentStep = nextStep;
    showStep(currentStep);
  };
}

function confirmPlateChange() {
  plateChangeModal.classList.remove("active");
}

// Display functions
function showStep(stepIndex) {
  const step = protocol[stepIndex];
  if (!step) return;

  // Clear previous highlights
  clearPlates();

  // Create and highlight wells
  createPlate(
    sourcePlate,
    step.source_plate_density,
    `Source Plate: ${step.source_plate_name}`
  );

  createPlate(
    targetPlate,
    step.target_plate_density,
    `Target Plate: ${step.target_plate_name}`
  );

  highlightWell(
    sourcePlate,
    step.source_plate_row,
    step.source_plate_column,
    step.source_plate_density
  );
  highlightWell(
    targetPlate,
    step.target_plate_row,
    step.target_plate_column,
    step.target_plate_density
  );

  // Correct version: ensures proper sizing
  requestAnimationFrame(() => {
    updatePlateLayoutMode(); // first determine vertical/horizontal
    updatePlateScales(); // apply scale transform
  });

  // Update step information and navigation
  updateStepInfo(step);
  updateNavigationButtons();
  updateStepCounter();
  highlightCurrentStepInTable();
}

function createPlate(plateElement, density, labelText) {
  plateElement.innerHTML = "";

  const label = document.createElement("div");

  plateElement.className = `plate format-${density}`;
  label.className = "plate-label";
  label.textContent = labelText;
  plateElement.appendChild(label);
  const rows = density === "384" ? 16 : 8;
  const cols = density === "384" ? 24 : 12;

  // Create column headers
  const headerRow = document.createElement("div");
  headerRow.className = "plate-header";
  //headerRow.appendChild(document.createElement('div')); // Empty corner cell
  // Create placeholder corner cell to align with row header
  const header = document.createElement("div");
  header.className = "col-header";
  header.textContent = " ";
  headerRow.appendChild(header);
  for (let col = 1; col <= cols; col++) {
    const header = document.createElement("div");
    header.className = "col-header";
    header.textContent = col;
    headerRow.appendChild(header);
  }
  plateElement.appendChild(headerRow);

  // Create rows with row headers and wells
  for (let row = 0; row < rows; row++) {
    const rowElement = document.createElement("div");
    rowElement.className = "plate-row";

    // Add row header
    const rowHeader = document.createElement("div");
    rowHeader.className = "row-header";
    rowHeader.textContent = String.fromCharCode(65 + row); // A, B, C, etc.
    rowElement.appendChild(rowHeader);

    // Add wells
    for (let col = 0; col < cols; col++) {
      const well = document.createElement("div");
      well.className = "well";
      well.id = `well-${plateElement.id}-${String.fromCharCode(65 + row)}${
        col + 1
      }`;
      const wellLabel = document.createElement("span");
      wellLabel.className = "well-label";
      wellLabel.textContent = `${String.fromCharCode(65 + row)}${col + 1}`;
      well.appendChild(wellLabel);
      rowElement.appendChild(well);
    }

    plateElement.appendChild(rowElement);
  }
}

function highlightWell(plateElement, row, col, density) {
  const wellId = `well-${plateElement.id}-${row}${col}`;
  const well = document.getElementById(wellId);
  if (well) {
    well.classList.add("highlighted");
  }
}

function clearPlates() {
  sourcePlate.innerHTML = "";
  targetPlate.innerHTML = "";
}

function updateStepInfo(step) {
  const sourceWell = `${step.source_plate_row}${step.source_plate_column}`;
  const targetWell = `${step.target_plate_row}${step.target_plate_column}`;

  // Build additional info block dynamically
  const extraInfoHTML = Object.entries(step.extra)
    .map(([key, value]) => `<div><strong>${key}:</strong> ${value}</div>`)
    .join("");

  stepInfo.innerHTML = `
    <div class="additional-info">${extraInfoHTML}</div>
  `;
}

function updateNavigationButtons() {
  prevStepBtn.disabled = currentStep === 0;
  nextStepBtn.disabled = currentStep === protocol.length - 1;
}

function updateStepCounter() {
  stepCounter.textContent = `Step ${currentStep + 1} of ${protocol.length}`;
}

function displayProtocolTable() {
  const tbody = protocolTable.querySelector("tbody");
  tbody.innerHTML = "";

  protocol.forEach((step, index) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${index + 1}</td>
      <td>${step.source_plate_name}</td>
      <td>${step.source_plate_row}${step.source_plate_column}</td>
      <td>${step.target_plate_name}</td>
      <td>${step.target_plate_row}${step.target_plate_column}</td>
      <td>${getAdditionalInfo(step)}</td>
    `;
    tbody.appendChild(row);
  });
}

function getAdditionalInfo(step) {
  return Object.entries(step.extra)
    .map(([k, v]) => `${k}: ${v}`)
    .join("<br>");
}

function highlightCurrentStepInTable() {
  const rows = protocolTable.querySelectorAll("tbody tr");
  rows.forEach((row, index) => {
    if (index === currentStep) {
      row.classList.add("current-step");
      tableContainer.scrollTop = row.offsetTop - 20;
    } else {
      row.classList.remove("current-step");
    }
    //row.classList.toggle('current-step', index === currentStep);
  });
}
