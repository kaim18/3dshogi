import type { AIStrategy } from './types';

export const randomAI: AIStrategy = (_state, legalMoves) => {
  if (legalMoves.length === 0) throw new Error('No legal moves');
  return legalMoves[Math.floor(Math.random() * legalMoves.length)];
};
