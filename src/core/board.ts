import { Piece, Position } from './types';
import { BOARD_X, BOARD_Y, BOARD_Z, getInitialPieces } from './constants';

// Immutable 3D board. All mutation methods return a new Board.
export class Board {
  private readonly cells: readonly (readonly (readonly (Piece | null)[])[])[];

  private constructor(cells: (Piece | null)[][][]) {
    this.cells = cells;
  }

  static empty(): Board {
    const cells = Array.from({ length: BOARD_Z }, () =>
      Array.from({ length: BOARD_Y }, () =>
        Array.from<Piece | null>({ length: BOARD_X }).fill(null)
      )
    );
    return new Board(cells);
  }

  static inBounds(pos: Position): boolean {
    return pos.x >= 1 && pos.x <= BOARD_X
      && pos.y >= 1 && pos.y <= BOARD_Y
      && pos.z >= 1 && pos.z <= BOARD_Z;
  }

  get(pos: Position): Piece | null {
    if (!Board.inBounds(pos)) return null;
    return this.cells[pos.z - 1][pos.y - 1][pos.x - 1];
  }

  set(pos: Position, piece: Piece): Board {
    if (!Board.inBounds(pos)) return this;
    const newCells = this.copyCells();
    newCells[pos.z - 1][pos.y - 1][pos.x - 1] = piece;
    return new Board(newCells);
  }

  remove(pos: Position): Board {
    if (!Board.inBounds(pos)) return this;
    const newCells = this.copyCells();
    newCells[pos.z - 1][pos.y - 1][pos.x - 1] = null;
    return new Board(newCells);
  }

  private copyCells(): (Piece | null)[][][] {
    return this.cells.map(layer =>
      layer.map(row => [...row])
    );
  }

  static from(pieces: { piece: Piece; pos: Position }[]): Board {
    let b = Board.empty();
    for (const { piece, pos } of pieces) {
      b = b.set(pos, piece);
    }
    return b;
  }

  static createInitial(): Board {
    const placements = getInitialPieces().map(({ piece, x, y, z }) => ({
      piece,
      pos: { x, y, z } as Position,
    }));
    return Board.from(placements);
  }
}
