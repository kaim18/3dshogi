import { GameState, MoveAction, Position, PieceType } from '../core/types';
import { getPiece, getLegalMoves, getHand, applyMove, isCheckmate } from '../core/game';
import { getDropPositions } from '../core/drop';
import { PROMOTABLE } from '../core/constants';
import { UIState, UIEvent, UIPhase, TransitionResult } from './types';
import { opponent } from '../core/game';

export const initialUIState: UIState = {
  phase: { kind: 'idle' },
  viewMode: { kind: 'cube' },
  viewSide: 'sente',
};

function posEq(a: Position, b: Position): boolean {
  return a.x === b.x && a.y === b.y && a.z === b.z;
}

function moveDests(moves: MoveAction[]): Position[] {
  const seen = new Set<string>();
  const result: Position[] = [];
  for (const m of moves) {
    if (m.kind !== 'move') continue;
    const k = `${m.to.x},${m.to.y},${m.to.z}`;
    if (!seen.has(k)) { seen.add(k); result.push(m.to); }
  }
  return result;
}

function canPromoteMove(moves: MoveAction[], to: Position): { promote: MoveAction | null; noPromote: MoveAction | null } {
  let promote: MoveAction | null = null;
  let noPromote: MoveAction | null = null;
  for (const m of moves) {
    if (m.kind === 'move' && posEq(m.to, to)) {
      if (m.promote) promote = m;
      else noPromote = m;
    }
  }
  return { promote, noPromote };
}

export function transition(ui: UIState, event: UIEvent, gs: GameState): TransitionResult {
  // View controls work in any phase
  if (event.kind === 'setViewMode') {
    return { uiState: { ...ui, viewMode: event.mode } };
  }
  if (event.kind === 'flipViewSide') {
    return { uiState: { ...ui, viewSide: opponent(ui.viewSide) } };
  }

  const { phase } = ui;

  switch (phase.kind) {
    case 'idle':
      return transitionIdle(ui, event, gs);
    case 'pieceSelected':
      return transitionPieceSelected(ui, phase, event, gs);
    case 'handSelected':
      return transitionHandSelected(ui, phase, event, gs);
    case 'promoteConfirm':
      return transitionPromoteConfirm(ui, phase, event, gs);
    case 'animating':
      return transitionAnimating(ui, phase, event, gs);
    case 'gameOver':
      return { uiState: ui };
  }
}

function transitionIdle(ui: UIState, event: UIEvent, gs: GameState): TransitionResult {
  if (event.kind === 'clickCell') {
    const piece = getPiece(gs, event.pos);
    if (piece && piece.owner === gs.turn) {
      const moves = getLegalMoves(gs).filter(m =>
        m.kind === 'move' && posEq(m.from, event.pos)
      );
      if (moves.length > 0) {
        return { uiState: { ...ui, phase: { kind: 'pieceSelected', pos: event.pos, moves } } };
      }
    }
    return { uiState: ui };
  }

  if (event.kind === 'clickHand') {
    if (getHand(gs, gs.turn, event.pieceType) > 0) {
      const drops = getDropPositions(gs.board, gs.turn, event.pieceType);
      if (drops.length > 0) {
        return { uiState: { ...ui, phase: { kind: 'handSelected', pieceType: event.pieceType, drops } } };
      }
    }
    return { uiState: ui };
  }

  if (event.kind === 'aiMove') {
    const { move } = event;
    const newGs = applyMove(gs, move);
    const from = move.kind === 'move' ? move.from : move.to;
    const to = move.kind === 'move' ? move.to : move.to;
    const piece = move.kind === 'move' ? getPiece(gs, move.from)! : { type: move.pieceType, owner: gs.turn };
    const nextPhase: UIPhase = isCheckmate(newGs)
      ? { kind: 'gameOver', winner: gs.turn }
      : { kind: 'animating', from, to, piece, move, applied: true };
    return { uiState: { ...ui, phase: nextPhase }, newGameState: newGs };
  }

  return { uiState: ui };
}

