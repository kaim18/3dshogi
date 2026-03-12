import { MoveAction, Piece, PieceType, Player, Position } from '../core/types';

// ===== View Mode =====
export type ViewMode =
  | { kind: 'cube' }
  | { kind: 'flat' }
  | { kind: 'slice'; z: 1 | 2 | 3 };

// ===== UI Phase (state machine) =====
export type UIPhase =
  | { kind: 'idle' }
  | { kind: 'pieceSelected'; pos: Position; moves: MoveAction[] }
  | { kind: 'handSelected'; pieceType: PieceType; drops: Position[] }
  | { kind: 'promoteConfirm'; promoteMove: MoveAction; noPromoteMove: MoveAction }
  | { kind: 'animating'; from: Position; to: Position; piece: Piece; move: MoveAction; applied: boolean }
  | { kind: 'gameOver'; winner: Player | 'draw' };

// ===== UI State =====
export type UIState = Readonly<{
  phase: UIPhase;
  viewMode: ViewMode;
  viewSide: Player;
}>;

// ===== UI Events =====
export type UIEvent =
  | { kind: 'clickCell'; pos: Position }
  | { kind: 'clickHand'; pieceType: PieceType }
  | { kind: 'confirmPromote'; promote: boolean }
  | { kind: 'animationEnd' }
  | { kind: 'aiMove'; move: MoveAction }
  | { kind: 'setViewMode'; mode: ViewMode }
  | { kind: 'flipViewSide' };

// ===== Transition result =====
export type TransitionResult = {
  uiState: UIState;
  newGameState?: import('../core/types').GameState; // set only when applyMove should happen
};

// ===== 3D world coordinates =====
export type WorldPos = { wx: number; wy: number; wz: number };

// ===== View data for renderer =====
export type CellView = {
  pos: Position;
  piece: Piece | null;
  highlight: 'none' | 'selected' | 'move' | 'drop';
  animating: boolean;
};

export type HandView = {
  pieceType: PieceType;
  count: number;
  selectable: boolean;
  selected: boolean;
};

export type ViewData = {
  cells: CellView[];
  senteHand: HandView[];
  goteHand: HandView[];
  turn: Player;
  phase: UIPhase['kind'];
  viewMode: ViewMode;
};
