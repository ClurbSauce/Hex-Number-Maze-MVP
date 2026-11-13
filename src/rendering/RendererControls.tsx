import { DEFAULT_SPHERE, type SphereSettings } from './projection';
export type RendererMode = 'flat' | 'sphere';
const sliders: { key: keyof SphereSettings; label: string; min: number; max: number; step: number; unit: string }[] = [
  { key:'sphereRadius', label:'Sphere radius / curvature', min:2, max:12, step:0.1, unit:' units (smaller = more curved)' },
  { key:'cameraDistance', label:'Camera distance', min:6, max:15, step:0.1, unit:' relative units' },
  { key:'perspective', label:'Perspective strength', min:25, max:70, step:1, unit:'° field of view' },
  { key:'cellSize', label:'Cell size', min:0.6, max:1.4, step:0.05, unit:' units' },
  { key:'duration', label:'Roll animation duration', min:0, max:1000, step:20, unit:' ms' },
];
export default function RendererControls({ mode, onMode, settings, onSettings }: {
  mode: RendererMode; onMode: (mode: RendererMode) => void;
  settings: SphereSettings; onSettings: (settings: SphereSettings) => void;
}) {
  return <details className="renderer-controls"><summary>Rendering prototype · {mode === 'flat' ? 'Flat SVG' : 'Rolling sphere'}</summary>
    <label>Renderer<select value={mode} onChange={e=>onMode(e.target.value as RendererMode)}><option value="flat">Flat SVG</option><option value="sphere">Rolling sphere (Three.js)</option></select></label>
    <p className="muted">View changes apply immediately. The seed, position, score, scouting allowance, and running timer are preserved.</p>
    {mode === 'sphere' && <><div className="renderer-sliders">{sliders.map(s=><label key={s.key}>{s.label}<output>{settings[s.key]}{s.unit}</output><input aria-label={s.label} type="range" min={s.min} max={s.max} step={s.step} value={settings[s.key]} onChange={e=>onSettings({...settings,[s.key]:Number(e.target.value)})}/></label>)}</div><button className="secondary-button" onClick={()=>onSettings({...DEFAULT_SPHERE})}>Reset rendering controls</button><p className="muted">Small radius increases curvature. Wide field of view and camera distance change framing. Reduced-motion preferences disable rolling. The active cell settles at the center after each roll.</p></>}
  </details>;
}
