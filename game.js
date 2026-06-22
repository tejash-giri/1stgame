/**
 * ═══════════════════════════════════════════════════════════════════
 * BLOCK PUZZLE — Complete Game Engine v2
 * ═══════════════════════════════════════════════════════════════════
 *
 * Sections:
 *   0. Shape ID mapping
 *   1. State definitions
 *   2. Complete shape library (all classic puzzle variations)
 *   3. Collision & placement engine
 *   4. Line cleansing with combo scoring
 *   5. Game over / victory detection
 *   6. Tray management
 *   7. Level initialization
 *   8. Serialization
 *   9. Debug / diagnostics
 *  10. DragController — PointerEvents with lift, preview, elastic return
 *  11. Animation controller — line-clear blasts, floating combo popups,
 *      smooth score counter
 * ═══════════════════════════════════════════════════════════════════
 */

/* ═══════════════════════════════════════════════════════════════════
   SECTION 0 — SHAPE ID MAPPING
   ═══════════════════════════════════════════════════════════════════ */

const SHAPE_ID_MAP = {
  // Dots
  '1x1': 'dot',
  // Squares
  '2x2': 'square_2',
  '3x3': 'square_3',
  // Horizontal lines
  '1x2': 'line_1x2',
  '1x3': 'line_1x3',
  '1x4': 'line_1x4',
  '1x5': 'line_1x5',
  // Vertical lines
  '2x1': 'line_2x1',
  '3x1': 'line_3x1',
  '4x1': 'line_4x1',
  '5x1': 'line_5x1',
  // L-shapes (4 rotations)
  'l_0':   'l_0',
  'l_90':  'l_90',
  'l_180': 'l_180',
  'l_270': 'l_270',
  // Extended L-shapes (3x3 bounding box, 4 rotations)
  'L_0':   'L_0',
  'L_90':  'L_90',
  'L_180': 'L_180',
  'L_270': 'L_270',
  // T-shapes (4 rotations)
  't_0':   't_0',
  't_90':  't_90',
  't_180': 't_180',
  't_270': 't_270',
  // Z/S shapes (2 rotations each)
  'z_h': 'z_h',
  'z_v': 'z_v',
  's_h': 's_h',
  's_v': 's_v',
  // Plus / cross
  'plus': 'pent_plus',
  // Backwards L (mirror L)
  'rl_0':   'rl_0',
  'rl_90':  'rl_90',
  'rl_180': 'rl_180',
  'rl_270': 'rl_270',
};

function resolveShapeId(id) {
  return SHAPE_ID_MAP[id] || id;
}

/* ═══════════════════════════════════════════════════════════════════
   SECTION 1 — STATE
   ═══════════════════════════════════════════════════════════════════ */

function createEmptyGrid() {
  return Array.from({ length: 8 }, () => Array(8).fill(0));
}

function deepCopyGrid(grid) {
  return grid.map(row => row.slice());
}

const GameState = {
  grid: createEmptyGrid(),
  currentScore: 0,
  targetScore: 0,
  activeLevel: 0,
  trayPieces: [],
  isGameOver: false,
  isLevelClear: false,
  comboMultiplier: 1,
  totalLinesCleared: 0,
};

let _currentLevelShapeIds = [];

/* ═══════════════════════════════════════════════════════════════════
   SECTION 2 — COMPLETE SHAPE LIBRARY
   ═══════════════════════════════════════════════════════════════════
   Every shape is a 2-D binary matrix. 1 = filled, 0 = empty.
   ═══════════════════════════════════════════════════════════════════ */

const SHAPES = {};

function M(r, c) { return Array.from({ length: r }, () => Array(c).fill(0)); }
function S(m, coords) { coords.forEach(([r, c]) => { m[r][c] = 1; }); return m; }

// ── Dots ──
SHAPES.dot = S(M(1,1), [[0,0]]);

// ── Squares ──
SHAPES.square_2 = S(M(2,2), [[0,0],[0,1],[1,0],[1,1]]);
SHAPES.square_3 = S(M(3,3), [
  [0,0],[0,1],[0,2],
  [1,0],[1,1],[1,2],
  [2,0],[2,1],[2,2],
]);

