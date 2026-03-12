import { Position } from '../core/types';
import { BOARD_X, BOARD_Y, BOARD_Z } from '../core/constants';
import { Board } from '../core/board';
import { WorldPos } from './types';

// Cell spacing in world units
const CELL_SIZE = 1.0;
// Vertical gap between layers
const LAYER_GAP = 4.0;

// Board center: x=5, y=5 maps to wx=0, wz=0
// z=2 (middle layer) maps to wy=0

export function boardToWorld(pos: Position): WorldPos {
  return {
    wx: (pos.x - 5) * CELL_SIZE,
    wy: (pos.z - 2) * LAYER_GAP,
    wz: (pos.y - 5) * CELL_SIZE,
  };
}

export function worldToBoard(wx: number, wy: number, wz: number): Position | null {
  const x = Math.round(wx / CELL_SIZE + 5);
  const z = Math.round(wy / LAYER_GAP + 2);
  const y = Math.round(wz / CELL_SIZE + 5);

  const pos = { x, y, z };
  if (!Board.inBounds(pos)) return null;
  return pos;
}
