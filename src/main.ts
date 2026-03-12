import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { createInitialState, getLegalMoves, applyMove, isCheckmate } from '@core/game';
import { GameState } from '@core/types';
import { initialUIState, transition } from './ui/inputState';
import { getViewData } from './ui/viewModel';
import { UIState, UIEvent, ViewData, ViewMode, CellView } from './ui/types';
import { PIECE_NAMES, BOARD_X, BOARD_Y, BOARD_Z } from '@core/constants';
import { randomAI } from './ai/random';
import { createMinimaxAI } from './ai/minimax';
import { initEncyclopedia } from './encyclopedia';
import { getLang, setLang, onLangChange, t } from './i18n';

const aiStrategy = createMinimaxAI(2);

// ===== State =====
let gameState: GameState = createInitialState();
let uiState: UIState = initialUIState;
let stateHistory: GameState[] = [];

// ===== Three.js setup =====
const app = document.getElementById('app')!;
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
app.prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1a2e);
scene.fog = new THREE.Fog(0x1a1a2e, 30, 60);

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 12, -14);
camera.lookAt(0, 0, 0);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0, 0, 0);

scene.add(new THREE.AmbientLight(0xffeedd, 0.4));
const dirLight = new THREE.DirectionalLight(0xffffff, 0.9);
dirLight.position.set(5, 15, 8);
scene.add(dirLight);
// Subtle fill light from below
const fillLight = new THREE.DirectionalLight(0x8899bb, 0.2);
fillLight.position.set(-3, -5, -3);
scene.add(fillLight);

// ===== Constants =====
const CELL_SIZE = 1.0;
const LAYER_GAP = 4.0;
const FLAT_SPREAD = 11;
const ANIM_DURATION = 200;
const LAYOUT_ANIM_DURATION = 400;

// ===== Layer groups: board cells, pieces, highlights all live inside =====
// Each layerGroup is positioned in world space; children use local coords (x,z on the board plane)
const layerGroups: THREE.Group[] = [];
const layerPieceGroups: THREE.Group[] = [];
const layerHighlightGroups: THREE.Group[] = [];
const cellMeshes: THREE.Mesh[] = [];

const cellGeo = new THREE.BoxGeometry(CELL_SIZE * 0.95, 0.15, CELL_SIZE * 0.95);

function localX(x: number) { return (x - 5) * CELL_SIZE; }
function localZ(y: number) { return (y - 5) * CELL_SIZE; }

function createBoardLayers() {
  for (let z = 1; z <= BOARD_Z; z++) {
    const layerGroup = new THREE.Group();
    layerGroup.userData = { z };
    layerGroup.position.set(0, (z - 2) * LAYER_GAP, 0);

    for (let y = 1; y <= BOARD_Y; y++) {
      for (let x = 1; x <= BOARD_X; x++) {
        const light = (x + y) % 2 === 0;
        const mat = new THREE.MeshStandardMaterial({
          color: light ? 0xdbb07a : 0xc99a5e,
          roughness: 0.75,
          metalness: 0.0,
        });
        const mesh = new THREE.Mesh(cellGeo, mat);
        mesh.position.set(localX(x), -0.075, localZ(y));
        mesh.userData = { x, y, z };
        layerGroup.add(mesh);
        cellMeshes.push(mesh);
      }
    }

    // Board frame (slightly below cells to avoid z-fighting)
    const frameGeo = new THREE.BoxGeometry(BOARD_X * CELL_SIZE + 0.1, 0.1, BOARD_Y * CELL_SIZE + 0.1);
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x8b6914, roughness: 0.6 });
    const frame = new THREE.Mesh(frameGeo, frameMat);
    frame.position.y = -0.2;
    layerGroup.add(frame);

    // Sub-groups for pieces and highlights (inside layerGroup)
    const pg = new THREE.Group();
    const hg = new THREE.Group();
    layerGroup.add(pg);
    layerGroup.add(hg);
    layerPieceGroups.push(pg);
    layerHighlightGroups.push(hg);

    scene.add(layerGroup);
    layerGroups.push(layerGroup);
  }
}
createBoardLayers();