// ── Horizontal lines ──
SHAPES.line_1x2 = S(M(1,2), [[0,0],[0,1]]);
SHAPES.line_1x3 = S(M(1,3), [[0,0],[0,1],[0,2]]);
SHAPES.line_1x4 = S(M(1,4), [[0,0],[0,1],[0,2],[0,3]]);
SHAPES.line_1x5 = S(M(1,5), [[0,0],[0,1],[0,2],[0,3],[0,4]]);

// ── Vertical lines ──
SHAPES.line_2x1 = S(M(2,1), [[0,0],[1,0]]);
SHAPES.line_3x1 = S(M(3,1), [[0,0],[1,0],[2,0]]);
SHAPES.line_4x1 = S(M(4,1), [[0,0],[1,0],[2,0],[3,0]]);
SHAPES.line_5x1 = S(M(5,1), [[0,0],[1,0],[2,0],[3,0],[4,0]]);

// ── L-shapes (2×2 bounding box, 3 cells) ──
SHAPES.l_0   = S(M(2,2), [[0,0],[1,0],[1,1]]);   // └
SHAPES.l_90  = S(M(2,2), [[0,0],[0,1],[1,0]]);   // ┌
SHAPES.l_180 = S(M(2,2), [[0,1],[1,0],[1,1]]);   // ┐
SHAPES.l_270 = S(M(2,2), [[0,0],[0,1],[1,1]]);   // ┘

// ── Extended L-shapes (3×3 bounding box, 5 cells) ──
SHAPES.L_0   = S(M(3,3), [[0,0],[1,0],[2,0],[2,1],[2,2]]);   // big └
SHAPES.L_90  = S(M(3,3), [[0,0],[0,1],[0,2],[1,0],[2,0]]);   // big ┌
SHAPES.L_180 = S(M(3,3), [[0,0],[0,1],[0,2],[1,2],[2,2]]);   // big ┐
SHAPES.L_270 = S(M(3,3), [[0,2],[1,2],[2,0],[2,1],[2,2]]);   // big ┘

// ── Backwards L / mirror L (4 rotations) ──
SHAPES.rl_0   = S(M(2,2), [[0,1],[1,0],[1,1]]);   // mirror └
SHAPES.rl_90  = S(M(2,2), [[0,0],[0,1],[1,1]]);   // mirror ┌
SHAPES.rl_180 = S(M(2,2), [[0,0],[0,1],[1,0]]);   // mirror ┐
SHAPES.rl_270 = S(M(2,2), [[0,0],[1,0],[1,1]]);   // mirror ┘

// ── T-shapes (4 rotations) ──
SHAPES.t_0   = S(M(2,3), [[0,0],[0,1],[0,2],[1,1]]);   // T down
SHAPES.t_90  = S(M(3,2), [[0,1],[1,0],[1,1],[2,1]]);   // T left
SHAPES.t_180 = S(M(2,3), [[0,1],[1,0],[1,1],[1,2]]);   // T up
SHAPES.t_270 = S(M(3,2), [[0,0],[1,0],[1,1],[2,0]]);   // T right

// ── Z-shapes (2 rotations) ──
SHAPES.z_h = S(M(2,3), [[0,0],[0,1],[1,1],[1,2]]);   // horizontal Z
SHAPES.z_v = S(M(3,2), [[0,1],[1,0],[1,1],[2,0]]);   // vertical Z

// ── S-shapes (2 rotations) ──
SHAPES.s_h = S(M(2,3), [[0,1],[0,2],[1,0],[1,1]]);   // horizontal S
SHAPES.s_v = S(M(3,2), [[0,0],[1,0],[1,1],[2,1]]);   // vertical S

// ── Plus / Cross ──
SHAPES.pent_plus = S(M(3,3), [[0,1],[1,0],[1,1],[1,2],[2,1]]);

// ── Utility ──
function getShapeDimensions(shapeMatrix) {
  return { rows: shapeMatrix.length, cols: shapeMatrix[0] ? shapeMatrix[0].length : 0 };
}

function getFilledCells(shapeMatrix) {
  const cells = [];
  for (let r = 0; r < shapeMatrix.length; r++)
    for (let c = 0; c < shapeMatrix[r].length; c++)
      if (shapeMatrix[r][c] === 1) cells.push([r, c]);
  return cells;
}

function rotateClockwise(shapeMatrix) {
  const { rows, cols } = getShapeDimensions(shapeMatrix);
  const rot = M(cols, rows);
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      rot[c][rows - 1 - r] = shapeMatrix[r][c];
  return rot;
}

