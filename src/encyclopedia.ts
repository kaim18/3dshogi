import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Board } from '@core/board';
import { getMoveDests } from '@core/moves';
import { PIECE_DEFS, PIECE_NAMES, PROMOTABLE, BOARD_X, BOARD_Y, BOARD_Z } from '@core/constants';
import { PieceType } from '@core/types';

const CELL = 1.0;
const GAP = 4.0;

// Piece entries: base pieces + their promoted forms grouped together
const ENTRIES: { type: PieceType; label: string }[] = [
  { type: 'king', label: '王将' },
  { type: 'rook', label: '飛車' }, { type: 'p_rook', label: '　→ 龍王' },
  { type: 'bishop', label: '角行' }, { type: 'p_bishop', label: '　→ 龍馬' },
  { type: 'gold', label: '金将' },
  { type: 'silver', label: '銀将' }, { type: 'p_silver', label: '　→ 成銀' },
  { type: 'knight', label: '桂馬' }, { type: 'p_knight', label: '　→ 成桂' },
  { type: 'lance', label: '香車' }, { type: 'p_lance', label: '　→ 成香' },
  { type: 'pawn', label: '歩兵' }, { type: 'p_pawn', label: '　→ と金' },
  { type: 'kirin', label: '麒麟' }, { type: 'p_kirin', label: '　→ 成麒' },
  { type: 'houou', label: '鳳凰' }, { type: 'p_houou', label: '　→ 成鳳' },
];

const DESCS: Partial<Record<PieceType, string>> = {
  king: '全26方向に1マス',
  rook: '直交6方向にスライド',
  p_rook: '直交6方向スライド＋全26方向1マス',
  bishop: '辺対角12方向にスライド',
  p_bishop: '辺対角12方向スライド＋全26方向1マス',
  gold: '直交6方向＋前方斜め4方向に1マス',
  silver: '前方9方向＋後方平面斜め2方向',
  p_silver: '金と同じ動き',
  knight: '前方2＋横1のジャンプ（4方向）',
  p_knight: '金と同じ動き',
  lance: '前方にスライド',
  p_lance: '金と同じ動き',
  pawn: '前方1マス',
  p_pawn: '金と同じ動き',
  kirin: '空間対角＋辺対角20方向にスライド',
  p_kirin: '空間対角＋辺対角スライド＋直交6方向1マス',
  houou: '2+1のL字ジャンプ（24方向）',
  p_houou: '2+1ジャンプ＋直交6方向1マス',
};

