import { useEffect, useMemo, useState } from 'react';
import { generate } from './engine/generator';
import { analyze } from './engine/solver';
import { elapsed, moveKind } from './engine/game';
import { disk, key, pixel } from './engine/hex';
import { canScout, configurePuzzle, DEFAULT_LAB, newScout, SCOUT_LABELS, toggleScout, viewCells, type LabSettings } from './engine/lab';

import { expireAttempt, GAME_OVER_LABELS, moveAttempt, newAttempt, timeLimit } from './engine/attempt';

const freshSeed = () => `hex-${crypto.randomUUID()}`;
const formatTime = (ms: number) => `${Math.floor(ms / 60000).toString().padStart(2, '0')}:${Math.floor(ms / 1000 % 60).toString().padStart(2, '0')}`;
const points = (size: number) => Array.from({ length: 6 }, (_, i) => {
  const a = Math.PI / 180 * (60 * i - 30); return `${size * Math.cos(a)},${size * Math.sin(a)}`;
}).join(' ');
interface PlayRecord { outcome?: 'complete' | 'mistake' | 'timeout' | 'dead-end'; settings?: LabSettings; mistakes?: number; scouts?: number; id: string; seed: string; target: number; version: number; moves: number; backtracks: number; elapsedMs: number; assisted: boolean; completedAt: string; feedback: string }
function readRecords(): PlayRecord[] {
  try {
    const data: unknown = JSON.parse(localStorage.getItem('hex-playtests') || '[]');
    return Array.isArray(data) ? data.filter(r => r && typeof r.id === 'string' && typeof r.seed === 'string' && typeof r.elapsedMs === 'number') : [];
  } catch { return []; }
}
function download(name: string, data: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export default function App() {
  const [puzzle, setPuzzle] = useState(() => generate(freshSeed(), { target: DEFAULT_LAB.target }));
  const [attempt, setAttempt] = useState(() => newAttempt(puzzle));
  const { game, mistakes, failure } = attempt;
  const [now, setNow] = useState(Date.now());
  const [developer, setDeveloper] = useState(false);
  const [help, setHelp] = useState(false);
  const [reveal, setReveal] = useState(false);
  const [assisted, setAssisted] = useState(false);
  const [seedInput, setSeedInput] = useState(puzzle.seed);
  const [settings, setSettings] = useState<LabSettings>({ ...DEFAULT_LAB });
  const [draftSettings, setDraftSettings] = useState<LabSettings>({ ...DEFAULT_LAB });
  const [scoutState, setScoutState] = useState(newScout);
  const { active: scouting, uses: scouts } = scoutState;
  const [solutionIndex, setSolutionIndex] = useState(0);
  const [error, setError] = useState('');
  const [records, setRecords] = useState<PlayRecord[]>(readRecords);
  const [runId, setRunId] = useState(() => crypto.randomUUID());
  const [feedback, setFeedback] = useState('');
  const analysis = useMemo(() => analyze(puzzle), [puzzle]);
  const activeId = game.path[game.path.length - 1], active = puzzle.cells[activeId];
  const previous = game.path[game.path.length - 2];
  const viewRadius = settings.visibleRings + Number(scouting);
  const visible = viewCells(puzzle, activeId, viewRadius);
  const boardScale = Math.max(1, (viewRadius + 0.6) / 2.6);
  const selectedSolution = analysis.solutions[solutionIndex] || [];
  const solution = new Set(selectedSolution);
  const complete = game.finishedAt !== null;
  const ended = complete || failure !== null;
  const limit = timeLimit(settings.gameOver);
  const legalNext = visible.filter(h => moveKind(puzzle, game, key(h)) === 'forward');
  const ms = elapsed(game, failure?.at ?? now);
  const remaining = limit === null ? null : Math.max(0, limit - ms);
  useEffect(() => {
    if (game.startedAt === null || ended) return;
    const tick = () => {
      const t = Date.now(); setNow(t);
      setAttempt(a => expireAttempt(a, settings.gameOver, t));
    };
    const timer = window.setInterval(tick, 100);
    window.addEventListener('focus', tick);
    return () => { clearInterval(timer); window.removeEventListener('focus', tick); };
  }, [game.startedAt, ended, settings.gameOver]);
  useEffect(() => {
    if (!ended) return;
    setRecords(old => old.some(r => r.id === runId) ? old : [...old, {
      id: runId, seed: puzzle.seed, target: puzzle.target, version: puzzle.version, moves: game.moves,
      outcome: failure?.reason ?? 'complete', settings: { ...settings }, mistakes, scouts, backtracks: game.backtracks, elapsedMs: elapsed(game, failure?.at ?? Date.now()), assisted, completedAt: new Date(failure?.at ?? game.finishedAt!).toISOString(), feedback: '',
    }]);
  }, [ended, failure, runId, puzzle, game, assisted, settings, mistakes, scouts]);
  useEffect(() => { try { localStorage.setItem('hex-playtests', JSON.stringify(records)); } catch { /* Private browsing can disable storage. Export remains available. */ } }, [records]);
  function resetAttempt(p = puzzle) {
    setAttempt(newAttempt(p)); setReveal(false); setAssisted(false); setSolutionIndex(0); setError('');
    setNow(Date.now()); setFeedback(''); setRunId(crypto.randomUUID());
    setScoutState(newScout());
  }
  function start(seed: string, target: number) {
    try {
      const p = generate(seed, { target }); setPuzzle(p); setSeedInput(seed); resetAttempt(p);
    } catch (e) { setError((e as Error).message); }
  }
  function applySettings() {
    const p = configurePuzzle(puzzle, draftSettings);
    setSettings({ ...draftSettings }); setPuzzle(p); resetAttempt(p);
  }
  function step(id: string) {
    const t = Date.now();
    setAttempt(a => moveAttempt(puzzle, a, id, t, settings.gameOver, analysis.viableCells));
    if (!ended && moveKind(puzzle, game, id)) setScoutState(s => ({ ...s, active: false }));
    setNow(t);
  }
  function scout() {
    const t = Date.now(), checked = expireAttempt(attempt, settings.gameOver, t);
    if (checked.failure || checked.game.finishedAt !== null) { setAttempt(checked); setNow(t); return; }
    setScoutState(s => toggleScout(s, settings.scouting, false));
  }
  function toggleReveal() { setReveal(v => !v); setAssisted(true); }
  const overviewPositions = useMemo(() => {
    const ids = new Set(analysis.reachableCellIds.flatMap(id => disk(puzzle.cells[id], 1).map(key)));
    return [...ids].map(id => puzzle.cells[id]).filter(Boolean).map(c => ({ ...c, ...pixel(c, 13) }));
  }, [puzzle, analysis]);
  const bounds = { x: Math.min(...overviewPositions.map(c => c.x)) - 16, y: Math.min(...overviewPositions.map(c => c.y)) - 16,
    w: Math.max(...overviewPositions.map(c => c.x)) - Math.min(...overviewPositions.map(c => c.x)) + 32,
    h: Math.max(...overviewPositions.map(c => c.y)) - Math.min(...overviewPositions.map(c => c.y)) + 32 };
  return <div className="app-shell">
    <header className="site-header"><a className="brand" href="./" aria-label="Hex Number Maze home"><span className="brand-icon">⬡</span><span>hex<span className="brand-dot">.</span></span></a><span className="header-caption">A LITTLE MAZE. A LITTLE MIND SPACE.</span><button className="icon-button" onClick={() => setHelp(v => !v)} aria-expanded={help} aria-label="How to play">?</button></header>
    <main>
      <div className="intro"><span className="eyebrow"><span className="tiny-dot"/> THE NUMBER MAZE</span><h1>One number at a time.</h1><p>Follow the sequence. Find your way.</p></div>
      {help && <aside className="help-panel"><strong>A small world, a few simple rules.</strong><p>Start at 1 and tap a neighboring number exactly one higher. Orange outlines show your next choices. Tap the blue outlined hex to retrace one step. Every step counts, including going back.</p><p>You can see {settings.visibleRings} rings around you. {settings.scouting !== 'none' && 'Scout reveals one extra ring until your next move.'} {settings.scouting === 'once' && 'You may scout only once per run.'} The timer starts on your first move. Reach {puzzle.target} to finish.</p></aside>}
      <section className="lab-panel" aria-label="Game Lab configuration">
        <div className="panel-heading"><h2>Game Lab</h2><span className="eyebrow">DEVELOPMENT SETTINGS</span></div>
        <form onSubmit={e => { e.preventDefault(); applySettings(); }}>
          <label>Visible rings<select value={draftSettings.visibleRings} onChange={e => setDraftSettings(s => ({ ...s, visibleRings: Number(e.target.value) }))}>{[1,2,3,4].map(n => <option key={n} value={n}>{n}</option>)}</select></label>
          <label>Target number<select value={draftSettings.target} onChange={e => setDraftSettings(s => ({ ...s, target: Number(e.target.value) }))}>{[15,25,40].map(n => <option key={n} value={n}>{n}</option>)}</select></label>
          <label>Scouting<select value={draftSettings.scouting} onChange={e => setDraftSettings(s => ({ ...s, scouting: e.target.value as LabSettings['scouting'] }))}>{Object.entries(SCOUT_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label>Primary score<select value={draftSettings.primaryScore} onChange={e => setDraftSettings(s => ({ ...s, primaryScore: e.target.value as LabSettings['primaryScore'] }))}><option value="mistakes">Mistakes</option><option value="moves">Moves</option><option value="time">Time</option></select></label>
          <label>Game over<select value={draftSettings.gameOver} onChange={e => setDraftSettings(s => ({ ...s, gameOver: e.target.value as LabSettings['gameOver'] }))}>{Object.entries(GAME_OVER_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <p className="muted">No mistakes ends on the first false branch. Dead end allows wrong turns but ends when there is no adjacent next number; you can turn back before reaching one. Dead end or 60 seconds ends on whichever happens first. Timers start on your first legal move and continue while away.</p>
          <button className="primary-button" type="submit">Apply & restart same seed</button>
          <button className="secondary-button" type="button" onClick={() => resetAttempt()}>Replay current settings</button>
        </form>
        <p className="muted">Applying settings restarts the attempt on the same seed. Visibility, scouting, scoring, and game-over rules keep the exact board; changing the target creates a different board from that seed.</p>
        <p className="seed-caption">Seed: <code>{puzzle.seed}</code></p>
      </section>
      <section className="game-card" aria-label="Number maze game">
        <div className="game-topline"><span className="puzzle-label">EXPLORATION <span>/ {puzzle.target}</span></span><span className="live-pill"><span/> {complete ? 'Complete' : failure ? 'Game over' : 'In play'}</span></div>
        <div className="primary-score" aria-label="Primary score"><span>{settings.primaryScore}</span><strong>{settings.primaryScore === 'mistakes' ? mistakes : settings.primaryScore === 'moves' ? game.moves : formatTime(ms)}</strong><small>Lower is better</small></div>
        <p className="score-definition">A mistake is entering a false branch. Continuing within it or stepping back adds no mistakes.</p>
        <p className="active-settings">{settings.visibleRings} rings · Scouting: {SCOUT_LABELS[settings.scouting]} · {mistakes} mistakes · {GAME_OVER_LABELS[settings.gameOver]}</p>
        <div className="stats"><div><span className="stat-label">CURRENT</span><div className="stat-number current-stat">{active.value}<span> / {puzzle.target}</span></div></div><div><span className="stat-label">MOVES</span><div className="stat-number">{game.moves.toString().padStart(2, '0')}</div></div><div><span className="stat-label">{limit === null ? 'TIME' : 'TIME LEFT'}</span><div className="stat-number time-stat">{formatTime(remaining === null ? ms : Math.ceil(remaining / 1000) * 1000)}</div></div></div>
        <div className="board-wrap">
          <svg className="board" viewBox={`${-235 * boardScale} ${-218 * boardScale} ${470 * boardScale} ${436 * boardScale}`} role="group" aria-label={`Hexagonal maze. Current number ${active.value}. Reach ${puzzle.target}.`}>
            {visible.map(h => {
              const id = key(h), cell = h, kind = ended ? null : moveKind(puzzle, game, id), isActive = id === activeId;
              const { x, y } = pixel({ q: h.q - active.q, r: h.r - active.r }, 46);
              const visited = game.path.includes(id), isSolution = reveal && solution.has(id);
              const label = `${cell?.value ?? 'Empty'}, ${isActive ? 'current position' : kind === 'back' ? 'backtrack' : kind === 'forward' ? 'move forward' : 'unavailable'}`;
              return <g key={id} transform={`translate(${x},${y})`} role="button" aria-label={label} aria-disabled={!kind} tabIndex={kind ? 0 : -1}
                onClick={() => step(id)} onKeyDown={e => { if ((e.key === 'Enter' || e.key === ' ') && kind) { e.preventDefault(); step(id); } }}
                className={`hex ${isActive ? 'active' : kind === 'back' ? 'back' : kind === 'forward' ? 'next' : visited ? 'visited' : 'quiet'} ${isSolution ? 'solution' : ''}`}>
                <polygon points={points(42)} />
                <text textAnchor="middle" dominantBaseline="central" y={isActive ? -3 : 0}>{cell?.value ?? '·'}</text>
                {isActive && <circle cy="22" r="2.4" className="position-dot"/>}
                {isSolution && !isActive && <circle cy="24" r="3" className="solution-dot"/>}
              </g>;
            })}
          </svg>
          <div className="board-caption" role="status">{complete ? 'You found your way.' : failure ? (failure.reason === 'timeout' ? 'Time is up.' : failure.reason === 'dead-end' ? 'A dead end. Game over.' : 'A wrong turn. Game over.') : legalNext.length ? <>Next up: <strong>{active.value + 1}</strong><span className="caption-dot">·</span>{legalNext.length > 1 ? `${legalNext.length} paths to explore` : 'Keep exploring'}</> : <>A dead end. <strong>Retrace your steps.</strong></>}</div>
        </div>
        {settings.scouting !== 'none' && <div className="scout-control"><button className="secondary-button" onClick={scout} disabled={!canScout(scoutState, settings.scouting, ended)} aria-pressed={scouting}>{scouting ? 'End scout' : settings.scouting === 'once' && scouts > 0 ? 'Scout used' : 'Scout +1 ring'}</button><span>{settings.scouting === 'once' ? `${Math.max(0, 1 - scouts)} of 1 scout remaining` : `${scouts} scout uses`} · no move cost</span></div>}
        <div className="legend"><span><i className="legend-current"/>You are here</span><span><i className="legend-next"/>Next number</span><span><i className="legend-back"/>Way back</span></div>
        <div className="game-actions"><button className="secondary-button" disabled={!previous || ended} onClick={() => step(previous)}>← <span>Step back</span></button><button className="primary-button" onClick={() => start(freshSeed(), puzzle.target)}>New game <span>↗</span></button></div>
      </section>
      {ended && <section className="completion" aria-live="polite"><span className="eyebrow">{complete ? 'MAZE COMPLETE' : 'GAME OVER'}</span><h2>{complete ? 'A little persistence. A path found.' : failure?.reason === 'timeout' ? 'Time is up.' : failure?.reason === 'dead-end' ? 'No way forward. You reached a dead end.' : 'One wrong turn ends this run.'}</h2><p>{mistakes} mistakes · {game.moves} moves · {formatTime(ms)} · {game.backtracks} steps back</p><p>{complete ? (game.moves === analysis.minimumMoves ? 'A perfect route.' : `${game.moves - analysis.minimumMoves!} moves beyond the shortest route.`) : 'Try again with the same seed.'} {assisted && 'Solution assisted.'}</p><button className="secondary-button" onClick={() => resetAttempt()}>Retry same seed</button><label htmlFor="feedback">How did this one feel?</label><textarea id="feedback" placeholder="A fair wrong turn? A memorable choice? Worth another go?" value={feedback} onChange={e => { setFeedback(e.target.value); setRecords(rs => rs.map(r => r.id === runId ? { ...r, feedback: e.target.value } : r)); }}/><small>Saved on this device when browser storage is available.</small></section>}
      <p className="under-note">Not every way forward leads to the finish.<br/>Getting a little lost is part of it.</p>
      <div className="developer-toggle"><button onClick={() => setDeveloper(v => !v)} aria-expanded={developer}><span className="code-mark">⌘</span> Developer mode <span className={`switch ${developer ? 'on' : ''}`}/></button><span>GENERATOR v1</span></div>
      {developer && <section className="developer-panel"><div className="panel-heading"><div><span className="eyebrow">UNDER THE SURFACE</span><h2>Puzzle workbench</h2></div><button className="text-button" onClick={() => download(`hex-${puzzle.seed}.json`, { puzzle, analysis, settings })}>Export puzzle ↗</button></div>
        <form onSubmit={e => { e.preventDefault(); start(seedInput, settings.target); }}><label className="seed-field">Reproducible seed<input value={seedInput} onChange={e => setSeedInput(e.target.value)} spellCheck={false} required /></label><button className="primary-button" type="submit">Generate</button></form>
        {error && <p role="alert" className="error">{error}</p>}<p className="seed-caption">Playing seed: <code>{puzzle.seed}</code><br/>8 branch attempts · depth up to 4 · visibility radius {settings.visibleRings}</p>
        <div className="metric-grid">{[['Valid routes', analysis.validPaths], ['Minimum moves', analysis.minimumMoves], ['Decision cells', analysis.branchingDecisions], ['False branches', analysis.falseBranches.length], ['Dead ends', analysis.deadEnds], ['Failing routes', analysis.failingRoutes]].map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
        <div className="solution-controls"><button className="secondary-button" onClick={toggleReveal} aria-pressed={reveal}>{reveal ? 'Hide solution' : 'Reveal solution'}</button><label>Route<select value={solutionIndex} onChange={e => { setSolutionIndex(Number(e.target.value)); if (reveal) setAssisted(true); }}>{analysis.solutions.map((_, i) => <option value={i} key={i}>{i + 1} of {analysis.solutions.length}</option>)}</select></label></div>
        <p className="muted">Revealing a solution marks this playtest as assisted. Green dots identify the selected route; the reachable maze and its surrounding cells appear below.</p>
        {reveal && <><svg className="overview" viewBox={`${bounds.x} ${bounds.y} ${bounds.w} ${bounds.h}`} role="img" aria-label="Reachable maze with selected solution in green">{overviewPositions.map(c => <g key={key(c)} transform={`translate(${c.x},${c.y})`}><polygon points={points(11.5)} fill={key(c) === activeId ? '#cf5b35' : solution.has(key(c)) ? '#b9d4ba' : '#edece5'}/><text textAnchor="middle" dominantBaseline="central" fontSize="8" fill={key(c) === activeId ? 'white' : '#424a42'}>{c.value}</text></g>)}</svg><p className="route-list">{selectedSolution.map((id, i) => `${i + 1} (${id})`).join(' → ')}</p></>}
        {analysis.solutionsTruncated && <p>Showing the first 100 routes. Total route counts remain exact.</p>}
        <details><summary>Metric definitions & false-branch depths</summary><p>All metrics describe increasing paths reachable from the start. A decision cell is a cell on a successful route with two or more forward choices. A false branch is an edge from such a viable cell into a region with no finish. Depth is the longest number of forward steps from that departure to a dead end. Dead ends count distinct cells; failing routes count all distinct increasing paths ending at them, including paths that merge.</p><p>Every successful increasing route takes target − 1 moves. Player detours add two moves per retraced step. These are raw measurements, not a difficulty score.</p>{analysis.falseBranches.length ? <ul>{analysis.falseBranches.map(b => <li key={`${b.from}:${b.entry}`}>({b.from}) → ({b.entry}): depth {b.depth}, {b.failingRoutes} failing route(s)</li>)}</ul> : <p>No false branches in this puzzle.</p>}</details>
        <div className="playtest-heading"><h3>Playtest notebook <span>{records.length}</span></h3><button className="text-button" disabled={!records.length} onClick={() => download('hex-playtests.json', records)}>Export sessions ↗</button></div>
        <p className="muted">Aim for five completed puzzles. Note how often you make choices, whether wrong turns feel fair, and whether the chosen visibility and scouting settings help or frustrate. Time includes time spent away after your first move.</p>
        {records.length > 0 && <div className="table-scroll"><table><thead><tr><th>Seed</th><th>Target</th><th>Rings</th><th>Scouting</th><th>Score</th><th>Game over</th><th>Outcome</th><th>Mistakes</th><th>Moves</th><th>Back</th><th>Time</th><th>Help</th></tr></thead><tbody>{records.slice(-10).reverse().map(r => <tr key={r.id}><td title={r.seed}>{r.seed}</td><td>{r.target}</td><td>{r.settings?.visibleRings ?? '—'}</td><td>{r.settings ? `${SCOUT_LABELS[r.settings.scouting]} (${r.scouts ?? 0})` : '—'}</td><td>{r.settings?.primaryScore ?? '—'}</td><td>{r.settings?.gameOver ? GAME_OVER_LABELS[r.settings.gameOver] : 'Free play'}</td><td>{r.outcome ?? 'complete'}</td><td>{r.mistakes ?? '—'}</td><td>{r.moves}</td><td>{r.backtracks}</td><td>{formatTime(r.elapsedMs)}</td><td>{r.assisted ? 'Yes' : 'No'}</td></tr>)}</tbody></table></div>}
      </section>}
    </main><footer><span>HEX / NUMBER MAZE</span><span>Made for the curious.</span></footer>
  </div>;
}