function mirrorHorizontal(shapeMatrix) {
  return shapeMatrix.map(row => row.slice().reverse());
}

/* ═══════════════════════════════════════════════════════════════════
   SECTION 3 — COLLISION & PLACEMENT
   ═══════════════════════════════════════════════════════════════════ */

function isValidPlacement(gridRow, gridCol, shapeMatrix, grid) {
  const board = grid || GameState.grid;
  return getFilledCells(shapeMatrix).every(([sr, sc]) => {
    const br = gridRow + sr, bc = gridCol + sc;
    if (br < 0 || br >= 8 || bc < 0 || bc >= 8) return false;
    return board[br][bc] === 0;
  });
}

function placeBlock(gridRow, gridCol, shapeMatrix, color, trayIndex) {
  if (!isValidPlacement(gridRow, gridCol, shapeMatrix))
    throw new Error(`Invalid placement at (${gridRow},${gridCol})`);

  getFilledCells(shapeMatrix).forEach(([sr, sc]) => {
    GameState.grid[gridRow + sr][gridCol + sc] = color;
  });
  if (trayIndex != null) GameState.trayPieces[trayIndex] = null;

  const clearResult = clearLines();
  const scoreGained = calculateScore(clearResult);
  GameState.currentScore += scoreGained;
  GameState.comboMultiplier = clearResult.combo;

  if (GameState.trayPieces.every(p => p === null)) refillTray();
  checkEndConditions();

  return {
    linesCleared: clearResult.totalLines,
    combo: clearResult.combo,
    scoreGained,
    clearedRows: clearResult.rows,
    clearedCols: clearResult.cols,
  };
}

/* ═══════════════════════════════════════════════════════════════════
   SECTION 4 — LINE CLEANSING
   ═══════════════════════════════════════════════════════════════════ */

function clearLines() {
  const grid = GameState.grid;
  const rows = [], cols = [];
  for (let r = 0; r < 8; r++) { let f = true; for (let c = 0; c < 8; c++) { if (grid[r][c] === 0) { f = false; break; } } if (f) rows.push(r); }
  for (let c = 0; c < 8; c++) { let f = true; for (let r = 0; r < 8; r++) { if (grid[r][c] === 0) { f = false; break; } } if (f) cols.push(c); }
  const total = rows.length + cols.length;
  rows.forEach(r => { for (let c = 0; c < 8; c++) if (grid[r][c] !== 'dead') grid[r][c] = 0; });
  cols.forEach(c => { for (let r = 0; r < 8; r++) if (grid[r][c] !== 'dead') grid[r][c] = 0; });
  const combo = total <= 1 ? 1 : total === 2 ? 2 : 3;
  GameState.totalLinesCleared += total;
  return { rows, cols, totalLines: total, combo };
}

function calculateScore(cr) {
  if (cr.totalLines === 0) return 0;
  const lvl = GAME_LEVELS[GameState.activeLevel];
  const mult = lvl ? lvl.targetScore / 500 : 1;
  return Math.floor(100 * cr.totalLines * cr.combo * mult);
}

/* ═══════════════════════════════════════════════════════════════════
   SECTION 5 — GAME OVER / VICTORY
   ═══════════════════════════════════════════════════════════════════ */

function hasAnyValidMove() {
  for (const p of GameState.trayPieces) {
    if (p === null) continue;
    for (let r = 0; r < 8; r++)
      for (let c = 0; c < 8; c++)
        if (isValidPlacement(r, c, p.shapeMatrix)) return true;
  }
  return false;
}

function checkEndConditions() {
  if (GameState.currentScore >= GameState.targetScore) {
    GameState.isLevelClear = true; GameState.isGameOver = false;
    return { state: 'victory' };
  }
  if (!hasAnyValidMove()) {
    GameState.isGameOver = true; GameState.isLevelClear = false;
    return { state: 'gameover' };
  }
  return { state: 'playing' };
}

/* ═══════════════════════════════════════════════════════════════════
   SECTION 6 — TRAY MANAGEMENT
   ═══════════════════════════════════════════════════════════════════ */

const BLOCK_COLORS = [
  '#ff6b35','#e040fb','#7c4dff','#ff5252','#69f0ae',
  '#82b1ff','#ffd740','#ffab40','#ff4081','#00e5ff',
  '#76ff03','#b388ff',
];

function pickRandomId(ids) { return ids[Math.floor(Math.random() * ids.length)]; }

