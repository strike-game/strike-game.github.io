const state = {
  size: 5,
  levelIndex: 0,
  levelsCompleted: 0,
  bestScore: 0,
  time: 0,
  moves: 0,
  timerId: null,
  currentPath: [],
  visited: new Set(),
  active: false,
  failed: false,
  won: false,
  touchId: null,
  settings: {
    sound: true,
    particles: true,
    reducedMotion: false,
  },
  playerName: "Player",
  generatedLevel: null,
  levelSeed: 1,
};

const board = document.getElementById("board");
const pathLayer = document.getElementById("pathLayer");
const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlayTitle");
const overlayText = document.getElementById("overlayText");
const overlayAction = document.getElementById("overlayAction");
const progressCount = document.getElementById("progressCount");
const progressTotal = document.getElementById("progressTotal");
const levelNumber = document.getElementById("levelNumber");
const timerEl = document.getElementById("timer");
const moveCountEl = document.getElementById("moveCount");
const restartBtn = document.getElementById("restartBtn");
const undoBtn = document.getElementById("undoBtn");
const skipBtn = document.getElementById("skipBtn");
const menuBtn = document.getElementById("menuBtn");
const menuOverlay = document.getElementById("menuOverlay");
const startBtn = document.getElementById("startBtn");
const toast = document.getElementById("toast");
const playerNameInput = document.getElementById("playerName");
const bestScoreEl = document.getElementById("bestScore");
const completedCountEl = document.getElementById("completedCount");
const soundToggle = document.getElementById("soundToggle");
const particlesToggle = document.getElementById("particlesToggle");
const reducedMotionToggle = document.getElementById("reducedMotionToggle");
const particles = document.getElementById("particles");
const tabButtons = Array.from(document.querySelectorAll(".tab-btn"));
const panels = Array.from(document.querySelectorAll(".panel"));

function init() {
  bindEvents();
  loadSettings();
  startMenu();
  updateHud();
  renderStats();
}

function bindEvents() {
  restartBtn.addEventListener("click", () => startLevel(state.levelIndex));
  undoBtn.addEventListener("click", undoMove);
  skipBtn.addEventListener("click", () => startLevel(state.levelIndex + 1));
  menuBtn.addEventListener("click", () => showMenu());
  board.addEventListener("pointermove", handleBoardPointerMove);
  board.addEventListener("pointerup", handlePointerUp);
  board.addEventListener("pointercancel", handlePointerUp);
  startBtn.addEventListener("click", () => {
    hideMenu();
    startLevel(0);
  });
  overlayAction.addEventListener("click", () => {
    if (state.won) {
      nextLevel();
    } else {
      startLevel(state.levelIndex);
    }
  });
  playerNameInput.addEventListener("input", (event) => {
    state.playerName = event.target.value.trim() || "Player";
    renderStats();
  });
  soundToggle.addEventListener("change", (event) => {
    state.settings.sound = event.target.checked;
    saveSettings();
  });
  particlesToggle.addEventListener("change", (event) => {
    state.settings.particles = event.target.checked;
    saveSettings();
  });
  reducedMotionToggle.addEventListener("change", (event) => {
    state.settings.reducedMotion = event.target.checked;
    saveSettings();
    document.body.classList.toggle("reduced-motion", state.settings.reducedMotion);
  });
  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      tabButtons.forEach((item) => item.classList.toggle("active", item === btn));
      panels.forEach((panel) => panel.classList.toggle("active", panel.dataset.panel === btn.dataset.panel));
    });
  });
}

function loadSettings() {
  const stored = localStorage.getItem("strike-through-settings");
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      state.settings = { ...state.settings, ...parsed };
    } catch (error) {
      console.warn("Settings parse failed", error);
    }
  }
  state.playerName = localStorage.getItem("strike-through-player") || "Player";
  state.bestScore = Number(localStorage.getItem("strike-through-best") || 0);
  state.levelsCompleted = Number(localStorage.getItem("strike-through-completed") || 0);
  playerNameInput.value = state.playerName;
  soundToggle.checked = state.settings.sound;
  particlesToggle.checked = state.settings.particles;
  reducedMotionToggle.checked = state.settings.reducedMotion;
  document.body.classList.toggle("reduced-motion", state.settings.reducedMotion);
}

