// --- Game State & Config ---
const STORAGE_KEY_CURRENT = "luckyWheel_current";
const STORAGE_KEY_SAVES = "luckyWheel_saves";

// New pastel/warm palette
const defaultColors = [
  "#FFADAD",
  "#FFD6A5",
  "#FDFFB6",
  "#CAFFBF",
  "#9BF6FF",
  "#A0C4FF",
  "#BDB2FF",
  "#FFC6FF",
];

// Default Data
let wheelData = {
  name: "My Lucky Wheel",
  showHistory: true, // Default ON
  showItemsList: true, // Default ON
  history: [], // Array of strings (recent wins)
  segments: [
    { text: "100", color: "#ffffff", weight: 1 },
    { text: "200", color: "#fff3e0", weight: 1 },
    { text: "500", color: "#ffffff", weight: 1 },
    { text: "1000", color: "#ffe0b2", weight: 1 },
    { text: "Lose", color: "#ffffff", weight: 20 },
    { text: "Spin Again", color: "#ffcc80", weight: 20 },
  ],
};

let isSpinning = false;
let currentRotation = 0;
let rafId = null;

// Logo Image
const logoImage = new Image();
logoImage.src = "logo.png";
logoImage.onload = () => {
  drawWheel(); // Redraw when loaded
};

// --- DOM Elements ---
const canvas = document.getElementById("wheelCanvas");
const ctx = canvas.getContext("2d");
const spinBtn = document.getElementById("spinBtn");

// Modal Elements
const settingsModal = document.getElementById("settingsModal");
const settingsBtn = document.getElementById("settingsBtn");
const closeSettings = document.getElementById("closeSettings");
const segmentsList = document.getElementById("segmentsList");
const addSegmentBtn = document.getElementById("addSegmentBtn");
const wheelNameInput = document.getElementById("wheelNameInput");
const saveWheelBtn = document.getElementById("saveWheelBtn");
const savedWheelsSelect = document.getElementById("savedWheelsSelect");
const newWheelBtn = document.getElementById("newWheelBtn");
const deleteWheelBtn = document.getElementById("deleteWheelBtn");
const copyOBSLinkBtn = document.getElementById("copyOBSLinkBtn");
const showHistoryCheckbox = document.getElementById("showHistoryCheckbox");
const showItemsListCheckbox = document.getElementById("showItemsListCheckbox");

// Summary Modal Elements
const summaryModal = document.getElementById("summaryModal");
const summaryList = document.getElementById("summaryList");
const closeSummaryBtn = document.getElementById("closeSummaryBtn");

const historyContainer = document.getElementById("historyContainer");
const historyList = document.getElementById("historyList");
const clearHistoryBtn = document.getElementById("clearHistoryBtn");
const itemsListDisplay = document.getElementById("itemsListDisplay");
const itemsListUl = document.getElementById("itemsListUl");

const autoSpinInput = document.getElementById("autoSpinInput");
const autoSpinBtn = document.getElementById("autoSpinBtn");
const winnerModal = document.getElementById("winnerModal");
const winnerPrize = document.getElementById("winnerPrize");
const closeWinnerBtn = document.getElementById("closeWinnerBtn");

// State for Auto Spin
let isAutoSpinning = false;
let autoSpinCount = 0;
let autoSpinResults = []; // Track results for summary

// Backup Elements
const exportBtn = document.getElementById("exportBtn");
const importBtn = document.getElementById("importBtn");
const importFile = document.getElementById("importFile");

// --- Audio System (Web Audio API) ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playTickSound() {
  if (audioCtx.state === "suspended") audioCtx.resume();
  const osc = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();

  osc.type = "sine";
  osc.frequency.setValueAtTime(600, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(300, audioCtx.currentTime + 0.05);

  gainNode.gain.setValueAtTime(0.2, audioCtx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.05);

  osc.connect(gainNode);
  gainNode.connect(audioCtx.destination);

  osc.start();
  osc.stop(audioCtx.currentTime + 0.05);
}

function playWinSound() {
  if (audioCtx.state === "suspended") audioCtx.resume();

  // Simple fanfare
  const now = audioCtx.currentTime;
  const notes = [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5];
  const times = [0, 0.1, 0.2, 0.3, 0.5, 0.6];

  notes.forEach((freq, i) => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = "square";
    osc.frequency.value = freq;

    const t = now + times[i];
    gain.gain.setValueAtTime(0.1, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start(t);
    osc.stop(t + 0.3);
  });
}

// --- Initialization ---
function init() {
  loadCurrentState();
  if (!wheelData.segments || wheelData.segments.length === 0) {
    // Fallback if data is corrupted or empty
    wheelData.segments = [
      { text: "A", color: "#FFADAD", weight: 1 },
      { text: "B", color: "#CAFFBF", weight: 1 },
      { text: "C", color: "#9BF6FF", weight: 1 },
    ];
  }
  // Ensure data compatibility
  if (!wheelData.history) wheelData.history = [];
  if (typeof wheelData.showHistory === "undefined")
    wheelData.showHistory = true;
  if (typeof wheelData.showItemsList === "undefined")
    wheelData.showItemsList = true;

  drawWheel();
  updateUIFromState(); // Render panels based on state
  setupEventListeners();

  // Try to load list initially (async)
  // setTimeout to let Firebase init
  setTimeout(() => updateSavedWheelsDropdown(), 1000);
}