function createPiece(shapeId) {
  const resolved = resolveShapeId(shapeId);
  const matrix = SHAPES[resolved];
  if (!matrix) {
    console.warn(`Unknown shape "${shapeId}" (resolved: "${resolved}"), fallback dot.`);
    return createPiece('dot');
  }
  return {
    id: resolved,
    shapeMatrix: deepCopyGrid(matrix),
    color: BLOCK_COLORS[Math.floor(Math.random() * BLOCK_COLORS.length)],
  };
}

function generateTray(count = 3, allowedShapes) {
  const ids = allowedShapes || _currentLevelShapeIds || Object.keys(SHAPES);
  return Array.from({ length: count }, () => createPiece(pickRandomId(ids)));
}

function refillTray() {
  GameState.trayPieces = generateTray(3, _currentLevelShapeIds);
}

/* ═══════════════════════════════════════════════════════════════════
   SECTION 7 — LEVEL INIT
   ═══════════════════════════════════════════════════════════════════ */

function initLevel(idx) {
  const cfg = GAME_LEVELS[idx];
  if (!cfg) { console.error(`Level ${idx} not found.`); return; }
  GameState.grid = createEmptyGrid();
  if (cfg.gridPreset) cfg.gridPreset.forEach(([r, c]) => { if (r >= 0 && r < 8 && c >= 0 && c < 8) GameState.grid[r][c] = 'dead'; });
  GameState.currentScore = 0;
  GameState.targetScore = cfg.targetScore;
  GameState.activeLevel = idx;
  GameState.isGameOver = false;
  GameState.isLevelClear = false;
  GameState.comboMultiplier = 1;
  GameState.totalLinesCleared = 0;
  _currentLevelShapeIds = (cfg.allowedShapes || []).map(id => resolveShapeId(id));
  GameState.trayPieces = generateTray(3, _currentLevelShapeIds);
}

/* ═══════════════════════════════════════════════════════════════════
   SECTION 8 — SERIALIZATION
   ═══════════════════════════════════════════════════════════════════ */

function serializeState() {
  return {
    grid: deepCopyGrid(GameState.grid),
    currentScore: GameState.currentScore,
    targetScore: GameState.targetScore,
    activeLevel: GameState.activeLevel,
    trayPieces: GameState.trayPieces.map(p => p ? { id: p.id, color: p.color } : null),
    isGameOver: GameState.isGameOver,
    isLevelClear: GameState.isLevelClear,
    totalLinesCleared: GameState.totalLinesCleared,
  };
}

function deserializeState(d) {
  if (!d) return;
  GameState.grid = d.grid || createEmptyGrid();
  GameState.currentScore = d.currentScore || 0;
  GameState.targetScore = d.targetScore || 0;
  GameState.activeLevel = d.activeLevel || 0;
  GameState.isGameOver = d.isGameOver || false;
  GameState.isLevelClear = d.isLevelClear || false;
  GameState.totalLinesCleared = d.totalLinesCleared || 0;
  GameState.trayPieces = (d.trayPieces || []).map(p => p ? createPiece(p.id) : null);
}

/* ═══════════════════════════════════════════════════════════════════
   SECTION 9 — DEBUG
   ═══════════════════════════════════════════════════════════════════ */

function printGrid(g) {
  const grid = g || GameState.grid;
  console.log('  0 1 2 3 4 5 6 7');
  grid.forEach((row, r) => console.log(r + ' ' + row.map(c => c === 0 ? '.' : c === 'dead' ? 'X' : '#').join(' ')));
}

function getGridStats() {
  let e = 0, f = 0, d = 0;
  GameState.grid.forEach(row => row.forEach(c => { if (c === 0) e++; else if (c === 'dead') d++; else f++; }));
  return { empty: e, filled: f, dead: d, total: 64 };
}

/* ═══════════════════════════════════════════════════════════════════
   SECTION 10 — DRAG CONTROLLER v2
   ═══════════════════════════════════════════════════════════════════
   • pointerdown → 1.2x lift animation, center under cursor
   • pointermove → real-time semi-transparent grid preview
   • pointerup valid → snap to grid, commit
   • pointerup invalid → elastic slide-back to tray slot
   ═══════════════════════════════════════════════════════════════════ */

