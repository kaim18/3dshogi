import { describe, it, expect } from 'vitest';
import { boardToWorld, worldToBoard } from '../src/ui/coords';

describe('coords', () => {
  describe('boardToWorld', () => {
    it('(1,1,1) maps to a valid world position', () => {
      const w = boardToWorld({ x: 1, y: 1, z: 1 });
      expect(w).toHaveProperty('wx');
      expect(w).toHaveProperty('wy');
      expect(w).toHaveProperty('wz');
    });

    it('adjacent cells differ by consistent spacing', () => {
      const a = boardToWorld({ x: 1, y: 1, z: 1 });
      const b = boardToWorld({ x: 2, y: 1, z: 1 });
      const c = boardToWorld({ x: 3, y: 1, z: 1 });
      const dx1 = b.wx - a.wx;
      const dx2 = c.wx - b.wx;
      expect(dx1).toBeCloseTo(dx2);
    });

    it('z layers are separated vertically', () => {
      const z1 = boardToWorld({ x: 5, y: 5, z: 1 });
      const z2 = boardToWorld({ x: 5, y: 5, z: 2 });
      const z3 = boardToWorld({ x: 5, y: 5, z: 3 });
      expect(z2.wy).toBeGreaterThan(z1.wy);
      expect(z3.wy).toBeGreaterThan(z2.wy);
    });

    it('center of board (5,5,2) maps to origin area', () => {
      const w = boardToWorld({ x: 5, y: 5, z: 2 });
      expect(Math.abs(w.wx)).toBeLessThan(1);
      expect(Math.abs(w.wz)).toBeLessThan(1);
    });
  });

  describe('worldToBoard', () => {
    it('round-trips for all valid positions', () => {
      for (let z = 1; z <= 3; z++)
        for (let y = 1; y <= 9; y++)
          for (let x = 1; x <= 9; x++) {
            const w = boardToWorld({ x, y, z });
            const pos = worldToBoard(w.wx, w.wy, w.wz);
            expect(pos).toEqual({ x, y, z });
          }
    });

    it('returns null for out-of-bounds world coords', () => {
      expect(worldToBoard(999, 999, 999)).toBeNull();
    });
  });
});