function saveSettings() {
  localStorage.setItem("strike-through-settings", JSON.stringify(state.settings));
  localStorage.setItem("strike-through-player", state.playerName);
  localStorage.setItem("strike-through-best", String(state.bestScore));
  localStorage.setItem("strike-through-completed", String(state.levelsCompleted));
}

function renderStats() {
  bestScoreEl.textContent = state.bestScore;
  completedCountEl.textContent = state.levelsCompleted;
}

function startMenu() {
  menuOverlay.classList.remove("hidden");
  overlay.classList.add("hidden");
  setupBoard(5, 5);
}

function showMenu() {
  menuOverlay.classList.remove("hidden");
}

function hideMenu() {
  menuOverlay.classList.add("hidden");
}

function startLevel(levelIndex) {
  state.levelIndex = levelIndex;
  state.currentPath = [];
  state.visited = new Set();
  state.active = false;
  state.failed = false;
  state.won = false;
  state.moves = 0;
  state.time = 0;
  clearInterval(state.timerId);
  state.timerId = null;
  state.generatedLevel = generateLevel(levelIndex);
  if (!state.generatedLevel) {
    endRun();
    return;
  }
  renderBoard();
  updateHud();
  showOverlay("Level " + (levelIndex + 1), "Trace the full route without retracing any tile.");
  hideMenu();
  startTimer();
}

function generateLevel(index) {
  const size = Math.min(7, 4 + Math.floor(index / 4));
  const targetLength = Math.max(8, 8 + index * 2 + Math.floor(index / 3));
  const maxAttempts = 400;
  let attempt = 0;
  while (attempt < maxAttempts) {
    const path = buildPath(size, targetLength);
    if (path && isPossiblePath(path, size)) {
      return { size, path };
    }
    attempt += 1;
  }
  const fallback = buildPath(size, targetLength + 2);
  return fallback && isPossiblePath(fallback, size) ? { size, path: fallback } : null;
}

function buildPath(size, targetLength) {
  const cells = [];
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      cells.push([x, y]);
    }
  }
  const start = cells[Math.floor(Math.random() * cells.length)];
  const path = [start];
  const visited = new Set([key(start)]);
  const directions = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  let current = start;
  while (path.length < targetLength) {
    const neighbors = directions
      .map(([dx, dy]) => [current[0] + dx, current[1] + dy])
      .filter(([x, y]) => x >= 0 && y >= 0 && x < size && y < size && !visited.has(key([x, y])));
    if (!neighbors.length) {
      return null;
    }
    const next = neighbors[Math.floor(Math.random() * neighbors.length)];
    current = next;
    path.push(current);
    visited.add(key(current));
  }
  return path;
}

function key([x, y]) {
  return `${x},${y}`;
}

function isPossiblePath(path, size) {
  if (!path || path.length < 2) return false;
  const visited = new Set(path.map((cell) => key(cell)));
  if (visited.size !== path.length) return false;
  for (let index = 0; index < path.length - 1; index += 1) {
    const current = path[index];
    const next = path[index + 1];
    if (!isAdjacent(current, next)) return false;
    if (current[0] < 0 || current[0] >= size || current[1] < 0 || current[1] >= size) return false;
    if (next[0] < 0 || next[0] >= size || next[1] < 0 || next[1] >= size) return false;
  }
  return true;
}

function setupBoard(cols, rows) {
  board.innerHTML = "";
  board.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
  board.style.gridTemplateRows = `repeat(${rows}, 1fr)`;
  const total = cols * rows;
  for (let index = 0; index < total; index += 1) {
    const tile = document.createElement("button");
    tile.className = "tile";
    tile.type = "button";
    tile.dataset.index = index;
    tile.addEventListener("pointerdown", handlePointerDown);
    tile.addEventListener("pointerenter", handlePointerEnter);
    tile.addEventListener("pointerup", handlePointerUp);
    tile.addEventListener("touchstart", (event) => event.preventDefault(), { passive: false });
    tile.addEventListener("touchmove", (event) => event.preventDefault(), { passive: false });
    board.appendChild(tile);
  }
}

