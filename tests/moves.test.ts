import { describe, it, expect } from 'vitest';
import { Board } from '@core/board';
import { getMoveDests } from '@core/moves';
import { Position, Piece } from '@core/types';

function posSet(positions: Position[]): Set<string> {
  return new Set(positions.map(p => `${p.x},${p.y},${p.z}`));
}

function p(owner: 'sente' | 'gote', type: Piece['type'], pos: Position) {
  return { piece: { type, owner }, pos };
}

describe('getMoveDests', () => {
  describe('King', () => {
    it('king in center of board has 26 moves', () => {
      const b = Board.from([p('sente', 'king', { x: 5, y: 5, z: 2 })]);
      expect(getMoveDests(b, { x: 5, y: 5, z: 2 }).length).toBe(26);
    });

    it('king in corner has limited moves', () => {
      const b = Board.from([p('sente', 'king', { x: 1, y: 1, z: 1 })]);
      expect(getMoveDests(b, { x: 1, y: 1, z: 1 }).length).toBe(7);
    });

    it('king cannot move to square occupied by own piece', () => {
      const b = Board.from([
        p('sente', 'king', { x: 5, y: 5, z: 2 }),
        p('sente', 'pawn', { x: 5, y: 6, z: 2 }),
      ]);
      const dests = getMoveDests(b, { x: 5, y: 5, z: 2 });
      expect(posSet(dests).has('5,6,2')).toBe(false);
      expect(dests.length).toBe(25);
    });

    it('king can capture enemy piece', () => {
      const b = Board.from([
        p('sente', 'king', { x: 5, y: 5, z: 2 }),
        p('gote', 'pawn', { x: 5, y: 6, z: 2 }),
      ]);
      const dests = getMoveDests(b, { x: 5, y: 5, z: 2 });
      expect(posSet(dests).has('5,6,2')).toBe(true);
      expect(dests.length).toBe(26);
    });
  });

  describe('Pawn', () => {
    it('sente pawn moves forward (y+1)', () => {
      const b = Board.from([p('sente', 'pawn', { x: 5, y: 3, z: 2 })]);
      expect(getMoveDests(b, { x: 5, y: 3, z: 2 })).toEqual([{ x: 5, y: 4, z: 2 }]);
    });

    it('gote pawn moves forward (y-1)', () => {
      const b = Board.from([p('gote', 'pawn', { x: 5, y: 7, z: 2 })]);
      expect(getMoveDests(b, { x: 5, y: 7, z: 2 })).toEqual([{ x: 5, y: 6, z: 2 }]);
    });

    it('pawn at edge of board has no moves', () => {
      const b = Board.from([p('sente', 'pawn', { x: 5, y: 9, z: 2 })]);
      expect(getMoveDests(b, { x: 5, y: 9, z: 2 }).length).toBe(0);
    });
  });

  describe('Rook (slide)', () => {
    it('rook on empty board has correct reach', () => {
      const b = Board.from([p('sente', 'rook', { x: 5, y: 5, z: 2 })]);
      expect(getMoveDests(b, { x: 5, y: 5, z: 2 }).length).toBe(18);
    });

    it('rook is blocked by own piece', () => {
      const b = Board.from([
        p('sente', 'rook', { x: 5, y: 5, z: 2 }),
        p('sente', 'pawn', { x: 5, y: 7, z: 2 }),
      ]);
      const dests = getMoveDests(b, { x: 5, y: 5, z: 2 });
      expect(posSet(dests).has('5,6,2')).toBe(true);
      expect(posSet(dests).has('5,7,2')).toBe(false);
      expect(posSet(dests).has('5,8,2')).toBe(false);
    });

    it('rook can capture enemy piece but stops there', () => {
      const b = Board.from([
        p('sente', 'rook', { x: 5, y: 5, z: 2 }),
        p('gote', 'pawn', { x: 5, y: 7, z: 2 }),
      ]);
      const dests = getMoveDests(b, { x: 5, y: 5, z: 2 });
      expect(posSet(dests).has('5,7,2')).toBe(true);
      expect(posSet(dests).has('5,8,2')).toBe(false);
    });
  });

  describe('Bishop (slide)', () => {
    it('bishop on empty board at center z=2', () => {
      const b = Board.from([p('sente', 'bishop', { x: 5, y: 5, z: 2 })]);
      expect(getMoveDests(b, { x: 5, y: 5, z: 2 }).length).toBe(24);
    });
  });

  describe('Lance (slide, forward only)', () => {
    it('sente lance slides forward', () => {
      const b = Board.from([p('sente', 'lance', { x: 5, y: 1, z: 2 })]);
      expect(getMoveDests(b, { x: 5, y: 1, z: 2 }).length).toBe(8);
    });

    it('gote lance slides backward (y-)', () => {
      const b = Board.from([p('gote', 'lance', { x: 5, y: 9, z: 2 })]);
      expect(getMoveDests(b, { x: 5, y: 9, z: 2 }).length).toBe(8);
    });
  });

  describe('Knight (jump)', () => {
    it('sente knight has 4 forward jumps from center', () => {
      const b = Board.from([p('sente', 'knight', { x: 5, y: 5, z: 2 })]);
      const dests = getMoveDests(b, { x: 5, y: 5, z: 2 });
      const s = posSet(dests);
      expect(s.has('6,7,2')).toBe(true);
      expect(s.has('4,7,2')).toBe(true);
      expect(s.has('5,7,3')).toBe(true);
      expect(s.has('5,7,1')).toBe(true);
      expect(dests.length).toBe(4);
    });

    it('knight jumps over pieces', () => {
      const b = Board.from([
        p('sente', 'knight', { x: 5, y: 5, z: 2 }),
        p('sente', 'pawn', { x: 5, y: 6, z: 2 }),
      ]);
      expect(getMoveDests(b, { x: 5, y: 5, z: 2 }).length).toBe(4);
    });

    it('gote knight jumps in y- direction', () => {
      const b = Board.from([p('gote', 'knight', { x: 5, y: 5, z: 2 })]);
      const s = posSet(getMoveDests(b, { x: 5, y: 5, z: 2 }));
      expect(s.has('6,3,2')).toBe(true);
      expect(s.has('4,3,2')).toBe(true);
      expect(s.has('5,3,3')).toBe(true);
      expect(s.has('5,3,1')).toBe(true);
    });
  });

  describe('Gold', () => {
    it('sente gold has 10 moves from center', () => {
      const b = Board.from([p('sente', 'gold', { x: 5, y: 5, z: 2 })]);
      expect(getMoveDests(b, { x: 5, y: 5, z: 2 }).length).toBe(10);
    });

    it('sente gold forward edge-diags are correct', () => {
      const b = Board.from([p('sente', 'gold', { x: 5, y: 5, z: 2 })]);
      const s = posSet(getMoveDests(b, { x: 5, y: 5, z: 2 }));
      expect(s.has('6,6,2')).toBe(true);
      expect(s.has('4,6,2')).toBe(true);
      expect(s.has('5,6,3')).toBe(true);
      expect(s.has('5,6,1')).toBe(true);
      expect(s.has('6,4,2')).toBe(false);
      expect(s.has('4,4,2')).toBe(false);
    });
  });

  describe('Silver', () => {
    it('sente silver has 13 moves from center z=2', () => {
      const b = Board.from([p('sente', 'silver', { x: 5, y: 5, z: 2 })]);
      expect(getMoveDests(b, { x: 5, y: 5, z: 2 }).length).toBe(13);
    });
  });

  describe('Kirin (space-diagonal slide)', () => {
    it('kirin at (5,5,2) slides on space diagonals', () => {
      const b = Board.from([p('sente', 'kirin', { x: 5, y: 5, z: 2 })]);
      expect(getMoveDests(b, { x: 5, y: 5, z: 2 }).length).toBe(8);
    });

    it('kirin at z=1 can slide further upward', () => {
      const b = Board.from([p('sente', 'kirin', { x: 5, y: 5, z: 1 })]);
      expect(getMoveDests(b, { x: 5, y: 5, z: 1 }).length).toBe(8);
    });
  });

  describe('Houou (jump)', () => {
    it('houou at center has 16 reachable destinations', () => {
      const b = Board.from([p('sente', 'houou', { x: 5, y: 5, z: 2 })]);
      expect(getMoveDests(b, { x: 5, y: 5, z: 2 }).length).toBe(16);
    });
  });

  describe('Promoted Rook (dragon)', () => {
    it('has slide + step moves', () => {
      const b = Board.from([p('sente', 'p_rook', { x: 5, y: 5, z: 2 })]);
      expect(getMoveDests(b, { x: 5, y: 5, z: 2 }).length).toBe(38);
    });
  });

  describe('Promoted Bishop (horse)', () => {
    it('has slide + step moves', () => {
      const b = Board.from([p('sente', 'p_bishop', { x: 5, y: 5, z: 2 })]);
      expect(getMoveDests(b, { x: 5, y: 5, z: 2 }).length).toBe(38);
    });
  });
});