export function initEncyclopedia() {
  const panel = document.getElementById('encyclopedia-panel')!;
  const canvas = document.getElementById('encyclopedia-canvas') as HTMLCanvasElement;
  const listEl = document.getElementById('piece-list')!;
  const titleEl = document.getElementById('piece-title')!;
  const descEl = document.getElementById('piece-desc')!;

  // Mini renderer
  const W = Math.min(400, window.innerWidth - 180);
  const H = Math.min(400, window.innerHeight - 160);
  canvas.width = W; canvas.height = H;

  const miniRenderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  miniRenderer.setSize(W, H);
  miniRenderer.setPixelRatio(window.devicePixelRatio);

  const miniScene = new THREE.Scene();
  miniScene.background = new THREE.Color(0x1a1a2e);

  const miniCam = new THREE.PerspectiveCamera(50, W / H, 0.1, 100);
  miniCam.position.set(0, 14, -12);
  miniCam.lookAt(0, 0, 0);

  const miniControls = new OrbitControls(miniCam, canvas);
  miniControls.enableDamping = true;
  miniControls.target.set(0, 0, 0);

  miniScene.add(new THREE.AmbientLight(0xffeedd, 0.5));
  const dl = new THREE.DirectionalLight(0xffffff, 0.8);
  dl.position.set(5, 15, 8);
  miniScene.add(dl);

  const boardGroup = new THREE.Group();
  miniScene.add(boardGroup);

  // Piece shape (reuse same pentagon)
  const pieceShape = new THREE.Shape();
  const w = CELL * 0.35, h = CELL * 0.45;
  pieceShape.moveTo(0, h);
  pieceShape.lineTo(w, h * 0.3);
  pieceShape.lineTo(w * 0.85, -h);
  pieceShape.lineTo(-w * 0.85, -h);
  pieceShape.lineTo(-w, h * 0.3);
  pieceShape.closePath();
  const pieceGeo = new THREE.ExtrudeGeometry(pieceShape, { depth: 0.2, bevelEnabled: false });

  const cellGeo = new THREE.BoxGeometry(CELL * 0.95, 0.15, CELL * 0.95);
  const highlightGeo = new THREE.BoxGeometry(CELL * 0.9, 0.18, CELL * 0.9);

  function lx(x: number) { return (x - 5) * CELL; }
  function lz(y: number) { return (y - 5) * CELL; }

  // Text texture cache
  const texCache = new Map<string, THREE.CanvasTexture>();
  function textTex(text: string): THREE.CanvasTexture {
    if (texCache.has(text)) return texCache.get(text)!;
    const c = document.createElement('canvas');
    c.width = 128; c.height = 128;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#111';
    ctx.font = 'bold 72px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 64, 64);
    const t = new THREE.CanvasTexture(c);
    texCache.set(text, t);
    return t;
  }

  function showPiece(type: PieceType) {
    // Clear
    while (boardGroup.children.length) boardGroup.remove(boardGroup.children[0]);

    // Place piece at center of board
    const center = { x: 5, y: 5, z: 2 };
    const board = Board.empty().set(center, { type, owner: 'sente' });
    const dests = getMoveDests(board, center);

    // Determine which layers have destinations
    const activeLayers = new Set([2]);
    for (const d of dests) activeLayers.add(d.z);

    // Draw layers
    for (const z of [1, 2, 3]) {
      if (!activeLayers.has(z)) continue;
      const layerG = new THREE.Group();
      layerG.position.set(0, (z - 2) * GAP, 0);

      // Board cells
      for (let y = 1; y <= BOARD_Y; y++)
        for (let x = 1; x <= BOARD_X; x++) {
          const light = (x + y) % 2 === 0;
          const mat = new THREE.MeshStandardMaterial({
            color: light ? 0xdbb07a : 0xc99a5e, roughness: 0.75, opacity: 0.5, transparent: true,
          });
          const m = new THREE.Mesh(cellGeo, mat);
          m.position.set(lx(x), -0.075, lz(y));
          layerG.add(m);
        }

      // Frame
      const frameGeo = new THREE.BoxGeometry(BOARD_X * CELL + 0.1, 0.1, BOARD_Y * CELL + 0.1);
      const frame = new THREE.Mesh(frameGeo, new THREE.MeshStandardMaterial({
        color: 0x8b6914, roughness: 0.6, opacity: 0.4, transparent: true,
      }));
      frame.position.y = -0.2;
      layerG.add(frame);

      boardGroup.add(layerG);
    }

    // Piece mesh at center
    const centerLayer = boardGroup.children.find(
      (c) => Math.abs(c.position.y - 0) < 0.01
    )!;
    const pg = new THREE.Group();
    const body = new THREE.Mesh(pieceGeo, new THREE.MeshStandardMaterial({ color: 0xf5e6c8, roughness: 0.6 }));
    body.rotation.x = -Math.PI / 2;
    body.rotation.z = Math.PI;
    pg.add(body);
    const tex = textTex(PIECE_NAMES[type]);
    const label = new THREE.Mesh(
      new THREE.PlaneGeometry(CELL * 0.55, CELL * 0.55),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }),
    );
    label.rotation.x = -Math.PI / 2;
    label.rotation.z = Math.PI;
    label.position.y = 0.22;
    pg.add(label);
    pg.position.set(lx(5), 0, lz(5));
    centerLayer.add(pg);

    // Highlight destinations
    for (const d of dests) {
      const layer = boardGroup.children.find(
        (c) => Math.abs(c.position.y - (d.z - 2) * GAP) < 0.01
      );
      if (!layer) continue;
      const hm = new THREE.Mesh(highlightGeo, new THREE.MeshBasicMaterial({
        color: 0x00aaff, transparent: true, opacity: 0.4,
      }));
      hm.position.set(lx(d.x), 0.02, lz(d.y));
      layer.add(hm);
    }

    titleEl.textContent = `${PIECE_NAMES[type]}（${type}）`;
    descEl.textContent = DESCS[type] ?? '';
  }

  // Build piece list buttons
  let activeBtn: HTMLButtonElement | null = null;
  for (const entry of ENTRIES) {
    const btn = document.createElement('button');
    btn.textContent = entry.label;
    btn.addEventListener('click', () => {
      activeBtn?.classList.remove('active');
      btn.classList.add('active');
      activeBtn = btn;
      showPiece(entry.type);
    });
    listEl.appendChild(btn);
  }

  // Open/close
  let animId = 0;
  function animateLoop() {
    animId = requestAnimationFrame(animateLoop);
    miniControls.update();
    miniRenderer.render(miniScene, miniCam);
  }

  document.getElementById('btn-encyclopedia')!.addEventListener('click', () => {
    panel.style.display = 'block';
    // Select first piece if none selected
    if (!activeBtn) {
      const first = listEl.querySelector('button') as HTMLButtonElement;
      first?.click();
    }
    animateLoop();
  });

  document.getElementById('close-encyclopedia')!.addEventListener('click', () => {
    panel.style.display = 'none';
    cancelAnimationFrame(animId);
  });
}