function setupEventListeners() {
  spinBtn.addEventListener("click", spinWheel);

  settingsBtn.addEventListener("click", openSettings);
  closeSettings.addEventListener("click", closeSettingsModal);

  // Prevent closing when dragging text out of modal
  let isOverlayClick = false;
  settingsModal.addEventListener("mousedown", (e) => {
    isOverlayClick = e.target === settingsModal;
  });
  settingsModal.addEventListener("click", (e) => {
    if (isOverlayClick && e.target === settingsModal) closeSettingsModal();
  });

  // Copy OBS Link
  if (copyOBSLinkBtn) {
    copyOBSLinkBtn.addEventListener("click", () => {
      if (!wheelData.name || wheelData.name.startsWith("New Wheel")) {
        alert("กรุณาบันทึกชื่อวงล้อก่อนสร้างลิงก์");
        return;
      }

      const url = new URL(window.location.href);
      url.searchParams.set("mode", "obs");
      url.searchParams.set("id", wheelData.name);

      navigator.clipboard
        .writeText(url.toString())
        .then(() => {
          alert(
            "คัดลอกลิงก์ OBS เรียบร้อย! \nสามารถนำไปเปิดใน Browser Source ของ OBS ได้เลย"
          );
        })
        .catch((err) => {
          console.error("Copy failed", err);
          prompt("Copy this link:", url.toString());
        });
    });
  }

  addSegmentBtn.addEventListener("click", addSegment);
  saveWheelBtn.addEventListener("click", saveToStorage);
  newWheelBtn.addEventListener("click", createNewWheel);
  deleteWheelBtn.addEventListener("click", deleteSavedWheel);

  // Auto-load when selecting a saved wheel
  savedWheelsSelect.addEventListener("change", loadFromStorage);

  clearHistoryBtn.addEventListener("click", clearHistory);
  autoSpinBtn.addEventListener("click", startAutoSpin);
  closeWinnerBtn.addEventListener("click", closeWinnerPopup);

  closeSummaryBtn.addEventListener("click", closeSummaryModal);

  // Backup
  if (exportBtn) exportBtn.addEventListener("click", exportData);
  if (importBtn) importBtn.addEventListener("click", () => importFile.click());
  if (importFile) importFile.addEventListener("change", importData);

  // Wheel Name Input - Real-time Update
  wheelNameInput.addEventListener("input", (e) => {
    wheelData.name = e.target.value;
  });

  // Global Keyboard Shortcuts
  // Global Keyboard Shortcuts
  document.addEventListener("keydown", (e) => {
    if (e.code === "Space" || e.key === " " || e.code === "Enter") {
      // Ignore if settings modal is open
      if (!settingsModal.classList.contains("hidden")) return;
      // Ignore if in OBS mode (passive)
      if (document.body.classList.contains("obs-mode")) return;

      e.preventDefault(); // Stop scrolling
      spinWheel();
    }
  });

  // Listen for Sync Events (from other windows)
  window.addEventListener("storage", (event) => {
    if (event.key === "luckyWheel_event") {
      try {
        const data = JSON.parse(event.newValue);
        if (data && data.type === "SPIN") {
          // Trigger animation with synced target
          startWheelAnimation(
            data.winningIndex,
            data.targetRotation,
            data.duration
          );
        }
      } catch (e) {
        console.error("Sync error", e);
      }
    } else if (event.key === STORAGE_KEY_CURRENT) {
      // Sync data changes (setting update)
      loadCurrentState();
      drawWheel();
      updateUIFromState();
    }
  });

  // Check for OBS Mode
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get("mode") === "obs") {
    document.body.classList.add("obs-mode");
    // Hide controls immediately
    document.querySelector(".controls").style.display = "none";
    document.getElementById("settingsBtn").style.display = "none";

    // Load specific wheel if provided
    const wheelId = urlParams.get("id");
    if (wheelId) {
      setTimeout(() => loadWheelByName(wheelId), 1000); // Small delay for Firebase init
    }
  }
}

// --- Wheel Logic ---

