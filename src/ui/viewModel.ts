import { GameState, PieceType, Position } from '../core/types';
import { BOARD_X, BOARD_Y, BOARD_Z } from '../core/constants';
import { UIState, UIPhase, CellView, HandView, ViewData } from './types';

const HAND_DISPLAY_ORDER: PieceType[] = ['rook','bishop','gold','silver','knight','lance','pawn','kirin','houou'];

function posEq(a: Position, b: Position): boolean {
  return a.x === b.x && a.y === b.y && a.z === b.z;
}

export function getViewData(gs: GameState, ui: UIState): ViewData {
  const { phase } = ui;

  // Precompute highlight sets
  let selectedPos: Position | null = null;
  const moveTargets = new Set<string>();
  const dropTargets = new Set<string>();
  let animFrom: Position | null = null;

  if (phase.kind === 'pieceSelected') {
    selectedPos = phase.pos;
    for (const m of phase.moves) {
      if (m.kind === 'move') moveTargets.add(`${m.to.x},${m.to.y},${m.to.z}`);
    }
  } else if (phase.kind === 'handSelected') {
    for (const d of phase.drops) dropTargets.add(`${d.x},${d.y},${d.z}`);
  } else if (phase.kind === 'animating') {
    animFrom = phase.from;
  }

  const cells: CellView[] = [];
  for (let z = 1; z <= BOARD_Z; z++)
    for (let y = 1; y <= BOARD_Y; y++)
      for (let x = 1; x <= BOARD_X; x++) {
        const pos: Position = { x, y, z };
        const key = `${x},${y},${z}`;
        let highlight: CellView['highlight'] = 'none';
        if (selectedPos && posEq(pos, selectedPos)) highlight = 'selected';
        else if (moveTargets.has(key)) highlight = 'move';
        else if (dropTargets.has(key)) highlight = 'drop';

        cells.push({
          pos,
          piece: gs.board.get(pos),
          highlight,
          animating: animFrom !== null && posEq(pos, animFrom),
        });
      }

  const senteHand = buildHandView(gs, 'sente', ui);
  const goteHand = buildHandView(gs, 'gote', ui);

  return { cells, senteHand, goteHand, turn: gs.turn, phase: phase.kind, viewMode: ui.viewMode };
}

function buildHandView(gs: GameState, player: 'sente' | 'gote', ui: UIState): HandView[] {
  return HAND_DISPLAY_ORDER.map(pieceType => {
    const count = gs.hands[player][pieceType] || 0;
    const selectable = count > 0 && gs.turn === player && ui.phase.kind === 'idle';
    const selected = ui.phase.kind === 'handSelected'
      && (ui.phase as Extract<UIPhase, { kind: 'handSelected' }>).pieceType === pieceType
      && gs.turn === player;
    return { pieceType, count, selectable, selected };
  });
}
