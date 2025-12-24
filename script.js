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
const resultText = document.getElementById("resultText");

// Modal Elements
const settingsModal = document.getElementById("settingsModal");
const settingsBtn = document.getElementById("settingsBtn");
const closeSettings = document.getElementById("closeSettings");
const segmentsList = document.getElementById("segmentsList");
const addSegmentBtn = document.getElementById("addSegmentBtn");
const wheelNameInput = document.getElementById("wheelNameInput");
const saveWheelBtn = document.getElementById("saveWheelBtn");
const loadWheelBtn = document.getElementById("loadWheelBtn");
const savedWheelsSelect = document.getElementById("savedWheelsSelect");
const newWheelBtn = document.getElementById("newWheelBtn");
const deleteWheelBtn = document.getElementById("deleteWheelBtn");

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
  drawWheel();
  setupEventListeners();
}

function setupEventListeners() {
  spinBtn.addEventListener("click", spinWheel);

  settingsBtn.addEventListener("click", openSettings);
  closeSettings.addEventListener("click", closeSettingsModal);
  settingsModal.addEventListener("click", (e) => {
    if (e.target === settingsModal) closeSettingsModal();
  });

  addSegmentBtn.addEventListener("click", addSegment);
  saveWheelBtn.addEventListener("click", saveToStorage);
  loadWheelBtn.addEventListener("click", loadFromStorage);
  newWheelBtn.addEventListener("click", createNewWheel);
  deleteWheelBtn.addEventListener("click", deleteSavedWheel);

  // Backup
  if (exportBtn) exportBtn.addEventListener("click", exportData);
  if (importBtn) importBtn.addEventListener("click", () => importFile.click());
  if (importFile) importFile.addEventListener("change", importData);
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
  const arcSize = (2 * Math.PI) / numSegments;

  for (let i = 0; i < numSegments; i++) {
    const seg = wheelData.segments[i];
    const angle = i * arcSize;

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, wheelRadius, angle, angle + arcSize);
    ctx.fillStyle = seg.color || defaultColors[i % defaultColors.length];
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(0,0,0,0.1)"; // Subtle separator
    ctx.stroke();

    // Text
    ctx.save();
    ctx.fillStyle = "#5d4037"; // Dark brown text
    ctx.font = 'bold 24px "Kanit", sans-serif';
    ctx.rotate(angle + arcSize / 2);
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillText(seg.text, wheelRadius - 25, 0);

    // Icon (Optional - drawing a small circle for visual interest if wanted)
    // ctx.beginPath();
    // ctx.arc(wheelRadius - 80, 0, 10, 0, Math.PI * 2);
    // ctx.fillStyle = "rgba(255,255,255,0.5)";
    // ctx.fill();

    ctx.restore();
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
    ctx.arc(0, 0, 35, 0, Math.PI * 2);
    ctx.clip(); // Clip to circle
    // Draw image centered, size 70x70
    ctx.drawImage(logoImage, -35, -35, 70, 70);
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

  if (audioCtx.state === "suspended") audioCtx.resume();

  isSpinning = true;
  spinBtn.disabled = true;
  resultText.innerText = "กำลังหมุน...";
  resultText.style.color = "#d35400";

  const winningIndex = getWeightedWinner();
  const numSegments = wheelData.segments.length;
  const arcSizeDeg = 360 / numSegments;

  // We want the winning segment to end up at TOP (270 degrees in canvas space usually)
  // Our pointer is at TOP (-90deg or 270deg).

  const segmentCenter = winningIndex * arcSizeDeg + arcSizeDeg / 2;
  // To get segmentCenter to align with 270deg (North):
  // rotation + segmentCenter = 270  => rotation = 270 - segmentCenter
  const targetBase = 270 - segmentCenter;

  const randomOffset = (Math.random() - 0.5) * (arcSizeDeg * 0.8);
  const fullSpins = 360 * 6; // Minimum spins

  // Calculate destination
  let targetRotation =
    currentRotation +
    fullSpins +
    ((targetBase - (currentRotation % 360) + 360) % 360) + // Ensure positive forward movement
    randomOffset;

  const startRotation = currentRotation;
  const startTime = performance.now();
  const duration = 5000;

  let lastAngle = currentRotation;

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

      const prize = wheelData.segments[winningIndex].text;
      resultText.innerText = `ยินดีด้วย! คุณได้รับ: ${prize}`;

      playWinSound();
      confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
    }
  }
  rafId = requestAnimationFrame(animate);
}

