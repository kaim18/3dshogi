import { Dir, PieceDef, PieceType, Player, Piece } from './types';

// ===== Direction vectors =====
export const ORTHOGONAL_6: Dir[] = [
  [1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1],
];

export const EDGE_DIAGONAL_12: Dir[] = [
  [1,1,0],[1,-1,0],[-1,1,0],[-1,-1,0],
  [1,0,1],[1,0,-1],[-1,0,1],[-1,0,-1],
  [0,1,1],[0,1,-1],[0,-1,1],[0,-1,-1],
];

export const SPACE_DIAGONAL_8: Dir[] = [
  [1,1,1],[1,1,-1],[1,-1,1],[1,-1,-1],
  [-1,1,1],[-1,1,-1],[-1,-1,1],[-1,-1,-1],
];

export const ALL_26: Dir[] = [...ORTHOGONAL_6, ...EDGE_DIAGONAL_12, ...SPACE_DIAGONAL_8];

const GOLD_FORWARD_EDGE: Dir[] = [[1,1,0],[-1,1,0],[0,1,1],[0,1,-1]];
const KNIGHT_DIRS: Dir[] = [[1,2,0],[-1,2,0],[0,2,1],[0,2,-1]];

function genHououDirs(): Dir[] {
  const set = new Set<string>();
  const dirs: Dir[] = [];
  const axes = [0, 1, 2];
  for (let a = 0; a < 3; a++) {
    for (let b = a + 1; b < 3; b++) {
      for (const s1 of [-1, 1]) {
        for (const s2 of [-1, 1]) {
          for (const [big, small] of [[2, 1], [1, 2]] as const) {
            const d: [number, number, number] = [0, 0, 0];
            d[a] = s1 * big;
            d[b] = s2 * small;
            const key = d.join(',');
            if (!set.has(key)) { set.add(key); dirs.push(d); }
          }
        }
      }
    }
  }
  return dirs;
}

export const HOUOU_DIRS: Dir[] = genHououDirs();

// ===== Gold-like movement (used by many promoted pieces) =====
const GOLD_DIRS: Dir[] = [...ORTHOGONAL_6, ...GOLD_FORWARD_EDGE];

// ===== Piece definitions =====
export const PIECE_DEFS: Record<PieceType, PieceDef> = {
  king:     { move: 'step',  dirs: ALL_26, forwardSensitive: false },
  rook:     { move: 'slide', dirs: ORTHOGONAL_6, forwardSensitive: false },
  bishop:   { move: 'slide', dirs: EDGE_DIAGONAL_12, forwardSensitive: false },
  gold:     { move: 'step',  dirs: GOLD_DIRS, forwardSensitive: true },
  silver:   { move: 'step',  dirs: [[0,1,0], ...EDGE_DIAGONAL_12], forwardSensitive: true },
  knight:   { move: 'jump',  dirs: KNIGHT_DIRS, forwardSensitive: true },
  lance:    { move: 'slide', dirs: [[0,1,0]], forwardSensitive: true },
  pawn:     { move: 'step',  dirs: [[0,1,0]], forwardSensitive: true },
  kirin:    { move: 'slide', dirs: SPACE_DIAGONAL_8, forwardSensitive: false },
  houou:    { move: 'jump',  dirs: HOUOU_DIRS, forwardSensitive: false },
  p_pawn:   { move: 'step',  dirs: GOLD_DIRS, forwardSensitive: true },
  p_silver: { move: 'step',  dirs: GOLD_DIRS, forwardSensitive: true },
  p_knight: { move: 'step',  dirs: GOLD_DIRS, forwardSensitive: true },
  p_lance:  { move: 'step',  dirs: GOLD_DIRS, forwardSensitive: true },
  p_kirin:  { move: 'jump+step', dirs: [], forwardSensitive: false, jumpDirs: HOUOU_DIRS, stepDirs: ORTHOGONAL_6 },
  p_houou:  { move: 'slide+step', dirs: [], forwardSensitive: false, slideDirs: SPACE_DIAGONAL_8, stepDirs: ORTHOGONAL_6 },
  p_rook:   { move: 'slide+step', dirs: [], forwardSensitive: false, slideDirs: ORTHOGONAL_6, stepDirs: ALL_26 },
  p_bishop: { move: 'slide+step', dirs: [], forwardSensitive: false, slideDirs: EDGE_DIAGONAL_12, stepDirs: ALL_26 },
};

