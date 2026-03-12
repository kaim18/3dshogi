// ===== Position =====
export type Position = Readonly<{ x: number; y: number; z: number }>;

// ===== Players =====
export type Player = 'sente' | 'gote';

// ===== Piece types =====
export type PieceType =
  | 'king' | 'rook' | 'bishop' | 'gold' | 'silver'
  | 'knight' | 'lance' | 'pawn' | 'kirin' | 'houou'
  | 'p_rook' | 'p_bishop' | 'p_silver' | 'p_knight'
  | 'p_lance' | 'p_pawn' | 'p_kirin' | 'p_houou';

export type Piece = Readonly<{
  type: PieceType;
  owner: Player;
}>;

// ===== Direction vector =====
export type Dir = readonly [number, number, number];

// ===== Move types =====
export type MoveType = 'step' | 'slide' | 'jump' | 'slide+step' | 'jump+step';

export type PieceDef = Readonly<{
  move: MoveType;
  dirs: readonly Dir[];
  forwardSensitive: boolean;
  slideDirs?: readonly Dir[];
  stepDirs?: readonly Dir[];
  jumpDirs?: readonly Dir[];
}>;

// ===== Game move =====
export type MoveAction =
  | Readonly<{ kind: 'move'; from: Position; to: Position; promote: boolean }>
  | Readonly<{ kind: 'drop'; pieceType: PieceType; to: Position }>;

// ===== Hands =====
export type Hands = Readonly<Record<Player, Readonly<Partial<Record<PieceType, number>>>>>;

// ===== Game state =====
export type GameState = Readonly<{
  board: Board;
  hands: Hands;
  turn: Player;
  moveHistory: readonly MoveAction[];
  positionHashes: ReadonlyMap<string, number>;
}>;

// Forward declaration — actual Board type imported where needed
import type { Board } from './board';