class DragController {
  constructor(opts = {}) {
    this._onCommit    = opts.onCommit    || (() => {});
    this._onCancel    = opts.onCancel    || (() => {});
    this._onProj      = opts.onProjectionChange || (() => {});
    this._getCellSize = opts.getCellSize || (() => 32);
    this._isValidFn   = opts.isValidFn  || (() => false);
    this._getFilled   = opts.getFilledCells || (() => []);

    this._active = false;
    this._pointerId = null;
    this._trayIndex = null;
    this._piece = null;
    this._gridEl = null;
    this._originSlot = null;
    this._ghost = null;
    this._originRect = null;
    this._gridRect = null;
    this._offsetX = 0;
    this._offsetY = 0;
    this._lastAnchor = { r: -1, c: -1, valid: false };

    this._onPointerMove   = this._onPointerMove.bind(this);
    this._onPointerUp     = this._onPointerUp.bind(this);
    this._onPointerCancel = this._onPointerCancel.bind(this);
  }

  start(e, trayIndex, piece, gridEl, originSlot) {
    if (this._active || !piece) return;

    this._active     = true;
    this._pointerId  = e.pointerId;
    this._trayIndex  = trayIndex;
    this._piece      = piece;
    this._gridEl     = gridEl;
    this._originSlot = originSlot;

    // Capture on the slot element (stable, not a child)
    if (originSlot.setPointerCapture) {
      try { originSlot.setPointerCapture(e.pointerId); } catch (_) {}
    }

    this._originRect = originSlot.getBoundingClientRect();
    this._gridRect   = gridEl.getBoundingClientRect();
    const cellSize   = this._gridRect.width / 8;
    const { rows: sR, cols: sC } = getShapeDimensions(piece.shapeMatrix);

    // Build ghost at exactly 1.0× grid cell size so it aligns with grid cells
    const ghostW = sC * cellSize;
    const ghostH = sR * cellSize;

    this._ghost = document.createElement('div');
    this._ghost.className = 'drag-ghost';
    Object.assign(this._ghost.style, {
      position: 'fixed',
      width:  ghostW + 'px',
      height: ghostH + 'px',
      display: 'grid',
      gridTemplateRows:    `repeat(${sR}, 1fr)`,
      gridTemplateColumns: `repeat(${sC}, 1fr)`,
      gap: '2px',
      zIndex: '9999',
      pointerEvents: 'none',
      opacity: '0',
      filter: 'drop-shadow(0 12px 28px rgba(0,0,0,0.6))',
      transition: 'filter 0.15s ease',
      transform: 'scale(1)',
      willChange: 'left, top, opacity, transform',
    });

    const filled = this._getFilled(piece.shapeMatrix);
    for (let r = 0; r < sR; r++) {
      for (let c = 0; c < sC; c++) {
        const isF = filled.some(([fr, fc]) => fr === r && fc === c);
        const block = document.createElement('div');
        if (isF) {
          Object.assign(block.style, {
            background: `linear-gradient(135deg, ${piece.color}, ${piece.color}dd)`,
            borderRadius: '5px',
            boxShadow: `inset 0 2px 3px rgba(255,255,255,0.4), inset 0 -1px 2px rgba(0,0,0,0.2), 0 0 12px ${piece.color}77`,
          });
        }
        this._ghost.appendChild(block);
      }
    }

    // Position ghost so its TOP-LEFT is under the cursor.
    // This makes the anchor cell (0,0) of the shape align with the grid cell
    // the cursor is over, matching the projection preview exactly.
    // We use a small inset (2px) so the ghost doesn't sit directly under the finger.
    this._offsetX = 0;
    this._offsetY = 0;
    this._ghost.style.left = (e.clientX) + 'px';
    this._ghost.style.top  = (e.clientY) + 'px';

    document.body.appendChild(this._ghost);

    // Trigger lift animation on next frame: scale up to 1.1× for the "lift" feel
    requestAnimationFrame(() => {
      if (this._ghost) {
        this._ghost.style.transition = 'opacity 0.15s ease, transform 0.15s cubic-bezier(.4,0,.2,1), filter 0.15s ease';
        this._ghost.style.opacity = '0.95';
        this._ghost.style.transform = 'scale(1.1)';
      }
    });

    document.addEventListener('pointermove', this._onPointerMove);
    document.addEventListener('pointerup',   this._onPointerUp);
    document.addEventListener('pointercancel', this._onPointerCancel);
  }