function renderBoard() {
  const { size, path } = state.generatedLevel;
  setupBoard(size, size);
  const tiles = Array.from(board.children);
  tiles.forEach((tile, index) => {
    const x = index % size;
    const y = Math.floor(index / size);
    const isPath = path.some(([px, py]) => px === x && py === y);
    tile.dataset.x = x;
    tile.dataset.y = y;
    tile.classList.toggle("path-tile", isPath);
    tile.textContent = isPath ? "" : "";
  });
  const pathSet = new Set(path.map((cell) => key(cell)));
  const startCell = path[0];
  const startIndex = startCell[1] * size + startCell[0];
  const startTile = tiles[startIndex];
  startTile.classList.add("start");
  updatePathLayer();
  updateProgress();
}

function updatePathLayer() {
  const { size, path } = state.generatedLevel;
  const points = path.map(([x, y]) => `${(x + 0.5) / size},${(y + 0.5) / size}`).join(" ");
  pathLayer.innerHTML = `
    <polyline points="${points}" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="0.018" stroke-linecap="round" stroke-linejoin="round"></polyline>
  `;
  const currentPoints = state.currentPath.map((cell) => `${(cell[0] + 0.5)/size},${(cell[1]+0.5)/size}`).join(" ");
  if (currentPoints) {
    pathLayer.innerHTML += `<polyline points="${currentPoints}" fill="none" stroke="rgba(42,214,255,0.95)" stroke-width="0.026" stroke-linecap="round" stroke-linejoin="round"></polyline>`;
  }
}

function updateProgress() {
  const total = state.generatedLevel.path.length;
  progressCount.textContent = state.currentPath.length;
  progressTotal.textContent = total;
  levelNumber.textContent = state.levelIndex + 1;
  moveCountEl.textContent = state.moves;
}

function showOverlay(title, text, actionLabel = "Start") {
  overlay.classList.remove("hidden");
  overlayTitle.textContent = title;
  overlayText.textContent = text;
  overlayAction.textContent = actionLabel;
}

function hideOverlay() {
  overlay.classList.add("hidden");
}

function startTimer() {
  state.time = 0;
  if (state.timerId) clearInterval(state.timerId);
  state.timerId = setInterval(() => {
    state.time += 1;
    timerEl.textContent = formatTime(state.time);
  }, 1000);
}

function formatTime(seconds) {
  const mins = String(Math.floor(seconds / 60)).padStart(2, "0");
  const secs = String(seconds % 60).padStart(2, "0");
  return `${mins}:${secs}`;
}

function handlePointerDown(event) {
  if (!state.generatedLevel || state.failed || state.won) return;
  const tile = event.currentTarget;
  const cell = [Number(tile.dataset.x), Number(tile.dataset.y)];
  const start = state.generatedLevel.path[0];
  if (!sameCell(cell, start)) return;
  state.active = true;
  state.currentPath = [cell];
  state.visited = new Set([key(cell)]);
  state.moves = 1;
  state.touchId = event.pointerId;
  tile.setPointerCapture?.(event.pointerId);
  highlightValidNext();
  updatePathLayer();
  updateProgress();
  hideOverlay();
}

function handlePointerEnter(event) {
  if (!state.active || state.failed || state.won) return;
  const tile = event.currentTarget;
  const cell = [Number(tile.dataset.x), Number(tile.dataset.y)];
  advanceToCell(cell);
}

function handleBoardPointerMove(event) {
  if (!state.active || state.failed || state.won) return;
  const tile = document.elementFromPoint(event.clientX, event.clientY)?.closest(".tile");
  if (!tile) return;
  const cell = [Number(tile.dataset.x), Number(tile.dataset.y)];
  advanceToCell(cell);
}

function handlePointerUp() {
  state.active = false;
  state.touchId = null;
}