// --- Management System ---

function openSettings() {
  renderSegmentsList();
  wheelNameInput.value = wheelData.name;
  updateSavedWheelsDropdown();
  settingsModal.classList.remove("hidden");
}

function closeSettingsModal() {
  wheelData.name = wheelNameInput.value || "Untitled Wheel";
  updateWheelDataFromDOM();
  localStorage.setItem(STORAGE_KEY_CURRENT, JSON.stringify(wheelData));
  drawWheel();
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

// --- Storage Logic ---

function saveToStorage() {
  updateWheelDataFromDOM();
  let saves = JSON.parse(localStorage.getItem(STORAGE_KEY_SAVES) || "[]");

  const existingIndex = saves.findIndex((w) => w.name === wheelData.name);
  if (existingIndex >= 0) {
    if (!confirm(`มีวงล้อชื่อ "${wheelData.name}" อยู่แล้ว ต้องการทับหรือไม่?`))
      return;
    saves[existingIndex] = JSON.parse(JSON.stringify(wheelData));
  } else {
    saves.push(JSON.parse(JSON.stringify(wheelData)));
  }

  localStorage.setItem(STORAGE_KEY_SAVES, JSON.stringify(saves));
  localStorage.setItem(STORAGE_KEY_CURRENT, JSON.stringify(wheelData));
  alert("บันทึกเรียบร้อย!");
  updateSavedWheelsDropdown();
}

function loadFromStorage() {
  const name = savedWheelsSelect.value;
  if (!name) return;

  const saves = JSON.parse(localStorage.getItem(STORAGE_KEY_SAVES) || "[]");
  const found = saves.find((w) => w.name === name);

  if (found) {
    wheelData = JSON.parse(JSON.stringify(found));
    localStorage.setItem(STORAGE_KEY_CURRENT, JSON.stringify(wheelData));
    wheelNameInput.value = wheelData.name;
    renderSegmentsList();
    drawWheel();
    alert(`โหลด "${name}" เรียบร้อย`);
  }
}

function deleteSavedWheel() {
  const name = savedWheelsSelect.value;
  if (!name) return;
  if (!confirm(`ต้องการลบ "${name}" ใช่หรือไม่?`)) return;

  let saves = JSON.parse(localStorage.getItem(STORAGE_KEY_SAVES) || "[]");
  saves = saves.filter((w) => w.name !== name);
  localStorage.setItem(STORAGE_KEY_SAVES, JSON.stringify(saves));

  updateSavedWheelsDropdown();
  alert("ลบเรียบร้อย");
}

function createNewWheel() {
  if (!confirm("สร้างวงล้อใหม่? ข้อมูลปัจจุบันที่ยังไม่บันทึกจะหายไป")) return;
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

function updateSavedWheelsDropdown() {
  const saves = JSON.parse(localStorage.getItem(STORAGE_KEY_SAVES) || "[]");
  savedWheelsSelect.innerHTML = "";

  if (saves.length === 0) {
    const op = document.createElement("option");
    op.text = "-- ไม่มีข้อมูลที่บันทึก --";
    savedWheelsSelect.appendChild(op);
    loadWheelBtn.disabled = true;
    deleteWheelBtn.disabled = true;
    return;
  }

  loadWheelBtn.disabled = false;
  deleteWheelBtn.disabled = false;
  saves.forEach((s) => {
    const op = document.createElement("option");
    op.value = s.name;
    op.text = s.name + ` (${s.segments.length} items)`;
    savedWheelsSelect.appendChild(op);
  });
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

// Start
init();