function transitionPieceSelected(
  ui: UIState, phase: Extract<UIPhase, { kind: 'pieceSelected' }>,
  event: UIEvent, gs: GameState,
): TransitionResult {
  // Hand click → switch to hand selection
  if (event.kind === 'clickHand') {
    return transitionIdle({ ...ui, phase: { kind: 'idle' } }, event, gs);
  }

  if (event.kind !== 'clickCell') return { uiState: ui };

  // Click same piece → deselect
  if (posEq(event.pos, phase.pos)) {
    return { uiState: { ...ui, phase: { kind: 'idle' } } };
  }

  // Click another own piece → switch selection
  const piece = getPiece(gs, event.pos);
  if (piece && piece.owner === gs.turn) {
    const moves = getLegalMoves(gs).filter(m =>
      m.kind === 'move' && posEq(m.from, event.pos)
    );
    if (moves.length > 0) {
      return { uiState: { ...ui, phase: { kind: 'pieceSelected', pos: event.pos, moves } } };
    }
  }

  // Click move target
  const targets = moveDests(phase.moves);
  if (targets.some(t => posEq(t, event.pos))) {
    const { promote, noPromote } = canPromoteMove(phase.moves, event.pos);
    if (promote && noPromote) {
      return { uiState: { ...ui, phase: { kind: 'promoteConfirm', promoteMove: promote, noPromoteMove: noPromote } } };
    }
    const move = promote || noPromote!;
    const movingPiece = getPiece(gs, phase.pos)!;
    return {
      uiState: { ...ui, phase: { kind: 'animating', from: phase.pos, to: event.pos, piece: movingPiece, move, applied: false } },
    };
  }

  // Click elsewhere → deselect
  return { uiState: { ...ui, phase: { kind: 'idle' } } };
}

function transitionHandSelected(
  ui: UIState, phase: Extract<UIPhase, { kind: 'handSelected' }>,
  event: UIEvent, gs: GameState,
): TransitionResult {
  if (event.kind === 'clickCell') {
    // Click own piece → switch to piece selection
    const piece = getPiece(gs, event.pos);
    if (piece && piece.owner === gs.turn) {
      const moves = getLegalMoves(gs).filter(m =>
        m.kind === 'move' && posEq(m.from, event.pos)
      );
      if (moves.length > 0) {
        return { uiState: { ...ui, phase: { kind: 'pieceSelected', pos: event.pos, moves } } };
      }
    }
    // Click drop target
    if (phase.drops.some(d => posEq(d, event.pos))) {
      const move: MoveAction = { kind: 'drop', pieceType: phase.pieceType, to: event.pos };
      return {
        uiState: { ...ui, phase: { kind: 'animating', from: event.pos, to: event.pos, piece: { type: phase.pieceType, owner: gs.turn }, move, applied: false } },
      };
    }
    return { uiState: { ...ui, phase: { kind: 'idle' } } };
  }
  if (event.kind === 'clickHand') {
    if (event.pieceType === phase.pieceType) {
      return { uiState: { ...ui, phase: { kind: 'idle' } } };
    }
    // Switch to different hand piece
    return transitionIdle({ ...ui, phase: { kind: 'idle' } }, event, gs);
  }
  return { uiState: ui };
}

function transitionPromoteConfirm(
  ui: UIState, phase: Extract<UIPhase, { kind: 'promoteConfirm' }>,
  event: UIEvent, gs: GameState,
): TransitionResult {
  if (event.kind !== 'confirmPromote') return { uiState: ui };
  const move = event.promote ? phase.promoteMove : phase.noPromoteMove;
  if (move.kind !== 'move') return { uiState: ui };
  const movingPiece = getPiece(gs, move.from)!;
  return {
    uiState: { ...ui, phase: { kind: 'animating', from: move.from, to: move.to, piece: movingPiece, move, applied: false } },
  };
}

function transitionAnimating(
  ui: UIState, phase: Extract<UIPhase, { kind: 'animating' }>,
  event: UIEvent, gs: GameState,
): TransitionResult {
  if (event.kind !== 'animationEnd') return { uiState: ui };
  if (phase.applied) {
    // AI move: already applied, just go idle (checkmate already checked)
    return { uiState: { ...ui, phase: { kind: 'idle' } } };
  }
  const newGs = applyMove(gs, phase.move);
  const nextPhase: UIPhase = isCheckmate(newGs)
    ? { kind: 'gameOver', winner: gs.turn }
    : { kind: 'idle' };
  return { uiState: { ...ui, phase: nextPhase }, newGameState: newGs };
}