  _onPointerMove(e) {
    if (!this._active || e.pointerId !== this._pointerId) return;
    e.preventDefault();

    this._ghost.style.left = (e.clientX - this._offsetX) + 'px';
    this._ghost.style.top  = (e.clientY - this._offsetY) + 'px';

    this._gridRect = this._gridEl.getBoundingClientRect();
    const cellSize = this._gridRect.width / 8;
    const relX = e.clientX - this._gridRect.left;
    const relY = e.clientY - this._gridRect.top;
    const aC = Math.floor(relX / cellSize);
    const aR = Math.floor(relY / cellSize);

    const valid = this._isValidFn(aR, aC, this._piece.shapeMatrix);
    const filled = this._getFilled(this._piece.shapeMatrix);

    this._ghost.style.filter = valid
      ? 'drop-shadow(0 12px 28px rgba(0,0,0,0.6)) drop-shadow(0 0 14px rgba(105,240,174,0.45))'
      : 'drop-shadow(0 12px 28px rgba(0,0,0,0.6)) drop-shadow(0 0 14px rgba(255,82,82,0.45))';

    if (aR !== this._lastAnchor.r || aC !== this._lastAnchor.c || valid !== this._lastAnchor.valid) {
      this._lastAnchor = { r: aR, c: aC, valid };
      this._onProj(aR, aC, valid, filled);
    }
  }

  _onPointerUp(e) {
    if (!this._active || e.pointerId !== this._pointerId) return;
    this._finish(e.clientX, e.clientY, false);
  }

  _onPointerCancel(e) {
    if (!this._active || e.pointerId !== this._pointerId) return;
    this._finish(e.clientX, e.clientY, true);
  }

  _finish(clientX, clientY, cancelled) {
    if (this._originSlot && this._originSlot.releasePointerCapture && this._pointerId) {
      try { this._originSlot.releasePointerCapture(this._pointerId); } catch (_) {}
    }
    document.removeEventListener('pointermove', this._onPointerMove);
    document.removeEventListener('pointerup',   this._onPointerUp);
    document.removeEventListener('pointercancel', this._onPointerCancel);

    this._clearProjection();

    if (cancelled || !this._piece) { this._animateReturn(); return; }

    this._gridRect = this._gridEl.getBoundingClientRect();
    const cellSize = this._gridRect.width / 8;
    const aC = Math.floor((clientX - this._gridRect.left) / cellSize);
    const aR = Math.floor((clientY - this._gridRect.top) / cellSize);

    if (this._isValidFn(aR, aC, this._piece.shapeMatrix)) {
      this._snapToGrid(aR, aC, cellSize, () => {
        this._onCommit(this._trayIndex, aR, aC, this._piece);
        this._cleanup();
      });
    } else {
      this._animateReturn();
    }
  }

  _snapToGrid(aR, aC, cellSize, done) {
    if (!this._ghost) { done(); return; }
    // Snap to exact grid position (top-left aligned, matching the drag offset)
    const targetX = this._gridRect.left + aC * cellSize;
    const targetY = this._gridRect.top  + aR * cellSize;
    this._ghost.style.transition = 'left 0.15s cubic-bezier(.4,0,.2,1), top 0.15s cubic-bezier(.4,0,.2,1), opacity 0.15s ease, transform 0.15s ease';
    this._ghost.style.left = targetX + 'px';
    this._ghost.style.top  = targetY + 'px';
    this._ghost.style.opacity = '0';
    this._ghost.style.transform = 'scale(0.9)';
    setTimeout(done, 150);
  }

  _animateReturn() {
    if (!this._ghost) { this._cleanup(); return; }
    const dest = this._originSlot.getBoundingClientRect();
    // Elastic slide-back: animate to the tray slot center, scaling down
    const dx = dest.left + dest.width  / 2 - this._offsetX;
    const dy = dest.top  + dest.height / 2 - this._offsetY;
    this._ghost.style.transition = 'left 0.4s cubic-bezier(.34,1.56,.64,1), top 0.4s cubic-bezier(.34,1.56,.64,1), opacity 0.35s ease, transform 0.35s ease';
    this._ghost.style.left   = dx + 'px';
    this._ghost.style.top    = dy + 'px';
    this._ghost.style.opacity = '0';
    this._ghost.style.transform = 'scale(0.4)';
    this._onCancel(this._trayIndex, this._piece);
    setTimeout(() => this._cleanup(), 400);
  }

