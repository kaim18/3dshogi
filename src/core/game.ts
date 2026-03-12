import { Board } from './board';
import { PROMOTABLE, UNPROMOTE, BOARD_X, BOARD_Y, BOARD_Z } from './constants';
import { getMoveDests } from './moves';
import { getDropPositions } from './drop';
import { GameState, MoveAction, Hands, Piece, PieceType, Player, Position } from './types';

const HAND_TYPES: PieceType[] = ['pawn','lance','knight','silver','gold','bishop','rook','kirin','houou'];

export function opponent(p: Player): Player {
  return p === 'sente' ? 'gote' : 'sente';
}

function mustForcePromote(type: PieceType, owner: Player, toY: number): boolean {
  if (type === 'pawn' || type === 'lance') {
    return owner === 'sente' ? toY === 9 : toY === 1;
  }
  if (type === 'knight') {
    return owner === 'sente' ? toY >= 8 : toY <= 2;
  }
  return false;
}

function canPromote(type: PieceType, owner: Player, fromY: number, toY: number): boolean {
  if (!(type in PROMOTABLE)) return false;
  const enemyZone = owner === 'sente' ? [7, 8, 9] : [1, 2, 3];
  return enemyZone.includes(toY) || enemyZone.includes(fromY);
}

function addToHand(hands: Hands, player: Player, type: PieceType): Hands {
  const current = hands[player][type] || 0;
  return {
    ...hands,
    [player]: { ...hands[player], [type]: current + 1 },
  };
}

function removeFromHand(hands: Hands, player: Player, type: PieceType): Hands {
  const current = hands[player][type] || 0;
  return {
    ...hands,
    [player]: { ...hands[player], [type]: current - 1 },
  };
}

function boardHash(board: Board, turn: Player, hands: Hands): string {
  const parts: string[] = [turn];
  for (let z = 1; z <= BOARD_Z; z++)
    for (let y = 1; y <= BOARD_Y; y++)
      for (let x = 1; x <= BOARD_X; x++) {
        const p = board.get({ x, y, z });
        parts.push(p ? `${p.owner[0]}${p.type}` : '_');
      }
  for (const player of ['sente', 'gote'] as Player[]) {
    for (const t of HAND_TYPES) {
      const c = hands[player][t] || 0;
      if (c > 0) parts.push(`${player[0]}${t}${c}`);
    }
  }
  return parts.join('|');
}

function recordPosition(state: GameState): GameState {
  const hash = boardHash(state.board, state.turn, state.hands);
  const count = state.positionHashes.get(hash) || 0;
  const newMap = new Map(state.positionHashes);
  newMap.set(hash, count + 1);
  return { ...state, positionHashes: newMap };
}

// ===== Public API =====

export function createInitialState(): GameState {
  return recordPosition({
    board: Board.createInitial(),
    hands: { sente: {}, gote: {} },
    turn: 'sente',
    moveHistory: [],
    positionHashes: new Map(),
  });
}

export function createCustomState(opts: {
  pieces: { piece: Piece; pos: Position }[];
  turn?: Player;
  hands?: Hands;
}): GameState {
  return recordPosition({
    board: Board.from(opts.pieces),
    hands: opts.hands ?? { sente: {}, gote: {} },
    turn: opts.turn ?? 'sente',
    moveHistory: [],
    positionHashes: new Map(),
  });
}

export function getPiece(state: GameState, pos: Position): Piece | null {
  return state.board.get(pos);
}

export function getHand(state: GameState, player: Player, type: PieceType): number {
  return state.hands[player][type] || 0;
}

export function applyMove(state: GameState, move: MoveAction): GameState {
  let { board, hands, turn } = state;

  if (move.kind === 'move') {
    const piece = board.get(move.from)!;
    const captured = board.get(move.to);

    if (captured) {
      const baseType = UNPROMOTE[captured.type] || captured.type;
      hands = addToHand(hands, turn, baseType);
    }

    board = board.remove(move.from);
    let newType = piece.type;
    if (move.promote && canPromote(piece.type, turn, move.from.y, move.to.y)) {
      newType = PROMOTABLE[piece.type]!;
    }
    if (mustForcePromote(newType, turn, move.to.y) && PROMOTABLE[newType]) {
      newType = PROMOTABLE[newType]!;
    }
    board = board.set(move.to, { type: newType, owner: turn });
  } else {
    board = board.set(move.to, { type: move.pieceType, owner: turn });
    hands = removeFromHand(hands, turn, move.pieceType);
  }

  return recordPosition({
    board,
    hands,
    turn: opponent(turn),
    moveHistory: [...state.moveHistory, move],
    positionHashes: state.positionHashes,
  });
}

