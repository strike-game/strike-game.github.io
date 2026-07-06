const game = document.getElementById('game');
const line = document.getElementById('line');
const msg = document.getElementById('msg');
const msgText = document.getElementById('msgText');
const nextButton = document.getElementById('nextButton');
const levelInfo = document.getElementById('levelInfo');
const progressInfo = document.getElementById('progress');
const timerInfo = document.getElementById('timer');
const movesInfo = document.getElementById('moves');
const restartBtn = document.getElementById('restartBtn');
const undoBtn = document.getElementById('undoBtn');

const state = {
  level: 0,
  route: [],
  visited: new Set(),
  path: [],
  active: false,
  failed: false,
  elapsed: 0,
  timerId: null,
  moveCount: 0,
};

const TILE_GAP = 10;
const MAX_SIZE = 10;

function init() {
  restartBtn.addEventListener('click', restartLevel);
  undoBtn.addEventListener('click', undoMove);
  nextButton.addEventListener('click', restartLevel);
  window.addEventListener('pointerdown', onPointerDown, { passive: false });
  window.addEventListener('pointermove', onPointerMove, { passive: false });
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', onPointerUp);
  window.addEventListener('resize', renderBoard);
  startLevel();
}

function startLevel() {
  state.route = generateRoute(state.level);
  state.visited.clear();
  state.path = [];
  state.active = false;
  state.failed = false;
  state.elapsed = 0;
  state.moveCount = 0;
  clearInterval(state.timerId);
  hideMessage();
  renderBoard();
  updateHud();
}

function restartLevel() {
  startLevel();
}

function nextLevel() {
  state.level += 1;
  startLevel();
}

function updateHud() {
  levelInfo.textContent = `Level ${state.level + 1}`;
  progressInfo.textContent = `Visited ${state.path.length}/${state.route.length}`;
  timerInfo.textContent = `Time: ${formatTime(state.elapsed)}`;
  movesInfo.textContent = `Moves:${Math.max(state.moveCount, 0)}`;
}

function formatTime(seconds) {
  const mins = String(Math.floor(seconds / 60)).padStart(2, '0');
  const secs = String(seconds % 60).padStart(2, '0');
  return `${mins}:${secs}`;
}

function generateRoute(level) {
  const size = Math.min(MAX_SIZE, 3 + Math.floor(level / 3));
  const target = Math.min(size * size, Math.max(6, 6 + Math.floor(level * 1.5)));
  const route = findPath(size, target);
  if (route) return route;
  return fallbackPath(size, target);
}

function findPath(size, target) {
  const start = [Math.floor(Math.random() * size), Math.floor(Math.random() * size)];
  const visited = new Set([key(start)]);
  const route = [start];
  if (searchRoute(route, visited, size, target)) return route;
  return null;
}

function searchRoute(route, visited, size, target) {
  if (route.length === target) return true;
  const current = route[route.length - 1];
  const neighbors = shuffle(getNeighbors(current, size));
  neighbors.sort((a, b) => getNeighbors(a, size).length - getNeighbors(b, size).length);
  for (const next of neighbors) {
    const nextKey = key(next);
    if (visited.has(nextKey)) continue;
    visited.add(nextKey);
    route.push(next);
    if (searchRoute(route, visited, size, target)) {
      return true;
    }
    route.pop();
    visited.delete(nextKey);
  }
  return false;
}

function fallbackPath(size, target) {
  const route = [];
  for (let y = 0; y < size && route.length < target; y += 1) {
    const row = [...Array(size).keys()].map((x) => [x, y]);
    if (y % 2) row.reverse();
    for (const point of row) {
      route.push(point);
      if (route.length >= target) break;
    }
  }
  return route;
}

function getNeighbors([x, y], size) {
  const candidates = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]];
  return candidates.filter(([nx, ny]) => nx >= 0 && ny >= 0 && nx < size && ny < size);
}

function key([x, y]) {
  return `${x},${y}`;
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function renderBoard() {
  game.querySelectorAll('.tile, .particle').forEach((el) => el.remove());
  if (!state.route.length) return;
  const xs = state.route.map((c) => c[0]);
  const ys = state.route.map((c) => c[1]);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);
  const cols = maxX - minX + 1;
  const rows = maxY - minY + 1;
  const rect = game.getBoundingClientRect();
  const cellSize = Math.floor((Math.min(rect.width, rect.height) - TILE_GAP * (Math.max(cols, rows) - 1)) / Math.max(cols, rows));
  const offsetX = (rect.width - (cellSize * cols + TILE_GAP * (cols - 1))) / 2;
  const offsetY = (rect.height - (cellSize * rows + TILE_GAP * (rows - 1))) / 2;

  state.route.forEach((cell, index) => {
    const tile = document.createElement('div');
    tile.className = 'tile';
    const x = cell[0] - minX;
    const y = cell[1] - minY;
    tile.style.width = `${cellSize}px`;
    tile.style.height = `${cellSize}px`;
    tile.style.left = `${offsetX + x * (cellSize + TILE_GAP)}px`;
    tile.style.top = `${offsetY + y * (cellSize + TILE_GAP)}px`;
    tile.dataset.x = cell[0];
    tile.dataset.y = cell[1];
    tile.dataset.index = index;
    tile.addEventListener('pointerdown', onTileDown, { passive: false });
    game.appendChild(tile);
    if (index === 0) tile.classList.add('start');
  });
  updateLine();
  updateTiles();
}

