import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { distance, key } from '../engine/hex';
import { roundHex, scoutOffset } from './scouting';
import { cellLabel, type BoardCell, type BoardProps } from './types';
import { hexTriangles, localPosition, project, sampleRoll, type Roll, type SphereSettings } from './projection';

interface Props extends BoardProps {
  settings: SphereSettings; onFallback: () => void;
  scout?: { active: boolean; available: boolean; cells: BoardCell[]; onStart: () => boolean };
}
const palette = (c: BoardCell) => c.active ? ['#cd603b','#fff8ed','#bd5433'] : c.kind === 'back' ? ['#eaf1ed','#547c79','#8caeac'] : c.kind === 'forward' ? ['#fcf5e7','#a96436','#ce8b5d'] : ['#f0f2e8','#69785d','#d4dac9'];
function texture(c: BoardCell): THREE.CanvasTexture {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const [fill, ink, outline] = palette(c);
  ctx.fillStyle = fill; ctx.fillRect(0,0,256,256);
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (60*i-30)*Math.PI/180, x = 128+123*Math.cos(a), y = 128-123*Math.sin(a);
    if (i) ctx.lineTo(x,y); else ctx.moveTo(x,y);
  }
  ctx.closePath(); ctx.strokeStyle = c.solution ? '#50865a' : outline; ctx.lineWidth = c.kind || c.solution ? 5 : 3; ctx.stroke();
  ctx.font = '500 72px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillStyle=ink;
  ctx.fillText(String(c.value),128,c.active ? 119 : 128);
  if (c.active || c.solution) { ctx.beginPath(); ctx.arc(128,190,6,0,Math.PI*2); ctx.fillStyle = c.active ? '#f6c7b3' : '#50865a'; ctx.fill(); }
  const t = new THREE.CanvasTexture(canvas); t.colorSpace=THREE.SRGBColorSpace; return t;
}
interface Tile { mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>; signature: string; cell: BoardCell }
export default function SphereBoard(props: Props) {
  const host = useRef<HTMLDivElement>(null);
  const latest = useRef(props);
  latest.current = props;
  const refresh = useRef<(() => void) | null>(null);
  const [failure, setFailure] = useState('');
  useEffect(() => {
    const container = host.current!;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); }
    catch { setFailure('WebGL is unavailable. Use the flat renderer to continue this same game.'); return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0xfcfcf7, 0); renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1;
    container.appendChild(renderer.domElement);
    renderer.domElement.setAttribute('aria-hidden','true');
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xffffff, 0x889581, 1.7));
    const light = new THREE.DirectionalLight(0xffffff, 1.2); light.position.set(-3,5,8); scene.add(light);
    const camera = new THREE.PerspectiveCamera(45,1,0.05,200);
    const tiles = new Map<string, Tile>();
    const raw = hexTriangles();
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let roll: Roll = { from: latest.current.center, to: latest.current.center, start: performance.now(), duration: 0 };
    let pan: Roll = { from: {q:0,r:0}, to: {q:0,r:0}, start:0, duration:0 };
    let wasScouting=false;
    let resetKey = latest.current.resetKey;
    let frame = 0, width = 0, height = 0, disposed = false;
    const disposeTile = (tile: Tile) => {
      scene.remove(tile.mesh); tile.mesh.geometry.dispose(); tile.mesh.material.map?.dispose(); tile.mesh.material.dispose();
    };
    function sync() {
      const p = latest.current, now = performance.now();
      if (wasScouting && !p.scout?.active) {
        pan = { from: sampleRoll(pan,now), to:{q:0,r:0}, start:now, duration: reducedMotion.matches ? 0 : p.settings.duration };
        press=null;
      }
      wasScouting=!!p.scout?.active;
      renderer.domElement.style.touchAction=p.scout?.available ? 'none' : 'manipulation';
      if (p.resetKey !== resetKey) {
        roll = { from: p.center, to: p.center, start: now, duration: 0 }; resetKey = p.resetKey;
        pan={from:{q:0,r:0},to:{q:0,r:0},start:now,duration:0}; press=null;
      } else if (key(roll.to) !== key(p.center)) {
        // Re-target from the current interpolated position on quick taps; never queue stale moves.
        const adjacent = distance(roll.to, p.center) === 1;
        roll = { from: adjacent ? sampleRoll(roll, now) : p.center, to: p.center, start: now,
          duration: adjacent && !reducedMotion.matches ? p.settings.duration : 0 };
      }
      const offset = roundHex(sampleRoll(pan,now));
      const scoutCenter=p.scout?.active ? {q:p.center.q+offset.q,r:p.center.r+offset.r} : p.center;
      const cells=p.scout?.active ? p.scout.cells.filter(c=>distance(c,scoutCenter)<=p.radius) : p.cells;
      container.dataset.scoutCenter=key(scoutCenter);
      container.dataset.visibleCells=String(cells.length);
      const ids = new Set(cells.map(key));
      for (const [id,tile] of tiles) if (!ids.has(id)) { disposeTile(tile); tiles.delete(id); }
      for (const cell of cells) {
        const id=key(cell), signature=JSON.stringify([cell.value,cell.active,cell.kind,cell.solution]);
        let tile=tiles.get(id);
        if (!tile) {
          const geometry = new THREE.BufferGeometry();
          geometry.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(raw.length/2*3),3));
          geometry.setAttribute('normal',new THREE.Float32BufferAttribute(new Float32Array(raw.length/2*3),3));
          geometry.setAttribute('uv',new THREE.Float32BufferAttribute(raw.map(v=>v/2+0.5),2));
          const material = new THREE.MeshStandardMaterial({ map: texture(cell), roughness:1, metalness:0, side:THREE.DoubleSide });
          const mesh = new THREE.Mesh(geometry,material); mesh.userData.id=id; mesh.frustumCulled=false;
          scene.add(mesh); tile={mesh,signature,cell}; tiles.set(id,tile);
        } else if (tile.signature !== signature) {
          tile.mesh.material.map?.dispose(); tile.mesh.material.map=texture(cell); tile.signature=signature;
        }
        tile.cell=cell;
      }
      requestDraw();
    }
    function draw(now: number) {
      frame=0; if(disposed) return;
      const p=latest.current, settings=p.settings;
      const w=Math.max(1,container.clientWidth), h=Math.max(1,container.clientHeight);
      if(w!==width || h!==height) { width=w; height=h; renderer.setSize(w,h,false); }
      camera.aspect=w/h; camera.fov=settings.perspective;
      // Fit the visible ring count at the default distance/FOV; controls remain independent offsets.
      const extent=settings.sphereRadius * (2*p.radius+1) / Math.hypot(2*p.radius+1, settings.sphereRadius);
      const fit=extent / Math.tan(45*Math.PI/360) / Math.min(1,w/h) + 1;
      camera.position.set(0,0,fit * settings.cameraDistance/9);
      camera.lookAt(0,0,0); camera.updateProjectionMatrix();
      const base=sampleRoll(roll,now), offset=sampleRoll(pan,now);
      const origin={q:base.q+offset.q,r:base.r+offset.r};
      for(const tile of tiles.values()) {
        const pos=tile.mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
        const normal=tile.mesh.geometry.getAttribute('normal') as THREE.BufferAttribute;
        const center=localPosition(tile.cell,origin,settings.cellSize);
        for(let i=0;i<raw.length;i+=2) {
          const point=project(center.x+raw[i]*settings.cellSize*0.94,center.y+raw[i+1]*settings.cellSize*0.94,settings.sphereRadius);
          pos.setXYZ(i/2,...point);
          normal.setXYZ(i/2,point[0]/settings.sphereRadius,point[1]/settings.sphereRadius,(point[2]+settings.sphereRadius)/settings.sphereRadius);
        }
        pos.needsUpdate=true; normal.needsUpdate=true; tile.mesh.geometry.computeBoundingSphere();
      }
      renderer.render(scene,camera);
      if(now < roll.start+roll.duration || now < pan.start+pan.duration) requestDraw();
    }
    function requestDraw() { if(!frame && !disposed) frame=requestAnimationFrame(draw); }
    function pick(event: PointerEvent) {
      const rect=renderer.domElement.getBoundingClientRect();
      pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);
      raycaster.setFromCamera(pointer,camera);
      return raycaster.intersectObjects([...tiles.values()].map(t=>t.mesh),false)[0]?.object.userData.id as string | undefined;
    }
    let press: { x: number; y: number; id: number; offset: {q:number;r:number}; dragging: boolean } | null = null;
    const onDown = (e: PointerEvent) => {
      if(e.button !== 0 || press) return;
      press={ x:e.clientX,y:e.clientY,id:e.pointerId,offset:sampleRoll(pan,performance.now()),dragging:false };
      if(latest.current.scout?.available) renderer.domElement.setPointerCapture(e.pointerId);
    };
    const onCancel = () => { press=null; renderer.domElement.style.cursor='default'; };
    const onClick = (e: PointerEvent) => {
      const start=press; press=null;
      if(renderer.domElement.hasPointerCapture(e.pointerId)) renderer.domElement.releasePointerCapture(e.pointerId);
      if(!start || start.id !== e.pointerId || start.dragging || latest.current.scout?.active || Math.hypot(e.clientX-start.x,e.clientY-start.y)>8) return;
      const id=pick(e); if(id && latest.current.cells.some(c=>key(c)===id && c.kind)) latest.current.onMove(id);
    };
    const onHover = (e: PointerEvent) => {
      const p=latest.current;
      if(press && press.id===e.pointerId && p.scout?.available) {
        const dx=e.clientX-press.x, dy=e.clientY-press.y;
        if(!press.dragging && Math.hypot(dx,dy)>8) {
          if(!p.scout.onStart()) { press=null; return; }
          press.dragging=true;
        }
        if(press.dragging) {
          const units=2*camera.position.z*Math.tan(camera.fov*Math.PI/360)/Math.max(1,height);
          const offset=scoutOffset(press.offset,dx,dy,units,p.settings.cellSize);
          pan={from:offset,to:offset,start:performance.now(),duration:0};
          renderer.domElement.style.cursor='grabbing'; sync(); return;
        }
      }
      const id=pick(e);
      renderer.domElement.style.cursor=p.scout?.available ? 'grab' : id && p.cells.some(c=>key(c)===id && c.kind) ? 'pointer' : 'default';
    };
    const onLost = (e: Event) => { e.preventDefault(); setFailure('The WebGL context was lost. Switch to flat view to continue without resetting.'); };
    renderer.domElement.addEventListener('pointerdown',onDown);
    renderer.domElement.addEventListener('pointercancel',onCancel);
    renderer.domElement.addEventListener('lostpointercapture',onCancel);
    renderer.domElement.addEventListener('pointerup',onClick);
    renderer.domElement.addEventListener('pointermove',onHover);
    renderer.domElement.addEventListener('webglcontextlost',onLost);
    const observer=new ResizeObserver(requestDraw); observer.observe(container);
    refresh.current=sync; sync();
    return () => {
      disposed=true; refresh.current=null; cancelAnimationFrame(frame); observer.disconnect();
      renderer.domElement.removeEventListener('pointerdown',onDown);
      renderer.domElement.removeEventListener('pointercancel',onCancel);
      renderer.domElement.removeEventListener('lostpointercapture',onCancel);
      renderer.domElement.removeEventListener('pointerup',onClick); renderer.domElement.removeEventListener('pointermove',onHover);
      renderer.domElement.removeEventListener('webglcontextlost',onLost);
      for(const tile of tiles.values()) disposeTile(tile);
      tiles.clear(); renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove();
    };
  }, []);
  useEffect(() => { refresh.current?.(); }, [props.cells, props.center.q, props.center.r, props.radius, props.settings, props.resetKey, props.scout?.active, props.scout?.available, props.scout?.cells]);
  return <div className="sphere-board" role="group" aria-label={`Spherical maze. Current number ${props.cells.find(c=>c.active)?.value}.`}>
    <div className="sphere-canvas" ref={host}/>
    {failure && <div className="sphere-error" role="alert">{failure}<button className="secondary-button" onClick={props.onFallback}>Use flat renderer</button></div>}
    <div className="sphere-keyboard" aria-label="Spherical board keyboard controls">
      {props.cells.filter(c=>c.kind && !props.scout?.active).map(c=><button key={key(c)} onClick={()=>props.onMove(key(c))} aria-label={`${cellLabel(c)} at ${key(c)}`}>{c.value} ({key(c)})</button>)}
    </div>
  </div>;
}
