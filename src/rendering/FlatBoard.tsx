import { key, pixel } from '../engine/hex';
import { cellLabel, type BoardProps } from './types';
const points = Array.from({ length: 6 }, (_, i) => {
  const a = Math.PI / 180 * (60 * i - 30);
  return `${42 * Math.cos(a)},${42 * Math.sin(a)}`;
}).join(' ');
export default function FlatBoard({ cells, center, radius, onMove }: BoardProps) {
  const scale = Math.max(1, (radius + 0.6) / 2.6);
  return <svg className="board" viewBox={`${-235 * scale} ${-218 * scale} ${470 * scale} ${436 * scale}`} role="group" aria-label={`Hexagonal maze. Current number ${cells.find(c => c.active)?.value}.`}>
    {cells.map(c => {
      const id = key(c), { x, y } = pixel({ q: c.q - center.q, r: c.r - center.r }, 46);
      return <g key={id} transform={`translate(${x},${y})`} role="button" aria-label={cellLabel(c)} aria-disabled={!c.kind} tabIndex={c.kind ? 0 : -1}
        onClick={() => { if (c.kind) onMove(id); }} onKeyDown={e => { if ((e.key === 'Enter' || e.key === ' ') && c.kind) { e.preventDefault(); onMove(id); } }}
        className={`hex ${c.active ? 'active' : c.kind === 'back' ? 'back' : c.kind === 'forward' ? 'next' : c.visited ? 'visited' : 'quiet'} ${c.solution ? 'solution' : ''}`}>
        <polygon points={points}/><text textAnchor="middle" dominantBaseline="central" y={c.active ? -3 : 0}>{c.value}</text>
        {c.active && <circle cy="22" r="2.4" className="position-dot"/>}
        {c.solution && !c.active && <circle cy="24" r="3" className="solution-dot"/>}
      </g>;
    })}
  </svg>;
}
