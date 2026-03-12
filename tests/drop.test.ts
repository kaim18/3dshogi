import { describe, it, expect } from 'vitest';
import { Board } from '@core/board';
import { getDropPositions } from '@core/drop';
import { Position, Piece } from '@core/types';

function posSet(positions: Position[]): Set<string> {
  return new Set(positions.map(p => `${p.x},${p.y},${p.z}`));
}

function p(owner: 'sente' | 'gote', type: Piece['type'], pos: Position) {
  return { piece: { type, owner }, pos };
}

describe('getDropPositions', () => {
  describe('Z constraint', () => {
    it('all drop positions are on Z=2', () => {
      const b = Board.from([]);
      for (const pos of getDropPositions(b, 'sente', 'gold')) expect(pos.z).toBe(2);
    });

    it('cannot drop on occupied square', () => {
      const b = Board.from([p('gote', 'pawn', { x: 5, y: 5, z: 2 })]);
      expect(posSet(getDropPositions(b, 'sente', 'gold')).has('5,5,2')).toBe(false);
    });

    it('gold can drop on any empty Z=2 square', () => {
      const b = Board.from([]);
      expect(getDropPositions(b, 'sente', 'gold').length).toBe(81);
    });
  });

  describe('Pawn restrictions', () => {
    it('sente cannot drop pawn on Y=9', () => {
      const b = Board.from([]);
      for (const pos of getDropPositions(b, 'sente', 'pawn')) expect(pos.y).not.toBe(9);
    });

    it('gote cannot drop pawn on Y=1', () => {
      const b = Board.from([]);
      for (const pos of getDropPositions(b, 'gote', 'pawn')) expect(pos.y).not.toBe(1);
    });

    it('nifu: cannot drop pawn on file with own unpromoted pawn on Z=2', () => {
      const b = Board.from([p('sente', 'pawn', { x: 5, y: 3, z: 2 })]);
      for (const pos of getDropPositions(b, 'sente', 'pawn')) expect(pos.x).not.toBe(5);
    });

    it('nifu: promoted pawn does not block', () => {
      const b = Board.from([p('sente', 'p_pawn', { x: 5, y: 3, z: 2 })]);
      expect(getDropPositions(b, 'sente', 'pawn').some(pos => pos.x === 5)).toBe(true);
    });

    it('nifu: enemy pawn does not block', () => {
      const b = Board.from([p('gote', 'pawn', { x: 5, y: 7, z: 2 })]);
      expect(getDropPositions(b, 'sente', 'pawn').some(pos => pos.x === 5)).toBe(true);
    });

    it('nifu: pawn on Z=1 or Z=3 does not block', () => {
      const b = Board.from([
        p('sente', 'pawn', { x: 5, y: 3, z: 1 }),
        p('sente', 'pawn', { x: 5, y: 3, z: 3 }),
      ]);
      expect(getDropPositions(b, 'sente', 'pawn').some(pos => pos.x === 5)).toBe(true);
    });
  });

  describe('Lance restrictions', () => {
    it('sente cannot drop lance on Y=9', () => {
      const b = Board.from([]);
      for (const pos of getDropPositions(b, 'sente', 'lance')) expect(pos.y).not.toBe(9);
    });

    it('gote cannot drop lance on Y=1', () => {
      const b = Board.from([]);
      for (const pos of getDropPositions(b, 'gote', 'lance')) expect(pos.y).not.toBe(1);
    });
  });

  describe('Knight restrictions', () => {
    it('sente cannot drop knight on Y=8 or Y=9', () => {
      const b = Board.from([]);
      for (const pos of getDropPositions(b, 'sente', 'knight')) {
        expect(pos.y).not.toBe(8);
        expect(pos.y).not.toBe(9);
      }
    });

    it('gote cannot drop knight on Y=1 or Y=2', () => {
      const b = Board.from([]);
      for (const pos of getDropPositions(b, 'gote', 'knight')) {
        expect(pos.y).not.toBe(1);
        expect(pos.y).not.toBe(2);
      }
    });
  });
});
