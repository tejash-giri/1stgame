/**
 * ═══════════════════════════════════════════════════════════════════
 * BLOCK PUZZLE — Game Engine v5 (6×6 · 3-Mode · Dynamic Difficulty)
 * ═══════════════════════════════════════════════════════════════════
 * Grid: 6×6 fixed. Endless continuous play per mode.
 * Modes: Easy / Medium / Hard — dynamic shape weighting by score.
 * Drag: getBoundingClientRect() cached once on pointerdown.
 * Ghost: positioned via translate3d() in a dedicated rAF loop.
 * Tray: constant scale(0.55) compression, 1.0× on pickup.
 * ═══════════════════════════════════════════════════════════════════
 */
(function(){
'use strict';
try {

// ═══════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════
var GRID = 6;
var GRID_TOTAL = GRID * GRID;
var MODES = { EASY: 'easy', MEDIUM: 'medium', HARD: 'hard' };

// ═══════════════════════════════════════════════════════════════
// SHAPE ID MAPPING
// ═══════════════════════════════════════════════════════════════
var SHAPE_ID_MAP = {
  '1x1':'dot','2x2':'square_2','3x3':'square_3',
  '1x2':'line_1x2','1x3':'line_1x3','1x4':'line_1x4','1x5':'line_1x5',
  '2x1':'line_2x1','3x1':'line_3x1','4x1':'line_4x1','5x1':'line_5x1',
  'l_0':'l_0','l_90':'l_90','l_180':'l_180','l_270':'l_270',
  'L_0':'L_0','L_90':'L_90','L_180':'L_180','L_270':'L_270',
  'rl_0':'rl_0','rl_90':'rl_90','rl_180':'rl_180','rl_270':'rl_270',
  't_0':'t_0','t_90':'t_90','t_180':'t_180','t_270':'t_270',
  'z_h':'z_h','z_v':'z_v','s_h':'s_h','s_v':'s_v','plus':'pent_plus',
};
function resolveId(id){ return SHAPE_ID_MAP[id]||id; }

// ═══════════════════════════════════════════════════════════════
// SHAPE LIBRARY
// ═══════════════════════════════════════════════════════════════
var SHAPES = {};
function M(r,c){return Array.from({length:r},function(){return Array(c).fill(0);});}
function S(m,coords){coords.forEach(function(rc){m[rc[0]][rc[1]]=1;});return m;}
SHAPES.dot=S(M(1,1),[[0,0]]);
SHAPES.square_2=S(M(2,2),[[0,0],[0,1],[1,0],[1,1]]);
SHAPES.square_3=S(M(3,3),[[0,0],[0,1],[0,2],[1,0],[1,1],[1,2],[2,0],[2,1],[2,2]]);
SHAPES.line_1x2=S(M(1,2),[[0,0],[0,1]]);
SHAPES.line_1x3=S(M(1,3),[[0,0],[0,1],[0,2]]);
SHAPES.line_1x4=S(M(1,4),[[0,0],[0,1],[0,2],[0,3]]);
SHAPES.line_1x5=S(M(1,5),[[0,0],[0,1],[0,2],[0,3],[0,4]]);
SHAPES.line_2x1=S(M(2,1),[[0,0],[1,0]]);
SHAPES.line_3x1=S(M(3,1),[[0,0],[1,0],[2,0]]);
SHAPES.line_4x1=S(M(4,1),[[0,0],[1,0],[2,0],[3,0]]);
SHAPES.line_5x1=S(M(5,1),[[0,0],[1,0],[2,0],[3,0],[4,0]]);
SHAPES.l_0=S(M(2,2),[[0,0],[1,0],[1,1]]);
SHAPES.l_90=S(M(2,2),[[0,0],[0,1],[1,0]]);
SHAPES.l_180=S(M(2,2),[[0,1],[1,0],[1,1]]);
SHAPES.l_270=S(M(2,2),[[0,0],[0,1],[1,1]]);
SHAPES.L_0=S(M(3,3),[[0,0],[1,0],[2,0],[2,1],[2,2]]);
SHAPES.L_90=S(M(3,3),[[0,0],[0,1],[0,2],[1,0],[2,0]]);
SHAPES.L_180=S(M(3,3),[[0,0],[0,1],[0,2],[1,2],[2,2]]);
SHAPES.L_270=S(M(3,3),[[0,2],[1,2],[2,0],[2,1],[2,2]]);
SHAPES.rl_0=S(M(2,2),[[0,1],[1,0],[1,1]]);
SHAPES.rl_90=S(M(2,2),[[0,0],[0,1],[1,1]]);
SHAPES.rl_180=S(M(2,2),[[0,0],[0,1],[1,0]]);
SHAPES.rl_270=S(M(2,2),[[0,0],[1,0],[1,1]]);
SHAPES.t_0=S(M(2,3),[[0,0],[0,1],[0,2],[1,1]]);
SHAPES.t_90=S(M(3,2),[[0,1],[1,0],[1,1],[2,1]]);
SHAPES.t_180=S(M(2,3),[[0,1],[1,0],[1,1],[1,2]]);
SHAPES.t_270=S(M(3,2),[[0,0],[1,0],[1,1],[2,0]]);
SHAPES.z_h=S(M(2,3),[[0,0],[0,1],[1,1],[1,2]]);
SHAPES.z_v=S(M(3,2),[[0,1],[1,0],[1,1],[2,0]]);
SHAPES.s_h=S(M(2,3),[[0,1],[0,2],[1,0],[1,1]]);
SHAPES.s_v=S(M(3,2),[[0,0],[1,0],[1,1],[2,1]]);
SHAPES.pent_plus=S(M(3,3),[[0,1],[1,0],[1,1],[1,2],[2,1]]);

function getDims(m){return {rows:m.length,cols:m[0]?m[0].length:0};}
function getFilled(m){var c=[];for(var r=0;r<m.length;r++)for(var cc=0;cc<m[r].length;cc++)if(m[r][cc]===1)c.push([r,cc]);return c;}

// ═══════════════════════════════════════════════════════════════
// DYNAMIC DIFFICULTY — Weighted shape pools by mode + score
// ═══════════════════════════════════════════════════════════════
// Each entry: [shapeId, weight]. Higher weight = more likely.
// Score thresholds shift the pool composition.

function getShapePool(mode, score){
  var s = score || 0;

  if(mode === MODES.EASY){
    // Easy: overwhelmingly small/complex shapes. Big shapes near 0%.
    if(s < 200){
      return [
        ['1x1',30],['1x2',15],['2x1',15],['2x2',20],
        ['l_0',5],['l_90',5],['l_180',5],['l_270',5],
      ];
    }
    if(s < 500){
      return [
        ['1x1',25],['1x2',14],['2x1',14],['2x2',18],
        ['l_0',5],['l_90',5],['l_180',5],['l_270',5],
        ['1x3',4],['3x1',4],['rl_0',3],['rl_90',3],
      ];
    }
    // 500+: tiny chance of larger shapes
    return [
      ['1x1',20],['1x2',12],['2x1',12],['2x2',15],
      ['l_0',5],['l_90',5],['l_180',5],['l_270',5],
      ['1x3',5],['3x1',5],['rl_0',3],['rl_90',3],['rl_180',2],['rl_270',2],
      ['1x4',2],['4x1',2],['t_0',1],['t_90',1],
    ];
  }

  if(mode === MODES.MEDIUM){
    // Medium: gradual introduction of larger shapes
    if(s < 300){
      return [
        ['1x1',15],['1x2',12],['2x1',12],['2x2',15],
        ['l_0',6],['l_90',6],['l_180',6],['l_270',6],
        ['1x3',5],['3x1',5],['rl_0',3],['rl_90',3],['rl_180',3],['rl_270',3],
      ];
    }
    if(s < 600){
      return [
        ['1x1',10],['1x2',10],['2x1',10],['2x2',10],
        ['l_0',5],['l_90',5],['l_180',5],['l_270',5],
        ['1x3',6],['3x1',6],['1x4',4],['4x1',4],
        ['t_0',3],['t_90',3],['t_180',2],['t_270',2],
        ['rl_0',2],['rl_90',2],
      ];
    }
    if(s < 1000){
      return [
        ['1x1',5],['1x2',8],['2x1',8],['2x2',8],
        ['l_0',4],['l_90',4],['l_180',4],['l_270',4],
        ['1x3',6],['3x1',6],['1x4',5],['4x1',5],['1x5',3],['5x1',3],
        ['t_0',3],['t_90',3],['t_180',2],['t_270',2],
        ['z_h',3],['z_v',3],['s_h',2],['s_v',2],
        ['L_0',2],['L_90',2],
      ];
    }
    // 1000+: all shapes, larger ones more frequent
    return [
      ['1x1',3],['1x2',6],['2x1',6],['2x2',6],
      ['l_0',3],['l_90',3],['l_180',3],['l_270',3],
      ['1x3',5],['3x1',5],['1x4',5],['4x1',5],['1x5',4],['5x1',4],
      ['t_0',3],['t_90',3],['t_180',3],['t_270',3],
      ['z_h',3],['z_v',3],['s_h',3],['s_v',3],
      ['L_0',3],['L_90',3],['L_180',2],['L_270',2],
      ['3x3',3],['plus',2],
    ];
  }

  if(mode === MODES.HARD){
    // Hard: big shapes from the start, gets worse
    if(s < 200){
      return [
        ['1x1',5],['1x2',6],['2x1',6],['2x2',6],
        ['1x3',6],['3x1',6],['1x4',5],['4x1',5],['1x5',4],['5x1',4],
        ['l_0',4],['l_90',4],['l_180',4],['l_270',4],
        ['L_0',3],['L_90',3],['L_180',2],['L_270',2],
        ['t_0',2],['t_90',2],['t_180',2],['t_270',2],
        ['z_h',2],['z_v',2],['s_h',2],['s_v',2],
        ['3x3',3],['plus',2],
      ];
    }
    if(s < 500){
      return [
        ['1x1',2],['1x2',4],['2x1',4],['2x2',4],
        ['1x3',5],['3x1',5],['1x4',6],['4x1',6],['1x5',5],['5x1',5],
        ['l_0',3],['l_90',3],['l_180',3],['l_270',3],
        ['L_0',4],['L_90',4],['L_180',3],['L_270',3],
        ['t_0',3],['t_90',3],['t_180',2],['t_270',2],
        ['z_h',3],['z_v',3],['s_h',3],['s_v',3],
        ['3x3',5],['plus',3],
      ];
    }
    // 500+: maximum pain
    return [
      ['1x1',1],['1x2',2],['2x1',2],['2x2',3],
      ['1x3',4],['3x1',4],['1x4',6],['4x1',6],['1x5',7],['5x1',7],
      ['l_0',2],['l_90',2],['l_180',2],['l_270',2],
      ['L_0',4],['L_90',4],['L_180',4],['L_270',4],
      ['t_0',3],['t_90',3],['t_180',3],['t_270',3],
      ['z_h',3],['z_v',3],['s_h',3],['s_v',3],
      ['3x3',6],['plus',4],
    ];
  }

  // Fallback to easy
  return [['1x1',50],['2x2',30],['1x2',20]];
}

// Weighted random selection from a pool
function pickWeighted(pool){
  var total = 0;
  for(var i = 0; i < pool.length; i++) total += pool[i][1];
  var r = Math.random() * total;
  for(var i = 0; i < pool.length; i++){
    r -= pool[i][1];
    if(r <= 0) return pool[i][0];
  }
  return pool[pool.length - 1][0];
}

// ═══════════════════════════════════════════════════════════════
// GAME STATE
// ═══════════════════════════════════════════════════════════════
function emptyGrid(){return Array.from({length:GRID},function(){return Array(GRID).fill(0);});}
var G = {
  grid: emptyGrid(),
  currentScore: 0,
  activeMode: null,
  trayPieces: [],
  isGameOver: false,
  combo: 1,
  totalLines: 0,
};

// ═══════════════════════════════════════════════════════════════
// COLLISION & PLACEMENT
// ═══════════════════════════════════════════════════════════════
function isValid(gr,gc,sm,b){
  var board=b||G.grid;
  return getFilled(sm).every(function(rc){
    var br=gr+rc[0],bc=gc+rc[1];
    if(br<0||br>=GRID||bc<0||bc>=GRID)return false;
    return board[br][bc]===0;
  });
}

function placeBlock(gr,gc,sm,color,ti){
  if(!isValid(gr,gc,sm))throw new Error('Invalid placement');
  getFilled(sm).forEach(function(rc){G.grid[gr+rc[0]][gc+rc[1]]=color;});
  if(ti!=null)G.trayPieces[ti]=null;
  var cr=clearLines();
  var pts=calcScore(cr);
  G.currentScore+=pts;
  G.combo=cr.combo;
  // Refill tray if all three slots are now empty
  if(G.trayPieces.every(function(p){return p===null;})) refillTray();
  // Run the automated game-over verification loop AFTER refill
  var endState = checkEnd();
  return {lines:cr.total,combo:cr.combo,scoreGained:pts,rows:cr.rows,cols:cr.cols,endState:endState};
}

// ═══════════════════════════════════════════════════════════════
// LINE CLEANSING
// ═══════════════════════════════════════════════════════════════
function clearLines(){
  var g=G.grid,rows=[],cols=[],total=0;
  for(var r=0;r<GRID;r++){var f=true;for(var c=0;c<GRID;c++){if(g[r][c]===0){f=false;break;}}if(f)rows.push(r);}
  for(var c=0;c<GRID;c++){var f=true;for(var r=0;r<GRID;r++){if(g[r][c]===0){f=false;break;}}if(f)cols.push(c);}
  total=rows.length+cols.length;
  rows.forEach(function(r){for(var c=0;c<GRID;c++)if(g[r][c]!=='dead')g[r][c]=0;});
  cols.forEach(function(c){for(var r=0;r<GRID;r++)if(g[r][c]!=='dead')g[r][c]=0;});
  G.totalLines+=total;
  return {rows:rows,cols:cols,total:total,combo:total<=1?1:total===2?2:3};
}

function calcScore(cr){
  if(cr.total===0)return 0;
  return Math.floor(100*cr.total*cr.combo);
}

// ═══════════════════════════════════════════════════════════════
// MOVE VALIDATION — canShapeFit + global game-over check
// ═══════════════════════════════════════════════════════════════

/**
 * canShapeFit: brute-force scans every (row,col) on the 6×6 board
 * to determine if shapeMatrix can be placed without overlapping
 * filled cells or exceeding boundaries.
 * Returns true on the first valid anchor found.
 */
function canShapeFit(boardMatrix, shapeMatrix){
  var filled = getFilled(shapeMatrix);
  var dims = getDims(shapeMatrix);
  // Pre-compute the max anchor row/col so we never exceed GRID bounds
  var maxR = GRID - dims.rows;
  var maxC = GRID - dims.cols;
  for(var r = 0; r <= maxR; r++){
    for(var c = 0; c <= maxC; c++){
      var fits = true;
      for(var f = 0; f < filled.length; f++){
        var br = r + filled[f][0];
        var bc = c + filled[f][1];
        if(boardMatrix[br][bc] !== 0){ fits = false; break; }
      }
      if(fits) return true;
    }
  }
  return false;
}

/**
 * hasAnyMove: iterates the three tray slots; for each non-null piece
 * calls canShapeFit against the current grid. Returns true if at least
 * one tray shape can still be placed somewhere.
 */
function hasAnyMove(){
  for(var i = 0; i < G.trayPieces.length; i++){
    var p = G.trayPieces[i];
    if(p === null) continue;
    if(canShapeFit(G.grid, p.shapeMatrix)) return true;
  }
  return false;
}

/**
 * checkEnd: the authoritative game-over gate.
 * Sets G.isGameOver and returns the result object.
 */
function checkEnd(){
  if(!hasAnyMove()){ G.isGameOver = true; return {state:'gameover'}; }
  return {state:'playing'};
}

// ═══════════════════════════════════════════════════════════════
// TRAY MANAGEMENT — Dynamic difficulty-aware
// ═══════════════════════════════════════════════════════════════
var BC=['#ff6b35','#e040fb','#7c4dff','#ff5252','#69f0ae','#82b1ff','#ffd740','#ffab40','#ff4081','#00e5ff','#76ff03','#b388ff'];

function mkPiece(shapeId){
  var res=resolveId(shapeId),m=SHAPES[res];
  if(!m){console.warn('Unknown shape',shapeId,'->',res);return mkPiece('dot');}
  return {id:res,shapeMatrix:m.map(function(r){return r.slice();}),color:BC[Math.floor(Math.random()*BC.length)]};
}

function genTrayForMode(mode, score){
  var pool = getShapePool(mode, score || 0);
  return Array.from({length:3},function(){return mkPiece(pickWeighted(pool));});
}

function refillTray(){
  G.trayPieces = genTrayForMode(G.activeMode, G.currentScore);
}

// ═══════════════════════════════════════════════════════════════
// MODE INIT
// ═══════════════════════════════════════════════════════════════
function initMode(mode){
  G.grid = emptyGrid();
  G.currentScore = 0;
  G.activeMode = mode;
  G.isGameOver = false;
  G.combo = 1;
  G.totalLines = 0;
  G.trayPieces = genTrayForMode(mode, 0);
}

// ═══════════════════════════════════════════════════════════════
// HIGH SCORE HELPERS
// ═══════════════════════════════════════════════════════════════
function getModeHighKey(mode){ return 'bp_mode_' + mode + '_high'; }
function getModeHigh(mode){ return parseInt(localStorage.getItem(getModeHighKey(mode))||'0',10)||0; }
function setModeHigh(mode,score){
  var key = getModeHighKey(mode);
  var cur = parseInt(localStorage.getItem(key)||'0',10)||0;
  if(score > cur){ localStorage.setItem(key,score.toString()); return true; }
  return false;
}

// ═══════════════════════════════════════════════════════════════
// DRAG CONTROLLER v5 — Cached geometry + rAF-decoupled ghost
// ═══════════════════════════════════════════════════════════════
function DragController(opts){
  this._onCommit=opts.onCommit||function(){};
  this._onCancel=opts.onCancel||function(){};
  this._onProj=opts.onProjectionChange||function(){};
  this._isValidFn=opts.isValidFn||function(){return false;};
  this._getFilled=opts.getFilledCells||function(){return[];};
  this._active=false;this._pid=null;this._ti=null;
  this._piece=null;this._gridEl=null;this._slot=null;
  this._ghost=null;
  this._gridRect=null;this._cellSize=0;
  this._lastAnchor={r:-1,c:-1,valid:false};
  this._rafId=null;
  this._curX=0;this._curY=0;
  this._move=this._move.bind(this);
  this._up=this._up.bind(this);
  this._cancel=this._cancel.bind(this);
  this._rafLoop=this._rafLoop.bind(this);
}

DragController.prototype.start=function(e,ti,piece,gridEl,slot){
  if(this._active||!piece)return;
  this._active=true;this._pid=e.pointerId;this._ti=ti;
  this._piece=piece;this._gridEl=gridEl;this._slot=slot;
  if(slot.setPointerCapture){try{slot.setPointerCapture(e.pointerId);}catch(_){}}

  // CACHE geometry once on pointerdown
  this._gridRect=gridEl.getBoundingClientRect();
  this._cellSize=this._gridRect.width/GRID;

  var dims=getDims(piece.shapeMatrix);
  var sR=dims.rows,sC=dims.cols;
  var ghostW=sC*this._cellSize,ghostH=sR*this._cellSize;

  // Build ghost at 1.0× grid cell size
  this._ghost=document.createElement('div');
  this._ghost.className='drag-ghost';
  var gs=this._ghost.style;
  gs.position='fixed';gs.width=ghostW+'px';gs.height=ghostH+'px';
  gs.display='grid';gs.gridTemplateRows='repeat('+sR+',1fr)';gs.gridTemplateColumns='repeat('+sC+',1fr)';
  gs.gap='2px';gs.zIndex='9999';gs.pointerEvents='none';
  gs.opacity='0';gs.willChange='transform';
  gs.left='0px';gs.top='0px';gs.transform='translate3d(0,0,0)';

  var filled=this._getFilled(piece.shapeMatrix);
  for(var r=0;r<sR;r++)for(var c=0;c<sC;c++){
    var isF=filled.some(function(fc){return fc[0]===r&&fc[1]===c;});
    var block=document.createElement('div');
    if(isF){
      block.style.background='linear-gradient(135deg,'+piece.color+','+piece.color+'dd)';
      block.style.borderRadius='4px';
      block.style.boxShadow='inset 0 2px 3px rgba(255,255,255,0.4),inset 0 -1px 2px rgba(0,0,0,0.2),0 0 10px '+piece.color+'77';
    }
    this._ghost.appendChild(block);
  }
  document.body.appendChild(this._ghost);

  // Initial position — scale up from 0.55 to 1.0
  var self=this;
  var sx=e.clientX - ghostW/2;
  var sy=e.clientY - ghostH/2;
  requestAnimationFrame(function(){
    if(self._ghost){
      self._ghost.style.opacity='0.95';
      self._ghost.style.transform='translate3d('+sx+'px,'+sy+'px,0) scale(1.0)';
    }
  });

  // Start rAF loop
  this._rafId=requestAnimationFrame(this._rafLoop);

  document.addEventListener('pointermove',this._move);
  document.addEventListener('pointerup',this._up);
  document.addEventListener('pointercancel',this._cancel);
};

DragController.prototype._rafLoop=function(){
  if(!this._active)return;
  if(this._ghost){
    this._ghost.style.transform='translate3d('+this._curX+'px,'+this._curY+'px,0) scale(1.0)';
  }
  this._rafId=requestAnimationFrame(this._rafLoop);
};

DragController.prototype._move=function(e){
  if(!this._active||e.pointerId!==this._pid)return;
  e.preventDefault();
  this._curX=e.clientX;this._curY=e.clientY;

  // Anchor from CACHED rect (no getBoundingClientRect!)
  var relX=e.clientX-this._gridRect.left;
  var relY=e.clientY-this._gridRect.top;
  var aC=Math.floor(relX/this._cellSize);
  var aR=Math.floor(relY/this._cellSize);
  var valid=this._isValidFn(aR,aC,this._piece.shapeMatrix);
  var filled=this._getFilled(this._piece.shapeMatrix);

  if(this._ghost){
    this._ghost.style.filter=valid
      ?'drop-shadow(0 8px 20px rgba(0,0,0,0.6)) drop-shadow(0 0 12px rgba(105,240,174,0.45))'
      :'drop-shadow(0 8px 20px rgba(0,0,0,0.6)) drop-shadow(0 0 12px rgba(255,82,82,0.45))';
  }

  if(aR!==this._lastAnchor.r||aC!==this._lastAnchor.c||valid!==this._lastAnchor.valid){
    this._lastAnchor={r:aR,c:aC,valid:valid};
    this._onProj(aR,aC,valid,filled);
  }
};

DragController.prototype._up=function(e){
  if(!this._active||e.pointerId!==this._pid)return;
  this._finish(e.clientX,e.clientY,false);
};
DragController.prototype._cancel=function(e){
  if(!this._active||e.pointerId!==this._pid)return;
  this._finish(e.clientX,e.clientY,true);
};

DragController.prototype._finish=function(cx,cy,cancelled){
  if(this._rafId){cancelAnimationFrame(this._rafId);this._rafId=null;}
  if(this._slot&&this._slot.releasePointerCapture&&this._pid){try{this._slot.releasePointerCapture(this._pid);}catch(_){}}
  document.removeEventListener('pointermove',this._move);
  document.removeEventListener('pointerup',this._up);
  document.removeEventListener('pointercancel',this._cancel);
  this._clearProj();
  if(cancelled||!this._piece){this._animateReturn();return;}
  var aC=Math.floor((cx-this._gridRect.left)/this._cellSize);
  var aR=Math.floor((cy-this._gridRect.top)/this._cellSize);
  var self=this;
  if(this._isValidFn(aR,aC,this._piece.shapeMatrix)){
    this._snapToGrid(aR,aC,function(){self._onCommit(self._ti,aR,aC,self._piece);self._cleanup();});
  }else{this._animateReturn();}
};

DragController.prototype._snapToGrid=function(aR,aC,cb){
  if(!this._ghost){cb();return;}
  var tx=this._gridRect.left+aC*this._cellSize;
  var ty=this._gridRect.top+aR*this._cellSize;
  this._ghost.style.transition='transform 0.15s ease, opacity 0.15s ease';
  this._ghost.style.transform='translate3d('+tx+'px,'+ty+'px,0) scale(0.9)';
  this._ghost.style.opacity='0';
  var self=this;setTimeout(function(){cb();},150);
};

DragController.prototype._animateReturn=function(){
  if(!this._ghost){this._cleanup();return;}
  var dest=this._slot.getBoundingClientRect();
  var dx=dest.left+dest.width/2,dy=dest.top+dest.height/2;
  this._ghost.style.transition='transform 0.4s cubic-bezier(.34,1.56,.64,1), opacity 0.35s ease';
  this._ghost.style.transform='translate3d('+dx+'px,'+dy+'px,0) scale(0.4)';
  this._ghost.style.opacity='0';
  this._onCancel(this._ti,this._piece);
  var self=this;setTimeout(function(){self._cleanup();},400);
};

DragController.prototype._cleanup=function(){
  if(this._rafId){cancelAnimationFrame(this._rafId);this._rafId=null;}
  if(this._ghost){this._ghost.remove();this._ghost=null;}
  this._active=false;this._pid=null;this._ti=null;this._piece=null;
  this._gridEl=null;this._slot=null;this._gridRect=null;this._cellSize=0;
  this._lastAnchor={r:-1,c:-1,valid:false};
};
DragController.prototype._clearProj=function(){this._onProj(-1,-1,false,[]);};
DragController.prototype.abort=function(){if(!this._active)return;this._clearProj();this._animateReturn();};
Object.defineProperty(DragController.prototype,'isActive',{get:function(){return this._active;}});

// ═══════════════════════════════════════════════════════════════
// ANIMATION CONTROLLER
// ═══════════════════════════════════════════════════════════════
var AnimCtrl={
  blastLines:function(rows,cols,gridEl){
    return new Promise(function(resolve){
      var cells=gridEl.children,indices=new Set();
      rows.forEach(function(r){for(var c=0;c<GRID;c++)indices.add(r*GRID+c);});
      cols.forEach(function(c){for(var r=0;r<GRID;r++)indices.add(r*GRID+c);});
      var sumR=0,sumC=0,cnt=0;
      indices.forEach(function(idx){sumR+=Math.floor(idx/GRID);sumC+=idx%GRID;cnt++;});
      var cR=sumR/cnt,cC=sumC/cnt;
      indices.forEach(function(idx){
        var r=Math.floor(idx/GRID),c=idx%GRID;
        var dist=Math.sqrt((r-cR)*(r-cR)+(c-cC)*(c-cC));
        var cell=cells[idx];
        if(cell){cell.style.animationDelay=(dist*30)+'ms';cell.classList.add('grid-cell--blast');}
      });
      setTimeout(function(){indices.forEach(function(idx){var cell=cells[idx];if(cell){cell.classList.remove('grid-cell--blast');cell.style.animationDelay='';}});resolve();},800);
    });
  },
  spawnComboPopup:function(text,container,x,y){
    var el=document.createElement('div');el.className='combo-popup';el.textContent=text;
    el.style.cssText='position:absolute;left:'+x+'px;top:'+y+'px;transform:translate(-50%,0);pointer-events:none;z-index:3000;';
    container.appendChild(el);setTimeout(function(){el.remove();},1200);
  },
  animateScore:function(from,to,duration,onTick){
    var start=performance.now(),diff=to-from;
    function tick(now){
      var el=now-start,prog=Math.min(el/duration,1);
      var eased=1-Math.pow(1-prog,3);
      onTick(Math.round(from+diff*eased));
      if(prog<1)requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  },
};

// ═══════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════
var BlockPuzzle={
  G:G, GRID:GRID, MODES:MODES,
  initMode:initMode,
  isValid:isValid, placeBlock:placeBlock,
  clearLines:clearLines, calcScore:calcScore,
  canShapeFit:canShapeFit, hasAnyMove:hasAnyMove, checkEnd:checkEnd,
  genTrayForMode:genTrayForMode, mkPiece:mkPiece,
  getDims:getDims, getFilled:getFilled,
  getModeHigh:getModeHigh, setModeHigh:setModeHigh,
  DragController:DragController, AnimCtrl:AnimCtrl,
};
if(typeof window!=='undefined')window.BlockPuzzle=BlockPuzzle;

}catch(e){
  console.error('[BP] Engine init error:',e);
}
})();