// ===== Piece geometry: flat pentagon using ShapeGeometry + text as sprite =====
function createPieceShape(): THREE.Shape {
  const w = CELL_SIZE * 0.35;
  const h = CELL_SIZE * 0.45;
  const shape = new THREE.Shape();
  shape.moveTo(0, h);              // top point
  shape.lineTo(w, h * 0.3);
  shape.lineTo(w * 0.85, -h);
  shape.lineTo(-w * 0.85, -h);
  shape.lineTo(-w, h * 0.3);
  shape.closePath();
  return shape;
}

const pieceShape = createPieceShape();
const pieceGeo = new THREE.ExtrudeGeometry(pieceShape, { depth: 0.2, bevelEnabled: false });
// Center the geometry
pieceGeo.computeBoundingBox();

// ===== Text sprite on piece =====
const textureCache = new Map<string, THREE.CanvasTexture>();

function getTextTexture(text: string, _owner: 'sente' | 'gote'): THREE.CanvasTexture {
  if (textureCache.has(text)) return textureCache.get(text)!;
  const canvas = document.createElement('canvas');
  canvas.width = 128; canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, 128, 128);
  ctx.fillStyle = '#111';
  ctx.font = 'bold 72px serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 64, 64);
  const tex = new THREE.CanvasTexture(canvas);
  tex.premultiplyAlpha = false;
  textureCache.set(text, tex);
  return tex;
}

function createPieceMesh(name: string, owner: 'sente' | 'gote'): THREE.Group {
  const group = new THREE.Group();

  // Pentagon body: extrude is in XY plane
  // rotation.x = -PI/2 maps shape +Y → world -Z (toward camera)
  // We want sente pointing AWAY from camera (+Z = toward gote side)
  // So rotate body PI around Y after laying flat
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xf5e6c8, roughness: 0.6 });
  const body = new THREE.Mesh(pieceGeo, bodyMat);
  body.rotation.x = -Math.PI / 2;
  body.rotation.z = Math.PI;
  group.add(body);

  // Text label on top face
  // Label needs to face the owner's side (readable from their perspective)
  const tex = getTextTexture(name, owner);
  const labelMat = new THREE.MeshBasicMaterial({
    map: tex, transparent: true, depthWrite: false,
  });
  const labelGeo = new THREE.PlaneGeometry(CELL_SIZE * 0.55, CELL_SIZE * 0.55);
  const label = new THREE.Mesh(labelGeo, labelMat);
  label.rotation.x = -Math.PI / 2;
  // Rotate label so text reads correctly when viewed from sente side (+z camera)
  // Body is rotated PI around Z, so label needs matching rotation
  label.rotation.z = Math.PI;
  label.position.y = 0.22; // above body top
  group.add(label);

  // Gote: rotate 180° so pentagon points toward sente side
  if (owner === 'gote') group.rotation.y = Math.PI;

  return group;
}

// Track piece groups by position key for animation
const pieceMeshMap = new Map<string, THREE.Group>();

function posKey(x: number, y: number, z: number) { return `${x},${y},${z}`; }

function rebuildPieces(vd: ViewData) {
  for (const pg of layerPieceGroups) {
    while (pg.children.length) pg.remove(pg.children[0]);
  }
  pieceMeshMap.clear();

  for (const cell of vd.cells) {
    if (!cell.piece) continue;
    const zi = cell.pos.z - 1; // 0-indexed layer
    const mesh = createPieceMesh(PIECE_NAMES[cell.piece.type], cell.piece.owner);
    mesh.position.set(localX(cell.pos.x), 0, localZ(cell.pos.y));
    layerPieceGroups[zi].add(mesh);
    pieceMeshMap.set(posKey(cell.pos.x, cell.pos.y, cell.pos.z), mesh);
  }
}

