import { describe, it, expect } from 'vitest';
import { getViewData } from '../src/ui/viewModel';
import { createCustomState, createInitialState } from '@core/game';
import { initialUIState } from '../src/ui/inputState';
import { transition } from '../src/ui/inputState';
import { Piece, Position } from '@core/types';

function p(owner: 'sente' | 'gote', type: Piece['type'], pos: Position) {
  return { piece: { type, owner }, pos };
}

describe('getViewData', () => {
  it('returns all 243 cells', () => {
    const gs = createInitialState();
    const vd = getViewData(gs, initialUIState);
    expect(vd.cells.length).toBe(243);
  });

  it('cells have correct pieces from game state', () => {
    const gs = createInitialState();
    const vd = getViewData(gs, initialUIState);
    const kingCell = vd.cells.find(c => c.pos.x === 5 && c.pos.y === 1 && c.pos.z === 2);
    expect(kingCell?.piece).toEqual({ type: 'king', owner: 'sente' });
  });

  it('no highlights in idle phase', () => {
    const gs = createInitialState();
    const vd = getViewData(gs, initialUIState);
    expect(vd.cells.every(c => c.highlight === 'none')).toBe(true);
  });

  it('selected piece is highlighted', () => {
    const gs = createCustomState({
      pieces: [
        p('sente', 'king', { x: 5, y: 1, z: 2 }),
        p('sente', 'pawn', { x: 5, y: 3, z: 2 }),
        p('gote', 'king', { x: 5, y: 9, z: 2 }),
      ],
    });
    const ui = transition(initialUIState, { kind: 'clickCell', pos: { x: 5, y: 3, z: 2 } }, gs).uiState;
    const vd = getViewData(gs, ui);
    const selected = vd.cells.find(c => c.pos.x === 5 && c.pos.y === 3 && c.pos.z === 2);
    expect(selected?.highlight).toBe('selected');
  });

  it('move targets are highlighted', () => {
    const gs = createCustomState({
      pieces: [
        p('sente', 'king', { x: 5, y: 1, z: 2 }),
        p('sente', 'pawn', { x: 5, y: 3, z: 2 }),
        p('gote', 'king', { x: 5, y: 9, z: 2 }),
      ],
    });
    const ui = transition(initialUIState, { kind: 'clickCell', pos: { x: 5, y: 3, z: 2 } }, gs).uiState;
    const vd = getViewData(gs, ui);
    const target = vd.cells.find(c => c.pos.x === 5 && c.pos.y === 4 && c.pos.z === 2);
    expect(target?.highlight).toBe('move');
  });

  it('drop targets are highlighted in handSelected', () => {
    const gs = createCustomState({
      pieces: [
        p('sente', 'king', { x: 5, y: 1, z: 2 }),
        p('gote', 'king', { x: 5, y: 9, z: 2 }),
      ],
      hands: { sente: { gold: 1 }, gote: {} },
    });
    const ui = transition(initialUIState, { kind: 'clickHand', pieceType: 'gold' }, gs).uiState;
    const vd = getViewData(gs, ui);
    const drops = vd.cells.filter(c => c.highlight === 'drop');
    expect(drops.length).toBeGreaterThan(0);
    expect(drops.every(c => c.pos.z === 2)).toBe(true);
  });

  it('animating cell is marked', () => {
    const gs = createCustomState({
      pieces: [
        p('sente', 'king', { x: 5, y: 1, z: 2 }),
        p('sente', 'pawn', { x: 5, y: 3, z: 2 }),
        p('gote', 'king', { x: 5, y: 9, z: 2 }),
      ],
    });
    const ui1 = transition(initialUIState, { kind: 'clickCell', pos: { x: 5, y: 3, z: 2 } }, gs).uiState;
    const ui2 = transition(ui1, { kind: 'clickCell', pos: { x: 5, y: 4, z: 2 } }, gs).uiState;
    const vd = getViewData(gs, ui2);
    const fromCell = vd.cells.find(c => c.pos.x === 5 && c.pos.y === 3 && c.pos.z === 2);
    expect(fromCell?.animating).toBe(true);
  });

  it('hand view shows correct counts', () => {
    const gs = createCustomState({
      pieces: [
        p('sente', 'king', { x: 5, y: 1, z: 2 }),
        p('gote', 'king', { x: 5, y: 9, z: 2 }),
      ],
      hands: { sente: { pawn: 3, gold: 1 }, gote: { silver: 2 } },
    });
    const vd = getViewData(gs, initialUIState);
    const sentePawn = vd.senteHand.find(h => h.pieceType === 'pawn');
    expect(sentePawn?.count).toBe(3);
    const gotesilver = vd.goteHand.find(h => h.pieceType === 'silver');
    expect(gotesilver?.count).toBe(2);
  });

  it('turn reflects game state', () => {
    const gs = createInitialState();
    expect(getViewData(gs, initialUIState).turn).toBe('sente');
  });
});