function drawWheel() {
  const numSegments = wheelData.segments.length;
  if (numSegments === 0) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    return;
  }

  // Dimensions
  const w = canvas.width;
  const h = canvas.height;
  const centerX = w / 2;
  const centerY = h / 2;

  // Outer Rim Settings
  const outerRimWidth = 35;
  const innerRimWidth = 10;
  const wheelRadius = Math.min(centerX, centerY) - outerRimWidth; // Actual content radius

  ctx.clearRect(0, 0, w, h);

  ctx.save();
  ctx.translate(centerX, centerY);

  // Rotate entire wheel canvas
  const rotationRad = (currentRotation * Math.PI) / 180;
  ctx.rotate(rotationRad);

  // 1. Draw Segments
  const totalWeight = wheelData.segments.reduce(
    (sum, seg) => sum + (parseFloat(seg.weight) || 0),
    0
  );
  let currentAngle = 0;

  for (let i = 0; i < numSegments; i++) {
    const seg = wheelData.segments[i];
    const weight = parseFloat(seg.weight) || 0;
    const arcSize = (weight / totalWeight) * 2 * Math.PI;

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, wheelRadius, currentAngle, currentAngle + arcSize);
    ctx.fillStyle = seg.color || defaultColors[i % defaultColors.length];
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(0,0,0,0.1)"; // Subtle separator
    ctx.stroke();

    // Text
    ctx.save();
    ctx.fillStyle = "#5d4037"; // Dark brown text
    ctx.font = 'bold 24px "Kanit", sans-serif';

    // Rotate to center of this segment
    ctx.rotate(currentAngle + arcSize / 2);
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";

    // Prevent text from overlapping with center hub (radius 50)
    const hubRadius = 50;
    const maxTextWidth = wheelRadius - 25 - hubRadius - 10;

    ctx.fillText(seg.text, wheelRadius - 25, 0, maxTextWidth);

    // Icon (Optional - drawing a small circle for visual interest if wanted)
    // ctx.beginPath();
    // ctx.arc(wheelRadius - 80, 0, 10, 0, Math.PI * 2);
    // ctx.fillStyle = "rgba(255,255,255,0.5)";
    // ctx.fill();

    ctx.restore();

    // Advance angle
    currentAngle += arcSize;
  }

  // 2. Draw Outer Rim (Orange)
  ctx.beginPath();
  ctx.arc(0, 0, wheelRadius + outerRimWidth / 2, 0, 2 * Math.PI);
  ctx.lineWidth = outerRimWidth;
  ctx.strokeStyle = "#ff7f50"; // Dark Orange
  ctx.stroke();

  // 3. Draw Inner Rim (Yellow/Gold)
  ctx.beginPath();
  ctx.arc(0, 0, wheelRadius + 2, 0, 2 * Math.PI); // Slightly overlap segment edge
  ctx.lineWidth = innerRimWidth;
  ctx.strokeStyle = "#ffa502";
  ctx.stroke();

  // 4. Draw Lights (Dots) on Rim
  const numLights = 16;
  const lightRadius = wheelRadius + outerRimWidth / 2;

  for (let i = 0; i < numLights; i++) {
    const angle = (i / numLights) * 2 * Math.PI;
    const x = Math.cos(angle) * lightRadius;
    const y = Math.sin(angle) * lightRadius;

    ctx.beginPath();
    ctx.arc(x, y, 6, 0, 2 * Math.PI);
    // Alternate light colors or make them blink by using performance.now()
    // Making them toggle based on rotation logic loosely creates a blinking effect
    const blink = Math.floor(Date.now() / 200) % 2 === 0;
    const isAlt = i % 2 === 0;

    if (isSpinning) {
      ctx.fillStyle =
        i % 2 === Math.floor(currentRotation / 20) % 2 ? "#fff" : "#ffeaa7";
    } else {
      ctx.fillStyle = i % 2 === 0 ? "#fff" : "#ffecb3";
    }

    ctx.fill();
    ctx.shadowBlur = 5;
    ctx.shadowColor = "rgba(255, 255, 255, 0.8)";
    ctx.shadowBlur = 0; // Reset
  }

  // 5. Center Hub ("SPIN" text decoration, actual part of wheel)
  ctx.beginPath();
  ctx.arc(0, 0, 50, 0, 2 * Math.PI);
  ctx.fillStyle = "#ffca28"; // Amber
  ctx.fill();

  ctx.beginPath();
  ctx.arc(0, 0, 40, 0, 2 * Math.PI);
  ctx.fillStyle = "#fff8e1"; // Light Center
  ctx.fill();

  // Draw Logo Image if available
  ctx.rotate(-rotationRad); // Rotate back for static logo

  if (logoImage && logoImage.complete) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, 45, 0, Math.PI * 2); // Increased from 35 to 45
    ctx.clip(); // Clip to circle
    // Draw image centered, size 90x90
    ctx.drawImage(logoImage, -45, -45, 90, 90);
    ctx.restore();
  } else {
    // Fallback Text "SPIN"
    ctx.fillStyle = "#e65100";
    ctx.font = '900 24px "Outfit", sans-serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("SPIN", 0, 2);
  }

  ctx.restore();
}

function getWeightedWinner() {
  const totalWeight = wheelData.segments.reduce(
    (sum, seg) => sum + (parseFloat(seg.weight) || 0),
    0
  );
  let random = Math.random() * totalWeight;

  for (let i = 0; i < wheelData.segments.length; i++) {
    const weight = parseFloat(wheelData.segments[i].weight) || 0;
    if (random < weight) {
      return i;
    }
    random -= weight;
  }
  return 0; // Fallback
}