function onTileDown(event) {
  event.preventDefault();
  const tile = event.currentTarget;
  const cell = [Number(tile.dataset.x), Number(tile.dataset.y)];
  if (state.failed) return;
  if (state.path.length === 0 && sameCell(cell, state.route[0])) {
    beginRoute(cell);
  }
}

function beginRoute(cell) {
  state.active = true;
  state.path = [cell];
  state.visited = new Set([key(cell)]);
  state.moveCount = 1;
  state.elapsed = 0;
  clearInterval(state.timerId);
  state.timerId = setInterval(() => {
    state.elapsed += 1;
    updateHud();
  }, 1000);
  updateLine();
  updateTiles();
  updateHud();
}

function onPointerDown(event) {
  if (event.target.closest('.tile')) return;
  if (state.active && !state.failed) event.preventDefault();
}

function onPointerMove(event) {
  if (!state.active || state.failed) return;
  event.preventDefault();
  const element = document.elementFromPoint(event.clientX, event.clientY);
  const tile = element?.closest('.tile');
  if (!tile) return;
  const cell = [Number(tile.dataset.x), Number(tile.dataset.y)];
  attemptMove(cell);
}

function onPointerUp() {
  state.active = false;
}

function attemptMove(cell) {
  if (!state.route.length) return;
  const nextExpected = state.route[state.path.length];
  if (!nextExpected || !sameCell(cell, nextExpected)) {
    if (!sameCell(cell, state.route[0])) failLevel();
    return;
  }
  if (state.visited.has(key(cell))) {
    failLevel();
    return;
  }
  state.path.push(cell);
  state.visited.add(key(cell));
  state.moveCount += 1;
  updateLine();
  updateTiles();
  updateHud();
  playTone(600, 0.04, 'sine', 0.04);
  if (state.path.length === state.route.length) {
    winLevel();
  }
}

function updateLine() {
  const points = state.path
    .map((cell) => tileCenter(cell))
    .map((pos) => `${pos.x},${pos.y}`)
    .join(' ');
  line.setAttribute('points', points);
}

function tileCenter(cell) {
  const tile = Array.from(game.querySelectorAll('.tile')).find((div) => Number(div.dataset.x) === cell[0] && Number(div.dataset.y) === cell[1]);
  if (!tile) return { x: 0, y: 0 };
  const rect = tile.getBoundingClientRect();
  const parent = game.getBoundingClientRect();
  return { x: rect.left - parent.left + rect.width / 2, y: rect.top - parent.top + rect.height / 2 };
}

function updateTiles() {
  Array.from(game.querySelectorAll('.tile')).forEach((tile) => {
    tile.classList.remove('visited', 'validHover');
    const cell = [Number(tile.dataset.x), Number(tile.dataset.y)];
    if (state.visited.has(key(cell))) tile.classList.add('visited');
  });
  const next = state.route[state.path.length];
  if (next) {
    const nextTile = Array.from(game.querySelectorAll('.tile')).find((tile) => Number(tile.dataset.x) === next[0] && Number(tile.dataset.y) === next[1]);
    nextTile?.classList.add('validHover');
  }
}

function undoMove() {
  if (!state.path.length || state.failed) return;
  const removed = state.path.pop();
  if (removed) state.visited.delete(key(removed));
  state.moveCount = Math.max(state.path.length, 0);
  updateLine();
  updateTiles();
  updateHud();
}

function failLevel() {
  if (state.failed) return;
  state.failed = true;
  state.active = false;
  playTone(180, 0.14, 'triangle', 0.08);
  const total = line.getTotalLength();
  line.style.strokeDasharray = total;
  line.style.strokeDashoffset = '0';
  requestAnimationFrame(() => {
    line.style.strokeDashoffset = total;
  });
  setTimeout(startLevel, 900);
}

function winLevel() {
  state.active = false;
  clearInterval(state.timerId);
  showMessage('You Win!');
  playTone(620, 0.1, 'sine', 0.08);
  playTone(780, 0.14, 'triangle', 0.08);
  spawnParticles();
  setTimeout(nextLevel, 1400);
}

function showMessage(text) {
  msgText.textContent = text;
  msg.classList.add('show');
  nextButton.style.display = 'none';
}

function hideMessage() {
  msg.classList.remove('show');
}

function spawnParticles() {
  for (let i = 0; i < 30; i += 1) {
    const p = document.createElement('div');
    p.className = 'particle';
    const bounds = game.getBoundingClientRect();
    p.style.left = `${bounds.width / 2}px`;
    p.style.top = `${bounds.height / 2}px`;
    game.appendChild(p);
    const angle = Math.random() * Math.PI * 2;
    const distance = 80 + Math.random() * 80;
    const dx = Math.cos(angle) * distance;
    const dy = Math.sin(angle) * distance;
    p.animate([
      { transform: 'translate(0,0) scale(1)', opacity: 1 },
      { transform: `translate(${dx}px, ${dy}px) scale(0)`, opacity: 0 }
    ], { duration: 700, easing: 'ease-out' });
    setTimeout(() => p.remove(), 720);
  }
}

function playTone(freq, duration, type = 'sine', volume = 0.08) {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;
  const ctx = new AudioContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  osc.connect(gain);
  gain.connect(ctx.destination);
  gain.gain.value = volume;
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
  osc.start();
  osc.stop(ctx.currentTime + duration);
  setTimeout(() => ctx.close(), duration * 1000 + 50);
}

function sameCell(a, b) {
  return a[0] === b[0] && a[1] === b[1];
}

init();
