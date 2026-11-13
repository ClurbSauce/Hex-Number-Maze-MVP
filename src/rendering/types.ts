import type { Cell } from '../engine/generator';
import type { Hex } from '../engine/hex';
export interface BoardCell extends Cell {
  active: boolean;
  kind: 'forward' | 'back' | null;
  visited: boolean;
  solution: boolean;
}
/** Read-only presentation data. All movement validation stays with the caller. */
export interface BoardProps {
  cells: BoardCell[];
  center: Hex;
  radius: number;
  resetKey: string;
  onMove: (id: string) => void;
}
export const cellLabel = (c: BoardCell): string => `${c.value}, ${c.active ? 'current position' : c.kind === 'back' ? 'backtrack' : c.kind === 'forward' ? 'move forward' : 'unavailable'}`;