function spinWheel() {
  if (isSpinning || wheelData.segments.length === 0) return;

  // If in OBS mode, do not allow manual spin (wait for sync)
  if (document.body.classList.contains("obs-mode")) return;

  // 1. Calculate Result locally (as Controller)
  const winningIndex = getWeightedWinner();

  // 2. Calculate Target Rotation logic
  const numSegments = wheelData.segments.length;
  const totalWeight = wheelData.segments.reduce(
    (sum, seg) => sum + (parseFloat(seg.weight) || 0),
    0
  );

  // Calculate start angle of winner
  let angleStart = 0;
  for (let i = 0; i < winningIndex; i++) {
    const w = parseFloat(wheelData.segments[i].weight) || 0;
    angleStart += (w / totalWeight) * 360;
  }

  // Winner arc size
  const winnerWeight = parseFloat(wheelData.segments[winningIndex].weight) || 0;
  const arcSizeDeg = (winnerWeight / totalWeight) * 360;

  // Center of winning segment
  const segmentCenter = angleStart + arcSizeDeg / 2;

  const targetBase = 270 - segmentCenter;
  const randomOffset = (Math.random() - 0.5) * (arcSizeDeg * 0.8);
  const fullSpins = 360 * 6;

  const targetRotation =
    currentRotation +
    fullSpins +
    ((targetBase - (currentRotation % 360) + 360) % 360) +
    randomOffset;

  // 3. Broadcast Event to other windows (LocalStorage & Firebase)
  const syncData = {
    type: "SPIN",
    winningIndex: winningIndex,
    targetRotation: targetRotation,
    duration: 5000,
    timestamp: Date.now(),
    isAutoSpin: isAutoSpinning, // Add flag
  };
  localStorage.setItem("luckyWheel_event", JSON.stringify(syncData));

  // Sync to Firebase (for Live/OBS mode on different machines)
  if (wheelData.name && !wheelData.name.startsWith("New Wheel")) {
    const { setDoc, doc } = window.FirebaseFirestore;
    setDoc(
      doc(window.db, "wheels", wheelData.name),
      {
        spinEvent: syncData,
      },
      { merge: true }
    ).catch((err) => console.error("Broadcast failed", err));
  }

  // 4. Trigger Local Animation
  startWheelAnimation(winningIndex, targetRotation, 5000, {
    isAutoSpin: isAutoSpinning,
  });
}

function startWheelAnimation(
  winningIndex,
  targetRotation,
  duration,
  options = {}
) {
  if (isSpinning) return;

  if (audioCtx.state === "suspended") audioCtx.resume();

  isSpinning = true;
  spinBtn.disabled = true;
  if (!document.body.classList.contains("obs-mode")) {
    settingsBtn.classList.add("hidden");
  }

  // Update global state for consistency
  // (winningIndex derived from targetRotation implicitly in visual, passed here for final display)

  const startRotation = currentRotation;
  const startTime = performance.now();
  let lastAngle = currentRotation;

  // Recalculate for animation loop scope - use Average Arc for tick sound approx
  const numSegments = wheelData.segments.length;
  const arcSizeDeg = 360 / numSegments; // Average size for ticks

  function animate(time) {
    const elapsed = time - startTime;
    if (elapsed < duration) {
      const progress = elapsed / duration;
      // Ease out cubic
      const ease = 1 - Math.pow(1 - progress, 3);
      currentRotation = startRotation + (targetRotation - startRotation) * ease;

      const totalDeg = currentRotation;
      if (
        Math.floor(totalDeg / arcSizeDeg) > Math.floor(lastAngle / arcSizeDeg)
      ) {
        playTickSound();
      }
      lastAngle = totalDeg;

      drawWheel();
      rafId = requestAnimationFrame(animate);
    } else {
      currentRotation = targetRotation;
      drawWheel();
      isSpinning = false;
      spinBtn.disabled = false;
      if (!document.body.classList.contains("obs-mode")) {
        settingsBtn.classList.remove("hidden");
      }

      let prize = "Unknown";
      if (wheelData.segments[winningIndex]) {
        prize = wheelData.segments[winningIndex].text;
      }

      addToHistory(prize);
      playWinSound();

      // Delay slightly before showing popup
      setTimeout(() => {
        showWinnerPopup(prize, options.isAutoSpin);
      }, 200);
    }
  }
  rafId = requestAnimationFrame(animate);
}

// --- Management System ---

function openSettings() {
  renderSegmentsList();
  wheelNameInput.value = wheelData.name;
  showHistoryCheckbox.checked = wheelData.showHistory;
  showItemsListCheckbox.checked = wheelData.showItemsList;
  updateSavedWheelsDropdown();
  settingsModal.classList.remove("hidden");
}

function closeSettingsModal() {
  wheelData.name = wheelNameInput.value || "Untitled Wheel";
  wheelData.showHistory = showHistoryCheckbox.checked;
  wheelData.showItemsList = showItemsListCheckbox.checked;

  updateWheelDataFromDOM();
  localStorage.setItem(STORAGE_KEY_CURRENT, JSON.stringify(wheelData));
  drawWheel();
  updateUIFromState(); // Sync visibility immediately
  settingsModal.classList.add("hidden");
}

