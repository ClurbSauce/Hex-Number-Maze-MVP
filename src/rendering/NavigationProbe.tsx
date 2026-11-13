import { useState } from 'react';
import { directions, disk, distance, key } from '../engine/hex';
import SphereBoard from './SphereBoard';
import type { SphereSettings } from './projection';
/** Renderer-only diagnostic: arbitrary coordinates and six-direction moves, never a game-engine mutation. */
export default function NavigationProbe({ settings, onFallback }: { settings: SphereSettings; onFallback: () => void }) {
  const [center,setCenter]=useState({q:0,r:0});
  const [moves,setMoves]=useState(0);
  const cells=disk(center,2).map(h=>({ ...h, value: ((Math.imul(h.q,73856093)^Math.imul(h.r,19349663))>>>0)%40+1,
    active:key(h)===key(center),kind:distance(h,center)===1 ? 'forward' as const : null,visited:false,solution:false }));
  const move=(id:string)=>{const c=cells.find(c=>key(c)===id);if(c?.kind){setCenter({q:c.q,r:c.r});setMoves(n=>n+1);}};
  return <section className="navigation-probe" aria-label="Renderer-only navigation test">
    <p>Navigation test only: synthetic coordinate labels, no puzzle moves. The game timer above continues if already started.</p>
    <output>Center ({key(center)}) · {moves} test moves</output>
    <SphereBoard cells={cells} center={center} radius={2} resetKey="navigation-probe" onMove={move} settings={settings} onFallback={onFallback}/>
    <div className="probe-directions">{directions.map((d,i)=><button key={i} className="secondary-button" onClick={()=>move(key({q:center.q+d.q,r:center.r+d.r}))}>Direction {i+1} ({d.q},{d.r})</button>)}</div>
    <button className="secondary-button" onClick={()=>setCenter({q:1000000,r:-1000000})}>Jump to distant coordinates</button>
    <button className="secondary-button" onClick={()=>{setCenter({q:0,r:0});setMoves(0);}}>Reset navigation test</button>
  </section>;
}