function advanceToCell(cell) {
  if (!state.active || state.failed || state.won) return false;
  const expectedNext = state.generatedLevel?.path?.[state.currentPath.length];
  if (!expectedNext || !sameCell(cell, expectedNext)) {
    if (state.currentPath.length > 0 && !sameCell(cell, state.currentPath[0])) {
      failRun();
    }
    return false;
  }
  if (state.visited.has(key(cell))) {
    failRun();
    return false;
  }
  state.currentPath.push(cell);
  state.visited.add(key(cell));
  state.moves += 1;
  highlightValidNext();
  updatePathLayer();
  updateProgress();
  if (state.currentPath.length === state.generatedLevel.path.length) {
    winRun();
  }
  return true;
}

function isAdjacent(a, b) {
  return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) === 1;
}

function sameCell(a, b) {
  return a[0] === b[0] && a[1] === b[1];
}

function undoMove() {
  if (!state.currentPath.length || state.failed || state.won) return;
  const removed = state.currentPath.pop();
  if (removed) {
    state.visited.delete(key(removed));
  }
  state.moves = Math.max(1, state.moves - 1);
  highlightValidNext();
  updatePathLayer();
  updateProgress();
}

function highlightValidNext() {
  const tiles = Array.from(board.children);
  tiles.forEach((tile) => tile.classList.remove("valid-next", "visited", "current"));
  if (!state.currentPath.length) return;
  const last = state.currentPath[state.currentPath.length - 1];
  const pathSet = new Set(state.currentPath.map((cell) => key(cell)));
  tiles.forEach((tile) => {
    const cell = [Number(tile.dataset.x), Number(tile.dataset.y)];
    if (pathSet.has(key(cell))) {
      tile.classList.add("visited");
      if (state.currentPath[state.currentPath.length - 1] && sameCell(cell, state.currentPath[state.currentPath.length - 1])) {
        tile.classList.add("current");
      }
    } else if (isAdjacent(last, cell) && !state.visited.has(key(cell))) {
      tile.classList.add("valid-next");
    }
  });
}

function failRun() {
  if (state.failed) return;
  state.failed = true;
  state.active = false;
  playTone(220, 0.08, "triangle", 0.12);
  toastMessage("Oops — the line broke.");
  const pathLayerChildren = Array.from(pathLayer.children);
  pathLayerChildren.forEach((child, index) => 
    child.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 650, easing: "ease-out" })
  );
  setTimeout(() => {
    startLevel(state.levelIndex);
  }, 900);
}

function winRun() {
  if (state.won) return;
  state.won = true;
  state.active = false;
  clearInterval(state.timerId);
  state.levelsCompleted += 1;
  state.bestScore = Math.max(state.bestScore, state.levelsCompleted);
  saveSettings();
  renderStats();
  playTone(660, 0.12, "sine", 0.2);
  playTone(880, 0.16, "triangle", 0.18);
  spawnParticles();
  toastMessage("You win!");
  showOverlay("You Win!", `Level ${state.levelIndex + 1} cleared.`, "Next");
  setTimeout(() => nextLevel(), 1200);
}

function nextLevel() {
  startLevel(state.levelIndex + 1);
}

function endRun() {
  showOverlay("All clear", "You completed the run. Restart to play again.", "Restart");
  toastMessage("You beat the whole run!");
}

function toastMessage(message) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toast.timeoutId);
  toast.timeoutId = setTimeout(() => toast.classList.remove("show"), 1200);
}

function spawnParticles() {
  if (!state.settings.particles) return;
  const count = state.settings.reducedMotion ? 10 : 24;
  for (let i = 0; i < count; i += 1) {
    const particle = document.createElement("span");
    particle.className = "particle";
    particle.style.left = `${Math.random() * 100}%`;
    particle.style.top = `${Math.random() * 100}%`;
    particle.style.background = ["#2ad6ff", "#8b5cff", "#f7f9ff"][Math.floor(Math.random() * 3)];
    particles.appendChild(particle);
    setTimeout(() => particle.remove(), 700);
  }
}

function playTone(frequency, duration, type = "sine", volume = 0.1) {
  if (!state.settings.sound) return;
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;
  const ctx = new AudioContext();
  const gain = ctx.createGain();
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, ctx.currentTime);
  gain.gain.setValueAtTime(volume, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + duration);
  setTimeout(() => ctx.close(), duration * 1000 + 50);
}

init();