// ===== Promotion tables =====
export const PROMOTABLE: Partial<Record<PieceType, PieceType>> = {
  rook: 'p_rook', bishop: 'p_bishop', silver: 'p_silver',
  knight: 'p_knight', lance: 'p_lance', pawn: 'p_pawn',
  kirin: 'p_kirin', houou: 'p_houou',
};

export const UNPROMOTE: Partial<Record<PieceType, PieceType>> = Object.fromEntries(
  Object.entries(PROMOTABLE).map(([k, v]) => [v, k])
);

export const PROMOTED_SET = new Set(Object.values(PROMOTABLE));

// ===== Piece display names =====
export const PIECE_NAMES: Record<PieceType, string> = {
  king: '王', rook: '飛', bishop: '角', gold: '金',
  silver: '銀', knight: '桂', lance: '香', pawn: '歩',
  kirin: '麒', houou: '鳳',
  p_rook: '龍', p_bishop: '馬', p_silver: '全', p_knight: '圭',
  p_lance: '杏', p_pawn: 'と', p_kirin: '成麒', p_houou: '成鳳',
};

// ===== Board dimensions =====
export const BOARD_X = 9;
export const BOARD_Y = 9;
export const BOARD_Z = 3;

// ===== Initial setup =====
// Returns array of { piece, pos } using 1-indexed coordinates (matching spec)
// Internally we'll convert to 0-indexed in board.ts
export function getInitialPieces(): { piece: Piece; x: number; y: number; z: number }[] {
  const pieces: { piece: Piece; x: number; y: number; z: number }[] = [];
  const S = 'sente' as Player;
  const G = 'gote' as Player;

  function add(owner: Player, type: PieceType, x: number, y: number, z: number) {
    pieces.push({ piece: { type, owner }, x, y, z });
  }

  // --- Sente ---
  // Z=2 (middle layer)
  const backRow: PieceType[] = ['lance','knight','silver','gold','king','gold','silver','knight','lance'];
  for (let i = 0; i < 9; i++) add(S, backRow[i], 9 - i, 1, 2);
  add(S, 'rook', 8, 2, 2);
  add(S, 'bishop', 2, 2, 2);
  for (let x = 1; x <= 9; x++) add(S, 'pawn', x, 3, 2);

  // Z=3 (upper layer)
  add(S, 'kirin', 5, 1, 3);
  for (let x = 1; x <= 9; x += 2) add(S, 'pawn', x, 3, 3); // odd files

  // Z=1 (lower layer)
  add(S, 'houou', 5, 1, 1);
  for (let x = 2; x <= 8; x += 2) add(S, 'pawn', x, 3, 1); // even files

  // --- Gote (point-symmetric: (10-x, 10-y, 4-z)) ---
  // Z=2
  for (let i = 0; i < 9; i++) add(G, backRow[i], 10 - (9 - i), 9, 2);
  add(G, 'bishop', 8, 8, 2);
  add(G, 'rook', 2, 8, 2);
  for (let x = 1; x <= 9; x++) add(G, 'pawn', x, 7, 2);

  // Z=3 (corresponds to sente's Z=1)
  add(G, 'houou', 5, 9, 3);
  for (let x = 2; x <= 8; x += 2) add(G, 'pawn', x, 7, 3); // even files

  // Z=1 (corresponds to sente's Z=3)
  add(G, 'kirin', 5, 9, 1);
  for (let x = 1; x <= 9; x += 2) add(G, 'pawn', x, 7, 1); // odd files

  return pieces;
}
