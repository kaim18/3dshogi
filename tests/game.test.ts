import { describe, it, expect } from 'vitest';
import {
  createInitialState, createCustomState,
  applyMove, getPiece, getHand,
  isInCheck, getLegalMoves, isCheckmate, isRepetition,
} from '@core/game';
import { Piece, Position } from '@core/types';

function p(owner: 'sente' | 'gote', type: Piece['type'], pos: Position) {
  return { piece: { type, owner }, pos };
}

describe('Game (pure functions)', () => {
  describe('initialization', () => {
    it('starts with sente turn', () => {
      expect(createInitialState().turn).toBe('sente');
    });

    it('has 62 pieces on board', () => {
      const s = createInitialState();
      let count = 0;
      for (let z = 1; z <= 3; z++)
        for (let y = 1; y <= 9; y++)
          for (let x = 1; x <= 9; x++)
            if (getPiece(s, { x, y, z })) count++;
      expect(count).toBe(62);
    });

    it('hands are empty', () => {
      const s = createInitialState();
      expect(getHand(s, 'sente', 'pawn')).toBe(0);
      expect(getHand(s, 'gote', 'pawn')).toBe(0);
    });
  });

  describe('applyMove - basic move', () => {
    it('moves a piece and switches turn', () => {
      const s0 = createInitialState();
      const s1 = applyMove(s0, { kind: 'move', from: { x: 5, y: 3, z: 2 }, to: { x: 5, y: 4, z: 2 }, promote: false });
      expect(getPiece(s1, { x: 5, y: 4, z: 2 })).toEqual({ type: 'pawn', owner: 'sente' });
      expect(getPiece(s1, { x: 5, y: 3, z: 2 })).toBeNull();
      expect(s1.turn).toBe('gote');
      // original state unchanged
      expect(getPiece(s0, { x: 5, y: 3, z: 2 })).toEqual({ type: 'pawn', owner: 'sente' });
      expect(s0.turn).toBe('sente');
    });
  });

  describe('applyMove - capture', () => {
    it('captures enemy piece and adds to hand', () => {
      const s0 = createCustomState({
        pieces: [
          p('sente', 'king', { x: 5, y: 1, z: 2 }),
          p('sente', 'rook', { x: 5, y: 5, z: 2 }),
          p('gote', 'king', { x: 5, y: 9, z: 2 }),
          p('gote', 'pawn', { x: 5, y: 6, z: 2 }),
        ],
      });
      const s1 = applyMove(s0, { kind: 'move', from: { x: 5, y: 5, z: 2 }, to: { x: 5, y: 6, z: 2 }, promote: false });
      expect(getHand(s1, 'sente', 'pawn')).toBe(1);
      expect(getPiece(s1, { x: 5, y: 6, z: 2 })).toEqual({ type: 'rook', owner: 'sente' });
    });

    it('captured promoted piece reverts to base type', () => {
      const s0 = createCustomState({
        pieces: [
          p('sente', 'king', { x: 5, y: 1, z: 2 }),
          p('sente', 'rook', { x: 5, y: 5, z: 2 }),
          p('gote', 'king', { x: 5, y: 9, z: 2 }),
          p('gote', 'p_pawn', { x: 5, y: 6, z: 2 }),
        ],
      });
      const s1 = applyMove(s0, { kind: 'move', from: { x: 5, y: 5, z: 2 }, to: { x: 5, y: 6, z: 2 }, promote: false });
      expect(getHand(s1, 'sente', 'pawn')).toBe(1);
      expect(getHand(s1, 'sente', 'p_pawn')).toBe(0);
    });
  });

  describe('applyMove - promotion', () => {
    it('promotes pawn entering enemy zone', () => {
      const s0 = createCustomState({
        pieces: [p('sente', 'king', { x: 5, y: 1, z: 2 }), p('sente', 'pawn', { x: 5, y: 6, z: 2 }), p('gote', 'king', { x: 5, y: 9, z: 2 })],
      });
      const s1 = applyMove(s0, { kind: 'move', from: { x: 5, y: 6, z: 2 }, to: { x: 5, y: 7, z: 2 }, promote: true });
      expect(getPiece(s1, { x: 5, y: 7, z: 2 })).toEqual({ type: 'p_pawn', owner: 'sente' });
    });

    it('does not promote when promote=false', () => {
      const s0 = createCustomState({
        pieces: [p('sente', 'king', { x: 5, y: 1, z: 2 }), p('sente', 'pawn', { x: 5, y: 6, z: 2 }), p('gote', 'king', { x: 5, y: 9, z: 2 })],
      });
      const s1 = applyMove(s0, { kind: 'move', from: { x: 5, y: 6, z: 2 }, to: { x: 5, y: 7, z: 2 }, promote: false });
      expect(getPiece(s1, { x: 5, y: 7, z: 2 })).toEqual({ type: 'pawn', owner: 'sente' });
    });

    it('force promotes pawn reaching last rank', () => {
      const s0 = createCustomState({
        pieces: [p('sente', 'king', { x: 5, y: 1, z: 2 }), p('sente', 'pawn', { x: 5, y: 8, z: 2 }), p('gote', 'king', { x: 5, y: 9, z: 1 })],
      });
      const s1 = applyMove(s0, { kind: 'move', from: { x: 5, y: 8, z: 2 }, to: { x: 5, y: 9, z: 2 }, promote: false });
      expect(getPiece(s1, { x: 5, y: 9, z: 2 })).toEqual({ type: 'p_pawn', owner: 'sente' });
    });

    it('force promotes knight reaching Y=8', () => {
      const s0 = createCustomState({
        pieces: [p('sente', 'king', { x: 5, y: 1, z: 2 }), p('sente', 'knight', { x: 5, y: 6, z: 2 }), p('gote', 'king', { x: 5, y: 9, z: 2 })],
      });
      const s1 = applyMove(s0, { kind: 'move', from: { x: 5, y: 6, z: 2 }, to: { x: 6, y: 8, z: 2 }, promote: false });
      expect(getPiece(s1, { x: 6, y: 8, z: 2 })!.type).toBe('p_knight');
    });

    it('force promotes lance reaching Y=9', () => {
      const s0 = createCustomState({
        pieces: [p('sente', 'king', { x: 5, y: 1, z: 2 }), p('sente', 'lance', { x: 5, y: 8, z: 2 }), p('gote', 'king', { x: 5, y: 9, z: 1 })],
      });
      const s1 = applyMove(s0, { kind: 'move', from: { x: 5, y: 8, z: 2 }, to: { x: 5, y: 9, z: 2 }, promote: false });
      expect(getPiece(s1, { x: 5, y: 9, z: 2 })!.type).toBe('p_lance');
    });

    it('gote force promotes pawn reaching Y=1', () => {
      const s0 = createCustomState({
        pieces: [p('sente', 'king', { x: 5, y: 1, z: 1 }), p('gote', 'king', { x: 5, y: 9, z: 2 }), p('gote', 'pawn', { x: 5, y: 2, z: 2 })],
        turn: 'gote',
      });
      const s1 = applyMove(s0, { kind: 'move', from: { x: 5, y: 2, z: 2 }, to: { x: 5, y: 1, z: 2 }, promote: false });
      expect(getPiece(s1, { x: 5, y: 1, z: 2 })!.type).toBe('p_pawn');
    });
  });

  describe('applyMove - drop', () => {
    it('drops a piece from hand', () => {
      const s0 = createCustomState({
        pieces: [p('sente', 'king', { x: 5, y: 1, z: 2 }), p('gote', 'king', { x: 5, y: 9, z: 2 })],
        hands: { sente: { pawn: 1 }, gote: {} },
      });
      const s1 = applyMove(s0, { kind: 'drop', pieceType: 'pawn', to: { x: 5, y: 5, z: 2 } });
      expect(getPiece(s1, { x: 5, y: 5, z: 2 })).toEqual({ type: 'pawn', owner: 'sente' });
      expect(getHand(s1, 'sente', 'pawn')).toBe(0);
      expect(s1.turn).toBe('gote');
    });
  });

  describe('isInCheck', () => {
    it('detects check on sente king', () => {
      const s = createCustomState({
        pieces: [p('sente', 'king', { x: 5, y: 1, z: 2 }), p('gote', 'king', { x: 5, y: 9, z: 2 }), p('gote', 'rook', { x: 5, y: 5, z: 2 })],
      });
      expect(isInCheck(s, 'sente')).toBe(true);
    });

    it('no check when path is blocked', () => {
      const s = createCustomState({
        pieces: [
          p('sente', 'king', { x: 5, y: 1, z: 2 }), p('sente', 'pawn', { x: 5, y: 3, z: 2 }),
          p('gote', 'king', { x: 5, y: 9, z: 2 }), p('gote', 'rook', { x: 5, y: 5, z: 2 }),
        ],
      });
      expect(isInCheck(s, 'sente')).toBe(false);
    });
  });

  describe('getLegalMoves', () => {
    it('filters out moves that leave own king in check', () => {
      const s = createCustomState({
        pieces: [p('sente', 'king', { x: 5, y: 1, z: 2 }), p('gote', 'king', { x: 5, y: 9, z: 2 }), p('gote', 'rook', { x: 5, y: 5, z: 2 })],
      });
      const moves = getLegalMoves(s);
      for (const m of moves) {
        if (m.kind === 'move') expect(m.to.x === 5 && m.to.z === 2).toBe(false);
      }
      expect(moves.length).toBeGreaterThan(0);
    });
  });

  describe('isCheckmate', () => {
    it('detects checkmate', () => {
      const s = createCustomState({
        pieces: [
          p('sente', 'king', { x: 1, y: 1, z: 1 }),
          p('gote', 'king', { x: 5, y: 9, z: 2 }),
          p('gote', 'rook', { x: 1, y: 9, z: 2 }),
          p('gote', 'rook', { x: 9, y: 1, z: 2 }),
          p('gote', 'rook', { x: 1, y: 1, z: 2 }),
          p('gote', 'gold', { x: 2, y: 1, z: 1 }),
          p('gote', 'gold', { x: 2, y: 2, z: 1 }),
          p('gote', 'gold', { x: 1, y: 2, z: 1 }),
        ],
      });
      expect(getLegalMoves(s).length).toBe(0);
      expect(isCheckmate(s)).toBe(true);
    });

    it('not checkmate if king can escape', () => {
      const s = createCustomState({
        pieces: [p('sente', 'king', { x: 5, y: 1, z: 2 }), p('gote', 'king', { x: 5, y: 9, z: 2 }), p('gote', 'rook', { x: 5, y: 5, z: 2 })],
      });
      expect(isCheckmate(s)).toBe(false);
    });
  });

  describe('repetition (千日手)', () => {
    it('detects fourfold repetition', () => {
      let s = createCustomState({
        pieces: [p('sente', 'king', { x: 5, y: 1, z: 2 }), p('gote', 'king', { x: 5, y: 9, z: 2 })],
      });
      for (let i = 0; i < 4; i++) {
        s = applyMove(s, { kind: 'move', from: { x: 5, y: 1, z: 2 }, to: { x: 4, y: 1, z: 2 }, promote: false });
        s = applyMove(s, { kind: 'move', from: { x: 5, y: 9, z: 2 }, to: { x: 4, y: 9, z: 2 }, promote: false });
        s = applyMove(s, { kind: 'move', from: { x: 4, y: 1, z: 2 }, to: { x: 5, y: 1, z: 2 }, promote: false });
        s = applyMove(s, { kind: 'move', from: { x: 4, y: 9, z: 2 }, to: { x: 5, y: 9, z: 2 }, promote: false });
      }
      expect(isRepetition(s)).toBe(true);
    });
  });

  describe('immutability', () => {
    it('applyMove does not mutate original state', () => {
      const s0 = createInitialState();
      const s1 = applyMove(s0, { kind: 'move', from: { x: 5, y: 3, z: 2 }, to: { x: 5, y: 4, z: 2 }, promote: false });
      // s0 is untouched
      expect(s0.turn).toBe('sente');
      expect(getPiece(s0, { x: 5, y: 3, z: 2 })).toEqual({ type: 'pawn', owner: 'sente' });
      expect(getPiece(s0, { x: 5, y: 4, z: 2 })).toBeNull();
      // s1 has the move applied
      expect(s1.turn).toBe('gote');
      expect(getPiece(s1, { x: 5, y: 4, z: 2 })).toEqual({ type: 'pawn', owner: 'sente' });
    });
  });
});