function renderSegmentsList() {
  segmentsList.innerHTML = "";
  wheelData.segments.forEach((seg, index) => {
    const div = document.createElement("div");
    div.className = "segment-item";
    div.innerHTML = `
            <span>${index + 1}.</span>
            <input type="text" value="${
              seg.text
            }" placeholder="รางวัล" data-key="text" data-index="${index}">
            <input type="number" value="${
              seg.weight
            }" min="0" step="any" placeholder="%" data-key="weight" data-index="${index}" title="Percentage">
            <input type="color" value="${
              seg.color
            }" class="color-preview" data-key="color" data-index="${index}">
            <button class="remove-segment-btn" onclick="removeSegment(${index})">&times;</button>
        `;
    div.querySelectorAll("input").forEach((input) => {
      input.addEventListener("change", updateWheelDataFromDOM);
      input.addEventListener("input", updateWheelDataFromDOM);
    });
    segmentsList.appendChild(div);
  });
}

function addSegment() {
  wheelData.segments.push({
    text: "New Prize",
    color: defaultColors[wheelData.segments.length % defaultColors.length],
    weight: 1,
  });
  renderSegmentsList();
  drawWheel();
}

window.removeSegment = function (index) {
  wheelData.segments.splice(index, 1);
  renderSegmentsList();
  drawWheel();
};

function updateWheelDataFromDOM() {
  const items = document.querySelectorAll(".segment-item");
  items.forEach((item, index) => {
    const text = item.querySelector('[data-key="text"]').value;
    const weight =
      parseFloat(item.querySelector('[data-key="weight"]').value) || 0;
    const color = item.querySelector('[data-key="color"]').value;

    if (wheelData.segments[index]) {
      wheelData.segments[index].text = text;
      wheelData.segments[index].weight = weight;
      wheelData.segments[index].color = color;
    }
  });
}

// --- Storage Logic (Firebase & Realtime) ---

let unsubscribeCurrentWheel = null;

function subscribeToWheelUpdates(docId) {
  if (unsubscribeCurrentWheel) {
    unsubscribeCurrentWheel(); // Stop listening to old wheel
    unsubscribeCurrentWheel = null;
  }

  const { onSnapshot, doc } = window.FirebaseFirestore;
  console.log("Subscribing to live updates for:", docId);

  unsubscribeCurrentWheel = onSnapshot(
    doc(window.db, "wheels", docId),
    (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();

        // Check for Spin Event
        if (data.spinEvent && data.spinEvent.timestamp > lastSpinTimestamp) {
          // It's a new spin we haven't processed!
          console.log("Received remote spin event:", data.spinEvent);
          lastSpinTimestamp = data.spinEvent.timestamp;

          // If we are currently spinning, maybe ignore or force sync?
          // Let's ignore if already spinning to avoid glitch, or maybe Queue it?
          // Simple version: if not spinning, spin.
          if (!isSpinning) {
            startWheelAnimation(
              data.spinEvent.winningIndex,
              data.spinEvent.targetRotation,
              data.spinEvent.duration,
              { isAutoSpin: data.spinEvent.isAutoSpin }
            );
          }
        }

        // Potentially sync other data like segments update?
        // Optionally update local wheelData if it changed remotely (Real-time editing!)
        // But let's be careful not to overwrite our local edits if we are the editor.
        // For now, let's just focus on SPIN sync.
        // Actually, if we are in OBS mode, we definitely want data updates.
        // In OBS mode, we want to stay in sync with EVERYTHING (Settings, Segments, History)
        if (document.body.classList.contains("obs-mode")) {
          // Compare essential data to avoid unnecessary re-renders?
          // Or just overwrite. Since it's OBS, we want 1:1 reflection.
          // We preserve 'spinEvent' processing which is handled above.

          // Update local data
          wheelData.name = data.name;
          wheelData.segments = data.segments;
          wheelData.showHistory = data.showHistory;
          wheelData.showItemsList = data.showItemsList;
          wheelData.history = data.history || [];
          wheelData.totalSpins = data.totalSpins || 0;

          // Re-render
          drawWheel();
          updateUIFromState();
          renderSegmentsList();

          // Check for Close Popup Event
          if (
            data.closeEvent &&
            data.closeEvent.timestamp > lastCloseTimestamp
          ) {
            console.log("Received remote close event");
            lastCloseTimestamp = data.closeEvent.timestamp;
            closeWinnerPopup();
          }

          // Check for Summary Event
          if (
            data.summaryEvent &&
            data.summaryEvent.timestamp > lastSummaryTimestamp
          ) {
            console.log("Received remote summary event");
            lastSummaryTimestamp = data.summaryEvent.timestamp;
            autoSpinResults = data.summaryEvent.results || [];
            showAutoSpinSummary(true);
          }

          // Check for Close Summary Event
          if (
            data.closeSummaryEvent &&
            data.closeSummaryEvent.timestamp > lastCloseSummaryTimestamp
          ) {
            console.log("Received remote close summary event");
            lastCloseSummaryTimestamp = data.closeSummaryEvent.timestamp;
            closeSummaryModal();
          }

          // Sync history list logic is inside updateUIFromState -> renderHistoryDisplay
        }
      }
    }
  );
}
let lastSpinTimestamp = 0;
let lastCloseTimestamp = 0;
let lastSummaryTimestamp = 0;
let lastCloseSummaryTimestamp = 0;

