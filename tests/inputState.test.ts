import { describe, it, expect } from 'vitest';
import { transition, initialUIState } from '../src/ui/inputState';
import { createCustomState, createInitialState, getLegalMoves, applyMove } from '@core/game';
import { Piece, Position, GameState } from '@core/types';
import { UIState } from '../src/ui/types';

function p(owner: 'sente' | 'gote', type: Piece['type'], pos: Position) {
  return { piece: { type, owner }, pos };
}

function basicGame(): GameState {
  return createCustomState({
    pieces: [
      p('sente', 'king', { x: 5, y: 1, z: 2 }),
      p('sente', 'pawn', { x: 5, y: 3, z: 2 }),
      p('gote', 'king', { x: 5, y: 9, z: 2 }),
      p('gote', 'pawn', { x: 5, y: 7, z: 2 }),
    ],
  });
}

describe('inputState transition', () => {
  describe('idle phase', () => {
    it('starts in idle', () => {
      expect(initialUIState.phase.kind).toBe('idle');
    });

    it('clicking own piece enters pieceSelected', () => {
      const gs = basicGame();
      const { uiState } = transition(initialUIState, { kind: 'clickCell', pos: { x: 5, y: 3, z: 2 } }, gs);
      expect(uiState.phase.kind).toBe('pieceSelected');
      if (uiState.phase.kind === 'pieceSelected') {
        expect(uiState.phase.pos).toEqual({ x: 5, y: 3, z: 2 });
        expect(uiState.phase.moves.length).toBeGreaterThan(0);
      }
    });

    it('clicking empty cell stays idle', () => {
      const gs = basicGame();
      const { uiState } = transition(initialUIState, { kind: 'clickCell', pos: { x: 1, y: 1, z: 2 } }, gs);
      expect(uiState.phase.kind).toBe('idle');
    });

    it('clicking enemy piece stays idle', () => {
      const gs = basicGame();
      const { uiState } = transition(initialUIState, { kind: 'clickCell', pos: { x: 5, y: 7, z: 2 } }, gs);
      expect(uiState.phase.kind).toBe('idle');
    });
  });

  describe('pieceSelected phase', () => {
    function selectPawn(gs: GameState): UIState {
      return transition(initialUIState, { kind: 'clickCell', pos: { x: 5, y: 3, z: 2 } }, gs).uiState;
    }

    it('clicking valid move target enters animating', () => {
      const gs = basicGame();
      const ui = selectPawn(gs);
      const { uiState } = transition(ui, { kind: 'clickCell', pos: { x: 5, y: 4, z: 2 } }, gs);
      expect(uiState.phase.kind).toBe('animating');
    });

    it('clicking invalid cell returns to idle', () => {
      const gs = basicGame();
      const ui = selectPawn(gs);
      const { uiState } = transition(ui, { kind: 'clickCell', pos: { x: 1, y: 1, z: 1 } }, gs);
      expect(uiState.phase.kind).toBe('idle');
    });

    it('clicking another own piece switches selection', () => {
      const gs = basicGame();
      const ui = selectPawn(gs);
      const { uiState } = transition(ui, { kind: 'clickCell', pos: { x: 5, y: 1, z: 2 } }, gs);
      expect(uiState.phase.kind).toBe('pieceSelected');
      if (uiState.phase.kind === 'pieceSelected') {
        expect(uiState.phase.pos).toEqual({ x: 5, y: 1, z: 2 });
      }
    });

    it('clicking same piece deselects to idle', () => {
      const gs = basicGame();
      const ui = selectPawn(gs);
      const { uiState } = transition(ui, { kind: 'clickCell', pos: { x: 5, y: 3, z: 2 } }, gs);
      expect(uiState.phase.kind).toBe('idle');
    });
  });

  describe('promotion', () => {
    it('move into enemy zone with promotable piece shows promoteConfirm', () => {
      const gs = createCustomState({
        pieces: [
          p('sente', 'king', { x: 5, y: 1, z: 2 }),
          p('sente', 'pawn', { x: 5, y: 6, z: 2 }),
          p('gote', 'king', { x: 5, y: 9, z: 2 }),
        ],
      });
      const ui1 = transition(initialUIState, { kind: 'clickCell', pos: { x: 5, y: 6, z: 2 } }, gs).uiState;
      const { uiState } = transition(ui1, { kind: 'clickCell', pos: { x: 5, y: 7, z: 2 } }, gs);
      expect(uiState.phase.kind).toBe('promoteConfirm');
    });

    it('confirmPromote true enters animating with promote move', () => {
      const gs = createCustomState({
        pieces: [
          p('sente', 'king', { x: 5, y: 1, z: 2 }),
          p('sente', 'pawn', { x: 5, y: 6, z: 2 }),
          p('gote', 'king', { x: 5, y: 9, z: 2 }),
        ],
      });
      const ui1 = transition(initialUIState, { kind: 'clickCell', pos: { x: 5, y: 6, z: 2 } }, gs).uiState;
      const ui2 = transition(ui1, { kind: 'clickCell', pos: { x: 5, y: 7, z: 2 } }, gs).uiState;
      const { uiState } = transition(ui2, { kind: 'confirmPromote', promote: true }, gs);
      expect(uiState.phase.kind).toBe('animating');
      if (uiState.phase.kind === 'animating') {
        expect(uiState.phase.move).toEqual({ kind: 'move', from: { x: 5, y: 6, z: 2 }, to: { x: 5, y: 7, z: 2 }, promote: true });
      }
    });
  });

  describe('animating phase', () => {
    it('animationEnd applies move and returns to idle', () => {
      const gs = basicGame();
      const ui1 = transition(initialUIState, { kind: 'clickCell', pos: { x: 5, y: 3, z: 2 } }, gs).uiState;
      const ui2 = transition(ui1, { kind: 'clickCell', pos: { x: 5, y: 4, z: 2 } }, gs).uiState;
      expect(ui2.phase.kind).toBe('animating');
      const result = transition(ui2, { kind: 'animationEnd' }, gs);
      expect(result.uiState.phase.kind).toBe('idle');
      expect(result.newGameState).toBeDefined();
      expect(result.newGameState!.turn).toBe('gote');
    });
  });

  describe('hand selection (drop)', () => {
    it('clicking hand piece with available drops enters handSelected', () => {
      const gs = createCustomState({
        pieces: [
          p('sente', 'king', { x: 5, y: 1, z: 2 }),
          p('gote', 'king', { x: 5, y: 9, z: 2 }),
        ],
        hands: { sente: { pawn: 1 }, gote: {} },
      });
      const { uiState } = transition(initialUIState, { kind: 'clickHand', pieceType: 'pawn' }, gs);
      expect(uiState.phase.kind).toBe('handSelected');
      if (uiState.phase.kind === 'handSelected') {
        expect(uiState.phase.pieceType).toBe('pawn');
        expect(uiState.phase.drops.length).toBeGreaterThan(0);
      }
    });

    it('clicking valid drop target enters animating', () => {
      const gs = createCustomState({
        pieces: [
          p('sente', 'king', { x: 5, y: 1, z: 2 }),
          p('gote', 'king', { x: 5, y: 9, z: 2 }),
        ],
        hands: { sente: { pawn: 1 }, gote: {} },
      });
      const ui1 = transition(initialUIState, { kind: 'clickHand', pieceType: 'pawn' }, gs).uiState;
      const { uiState } = transition(ui1, { kind: 'clickCell', pos: { x: 5, y: 5, z: 2 } }, gs);
      expect(uiState.phase.kind).toBe('animating');
    });
  });

  describe('view controls', () => {
    it('setViewMode changes view mode', () => {
      const gs = basicGame();
      const { uiState } = transition(initialUIState, { kind: 'setViewMode', mode: { kind: 'slice', z: 3 } }, gs);
      expect(uiState.viewMode).toEqual({ kind: 'slice', z: 3 });
    });

    it('flipViewSide toggles view side', () => {
      const gs = basicGame();
      const { uiState } = transition(initialUIState, { kind: 'flipViewSide' }, gs);
      expect(uiState.viewSide).toBe('gote');
    });
  });

  describe('aiMove', () => {
    it('aiMove from idle applies move and enters animating with applied=true', () => {
      const gs = createInitialState();
      const moves = getLegalMoves(gs);
      const move = moves.find(m => m.kind === 'move')!;
      const { uiState, newGameState } = transition(initialUIState, { kind: 'aiMove', move }, gs);
      expect(uiState.phase.kind).toBe('animating');
      if (uiState.phase.kind === 'animating') {
        expect(uiState.phase.applied).toBe(true);
      }
      expect(newGameState).toBeDefined();
      expect(newGameState!.turn).toBe('gote');
    });

    it('animationEnd after applied AI move returns to idle without re-applying', () => {
      const gs = createInitialState();
      const moves = getLegalMoves(gs);
      const move = moves.find(m => m.kind === 'move')!;
      const r1 = transition(initialUIState, { kind: 'aiMove', move }, gs);
      const r2 = transition(r1.uiState, { kind: 'animationEnd' }, r1.newGameState!);
      expect(r2.uiState.phase.kind).toBe('idle');
      expect(r2.newGameState).toBeUndefined();
    });
  });
});
