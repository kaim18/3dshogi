import { Board } from './board';
import { BOARD_X, BOARD_Y } from './constants';
import { PieceType, Player, Position } from './types';

export function getDropPositions(board: Board, owner: Player, pieceType: PieceType): Position[] {
  const results: Position[] = [];
  const z = 2; // drops only on middle layer

  // Nifu: find columns with own unpromoted pawn on Z=2
  let nifuCols: Set<number> | null = null;
  if (pieceType === 'pawn') {
    nifuCols = new Set<number>();
    for (let x = 1; x <= BOARD_X; x++)
      for (let y = 1; y <= BOARD_Y; y++) {
        const p = board.get({ x, y, z });
        if (p && p.owner === owner && p.type === 'pawn') nifuCols.add(x);
      }
  }

  for (let y = 1; y <= BOARD_Y; y++) {
    // Row restrictions
    if (pieceType === 'pawn' || pieceType === 'lance') {
      if (owner === 'sente' && y === 9) continue;
      if (owner === 'gote' && y === 1) continue;
    }
    if (pieceType === 'knight') {
      if (owner === 'sente' && y >= 8) continue;
      if (owner === 'gote' && y <= 2) continue;
    }

    for (let x = 1; x <= BOARD_X; x++) {
      if (board.get({ x, y, z })) continue;
      if (nifuCols && nifuCols.has(x)) continue;
      results.push({ x, y, z });
    }
  }

  return results;
}
