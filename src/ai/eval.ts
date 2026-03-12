import type { GameState } from '../core/types';
import { BOARD_X, BOARD_Y, BOARD_Z } from '../core/constants';

export const PIECE_VALUES: Record<string, number> = {
  pawn: 1, lance: 3, knight: 4, silver: 5, gold: 6,
  bishop: 8, rook: 10, kirin: 7, houou: 7,
  p_pawn: 6, p_lance: 6, p_knight: 6, p_silver: 6,
  p_bishop: 12, p_rook: 14, p_kirin: 10, p_houou: 12,
  king: 0,
};

/** Evaluate from sente's perspective. Positive = sente advantage. */
export function evaluate(state: GameState): number {
  let score = 0;

  for (let z = 1; z <= BOARD_Z; z++)
    for (let y = 1; y <= BOARD_Y; y++)
      for (let x = 1; x <= BOARD_X; x++) {
        const p = state.board.get({ x, y, z });
        if (!p) continue;
        const isSente = p.owner === 'sente';
        const sign = isSente ? 1 : -1;

        // Material
        if (p.type !== 'king') {
          score += sign * (PIECE_VALUES[p.type] ?? 0);
          // Advancement: reward pushing pieces forward (0.0–0.8 bonus)
          const advance = isSente ? (y - 1) / 8 : (9 - y) / 8;
          score += sign * advance * 0.1;
          // Center layer bonus
          if (z === 2) score += sign * 0.05;
        } else {
          // King safety: prefer staying back
          const kingSafe = isSente ? (9 - y) / 8 : (y - 1) / 8;
          score += sign * kingSafe * 0.3;
        }
      }

  // Hand material
  for (const [type, count] of Object.entries(state.hands.sente)) {
    if (count && count > 0) score += (PIECE_VALUES[type] ?? 0) * count * 0.9;
  }
  for (const [type, count] of Object.entries(state.hands.gote)) {
    if (count && count > 0) score -= (PIECE_VALUES[type] ?? 0) * count * 0.9;
  }

  return score;
}
