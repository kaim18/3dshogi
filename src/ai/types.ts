import type { GameState, MoveAction } from '../core/types';

export type AIStrategy = (state: GameState, legalMoves: readonly MoveAction[]) => MoveAction;
