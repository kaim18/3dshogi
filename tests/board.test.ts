import { describe, it, expect } from 'vitest';
import { Board } from '@core/board';
import { Piece, Position } from '@core/types';

function p(owner: 'sente' | 'gote', type: Piece['type'], pos: Position) {
  return { piece: { type, owner }, pos };
}

describe('Board (immutable)', () => {
  describe('basics', () => {
    it('empty board returns null', () => {
      expect(Board.empty().get({ x: 5, y: 5, z: 2 })).toBeNull();
    });

    it('set returns new board with piece', () => {
      const b1 = Board.empty();
      const b2 = b1.set({ x: 5, y: 1, z: 2 }, { type: 'king', owner: 'sente' });
      expect(b2.get({ x: 5, y: 1, z: 2 })).toEqual({ type: 'king', owner: 'sente' });
      // original unchanged
      expect(b1.get({ x: 5, y: 1, z: 2 })).toBeNull();
    });

    it('remove returns new board without piece', () => {
      const b1 = Board.empty().set({ x: 5, y: 1, z: 2 }, { type: 'king', owner: 'sente' });
      const b2 = b1.remove({ x: 5, y: 1, z: 2 });
      expect(b2.get({ x: 5, y: 1, z: 2 })).toBeNull();
      // original unchanged
      expect(b1.get({ x: 5, y: 1, z: 2 })).toEqual({ type: 'king', owner: 'sente' });
    });

    it('rejects out-of-bounds coordinates', () => {
      const b = Board.empty();
      expect(b.get({ x: 0, y: 1, z: 2 })).toBeNull();
      expect(b.get({ x: 10, y: 1, z: 2 })).toBeNull();
      expect(b.get({ x: 5, y: 0, z: 2 })).toBeNull();
      expect(b.get({ x: 5, y: 1, z: 0 })).toBeNull();
      expect(b.get({ x: 5, y: 1, z: 4 })).toBeNull();
    });
  });

  describe('Board.from', () => {
    it('creates board from piece list', () => {
      const b = Board.from([
        p('sente', 'king', { x: 5, y: 1, z: 2 }),
        p('gote', 'king', { x: 5, y: 9, z: 2 }),
      ]);
      expect(b.get({ x: 5, y: 1, z: 2 })).toEqual({ type: 'king', owner: 'sente' });
      expect(b.get({ x: 5, y: 9, z: 2 })).toEqual({ type: 'king', owner: 'gote' });
      expect(b.get({ x: 5, y: 5, z: 2 })).toBeNull();
    });
  });

  describe('inBounds', () => {
    it('validates coordinates', () => {
      expect(Board.inBounds({ x: 1, y: 1, z: 1 })).toBe(true);
      expect(Board.inBounds({ x: 9, y: 9, z: 3 })).toBe(true);
      expect(Board.inBounds({ x: 0, y: 1, z: 1 })).toBe(false);
      expect(Board.inBounds({ x: 5, y: 5, z: 4 })).toBe(false);
    });
  });

  describe('initial setup', () => {
    it('places correct number of pieces', () => {
      const b = Board.createInitial();
      let count = 0;
      for (let z = 1; z <= 3; z++)
        for (let y = 1; y <= 9; y++)
          for (let x = 1; x <= 9; x++)
            if (b.get({ x, y, z })) count++;
      expect(count).toBe(62);
    });

    it('sente king at (5,1,2)', () => {
      expect(Board.createInitial().get({ x: 5, y: 1, z: 2 })).toEqual({ type: 'king', owner: 'sente' });
    });

    it('gote king at (5,9,2)', () => {
      expect(Board.createInitial().get({ x: 5, y: 9, z: 2 })).toEqual({ type: 'king', owner: 'gote' });
    });

    it('sente kirin at (5,1,3)', () => {
      expect(Board.createInitial().get({ x: 5, y: 1, z: 3 })).toEqual({ type: 'kirin', owner: 'sente' });
    });

    it('sente houou at (5,1,1)', () => {
      expect(Board.createInitial().get({ x: 5, y: 1, z: 1 })).toEqual({ type: 'houou', owner: 'sente' });
    });

    it('gote houou at (5,9,3)', () => {
      expect(Board.createInitial().get({ x: 5, y: 9, z: 3 })).toEqual({ type: 'houou', owner: 'gote' });
    });

    it('gote kirin at (5,9,1)', () => {
      expect(Board.createInitial().get({ x: 5, y: 9, z: 1 })).toEqual({ type: 'kirin', owner: 'gote' });
    });

    it('sente pawns on Z=2 Y=3', () => {
      const b = Board.createInitial();
      for (let x = 1; x <= 9; x++)
        expect(b.get({ x, y: 3, z: 2 })).toEqual({ type: 'pawn', owner: 'sente' });
    });

    it('sente pawns on Z=3 Y=3 (odd files)', () => {
      const b = Board.createInitial();
      for (let x = 1; x <= 9; x += 2)
        expect(b.get({ x, y: 3, z: 3 })).toEqual({ type: 'pawn', owner: 'sente' });
      for (let x = 2; x <= 8; x += 2)
        expect(b.get({ x, y: 3, z: 3 })).toBeNull();
    });

    it('sente pawns on Z=1 Y=3 (even files)', () => {
      const b = Board.createInitial();
      for (let x = 2; x <= 8; x += 2)
        expect(b.get({ x, y: 3, z: 1 })).toEqual({ type: 'pawn', owner: 'sente' });
      for (let x = 1; x <= 9; x += 2)
        expect(b.get({ x, y: 3, z: 1 })).toBeNull();
    });

    it('point symmetry holds for all pieces', () => {
      const b = Board.createInitial();
      for (let z = 1; z <= 3; z++)
        for (let y = 1; y <= 9; y++)
          for (let x = 1; x <= 9; x++) {
            const piece = b.get({ x, y, z });
            if (piece && piece.owner === 'sente') {
              const mirror = b.get({ x: 10 - x, y: 10 - y, z: 4 - z });
              expect(mirror).not.toBeNull();
              expect(mirror!.type).toBe(piece.type);
              expect(mirror!.owner).toBe('gote');
            }
          }
    });
  });
});