  _cleanup() {
    if (this._ghost) { this._ghost.remove(); this._ghost = null; }
    this._active = false; this._pointerId = null; this._trayIndex = null;
    this._piece = null; this._gridEl = null; this._originSlot = null;
    this._originRect = null; this._gridRect = null;
    this._lastAnchor = { r: -1, c: -1, valid: false };
  }

  _clearProjection() { this._onProj(-1, -1, false, []); }

  abort() { if (!this._active) return; this._clearProjection(); this._animateReturn(); }

  get isActive() { return this._active; }
}

/* ═══════════════════════════════════════════════════════════════════
   SECTION 11 — ANIMATION CONTROLLER
   ═══════════════════════════════════════════════════════════════════
   Handles:
   • Line-clear blast: scale-down from center outward + flash
   • Floating combo popup: "+40 Combo!" cascading upward
   • Smooth score counter: animates the number over 300ms
   ═══════════════════════════════════════════════════════════════════ */

const AnimCtrl = {
  /**
   * Animate cleared lines with a center-outward blast.
   * Returns a Promise that resolves when the animation completes.
   */
  blastLines(rows, cols, gridEl) {
    return new Promise(resolve => {
      const cells = gridEl.children;
      const indices = new Set();
      rows.forEach(r => { for (let c = 0; c < 8; c++) indices.add(r * 8 + c); });
      cols.forEach(c => { for (let r = 0; r < 8; r++) indices.add(r * 8 + c); });

      // Calculate center of the blast area
      let sumR = 0, sumC = 0, count = 0;
      indices.forEach(idx => { sumR += Math.floor(idx / 8); sumC += idx % 8; count++; });
      const centerR = sumR / count;
      const centerC = sumC / count;

      // Apply staggered animation based on distance from center
      indices.forEach(idx => {
        const r = Math.floor(idx / 8), c = idx % 8;
        const dist = Math.sqrt((r - centerR) ** 2 + (c - centerC) ** 2);
        const delay = dist * 30; // 30ms per cell distance
        const cell = cells[idx];
        if (cell) {
          cell.style.animationDelay = delay + 'ms';
          cell.classList.add('grid-cell--blast');
        }
      });

      const maxDelay = Math.sqrt(8 * 8 + 8 * 8) * 30 + 500;
      setTimeout(() => {
        indices.forEach(idx => {
          const cell = cells[idx];
          if (cell) {
            cell.classList.remove('grid-cell--blast');
            cell.style.animationDelay = '';
          }
        });
        resolve();
      }, maxDelay);
    });
  },

  /**
   * Spawn a floating combo popup.
   * @param {string} text — e.g. "+40 Combo!"
   * @param {HTMLElement} container — parent to append the popup to
   * @param {number} x — center x position
   * @param {number} y — start y position
   */
  spawnComboPopup(text, container, x, y) {
    const el = document.createElement('div');
    el.className = 'combo-popup';
    el.textContent = text;
    Object.assign(el.style, {
      position: 'absolute',
      left: x + 'px',
      top:  y + 'px',
      transform: 'translate(-50%, 0)',
      pointerEvents: 'none',
      zIndex: '3000',
    });
    container.appendChild(el);
    // Cleanup after animation
    setTimeout(() => el.remove(), 1200);
  },

  /**
   * Smoothly animate a score counter from `from` to `to` over `duration` ms.
   * Calls `onTick(currentValue)` every frame.
   */
  animateScore(from, to, duration, onTick) {
    const start = performance.now();
    const diff = to - from;
    function tick(now) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(from + diff * eased);
      onTick(current);
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  },
};

/* ═══════════════════════════════════════════════════════════════════
   EXPORTS
   ═══════════════════════════════════════════════════════════════════ */

const BlockPuzzle = {
  GameState, createEmptyGrid, deepCopyGrid,
  serializeState, deserializeState,
  SHAPES, getShapeDimensions, getFilledCells,
  rotateClockwise, mirrorHorizontal,
  isValidPlacement, placeBlock,
  clearLines, calculateScore,
  hasAnyValidMove, checkEndConditions,
  generateTray, refillTray, createPiece,
  initLevel, printGrid, getGridStats,
  DragController, AnimCtrl,
  SHAPE_ID_MAP,
};

if (typeof window !== 'undefined') window.BlockPuzzle = BlockPuzzle;
if (typeof module !== 'undefined' && module.exports) module.exports = BlockPuzzle;