// --- Storage Logic (Firebase) ---

// --- Storage Logic (Firebase) ---

async function saveToStorage() {
  updateWheelDataFromDOM();

  // Ensure settings are synced even if modal wasn't closed
  if (showHistoryCheckbox) wheelData.showHistory = showHistoryCheckbox.checked;
  if (showItemsListCheckbox)
    wheelData.showItemsList = showItemsListCheckbox.checked;

  if (!wheelData.name) {
    alert("กรุณาตั้งชื่อวงล้อ");
    return;
  }

  const docId = wheelData.name;

  try {
    showLoading(true);
    const { setDoc, doc } = window.FirebaseFirestore;
    await setDoc(doc(window.db, "wheels", docId), wheelData);

    alert("บันทึกเรียบร้อย (Cloud)!");
    updateSavedWheelsDropdown();
  } catch (e) {
    console.error("Save failed", e);
    alert("บันทึกไม่สำเร็จ: " + e.message);
  } finally {
    showLoading(false);
  }
}

async function loadFromStorage() {
  const name = savedWheelsSelect.value;
  if (!name) return;
  await loadWheelByName(name);
}

async function loadWheelByName(name) {
  try {
    showLoading(true);
    const { getDoc, doc } = window.FirebaseFirestore;
    const snap = await getDoc(doc(window.db, "wheels", name));

    if (snap.exists()) {
      wheelData = snap.data();
      localStorage.setItem(STORAGE_KEY_CURRENT, JSON.stringify(wheelData));

      wheelNameInput.value = wheelData.name;
      renderSegmentsList();
      drawWheel();
      updateUIFromState();

      // Start Realtime Listener
      subscribeToWheelUpdates(name);
    } else {
      console.warn("Wheel not found:", name);
    }
  } catch (e) {
    console.error("Load failed", e);
    // alert("โหลดไม่สำเร็จ");
  } finally {
    showLoading(false);
  }
}

async function deleteSavedWheel() {
  const name = savedWheelsSelect.value;
  if (!name) return;
  if (!confirm(`ต้องการลบ "${name}" ใช่หรือไม่?`)) return;

  try {
    showLoading(true);
    const { deleteDoc, doc } = window.FirebaseFirestore;
    await deleteDoc(doc(window.db, "wheels", name));

    alert("ลบเรียบร้อย");
    updateSavedWheelsDropdown();
  } catch (e) {
    console.error("Delete failed", e);
    alert("ลบไม่สำเร็จ");
  } finally {
    showLoading(false);
  }
}

function createNewWheel(isSilent = false) {
  if (
    !isSilent &&
    !confirm("สร้างวงล้อใหม่? ข้อมูลปัจจุบันที่ยังไม่บันทึกจะหายไป")
  )
    return;
  wheelData = {
    name: "New Wheel " + Math.floor(Math.random() * 1000),
    segments: [
      { text: "Winner", color: "#FF6B6B", weight: 50 },
      { text: "Loser", color: "#ccc", weight: 50 },
    ],
  };
  renderSegmentsList();
  drawWheel();
  wheelNameInput.value = wheelData.name;
}

async function updateSavedWheelsDropdown() {
  // Capture current selection (or name) before refresh
  const currentName = wheelData.name;
  savedWheelsSelect.innerHTML = "<option>กำลังโหลด...</option>";

  try {
    const { getDocs, collection } = window.FirebaseFirestore;
    const querySnapshot = await getDocs(collection(window.db, "wheels"));

    savedWheelsSelect.innerHTML = "";
    if (querySnapshot.empty) {
      const op = document.createElement("option");
      op.text = "-- ไม่มีข้อมูล (Cloud) --";
      savedWheelsSelect.appendChild(op);
      deleteWheelBtn.disabled = true;

      // Auto-create default wheel if nothing exists
      createNewWheel(true);
      return;
    }

    // Populate dropdown
    let firstWheelName = null;
    let foundCurrent = false;

    querySnapshot.forEach((doc) => {
      const data = doc.data();
      const op = document.createElement("option");
      op.value = data.name;
      const count = data.segments ? data.segments.length : 0;
      op.text = `${data.name} (${count})`;
      savedWheelsSelect.appendChild(op);

      if (!firstWheelName) firstWheelName = data.name;
      if (data.name === currentName) foundCurrent = true;
    });

    deleteWheelBtn.disabled = false;

    // Logic:
    // 1. If currently active wheel exists in list, select it.
    // 2. If NOT, and we have items, select the FIRST one and load it.

    if (foundCurrent) {
      savedWheelsSelect.value = currentName;
      // No need to loadFromStorage() because we are already ON this wheel data
    } else if (firstWheelName) {
      savedWheelsSelect.value = firstWheelName;
      loadFromStorage();
    }
  } catch (e) {
    console.error("List failed", e);
    savedWheelsSelect.innerHTML = "<option>Error Loading</option>";
  }
}