export function findKing(state: GameState, player: Player): Position | null {
  for (let z = 1; z <= BOARD_Z; z++)
    for (let y = 1; y <= BOARD_Y; y++)
      for (let x = 1; x <= BOARD_X; x++) {
        const p = state.board.get({ x, y, z });
        if (p && p.owner === player && p.type === 'king') return { x, y, z };
      }
  return null;
}

export function isInCheck(state: GameState, player: Player): boolean {
  const kingPos = findKing(state, player);
  if (!kingPos) return false;
  const enemy = opponent(player);

  for (let z = 1; z <= BOARD_Z; z++)
    for (let y = 1; y <= BOARD_Y; y++)
      for (let x = 1; x <= BOARD_X; x++) {
        const p = state.board.get({ x, y, z });
        if (p && p.owner === enemy) {
          const dests = getMoveDests(state.board, { x, y, z });
          if (dests.some(d => d.x === kingPos.x && d.y === kingPos.y && d.z === kingPos.z)) {
            return true;
          }
        }
      }
  return false;
}

function isLegalAfterMove(state: GameState, move: MoveAction): boolean {
  const { board, turn } = state;
  let newBoard: Board;

  if (move.kind === 'move') {
    const piece = board.get(move.from);
    if (!piece) return false;
    let newType = piece.type;
    if (move.promote && PROMOTABLE[piece.type]) newType = PROMOTABLE[piece.type]!;
    if (mustForcePromote(newType, turn, move.to.y) && PROMOTABLE[newType]) newType = PROMOTABLE[newType]!;
    newBoard = board.remove(move.from).set(move.to, { type: newType, owner: turn });
  } else {
    newBoard = board.set(move.to, { type: move.pieceType, owner: turn });
  }

  const tempState: GameState = { ...state, board: newBoard };
  return !isInCheck(tempState, turn);
}

function isDropPawnMate(state: GameState, to: Position): boolean {
  const { turn } = state;
  const enemy = opponent(turn);
  const newBoard = state.board.set(to, { type: 'pawn', owner: turn });
  const enemyState: GameState = { ...state, board: newBoard, turn: enemy };

  if (!isInCheck(enemyState, enemy)) return false;

  // Check if enemy has any legal response
  for (let z = 1; z <= BOARD_Z; z++)
    for (let y = 1; y <= BOARD_Y; y++)
      for (let x = 1; x <= BOARD_X; x++) {
        const p = newBoard.get({ x, y, z });
        if (!p || p.owner !== enemy) continue;
        const dests = getMoveDests(newBoard, { x, y, z });
        for (const d of dests) {
          if (isLegalAfterMove(enemyState, { kind: 'move', from: { x, y, z }, to: d, promote: false })) {
            return false;
          }
        }
      }
  return true;
}

export function getLegalMoves(state: GameState): MoveAction[] {
  const { board, turn, hands } = state;
  const moves: MoveAction[] = [];

  for (let z = 1; z <= BOARD_Z; z++)
    for (let y = 1; y <= BOARD_Y; y++)
      for (let x = 1; x <= BOARD_X; x++) {
        const p = board.get({ x, y, z });
        if (!p || p.owner !== turn) continue;
        const from = { x, y, z };
        for (const to of getMoveDests(board, from)) {
          const promoteOptions: boolean[] = [false];
          if (canPromote(p.type, turn, from.y, to.y)) promoteOptions.push(true);
          for (const promote of promoteOptions) {
            const move: MoveAction = { kind: 'move', from, to, promote };
            if (isLegalAfterMove(state, move)) moves.push(move);
          }
        }
      }

  for (const pieceType of HAND_TYPES) {
    if (!hands[turn][pieceType] || hands[turn][pieceType]! <= 0) continue;
    for (const to of getDropPositions(board, turn, pieceType)) {
      const move: MoveAction = { kind: 'drop', pieceType, to };
      if (pieceType === 'pawn' && isDropPawnMate(state, to)) continue;
      if (isLegalAfterMove(state, move)) moves.push(move);
    }
  }

  return moves;
}

export function isCheckmate(state: GameState): boolean {
  return isInCheck(state, state.turn) && getLegalMoves(state).length === 0;
}

export function isRepetition(state: GameState): boolean {
  for (const count of state.positionHashes.values()) {
    if (count >= 4) return true;
  }
  return false;
}
