import { describe, it, expect } from 'vitest';
import { randomAI } from '../src/ai/random';
import { evaluate } from '../src/ai/eval';
import { createMinimaxAI } from '../src/ai/minimax';
import { createInitialState, createCustomState, getLegalMoves, applyMove, isCheckmate } from '../src/core/game';
import type { GameState, MoveAction } from '../src/core/types';

describe('randomAI', () => {
  it('returns a move from the legal moves list', () => {
    const state = createInitialState();
    const moves = getLegalMoves(state);
    const chosen = randomAI(state, moves);
    expect(moves).toContainEqual(chosen);
  });

  it('throws when no legal moves', () => {
    const state = createInitialState();
    expect(() => randomAI(state, [])).toThrow('No legal moves');
  });

  it('returns different moves over many calls (not deterministic)', () => {
    const state = createInitialState();
    const moves = getLegalMoves(state);
    const chosen = new Set<string>();
    for (let i = 0; i < 50; i++) {
      chosen.add(JSON.stringify(randomAI(state, moves)));
    }
    expect(chosen.size).toBeGreaterThan(1);
  });
});

describe('AI game loop', () => {
  it('can play a full game with random AI vs random AI without errors', () => {
    let state: GameState = createInitialState();
    for (let i = 0; i < 200; i++) {
      const moves = getLegalMoves(state);
      if (moves.length === 0) break;
      const move = randomAI(state, moves);
      state = applyMove(state, move);
      if (isCheckmate(state)) break;
    }
    // Just verify it didn't throw
    expect(state.turn).toBeDefined();
  });

  it('every AI move is legal', () => {
    let state: GameState = createInitialState();
    for (let i = 0; i < 50; i++) {
      const moves = getLegalMoves(state);
      if (moves.length === 0) break;
      const move = randomAI(state, moves);
      // Verify the chosen move is in the legal moves list
      expect(moves).toContainEqual(move);
      state = applyMove(state, move);
    }
  });
});

describe('evaluate', () => {
  it('initial position is roughly equal', () => {
    const state = createInitialState();
    expect(Math.abs(evaluate(state))).toBeLessThan(0.1);
  });

  it('sente up a rook scores positive', () => {
    // Give sente a rook in hand
    const state = createCustomState({
      pieces: [
        { piece: { type: 'king', owner: 'sente' }, pos: { x: 5, y: 9, z: 2 } },
        { piece: { type: 'king', owner: 'gote' }, pos: { x: 5, y: 1, z: 2 } },
      ],
      hands: { sente: { rook: 1 }, gote: {} },
    });
    expect(evaluate(state)).toBeGreaterThan(0);
  });
});

describe('minimaxAI', () => {
  const ai = createMinimaxAI(2);

  it('returns a legal move', () => {
    const state = createInitialState();
    const moves = getLegalMoves(state);
    const chosen = ai(state, moves);
    expect(moves).toContainEqual(chosen);
  });

  it('captures a free piece (depth 1)', () => {
    // Rook can capture undefended pawn; pawn placed so capture is best
    const ai1 = createMinimaxAI(1);
    const state = createCustomState({
      pieces: [
        { piece: { type: 'king', owner: 'sente' }, pos: { x: 5, y: 1, z: 2 } },
        { piece: { type: 'rook', owner: 'sente' }, pos: { x: 3, y: 5, z: 2 } },
        { piece: { type: 'king', owner: 'gote' }, pos: { x: 5, y: 9, z: 2 } },
        { piece: { type: 'pawn', owner: 'gote' }, pos: { x: 3, y: 6, z: 2 } },
      ],
      turn: 'sente',
    });
    const moves = getLegalMoves(state);
    const chosen = ai1(state, moves);
    expect(chosen.kind).toBe('move');
    if (chosen.kind === 'move') {
      expect(chosen.to).toEqual({ x: 3, y: 6, z: 2 });
    }
  });

  it('prefers promoting a piece', () => {
    const ai1 = createMinimaxAI(1);
    // Gote pawn at y=4 can move to y=3 (sente territory = gote's enemy zone) and promote
    const state = createCustomState({
      pieces: [
        { piece: { type: 'king', owner: 'sente' }, pos: { x: 5, y: 1, z: 1 } },
        { piece: { type: 'king', owner: 'gote' }, pos: { x: 5, y: 9, z: 2 } },
        { piece: { type: 'pawn', owner: 'gote' }, pos: { x: 3, y: 4, z: 2 } },
      ],
      turn: 'gote',
    });
    const moves = getLegalMoves(state);
    const chosen = ai1(state, moves);
    expect(chosen.kind).toBe('move');
    if (chosen.kind === 'move') {
      expect(chosen.promote).toBe(true);
    }
  });

  it('can play a game without errors', () => {
    let state: GameState = createInitialState();
    for (let i = 0; i < 20; i++) {
      const moves = getLegalMoves(state);
      if (moves.length === 0) break;
      const move = ai(state, moves);
      expect(moves).toContainEqual(move);
      state = applyMove(state, move);
      if (isCheckmate(state)) break;
    }
    expect(state.turn).toBeDefined();
  });
});