// ===== Highlights =====
const HIGHLIGHT_COLORS: Record<string, number> = {
  selected: 0x00ff00, move: 0x00aaff, drop: 0xffaa00,
};

function rebuildHighlights(vd: ViewData) {
  for (const hg of layerHighlightGroups) {
    while (hg.children.length) hg.remove(hg.children[0]);
  }
  for (const cell of vd.cells) {
    if (cell.highlight === 'none') continue;
    const zi = cell.pos.z - 1;
    const mat = new THREE.MeshBasicMaterial({
      color: HIGHLIGHT_COLORS[cell.highlight],
      transparent: true, opacity: 0.35, side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(cellGeo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(localX(cell.pos.x), 0.01, localZ(cell.pos.y));
    layerHighlightGroups[zi].add(mesh);
  }
}

// ===== Move animation =====
// Animate in LOCAL coords within the layer group
let moveAnim: {
  obj: THREE.Group;
  fromLocal: THREE.Vector3;
  toLocal: THREE.Vector3;
  // If cross-layer, we reparent to scene and use world coords
  crossLayer: boolean;
  fromWorld: THREE.Vector3;
  toWorld: THREE.Vector3;
  start: number;
} | null = null;

function startMoveAnimation(
  fromPos: { x: number; y: number; z: number },
  toPos: { x: number; y: number; z: number },
) {
  const key = posKey(fromPos.x, fromPos.y, fromPos.z);
  const obj = pieceMeshMap.get(key);
  if (!obj) { finishMoveAnimation(); return; }

  const sameLayer = fromPos.z === toPos.z;
  const fromL = new THREE.Vector3(localX(fromPos.x), 0, localZ(fromPos.y));
  const toL = new THREE.Vector3(localX(toPos.x), 0, localZ(toPos.y));

  if (sameLayer) {
    moveAnim = { obj, fromLocal: fromL, toLocal: toL, crossLayer: false, fromWorld: fromL, toWorld: toL, start: performance.now() };
  } else {
    // Cross-layer: get world positions, reparent to scene
    const fromGroup = layerGroups[fromPos.z - 1];
    const toGroup = layerGroups[toPos.z - 1];
    const fromW = fromL.clone().applyMatrix4(fromGroup.matrixWorld);
    const toW = toL.clone().applyMatrix4(toGroup.matrixWorld);
    fromGroup.remove(obj);
    // Temporarily remove from piece group parent
    scene.add(obj);
    obj.position.copy(fromW);
    moveAnim = { obj, fromLocal: fromL, toLocal: toL, crossLayer: true, fromWorld: fromW, toWorld: toW, start: performance.now() };
  }
}

function updateMoveAnimation(now: number) {
  if (!moveAnim) return;
  const t = Math.min((now - moveAnim.start) / ANIM_DURATION, 1);
  const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

  if (moveAnim.crossLayer) {
    moveAnim.obj.position.lerpVectors(moveAnim.fromWorld, moveAnim.toWorld, eased);
  } else {
    moveAnim.obj.position.lerpVectors(moveAnim.fromLocal, moveAnim.toLocal, eased);
  }
  // Arc
  moveAnim.obj.position.y += Math.sin(eased * Math.PI) * 0.8;

  if (t >= 1) finishMoveAnimation();
}

function finishMoveAnimation() {
  if (moveAnim?.crossLayer && moveAnim.obj.parent === scene) {
    scene.remove(moveAnim.obj);
  }
  moveAnim = null;
  const prev = gameState;
  const result = transition(uiState, { kind: 'animationEnd' }, gameState);
  uiState = result.uiState;
  if (result.newGameState) {
    stateHistory.push(prev);
    gameState = result.newGameState;
  }
  render();
  scheduleAITurn();
}

// ===== Layout animation (cube ↔ flat ↔ slice) =====
let layoutAnim: {
  targets: { group: THREE.Group; from: THREE.Vector3; to: THREE.Vector3 }[];
  start: number;
} | null = null;

function getLayerTargetPos(z: number, mode: ViewMode): THREE.Vector3 {
  if (mode.kind === 'flat') return new THREE.Vector3((z - 2) * FLAT_SPREAD, 0, 0);
  if (mode.kind === 'slice') return new THREE.Vector3(0, 0, 0);
  return new THREE.Vector3(0, (z - 2) * LAYER_GAP, 0); // cube
}

function startLayoutAnimation(mode: ViewMode) {
  layoutAnim = {
    targets: layerGroups.map(g => ({
      group: g,
      from: g.position.clone(),
      to: getLayerTargetPos(g.userData.z, mode),
    })),
    start: performance.now(),
  };
}

function updateLayoutAnimation(now: number) {
  if (!layoutAnim) return;
  const t = Math.min((now - layoutAnim.start) / LAYOUT_ANIM_DURATION, 1);
  const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  for (const { group, from, to } of layoutAnim.targets) {
    group.position.lerpVectors(from, to, eased);
  }
  if (t >= 1) layoutAnim = null;
}

// ===== DOM overlay =====
const senteHandEl = document.getElementById('sente-hand')!;
const goteHandEl = document.getElementById('gote-hand')!;
const turnEl = document.getElementById('turn-indicator')!;
const promoteDialog = document.getElementById('promote-dialog')!;
const gameoverDialog = document.getElementById('gameover-dialog')!;
const winnerText = document.getElementById('winner-text')!;

function updateOverlay(vd: ViewData) {
  turnEl.textContent = vd.turn === 'sente' ? t('yourTurn') : t('cpuTurn');
  renderHand(senteHandEl, vd.senteHand);
  renderHand(goteHandEl, vd.goteHand);
  promoteDialog.style.display = vd.phase === 'promoteConfirm' ? 'block' : 'none';

  if (vd.phase === 'gameOver') {
    const phase = uiState.phase as { kind: 'gameOver'; winner: string };
    winnerText.textContent = phase.winner === 'sente' ? t('senteWins') : t('goteWins');
    gameoverDialog.style.display = 'block';
    turnEl.textContent = '';
  } else {
    gameoverDialog.style.display = 'none';
  }
}

function renderHand(el: HTMLElement, hand: ViewData['senteHand']) {
  el.innerHTML = '';
  for (const h of hand) {
    if (h.count === 0) continue;
    const div = document.createElement('div');
    div.className = 'hand-item' + (h.selectable ? ' selectable' : '') + (h.selected ? ' selected' : '');
    div.innerHTML = `${PIECE_NAMES[h.pieceType]}<span class="count">×${h.count}</span>`;
    div.addEventListener('click', () => {
      if (gameState.turn === 'gote') return;
      dispatch({ kind: 'clickHand', pieceType: h.pieceType });
    });
    el.appendChild(div);
  }
}

// ===== Dispatch =====
let prevViewMode: ViewMode = uiState.viewMode;

function dispatch(event: UIEvent) {
  const prev = gameState;
  const result = transition(uiState, event, gameState);
  uiState = result.uiState;
  if (result.newGameState) {
    stateHistory.push(prev);
    gameState = result.newGameState;
  }

  // View mode change → layout animation
  if (uiState.viewMode.kind !== prevViewMode.kind ||
      (uiState.viewMode.kind === 'slice' && prevViewMode.kind === 'slice' &&
       uiState.viewMode.z !== prevViewMode.z)) {
    startLayoutAnimation(uiState.viewMode);
    applyViewMode(uiState.viewMode);
    prevViewMode = uiState.viewMode;
  }

  // Move animation
  if (uiState.phase.kind === 'animating') {
    const phase = uiState.phase;
    if (!phase.applied) {
      // Player move: board not yet updated, render shows old state, then animate
      render();
    }
    // For AI move: board already updated, DON'T render yet (would destroy source mesh)
    startMoveAnimation(phase.from, phase.to);
    return;
  }

  render();
  scheduleAITurn();
}

// ===== AI turn =====
function scheduleAITurn() {
  if (gameState.turn !== 'gote') return;
  if (uiState.phase.kind !== 'idle') return;
  if (isCheckmate(gameState)) return;
  // Small delay so the player sees the board state before AI moves
  setTimeout(() => {
    const moves = getLegalMoves(gameState);
    if (moves.length === 0) return;
    const move = aiStrategy(gameState, moves);
    dispatch({ kind: 'aiMove', move });
  }, 300);
}

// ===== Raycaster =====
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

renderer.domElement.addEventListener('click', (e) => {
  if (moveAnim) return;
  if (gameState.turn === 'gote') return; // AI's turn, ignore input
  mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  const visible = cellMeshes.filter(m => {
    let obj: THREE.Object3D | null = m;
    while (obj) { if (!obj.visible) return false; obj = obj.parent; }
    return true;
  });
  const hits = raycaster.intersectObjects(visible);
  if (hits.length > 0) {
    const { x, y, z } = hits[0].object.userData;
    dispatch({ kind: 'clickCell', pos: { x, y, z } });
  }
});

// ===== Controls =====
const layoutBtn = document.getElementById('btn-layout')!;
const controlBtns = document.querySelectorAll('#controls button');
let isCube = true;

function updateActiveBtn(activeId: string) {
  controlBtns.forEach(b => b.classList.remove('active'));
  document.getElementById(activeId)!.classList.add('active');
}

layoutBtn.addEventListener('click', () => {
  isCube = !isCube;
  layoutBtn.textContent = isCube ? 'Cube' : 'Flat';
  dispatch({ kind: 'setViewMode', mode: { kind: isCube ? 'cube' : 'flat' } });
  updateActiveBtn('btn-layout');
});
for (const z of [1, 2, 3] as const) {
  document.getElementById(`btn-z${z}`)!.addEventListener('click', () => {
    dispatch({ kind: 'setViewMode', mode: { kind: 'slice', z } });
    updateActiveBtn(`btn-z${z}`);
  });
}
document.getElementById('btn-promote')!.addEventListener('click', () =>
  dispatch({ kind: 'confirmPromote', promote: true }));
document.getElementById('btn-no-promote')!.addEventListener('click', () =>
  dispatch({ kind: 'confirmPromote', promote: false }));
document.getElementById('btn-restart')!.addEventListener('click', () => {
  gameState = createInitialState();
  uiState = initialUIState;
  stateHistory = [];
  prevViewMode = uiState.viewMode;
  // Reset layer positions to cube
  for (let i = 0; i < layerGroups.length; i++) {
    layerGroups[i].position.set(0, (i - 1) * LAYER_GAP, 0);
  }
  render();
});

// ===== Undo (待った) =====
document.getElementById('btn-undo')!.addEventListener('click', () => {
  // Undo 2 moves (player + AI) back to player's turn
  if (stateHistory.length < 2 || gameState.turn !== 'sente') return;
  if (uiState.phase.kind !== 'idle') return;
  stateHistory.pop(); // AI's move
  gameState = stateHistory.pop()!; // player's move
  uiState = { ...uiState, phase: { kind: 'idle' } };
  render();
});

// ===== Help panel =====
const helpPanel = document.getElementById('help-panel')!;
const helpInner = document.getElementById('help-inner')!;

const helpRows = (keys: [string, string][]) =>
  '<table>' + keys.map(([l, r]) => `<tr><td>${t(l)}</td><td>${t(r)}</td></tr>`).join('') + '</table>';

function renderHelp() {
  helpInner.innerHTML =
    `<h2>${t('hControls')}</h2>` +
    helpRows([['ctrl1L','ctrl1R'],['ctrl2L','ctrl2R'],['ctrl3L','ctrl3R'],['ctrl4L','ctrl4R'],['ctrl5L','ctrl5R'],['ctrl6L','ctrl6R']]) +
    helpRows([['Cube','view1R'],['Flat','view2R'],['Z1 Z2 Z3','view3R']]) +
    `<h2>${t('hBoard')}</h2><p>${t('boardDesc')}</p>` +
    `<h2>${t('hPieces')}</h2><p>${t('pieceRef')}</p>` +
    `<h2>${t('hRules')}</h2>` +
    helpRows([['rule1L','rule1R'],['rule2L','rule2R'],['rule3L','rule3R'],['rule4L','rule4R'],['rule5L','rule5R']]);
}
renderHelp();

document.getElementById('btn-help')!.addEventListener('click', () => {
  helpPanel.style.display = helpPanel.style.display === 'block' ? 'none' : 'block';
});
document.getElementById('close-help')!.addEventListener('click', () => {
  helpPanel.style.display = 'none';
});

// ===== Language toggle =====
const langBtn = document.getElementById('btn-lang')!;
langBtn.addEventListener('click', () => {
  setLang(getLang() === 'ja' ? 'en' : 'ja');
});
onLangChange(() => {
  langBtn.textContent = getLang() === 'ja' ? '🌐 EN' : '🌐 JA';
  renderHelp();
  const vd = getViewData(gameState, uiState);
  updateOverlay(vd);
  document.getElementById('btn-restart')!.textContent = t('restart');
  document.getElementById('btn-undo')!.textContent = t('undo');
  document.getElementById('btn-promote')!.textContent = t('promote');
  document.getElementById('btn-no-promote')!.textContent = t('decline');
});

// ===== Encyclopedia =====
initEncyclopedia();

// ===== View mode visibility =====
function applyViewMode(mode: ViewMode) {
  for (let i = 0; i < layerGroups.length; i++) {
    layerGroups[i].visible = mode.kind !== 'slice' || mode.z === i + 1;
  }
}

// ===== Camera animation =====
const CAM_ANIM_DURATION = 400;
let camAnim: {
  from: THREE.Vector3;
  to: THREE.Vector3;
  start: number;
} | null = null;

function getCameraTarget(side: 'sente' | 'gote', mode: ViewMode): THREE.Vector3 {
  const sign = side === 'sente' ? -1 : 1;
  if (mode.kind === 'flat') return new THREE.Vector3(0, 22, 16 * sign);
  return new THREE.Vector3(0, 12, 14 * sign);
}

function applyViewSide(side: 'sente' | 'gote', mode: ViewMode) {
  const target = getCameraTarget(side, mode);
  if (camera.position.distanceTo(target) < 0.01) return;
  camAnim = {
    from: camera.position.clone(),
    to: target,
    start: performance.now(),
  };
}

function updateCameraAnimation(now: number) {
  if (!camAnim) return;
  const t = Math.min((now - camAnim.start) / CAM_ANIM_DURATION, 1);
  const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  camera.position.lerpVectors(camAnim.from, camAnim.to, eased);
  controls.target.set(0, 0, 0);
  controls.update();
  if (t >= 1) camAnim = null;
}

// ===== Render =====
function render() {
  const vd = getViewData(gameState, uiState);
  rebuildPieces(vd);
  rebuildHighlights(vd);
  updateOverlay(vd);
  applyViewMode(vd.viewMode);
  applyViewSide(uiState.viewSide, vd.viewMode);
}

render();

// ===== Animation loop =====
function animate() {
  requestAnimationFrame(animate);
  const now = performance.now();
  updateMoveAnimation(now);
  updateLayoutAnimation(now);
  updateCameraAnimation(now);
  controls.update();
  renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
