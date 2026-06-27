/**
 * BLOCK PUZZLE — Game Engine v6 (Performance Optimized)
 * Key fixes vs v5:
 * - Grid render: dirty-cell diffing, zero DOM writes on unchanged cells
 * - Tray render: one-time build, color/opacity patch only
 * - Ghost filter: CSS class toggle instead of style write per move
 * - Projection: batched class ops, no Set rebuild when anchor unchanged
 * - blastLines: CSS animation only, no setTimeout chain
 * - Removed transition on .grid-cell (main paint killer)
 */
(function(){
'use strict';
try {

var GRID = 6;
var GRID_TOTAL = GRID * GRID;
var MODES = { EASY: 'easy', MEDIUM: 'medium', HARD: 'hard' };

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

// ── Shape pools (unchanged logic) ──
function getShapePool(mode, score){
  var s = score || 0;
  if(mode === MODES.EASY){
    if(s < 200) return [['1x1',30],['1x2',15],['2x1',15],['2x2',20],['l_0',5],['l_90',5],['l_180',5],['l_270',5]];
    if(s < 500) return [['1x1',25],['1x2',14],['2x1',14],['2x2',18],['l_0',5],['l_90',5],['l_180',5],['l_270',5],['1x3',4],['3x1',4],['rl_0',3],['rl_90',3]];
    return [['1x1',20],['1x2',12],['2x1',12],['2x2',15],['l_0',5],['l_90',5],['l_180',5],['l_270',5],['1x3',5],['3x1',5],['rl_0',3],['rl_90',3],['rl_180',2],['rl_270',2],['1x4',2],['4x1',2],['t_0',1],['t_90',1]];
  }
  if(mode === MODES.MEDIUM){
    if(s < 300) return [['1x1',15],['1x2',12],['2x1',12],['2x2',15],['l_0',6],['l_90',6],['l_180',6],['l_270',6],['1x3',5],['3x1',5],['rl_0',3],['rl_90',3],['rl_180',3],['rl_270',3]];
    if(s < 600) return [['1x1',10],['1x2',10],['2x1',10],['2x2',10],['l_0',5],['l_90',5],['l_180',5],['l_270',5],['1x3',6],['3x1',6],['1x4',4],['4x1',4],['t_0',3],['t_90',3],['t_180',2],['t_270',2],['rl_0',2],['rl_90',2]];
    if(s < 1000) return [['1x1',5],['1x2',8],['2x1',8],['2x2',8],['l_0',4],['l_90',4],['l_180',4],['l_270',4],['1x3',6],['3x1',6],['1x4',5],['4x1',5],['1x5',3],['5x1',3],['t_0',3],['t_90',3],['t_180',2],['t_270',2],['z_h',3],['z_v',3],['s_h',2],['s_v',2],['L_0',2],['L_90',2]];
    return [['1x1',3],['1x2',6],['2x1',6],['2x2',6],['l_0',3],['l_90',3],['l_180',3],['l_270',3],['1x3',5],['3x1',5],['1x4',5],['4x1',5],['1x5',4],['5x1',4],['t_0',3],['t_90',3],['t_180',3],['t_270',3],['z_h',3],['z_v',3],['s_h',3],['s_v',3],['L_0',3],['L_90',3],['L_180',2],['L_270',2],['3x3',3],['plus',2]];
  }
  if(mode === MODES.HARD){
    if(s < 200) return [['1x1',5],['1x2',6],['2x1',6],['2x2',6],['1x3',6],['3x1',6],['1x4',5],['4x1',5],['1x5',4],['5x1',4],['l_0',4],['l_90',4],['l_180',4],['l_270',4],['L_0',3],['L_90',3],['L_180',2],['L_270',2],['t_0',2],['t_90',2],['t_180',2],['t_270',2],['z_h',2],['z_v',2],['s_h',2],['s_v',2],['3x3',3],['plus',2]];
    if(s < 500) return [['1x1',2],['1x2',4],['2x1',4],['2x2',4],['1x3',5],['3x1',5],['1x4',6],['4x1',6],['1x5',5],['5x1',5],['l_0',3],['l_90',3],['l_180',3],['l_270',3],['L_0',4],['L_90',4],['L_180',3],['L_270',3],['t_0',3],['t_90',3],['t_180',2],['t_270',2],['z_h',3],['z_v',3],['s_h',3],['s_v',3],['3x3',5],['plus',3]];
    return [['1x1',1],['1x2',2],['2x1',2],['2x2',3],['1x3',4],['3x1',4],['1x4',6],['4x1',6],['1x5',7],['5x1',7],['l_0',2],['l_90',2],['l_180',2],['l_270',2],['L_0',4],['L_90',4],['L_180',4],['L_270',4],['t_0',3],['t_90',3],['t_180',3],['t_270',3],['z_h',3],['z_v',3],['s_h',3],['s_v',3],['3x3',6],['plus',4]];
  }
  return [['1x1',50],['2x2',30],['1x2',20]];
}

function pickWeighted(pool){
  var total=0;for(var i=0;i<pool.length;i++)total+=pool[i][1];
  var r=Math.random()*total;
  for(var i=0;i<pool.length;i++){r-=pool[i][1];if(r<=0)return pool[i][0];}
  return pool[pool.length-1][0];
}

// ── Game State ──
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

// ── Collision & Placement ──
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
  if(G.trayPieces.every(function(p){return p===null;})) refillTray();
  var endState=checkEnd();
  return {lines:cr.total,combo:cr.combo,scoreGained:pts,rows:cr.rows,cols:cr.cols,endState:endState};
}

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

function canShapeFit(boardMatrix,shapeMatrix){
  var filled=getFilled(shapeMatrix);
  var dims=getDims(shapeMatrix);
  var maxR=GRID-dims.rows,maxC=GRID-dims.cols;
  for(var r=0;r<=maxR;r++){
    for(var c=0;c<=maxC;c++){
      var fits=true;
      for(var f=0;f<filled.length;f++){
        var br=r+filled[f][0],bc=c+filled[f][1];
        if(boardMatrix[br][bc]!==0){fits=false;break;}
      }
      if(fits)return true;
    }
  }
  return false;
}

function hasAnyMove(){
  for(var i=0;i<G.trayPieces.length;i++){
    var p=G.trayPieces[i];
    if(p===null)continue;
    if(canShapeFit(G.grid,p.shapeMatrix))return true;
  }
  return false;
}

function checkEnd(){
  if(!hasAnyMove()){G.isGameOver=true;return {state:'gameover'};}
  return {state:'playing'};
}

var BC=['#ff6b35','#e040fb','#7c4dff','#ff5252','#69f0ae','#82b1ff','#ffd740','#ffab40','#ff4081','#00e5ff','#76ff03','#b388ff'];

function mkPiece(shapeId){
  var res=resolveId(shapeId),m=SHAPES[res];
  if(!m){console.warn('Unknown shape',shapeId,'->',res);return mkPiece('dot');}
  return {id:res,shapeMatrix:m.map(function(r){return r.slice();}),color:BC[Math.floor(Math.random()*BC.length)]};
}

function genTrayForMode(mode,score){
  var pool=getShapePool(mode,score||0);
  return Array.from({length:3},function(){return mkPiece(pickWeighted(pool));});
}

function refillTray(){G.trayPieces=genTrayForMode(G.activeMode,G.currentScore);}

function initMode(mode){
  G.grid=emptyGrid();
  G.currentScore=0;
  G.activeMode=mode;
  G.isGameOver=false;
  G.combo=1;
  G.totalLines=0;
  G.trayPieces=genTrayForMode(mode,0);
}

function getModeHighKey(mode){return 'bp_mode_'+mode+'_high';}
function getModeHigh(mode){return parseInt(localStorage.getItem(getModeHighKey(mode))||'0',10)||0;}
function setModeHigh(mode,score){
  var key=getModeHighKey(mode);
  var cur=parseInt(localStorage.getItem(key)||'0',10)||0;
  if(score>cur){localStorage.setItem(key,score.toString());return true;}
  return false;
}

// ═══════════════════════════════════════════════════════════════
// DRAG CONTROLLER v6 — Ghost position only in rAF, no per-move style writes
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
  this._needsRender=false;
  this._ghostValid=null; // track valid state to avoid redundant class ops
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

  this._gridRect=gridEl.getBoundingClientRect();
  this._cellSize=this._gridRect.width/GRID;

  var dims=getDims(piece.shapeMatrix);
  var sR=dims.rows,sC=dims.cols;
  // Cache dims so _move never calls getDims() on every pointermove
  this._dims={rows:sR,cols:sC};
  var cs=this._cellSize;
  var ghostW=sC*cs,ghostH=sR*cs;

  this._ghost=document.createElement('div');
  this._ghost.className='drag-ghost';
  var gs=this._ghost.style;
  gs.width=ghostW+'px';gs.height=ghostH+'px';
  gs.display='grid';
  gs.gridTemplateRows='repeat('+sR+',1fr)';
  gs.gridTemplateColumns='repeat('+sC+',1fr)';
  gs.gap='2px';gs.opacity='0';

  var filledArr=this._getFilled(piece.shapeMatrix);
  // FIX: O(1) lookup set instead of Array.some() per cell (was O(n²))
  var filledSet=Object.create(null);
  for(var fi=0;fi<filledArr.length;fi++) filledSet[filledArr[fi][0]+','+filledArr[fi][1]]=1;
  // FIX: pre-build style string once, not per cell
  var filledCss='background:linear-gradient(135deg,'+piece.color+','+piece.color+'dd);border-radius:4px;box-shadow:inset 0 2px 3px rgba(255,255,255,.4);';
  var frag=document.createDocumentFragment();
  for(var r=0;r<sR;r++)for(var c=0;c<sC;c++){
    var block=document.createElement('div');
    if(filledSet[r+','+c]) block.style.cssText=filledCss;
    frag.appendChild(block);
  }
  this._ghost.appendChild(frag);
  document.body.appendChild(this._ghost);

  this._curX=e.clientX-ghostW/2;
  // Offset ghost ABOVE finger so piece visible during drag (not under thumb)
  // 80px above center = comfortable on mobile
  this._curY=e.clientY-ghostH-80;
  this._needsRender=true;
  this._ghostValid=null;

  var self=this;
  requestAnimationFrame(function(){
    if(self._ghost){self._ghost.style.opacity='0.95';}
  });

  this._rafId=requestAnimationFrame(this._rafLoop);
  document.addEventListener('pointermove',this._move,{passive:false});
  document.addEventListener('pointerup',this._up);
  document.addEventListener('pointercancel',this._cancel);
};

DragController.prototype._rafLoop=function(){
  if(!this._active)return;
  if(this._needsRender && this._ghost){
    this._ghost.style.transform='translate3d('+this._curX+'px,'+this._curY+'px,0)';
    this._needsRender=false;
  }
  this._rafId=requestAnimationFrame(this._rafLoop);
};

DragController.prototype._move=function(e){
  if(!this._active||e.pointerId!==this._pid)return;
  e.preventDefault();

  var dims=this._dims; // use cached — no getDims() per move
  var ghostW=dims.cols*this._cellSize;
  var ghostH=dims.rows*this._cellSize;
  this._curX=e.clientX-ghostW/2;
  // Same above-finger offset as start
  this._curY=e.clientY-ghostH-80;
  this._needsRender=true;

  // Projection anchor from ghost CENTER (not raw pointer) so preview matches ghost
  var ghostCX=this._curX+ghostW/2;
  var ghostCY=this._curY+ghostH/2;
  var relX=ghostCX-this._gridRect.left;
  var relY=ghostCY-this._gridRect.top;
  var aC=Math.floor(relX/this._cellSize - dims.cols/2 + 0.5);
  var aR=Math.floor(relY/this._cellSize - dims.rows/2 + 0.5);
  var valid=this._isValidFn(aR,aC,this._piece.shapeMatrix);

  // Only update ghost class when validity changes — no per-move style writes
  if(valid!==this._ghostValid){
    this._ghostValid=valid;
    if(this._ghost){
      this._ghost.classList.toggle('drag-ghost--valid',valid);
      this._ghost.classList.toggle('drag-ghost--invalid',!valid);
    }
  }

  if(aR!==this._lastAnchor.r||aC!==this._lastAnchor.c||valid!==this._lastAnchor.valid){
    this._lastAnchor={r:aR,c:aC,valid:valid};
    this._onProj(aR,aC,valid,this._getFilled(this._piece.shapeMatrix));
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
  var dims=this._dims;
  var ghostW=dims.cols*this._cellSize;
  var ghostH=dims.rows*this._cellSize;
  var ghostCX=cx; // ghost cx = pointer x (centered horizontally)
  var ghostCY=cy-80-ghostH/2; // ghost top = cy-ghostH-80, center = +ghostH/2
  var aC=Math.floor((ghostCX-this._gridRect.left)/this._cellSize - dims.cols/2 + 0.5);
  var aR=Math.floor(((cy-80-ghostH/2)-this._gridRect.top)/this._cellSize - dims.rows/2 + 0.5);
  var self=this;
  if(this._isValidFn(aR,aC,this._piece.shapeMatrix)){
    this._snapToGrid(aR,aC,function(){self._onCommit(self._ti,aR,aC,self._piece);self._cleanup();});
  }else{this._animateReturn();}
};

DragController.prototype._snapToGrid=function(aR,aC,cb){
  if(!this._ghost){cb();return;}
  var tx=this._gridRect.left+aC*this._cellSize;
  var ty=this._gridRect.top+aR*this._cellSize;
  this._ghost.style.transition='transform 0.12s ease,opacity 0.12s ease';
  this._ghost.style.transform='translate3d('+tx+'px,'+ty+'px,0) scale(0.85)';
  this._ghost.style.opacity='0';
  var self=this;setTimeout(function(){cb();},120);
};

DragController.prototype._animateReturn=function(){
  if(!this._ghost){this._cleanup();return;}
  var dest=this._slot.getBoundingClientRect();
  var dx=dest.left+dest.width/2,dy=dest.top+dest.height/2;
  this._ghost.style.transition='transform 0.3s cubic-bezier(.34,1.56,.64,1),opacity 0.28s ease';
  this._ghost.style.transform='translate3d('+dx+'px,'+dy+'px,0) scale(0.35)';
  this._ghost.style.opacity='0';
  this._onCancel(this._ti,this._piece);
  var self=this;setTimeout(function(){self._cleanup();},300);
};

DragController.prototype._cleanup=function(){
  if(this._rafId){cancelAnimationFrame(this._rafId);this._rafId=null;}
  if(this._ghost){this._ghost.remove();this._ghost=null;}
  this._active=false;this._pid=null;this._ti=null;this._piece=null;
  this._gridEl=null;this._slot=null;this._gridRect=null;this._cellSize=0;
  this._dims=null;
  this._lastAnchor={r:-1,c:-1,valid:false};
  this._needsRender=false;this._ghostValid=null;
};
DragController.prototype._clearProj=function(){this._onProj(-1,-1,false,[]);};
DragController.prototype.abort=function(){if(!this._active)return;this._clearProj();this._animateReturn();};
Object.defineProperty(DragController.prototype,'isActive',{get:function(){return this._active;}});

// ═══════════════════════════════════════════════════════════════
// ANIMATION CONTROLLER v6 — CSS-only blast, no chained setTimeout
// ═══════════════════════════════════════════════════════════════
var AnimCtrl={
  blastLines:function(rows,cols,gridEl){
    return new Promise(function(resolve){
      var cells=gridEl.children,indices=[];
      var rowSet=new Uint8Array(GRID),colSet=new Uint8Array(GRID);
      rows.forEach(function(r){rowSet[r]=1;});
      cols.forEach(function(c){colSet[c]=1;});
      for(var r=0;r<GRID;r++)for(var c=0;c<GRID;c++){
        if(rowSet[r]||colSet[c])indices.push(r*GRID+c);
      }
      if(!indices.length){resolve();return;}

      // Compute center for delay gradient
      var sumR=0,sumC=0,cnt=indices.length;
      for(var i=0;i<cnt;i++){sumR+=Math.floor(indices[i]/GRID);sumC+=indices[i]%GRID;}
      var cR=sumR/cnt,cC=sumC/cnt;
      var maxDelay=0;

      for(var i=0;i<cnt;i++){
        var idx=indices[i];
        var r=Math.floor(idx/GRID),c=idx%GRID;
        var dist=Math.sqrt((r-cR)*(r-cR)+(c-cC)*(c-cC));
        var delay=Math.round(dist*25);
        if(delay>maxDelay)maxDelay=delay;
        var cell=cells[idx];
        if(cell){
          cell.style.animationDelay=delay+'ms';
          cell.classList.add('grid-cell--blast');
        }
      }

      // Resolve when longest animation done, cleanup in renderGrid
      setTimeout(resolve, maxDelay+380);
    });
  },
  spawnComboPopup:function(text,container,x,y){
    var el=document.createElement('div');el.className='combo-popup';el.textContent=text;
    el.style.cssText='position:absolute;left:'+x+'px;top:'+y+'px;transform:translate(-50%,0);pointer-events:none;z-index:3000;';
    container.appendChild(el);
    // Use animation end rather than setTimeout where possible
    el.addEventListener('animationend',function(){el.remove();},{once:true});
    // Fallback
    setTimeout(function(){if(el.parentNode)el.remove();},1100);
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

}catch(e){console.error('[BP] Engine init error:',e);}
})();
