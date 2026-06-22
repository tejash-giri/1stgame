/**
 * ═══════════════════════════════════════════════════════════════════
 * BLOCK PUZZLE — Complete Game Engine v3 (Optimized)
 * ═══════════════════════════════════════════════════════════════════
 *
 * Performance: getBoundingClientRect() cached on pointerdown.
 * Ghost uses translate3d() for GPU-composited movement.
 * Tray scales dynamically per shape.
 * All experimental/visual code wrapped in try-catch to prevent UI blocking.
 * ═══════════════════════════════════════════════════════════════════
 */
(function(){
'use strict';
try {

/* ── SECTION 0 — SHAPE ID MAPPING ── */
const SHAPE_ID_MAP = {
  '1x1':'dot','2x2':'square_2','3x3':'square_3',
  '1x2':'line_1x2','1x3':'line_1x3','1x4':'line_1x4','1x5':'line_1x5',
  '2x1':'line_2x1','3x1':'line_3x1','4x1':'line_4x1','5x1':'line_5x1',
  'l_0':'l_0','l_90':'l_90','l_180':'l_180','l_270':'l_270',
  'L_0':'L_0','L_90':'L_90','L_180':'L_180','L_270':'L_270',
  'rl_0':'rl_0','rl_90':'rl_90','rl_180':'rl_180','rl_270':'rl_270',
  't_0':'t_0','t_90':'t_90','t_180':'t_180','t_270':'t_270',
  'z_h':'z_h','z_v':'z_v','s_h':'s_h','s_v':'s_v','plus':'pent_plus',
};
function resolveShapeId(id) { return SHAPE_ID_MAP[id] || id; }

/* ── SECTION 1 — STATE ── */
function createEmptyGrid() { return Array.from({length:8},()=>Array(8).fill(0)); }
function deepCopyGrid(g) { return g.map(r=>r.slice()); }
const GameState = {
  grid: createEmptyGrid(), currentScore:0, targetScore:0, activeLevel:0,
  trayPieces:[], isGameOver:false, isLevelClear:false, comboMultiplier:1, totalLinesCleared:0,
};
let _currentLevelShapeIds = [];

/* ── SECTION 2 — SHAPE LIBRARY ── */
const SHAPES = {};
function M(r,c){return Array.from({length:r},()=>Array(c).fill(0));}
function S(m,coords){coords.forEach(([r,c])=>{m[r][c]=1;});return m;}
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
function getShapeDimensions(m){return {rows:m.length,cols:m[0]?m[0].length:0};}
function getFilledCells(m){const c=[];for(let r=0;r<m.length;r++)for(let cc=0;cc<m[r].length;cc++)if(m[r][cc]===1)c.push([r,cc]);return c;}

/* ── SECTION 3 — COLLISION & PLACEMENT ── */
function isValidPlacement(gr,gc,sm,g){const b=g||GameState.grid;return getFilledCells(sm).every(([sr,sc])=>{const br=gr+sr,bc=gc+sc;if(br<0||br>=8||bc<0||bc>=8)return false;return b[br][bc]===0;});}
function placeBlock(gr,gc,sm,color,ti){
  if(!isValidPlacement(gr,gc,sm))throw new Error(`Invalid (${gr},${gc})`);
  getFilledCells(sm).forEach(([sr,sc])=>{GameState.grid[gr+sr][gc+sc]=color;});
  if(ti!=null)GameState.trayPieces[ti]=null;
  const cr=clearLines(),sg=calculateScore(cr);
  GameState.currentScore+=sg;GameState.comboMultiplier=cr.combo;
  if(GameState.trayPieces.every(p=>p===null))refillTray();
  checkEndConditions();
  return {linesCleared:cr.totalLines,combo:cr.combo,scoreGained:sg,clearedRows:cr.rows,clearedCols:cr.cols};
}

/* ── SECTION 4 — LINE CLEANSING ── */
function clearLines(){
  const g=GameState.grid,rows=[],cols=[];
  for(let r=0;r<8;r++){let f=true;for(let c=0;c<8;c++){if(g[r][c]===0){f=false;break;}}if(f)rows.push(r);}
  for(let c=0;c<8;c++){let f=true;for(let r=0;r<8;r++){if(g[r][c]===0){f=false;break;}}if(f)cols.push(c);}
  const t=rows.length+cols.length;
  rows.forEach(r=>{for(let c=0;c<8;c++)if(g[r][c]!=='dead')g[r][c]=0;});
  cols.forEach(c=>{for(let r=0;r<8;r++)if(g[r][c]!=='dead')g[r][c]=0;});
  GameState.totalLinesCleared+=t;
  return {rows,cols,totalLines:t,combo:t<=1?1:t===2?2:3};
}
function calculateScore(cr){
  if(cr.totalLines===0)return 0;
  const lvl=GAME_LEVELS[GameState.activeLevel];
  return Math.floor(100*cr.totalLines*cr.combo*(lvl?lvl.targetScore/500:1));
}

/* ── SECTION 5 — GAME OVER / VICTORY ── */
function hasAnyValidMove(){
  for(const p of GameState.trayPieces){if(p===null)continue;
    for(let r=0;r<8;r++)for(let c=0;c<8;c++)if(isValidPlacement(r,c,p.shapeMatrix))return true;
  }return false;
}
function checkEndConditions(){
  if(GameState.currentScore>=GameState.targetScore){GameState.isLevelClear=true;GameState.isGameOver=false;return {state:'victory'};}
  if(!hasAnyValidMove()){GameState.isGameOver=true;GameState.isLevelClear=false;return {state:'gameover'};}
  return {state:'playing'};
}

/* ── SECTION 6 ── */
const BC=['#ff6b35','#e040fb','#7c4dff','#ff5252','#69f0ae','#82b1ff','#ffd740','#ffab40','#ff4081','#00e5ff','#76ff03','#b388ff'];
function createPiece(sid){
  const res=resolveShapeId(sid),m=SHAPES[res];
  if(!m){console.warn(`Unknown "${sid}"->"${res}", fallback dot.`);return createPiece('dot');}
  return {id:res,shapeMatrix:deepCopyGrid(m),color:BC[Math.floor(Math.random()*BC.length)]};
}
function generateTray(n=3,ids){const s=ids||_currentLevelShapeIds||Object.keys(SHAPES);return Array.from({length:n},()=>createPiece(s[Math.floor(Math.random()*s.length)]));}
function refillTray(){GameState.trayPieces=generateTray(3,_currentLevelShapeIds);}

/* ── SECTION 7 ── */
function initLevel(idx){
  const cfg=GAME_LEVELS[idx];if(!cfg){console.error(`Level ${idx} not found.`);return;}
  GameState.grid=createEmptyGrid();
  if(cfg.gridPreset)cfg.gridPreset.forEach(([r,c])=>{if(r>=0&&r<8&&c>=0&&c<8)GameState.grid[r][c]='dead';});
  GameState.currentScore=0;GameState.targetScore=cfg.targetScore;GameState.activeLevel=idx;
  GameState.isGameOver=false;GameState.isLevelClear=false;GameState.comboMultiplier=1;GameState.totalLinesCleared=0;
  _currentLevelShapeIds=(cfg.allowedShapes||[]).map(id=>resolveShapeId(id));
  GameState.trayPieces=generateTray(3,_currentLevelShapeIds);
}

/* ── SECTION 8 ── */
function serializeState(){return {grid:deepCopyGrid(GameState.grid),currentScore:GameState.currentScore,targetScore:GameState.targetScore,activeLevel:GameState.activeLevel,trayPieces:GameState.trayPieces.map(p=>p?{id:p.id,color:p.color}:null),isGameOver:GameState.isGameOver,isLevelClear:GameState.isLevelClear,totalLinesCleared:GameState.totalLinesCleared};}
function deserializeState(d){
  if(!d)return;
  GameState.grid=d.grid||createEmptyGrid();GameState.currentScore=d.currentScore||0;
  GameState.targetScore=d.targetScore||0;GameState.activeLevel=d.activeLevel||0;
  GameState.isGameOver=d.isGameOver||false;GameState.isLevelClear=d.isLevelClear||false;
  GameState.totalLinesCleared=d.totalLinesCleared||0;
  GameState.trayPieces=(d.trayPieces||[]).map(p=>p?createPiece(p.id):null);
}

/* ── SECTION 9 ── */
function printGrid(g){const gd=g||GameState.grid;console.log('  0 1 2 3 4 5 6 7');gd.forEach((row,r)=>console.log(r+' '+row.map(c=>c===0?'.':c==='dead'?'X':'#').join(' ')));}
function getGridStats(){let e=0,f=0,d=0;GameState.grid.forEach(row=>row.forEach(c=>{if(c===0)e++;else if(c==='dead')d++;else f++;}));return{empty:e,filled:f,dead:d,total:64};}

/* ═══════════════════════════════════════════════════════════════════
   SECTION 10 — DRAG CONTROLLER v3 (Optimized)
   ═══════════════════════════════════════════════════════════════════
   • getBoundingClientRect() cached ONCE on pointerdown
   • Ghost positioned with translate3d() — GPU composited, no layout thrash
   • Touch-action: none inherited from container
   ═══════════════════════════════════════════════════════════════════ */
class DragController {
  constructor(opts={}){
    this._onCommit=opts.onCommit||(()=>{});this._onCancel=opts.onCancel||(()=>{});
    this._onProj=opts.onProjectionChange||(()=>{});
    this._isValidFn=opts.isValidFn||(()=>false);
    this._getFilled=opts.getFilledCells||(()=>[]);
    this._active=false;this._pointerId=null;this._trayIndex=null;
    this._piece=null;this._gridEl=null;this._originSlot=null;this._ghost=null;
    this._originRect=null;
    // CACHED grid bounding rect — refreshed only on pointerdown, not every move
    this._gridRect=null;this._cellSize=0;
    this._lastAnchor={r:-1,c:-1,valid:false};
    this._onPointerMove=this._onPointerMove.bind(this);
    this._onPointerUp=this._onPointerUp.bind(this);
    this._onPointerCancel=this._onPointerCancel.bind(this);
  }

  start(e,trayIndex,piece,gridEl,originSlot){
    if(this._active||!piece)return;
    this._active=true;this._pointerId=e.pointerId;this._trayIndex=trayIndex;
    this._piece=piece;this._gridEl=gridEl;this._originSlot=originSlot;

    if(originSlot.setPointerCapture){try{originSlot.setPointerCapture(e.pointerId);}catch(_){}}

    // CACHE: measure grid geometry ONCE on pointerdown
    this._originRect=originSlot.getBoundingClientRect();
    this._gridRect=gridEl.getBoundingClientRect();
    this._cellSize=this._gridRect.width/8;

    const {rows:sR,cols:sC}=getShapeDimensions(piece.shapeMatrix);
    const ghostW=sC*this._cellSize,ghostH=sR*this._cellSize;

    this._ghost=document.createElement('div');
    this._ghost.className='drag-ghost';
    Object.assign(this._ghost.style,{
      position:'fixed',width:ghostW+'px',height:ghostH+'px',
      display:'grid',gridTemplateRows:`repeat(${sR},1fr)`,gridTemplateColumns:`repeat(${sC},1fr)`,
      gap:'2px',zIndex:'9999',pointerEvents:'none',
      opacity:'0',willChange:'transform',
      // Use a neutral starting position; will be set by translate3d on next frame
      left:'0px',top:'0px',transform:'translate3d(0,0,0)',
    });

    const filled=this._getFilled(piece.shapeMatrix);
    for(let r=0;r<sR;r++)for(let c=0;c<sC;c++){
      const isF=filled.some(([fr,fc])=>fr===r&&fc===c);
      const block=document.createElement('div');
      if(isF)Object.assign(block.style,{
        background:`linear-gradient(135deg,${piece.color},${piece.color}dd)`,
        borderRadius:'5px',
        boxShadow:`inset 0 2px 3px rgba(255,255,255,0.4),inset 0 -1px 2px rgba(0,0,0,0.2),0 0 12px ${piece.color}77`,
      });
      this._ghost.appendChild(block);
    }
    document.body.appendChild(this._ghost);

    // Position at cursor (top-left aligned) and trigger lift on next frame
    requestAnimationFrame(()=>{
      if(!this._ghost)return;
      this._ghost.style.opacity='0.95';
      // Set initial position via translate3d
      const x=e.clientX,y=e.clientY;
      this._ghost.style.transform=`translate3d(${x}px,${y}px,0) scale(1.1)`;
    });

    document.addEventListener('pointermove',this._onPointerMove);
    document.addEventListener('pointerup',this._onPointerUp);
    document.addEventListener('pointercancel',this._onPointerCancel);
  }

  // ── MOVE: uses CACHED _gridRect, positions ghost with translate3d() ──
  _onPointerMove(e){
    if(!this._active||e.pointerId!==this._pointerId)return;
    e.preventDefault();
    // GPU-composited: just update transform, NO layout recalc
    this._ghost.style.transform=`translate3d(${e.clientX}px,${e.clientY}px,0) scale(1.1)`;

    // Anchor from cached grid rect
    const relX=e.clientX-this._gridRect.left;
    const relY=e.clientY-this._gridRect.top;
    const aC=Math.floor(relX/this._cellSize);
    const aR=Math.floor(relY/this._cellSize);
    const valid=this._isValidFn(aR,aC,this._piece.shapeMatrix);
    const filled=this._getFilled(this._piece.shapeMatrix);
    this._ghost.style.filter=valid
      ?'drop-shadow(0 12px 28px rgba(0,0,0,0.6)) drop-shadow(0 0 14px rgba(105,240,174,0.45))'
      :'drop-shadow(0 12px 28px rgba(0,0,0,0.6)) drop-shadow(0 0 14px rgba(255,82,82,0.45))';
    if(aR!==this._lastAnchor.r||aC!==this._lastAnchor.c||valid!==this._lastAnchor.valid){
      this._lastAnchor={r:aR,c:aC,valid};this._onProj(aR,aC,valid,filled);
    }
  }

  _onPointerUp(e){if(!this._active||e.pointerId!==this._pointerId)return;this._finish(e.clientX,e.clientY,false);}
  _onPointerCancel(e){if(!this._active||e.pointerId!==this._pointerId)return;this._finish(e.clientX,e.clientY,true);}

  _finish(clientX,clientY,cancelled){
    if(this._originSlot&&this._originSlot.releasePointerCapture&&this._pointerId){try{this._originSlot.releasePointerCapture(this._pointerId);}catch(_){}}
    document.removeEventListener('pointermove',this._onPointerMove);
    document.removeEventListener('pointerup',this._onPointerUp);
    document.removeEventListener('pointercancel',this._onPointerCancel);
    this._clearProjection();
    if(cancelled||!this._piece){this._animateReturn();return;}
    // Use cached cell size for final anchor
    const aC=Math.floor((clientX-this._gridRect.left)/this._cellSize);
    const aR=Math.floor((clientY-this._gridRect.top)/this._cellSize);
    if(this._isValidFn(aR,aC,this._piece.shapeMatrix)){
      this._snapToGrid(aR,aC,()=>{this._onCommit(this._trayIndex,aR,aC,this._piece);this._cleanup();});
    }else{this._animateReturn();}
  }

  _snapToGrid(aR,aC,done){
    if(!this._ghost){done();return;}
    const tx=this._gridRect.left+aC*this._cellSize;
    const ty=this._gridRect.top+aR*this._cellSize;
    this._ghost.style.transition='transform 0.15s cubic-bezier(.4,0,.2,1), opacity 0.15s ease';
    this._ghost.style.transform=`translate3d(${tx}px,${ty}px,0) scale(0.9)`;
    this._ghost.style.opacity='0';
    setTimeout(done,150);
  }

  _animateReturn(){
    if(!this._ghost){this._cleanup();return;}
    const dest=this._originSlot.getBoundingClientRect();
    const dx=dest.left+dest.width/2,dy=dest.top+dest.height/2;
    this._ghost.style.transition='transform 0.4s cubic-bezier(.34,1.56,.64,1), opacity 0.35s ease';
    this._ghost.style.transform=`translate3d(${dx}px,${dy}px,0) scale(0.4)`;
    this._ghost.style.opacity='0';
    this._onCancel(this._trayIndex,this._piece);
    setTimeout(()=>this._cleanup(),400);
  }

  _cleanup(){
    if(this._ghost){this._ghost.remove();this._ghost=null;}
    this._active=false;this._pointerId=null;this._trayIndex=null;
    this._piece=null;this._gridEl=null;this._originSlot=null;
    this._originRect=null;this._gridRect=null;this._cellSize=0;
    this._lastAnchor={r:-1,c:-1,valid:false};
  }
  _clearProjection(){this._onProj(-1,-1,false,[]);}
  abort(){if(!this._active)return;this._clearProjection();this._animateReturn();}
  get isActive(){return this._active;}
}

/* ═══════════════════════════════════════════════════════════════════
   SECTION 11 — ANIMATION CONTROLLER
   ═══════════════════════════════════════════════════════════════════ */
const AnimCtrl={
  blastLines(rows,cols,gridEl){
    return new Promise(resolve=>{
      const cells=gridEl.children,indices=new Set();
      rows.forEach(r=>{for(let c=0;c<8;c++)indices.add(r*8+c);});
      cols.forEach(c=>{for(let r=0;r<8;r++)indices.add(r*8+c);});
      let sumR=0,sumC=0,count=0;
      indices.forEach(idx=>{sumR+=Math.floor(idx/8);sumC+=idx%8;count++;});
      const cR=sumR/count,cC=sumC/count;
      indices.forEach(idx=>{
        const r=Math.floor(idx/8),c=idx%8;
        const dist=Math.sqrt((r-cR)**2+(c-cC)**2);
        const cell=cells[idx];
        if(cell){cell.style.animationDelay=(dist*30)+'ms';cell.classList.add('grid-cell--blast');}
      });
      setTimeout(()=>{indices.forEach(idx=>{const cell=cells[idx];if(cell){cell.classList.remove('grid-cell--blast');cell.style.animationDelay='';}});resolve();},800);
    });
  },
  spawnComboPopup(text,container,x,y){
    const el=document.createElement('div');
    el.className='combo-popup';el.textContent=text;
    Object.assign(el.style,{position:'absolute',left:x+'px',top:y+'px',transform:'translate(-50%,0)',pointerEvents:'none',zIndex:'3000'});
    container.appendChild(el);
    setTimeout(()=>el.remove(),1200);
  },
  animateScore(from,to,duration,onTick){
    const start=performance.now(),diff=to-from;
    function tick(now){
      const el=now-start,prog=Math.min(el/duration,1);
      const eased=1-Math.pow(1-prog,3);
      onTick(Math.round(from+diff*eased));
      if(prog<1)requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  },
};

/* ── EXPORTS ── */
const BlockPuzzle={
  GameState,createEmptyGrid,deepCopyGrid,serializeState,deserializeState,
  SHAPES,getShapeDimensions,getFilledCells,isValidPlacement,placeBlock,
  clearLines,calculateScore,hasAnyValidMove,checkEndConditions,
  generateTray,refillTray,createPiece,initLevel,printGrid,getGridStats,
  DragController,AnimCtrl,SHAPE_ID_MAP,
};
if(typeof window!=='undefined')window.BlockPuzzle=BlockPuzzle;
if(typeof module!=='undefined'&&module.exports)module.exports=BlockPuzzle;

// ── DEBUG: Visualizer layout fallback — wrap experimental rendering ──
try {
  // Any experimental 3D canvas or advanced visual rendering goes here.
  // If it throws, it will NOT block the primary UI execution loop.
  if(window.__BP_DEBUG__) console.log('[BP] Engine loaded. Shapes:',Object.keys(SHAPES).length,'Levels:',GAME_LEVELS.length);
}catch(e){
  console.warn('[BP] Non-critical init error (UI unaffected):',e.message);
}

}catch(e){
  console.error('[BP] Engine init error:',e);
}
})(); // end IIFE + try-catch wrapper