function showLoading(isLoading) {
  if (isLoading) {
    saveWheelBtn.disabled = true;
    deleteWheelBtn.disabled = true;
    savedWheelsSelect.disabled = true;
    document.body.style.cursor = "wait";
  } else {
    saveWheelBtn.disabled = false;
    deleteWheelBtn.disabled = false;
    savedWheelsSelect.disabled = false;
    document.body.style.cursor = "default";
  }
}

function loadCurrentState() {
  const current = localStorage.getItem(STORAGE_KEY_CURRENT);
  if (current) {
    try {
      wheelData = JSON.parse(current);
    } catch (e) {
      console.error("Load failed", e);
    }
  }
}

// --- Export / Import ---

function exportData() {
  const data = {
    current: JSON.parse(localStorage.getItem(STORAGE_KEY_CURRENT) || "null"),
    saves: JSON.parse(localStorage.getItem(STORAGE_KEY_SAVES) || "[]"),
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `lucky_wheel_backup_${new Date()
    .toISOString()
    .slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function importData(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      const data = JSON.parse(e.target.result);
      if (data.saves && Array.isArray(data.saves)) {
        if (
          !confirm(
            `ต้องการนำเข้าข้อมูลจากไฟล์ "${file.name}" ใช่หรือไม่? ข้อมูลปัจจุบันจะถูกแทนที่`
          )
        )
          return;

        localStorage.setItem(STORAGE_KEY_SAVES, JSON.stringify(data.saves));
        if (data.current) {
          localStorage.setItem(
            STORAGE_KEY_CURRENT,
            JSON.stringify(data.current)
          );
          wheelData = data.current;
        }

        updateSavedWheelsDropdown();
        wheelNameInput.value = wheelData.name;
        renderSegmentsList();
        drawWheel();

        alert("Import เรียบร้อย!");
      } else {
        alert("รูปแบบไฟล์ไม่ถูกต้อง");
      }
    } catch (err) {
      console.error(err);
      alert("เกิดข้อผิดพลาดในการอ่านไฟล์");
    }
  };
  reader.readAsText(file);
  // Reset input to allow re-importing same file if needed
  event.target.value = "";
}

// --- UI Logic (History & Items) ---

function updateUIFromState() {
  renderHistoryDisplay();
  renderItemsListDisplay();

  // Toggle Visibility
  if (wheelData.showHistory) {
    historyContainer.classList.remove("hidden");
  } else {
    historyContainer.classList.add("hidden");
  }

  if (wheelData.showItemsList) {
    itemsListDisplay.classList.remove("hidden");
  } else {
    itemsListDisplay.classList.add("hidden");
  }
}

function renderHistoryDisplay() {
  if (!wheelData.history) wheelData.history = [];
  historyList.innerHTML = "";

  // Copy and reverse to show newest first
  const recent = [...wheelData.history].reverse();

  recent.forEach((item) => {
    const li = document.createElement("li");

    let text = item;
    let time = "";
    let order = "";

    // Handle migration from old string format
    if (typeof item === "object") {
      text = item.text;
      time = item.time;
      order = item.order;
    }

    li.innerHTML = `
            <span class="history-order">#${order}</span>
            <span class="history-time">${time}</span>
            <span class="history-text">${text}</span>
        `;
    historyList.appendChild(li);
  });
}

function addToHistory(prize) {
  if (!wheelData.history) wheelData.history = [];

  // Initialize totalSpins if missing
  if (typeof wheelData.totalSpins === "undefined") {
    wheelData.totalSpins = wheelData.history.length;
  }

  wheelData.totalSpins++;

  const now = new Date();
  const timeString = now.toLocaleTimeString("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const entry = {
    order: wheelData.totalSpins,
    time: timeString,
    text: prize,
  };

  wheelData.history.push(entry);

  // Keep max 10
  if (wheelData.history.length > 10) {
    wheelData.history.shift(); // Remove oldest
  }

  // Save to Local (cache)
  localStorage.setItem(STORAGE_KEY_CURRENT, JSON.stringify(wheelData));
  updateUIFromState();

  // Sync to Cloud (if wheel is named/saved)
  // We don't want to await here to block UI
  if (wheelData.name && !wheelData.name.startsWith("New Wheel")) {
    const docId = wheelData.name;
    const { setDoc, doc } = window.FirebaseFirestore;
    // Use merge: true to just update history/totalSpins without overwriting everything if changed elsewhere?
    // Or just overwrite entire data? Since we are the controller.
    // Ideally we update only the fields changed, but setDoc with merge is easy.
    setDoc(doc(window.db, "wheels", docId), wheelData, { merge: true }).catch(
      (err) => console.error("Cloud history sync failed", err)
    );
  }
}

function renderItemsListDisplay() {
  itemsListUl.innerHTML = "";
  wheelData.segments.forEach((seg) => {
    const li = document.createElement("li");
    const dot = document.createElement("span");
    dot.className = "item-dot";
    dot.style.backgroundColor = seg.color || "#ccc";

    li.appendChild(dot);
    li.appendChild(document.createTextNode(seg.text));
    itemsListUl.appendChild(li);
  });
}

function clearHistory() {
  if (!confirm("ต้องการล้างประวัติการหมุนทั้งหมด?")) return;
  wheelData.history = [];
  wheelData.totalSpins = 0;
  renderHistoryDisplay();
  localStorage.setItem(STORAGE_KEY_CURRENT, JSON.stringify(wheelData));
}

// --- Auto Spin & Popup Logic ---

function startAutoSpin() {
  if (isAutoSpinning) {
    // Stop
    isAutoSpinning = false;
    autoSpinBtn.textContent = "Start Auto";
    return;
  }

  const count = parseInt(autoSpinInput.value) || 0;
  if (count <= 0) return;

  isAutoSpinning = true;
  autoSpinCount = count;
  autoSpinResults = []; // Reset results
  autoSpinBtn.textContent = "Stop Auto";

  runAutoSpinLoop();
}

function runAutoSpinLoop() {
  if (!isAutoSpinning || autoSpinCount <= 0) {
    isAutoSpinning = false;
    autoSpinBtn.textContent = "Start Auto";

    // Show Summary if we have results
    if (autoSpinResults.length > 0) {
      showAutoSpinSummary();
    }
    return;
  }

  autoSpinCount--;
  autoSpinInput.value = autoSpinCount;
  spinWheel();
}

function showWinnerPopup(prize, isAutoSpinRemote = false) {
  // Save result for auto spin summary
  if (isAutoSpinning || isAutoSpinRemote) {
    if (isAutoSpinning) autoSpinResults.push(prize); // Only push if local controller? Or OBS too?
    // Actually OBS should also push if we want summary there
    if (!isAutoSpinning && isAutoSpinRemote) autoSpinResults.push(prize);

    // Skip popup and confetti in auto mode
    // Just wait a short delay and continue (if local)
    if (isAutoSpinning) {
      setTimeout(runAutoSpinLoop, 500);
    }
    return;
  }

  // If OBS mode, maybe skip popup? Or show it too? Let's show it.
  winnerPrize.innerText = prize;
  winnerModal.classList.remove("hidden");

  // Trigger confetti AFTER popup shows
  confetti({
    particleCount: 300,
    spread: 100,
    origin: { y: 0.6 },
    zIndex: 9999,
  });

  // Play fanfare again?
  // playWinSound();
}

function closeWinnerPopup() {
  winnerModal.classList.add("hidden");

  // Sync Close Event to Cloud (for OBS)
  if (wheelData.name && !wheelData.name.startsWith("New Wheel")) {
    // Only sync if WE are the controller (not OBS mode purely reacting)
    if (!document.body.classList.contains("obs-mode")) {
      const { setDoc, doc } = window.FirebaseFirestore;
      setDoc(
        doc(window.db, "wheels", wheelData.name),
        {
          closeEvent: { timestamp: Date.now() },
        },
        { merge: true }
      ).catch((err) => console.error("Close sync failed", err));
    }
  }
}

function showAutoSpinSummary(isRemote = false) {
  summaryList.innerHTML = "";

  // Group results by count
  const counts = {};
  autoSpinResults.forEach((r) => {
    counts[r] = (counts[r] || 0) + 1;
  });

  for (const [prize, count] of Object.entries(counts)) {
    const li = document.createElement("li");
    li.style.borderBottom = "1px solid rgba(0,0,0,0.1)";
    li.style.padding = "5px 0";
    li.style.display = "flex";
    li.style.justifyContent = "space-between";

    li.innerHTML = `<span>${prize}</span> <span style="font-weight:bold;">x${count}</span>`;
    summaryList.appendChild(li);
  }

  summaryModal.classList.remove("hidden");

  // Sync Summary to Cloud
  if (!isRemote && wheelData.name && !wheelData.name.startsWith("New Wheel")) {
    if (!document.body.classList.contains("obs-mode")) {
      const { setDoc, doc } = window.FirebaseFirestore;
      setDoc(
        doc(window.db, "wheels", wheelData.name),
        {
          summaryEvent: {
            timestamp: Date.now(),
            results: autoSpinResults,
          },
        },
        { merge: true }
      ).catch((err) => console.error("Summary sync failed", err));
    }
  }
}

function closeSummaryModal() {
  summaryModal.classList.add("hidden");

  // Sync Close Summary to Cloud
  if (wheelData.name && !wheelData.name.startsWith("New Wheel")) {
    if (!document.body.classList.contains("obs-mode")) {
      const { setDoc, doc } = window.FirebaseFirestore;
      setDoc(
        doc(window.db, "wheels", wheelData.name),
        {
          closeSummaryEvent: { timestamp: Date.now() },
        },
        { merge: true }
      ).catch((err) => console.error("Close Summary sync failed", err));
    }
  }
}

// Start
init();
