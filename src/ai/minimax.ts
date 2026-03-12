import type { GameState, MoveAction } from '../core/types';
import { getLegalMoves, applyMove, isCheckmate, getPiece } from '../core/game';
import { evaluate, PIECE_VALUES } from './eval';
import type { AIStrategy } from './types';

function moveScore(state: GameState, move: MoveAction): number {
  let score = 0;
  if (move.kind === 'move') {
    const target = getPiece(state, move.to);
    if (target) score += 10 + (PIECE_VALUES[target.type] ?? 0);
    if (move.promote) score += 5;
  }
  return score;
}

function orderMoves(state: GameState, moves: readonly MoveAction[]): MoveAction[] {
  return [...moves].sort((a, b) => moveScore(state, b) - moveScore(state, a));
}

function alphaBeta(
  state: GameState, depth: number, alpha: number, beta: number,
): number {
  if (depth === 0 || isCheckmate(state)) {
    return evaluate(state);
  }

  const moves = orderMoves(state, getLegalMoves(state));
  if (moves.length === 0) return evaluate(state);

  if (state.turn === 'sente') {
    // Maximizing
    for (const move of moves) {
      const score = alphaBeta(applyMove(state, move), depth - 1, alpha, beta);
      if (score > alpha) alpha = score;
      if (alpha >= beta) break;
    }
    return alpha;
  } else {
    // Minimizing
    for (const move of moves) {
      const score = alphaBeta(applyMove(state, move), depth - 1, alpha, beta);
      if (score < beta) beta = score;
      if (alpha >= beta) break;
    }
    return beta;
  }
}

export function createMinimaxAI(depth: number): AIStrategy {
  return (state: GameState, legalMoves: readonly MoveAction[]): MoveAction => {
    if (legalMoves.length === 0) throw new Error('No legal moves');
    if (legalMoves.length === 1) return legalMoves[0];

    const maximizing = state.turn === 'sente';
    let bestScore = maximizing ? -Infinity : Infinity;
    let bestMoves: MoveAction[] = [];

    for (const move of legalMoves) {
      const score = alphaBeta(
        applyMove(state, move), depth - 1, -Infinity, Infinity,
      );
      if (maximizing ? score > bestScore : score < bestScore) {
        bestScore = score;
        bestMoves = [move];
      } else if (score === bestScore) {
        bestMoves.push(move);
      }
    }

    return bestMoves[Math.floor(Math.random() * bestMoves.length)];
  };
}
