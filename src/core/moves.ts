import { Board } from './board';
import { PIECE_DEFS } from './constants';
import { Position, Dir, Player } from './types';

function adjustDir(dir: Dir, owner: Player, forwardSensitive: boolean): Dir {
  if (!forwardSensitive || owner === 'sente') return dir;
  return [dir[0], -dir[1], dir[2]];
}

export function getMoveDests(board: Board, from: Position): Position[] {
  const piece = board.get(from);
  if (!piece) return [];

  const def = PIECE_DEFS[piece.type];
  const dests: Position[] = [];
  const seen = new Set<string>();

  function addIfValid(pos: Position): boolean {
    const key = `${pos.x},${pos.y},${pos.z}`;
    if (seen.has(key)) return false;
    if (!Board.inBounds(pos)) return false;
    const target = board.get(pos);
    if (target && target.owner === piece!.owner) return false;
    seen.add(key);
    dests.push(pos);
    return true;
  }

  function doStep(dirs: readonly Dir[]) {
    for (const rawDir of dirs) {
      const d = adjustDir(rawDir, piece!.owner, def.forwardSensitive);
      const pos = { x: from.x + d[0], y: from.y + d[1], z: from.z + d[2] };
      addIfValid(pos);
    }
  }

  function doSlide(dirs: readonly Dir[]) {
    for (const rawDir of dirs) {
      const d = adjustDir(rawDir, piece!.owner, def.forwardSensitive);
      for (let i = 1; ; i++) {
        const pos = { x: from.x + d[0] * i, y: from.y + d[1] * i, z: from.z + d[2] * i };
        if (!Board.inBounds(pos)) break;
        const target = board.get(pos);
        if (target) {
          if (target.owner !== piece!.owner) {
            const key = `${pos.x},${pos.y},${pos.z}`;
            if (!seen.has(key)) { seen.add(key); dests.push(pos); }
          }
          break;
        }
        const key = `${pos.x},${pos.y},${pos.z}`;
        if (!seen.has(key)) { seen.add(key); dests.push(pos); }
      }
    }
  }

  function doJump(dirs: Dir[]) {
    // Same as step but ignores pieces in between (already just 1 hop)
    doStep(dirs);
  }

  switch (def.move) {
    case 'step': doStep(def.dirs); break;
    case 'slide': doSlide(def.dirs); break;
    case 'jump': doJump(def.dirs); break;
    case 'slide+step':
      doSlide(def.slideDirs!);
      doStep(def.stepDirs!);
      break;
    case 'jump+step':
      doJump(def.jumpDirs!);
      doStep(def.stepDirs!);
      break;
  }

  return dests;
}
