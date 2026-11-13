import { describe, expect, it } from 'vitest';
import { directions, disk, key } from '../engine/hex';
import { ease, hexTriangles, localPosition, project, sampleRoll } from './projection';

describe('local sphere projection', () => {
  it('pins the origin to the front and stays on the sphere for near and distant offsets', () => {
    expect(project(0,0,4.5)).toEqual([0,0,0]);
    for (const [x,y] of [[1,2],[-20,5],[1e6,-1e6]]) {
      const p=project(x,y,4.5);
      expect(Math.hypot(p[0],p[1],p[2]+4.5)).toBeCloseTo(4.5,10);
      expect(p[2]).toBeGreaterThan(-4.5);
    }
  });
  it('keeps all nineteen cells distinct and preserves direction ordering', () => {
    const cells=disk({q:0,r:0},2);
    const projected=cells.map(c=>{const p=localPosition(c,{q:0,r:0},1); return project(p.x,p.y,4.5);});
    expect(new Set(projected.map(p=>p.join(','))).size).toBe(19);
    for (const d of directions) {
      const a=localPosition(d,{q:0,r:0},1), b=project(a.x,a.y,4.5);
      expect(Math.sign(b[0])).toBe(Math.sign(a.x)); expect(Math.sign(b[1])).toBe(Math.sign(a.y));
    }
  });
  it('is translation invariant across 10,000 consecutive moves and distant origins', () => {
    let origin={q:1000000,r:-1000000};
    const expected=directions.map(d=>localPosition(d,{q:0,r:0},1));
    for(let i=0;i<10000;i++) {
      const d=directions[i%6]; origin={q:origin.q+d.q,r:origin.r+d.r};
      directions.forEach((n,j)=>expect(localPosition({q:origin.q+n.q,r:origin.r+n.r},origin,1)).toEqual(expected[j]));
    }
  });
  it('projects coincident hex edges to identical positions on both cells', () => {
    const a=localPosition({q:0,r:0},{q:0.3,r:-0.1},1);
    const b=localPosition({q:1,r:0},{q:0.3,r:-0.1},1);
    for(const y of [-0.5,0,0.5]) {
      const pa=project(a.x+Math.sqrt(3)/2,a.y+y,4.5);
      const pb=project(b.x-Math.sqrt(3)/2,b.y+y,4.5);
      pa.forEach((v,i)=>expect(v).toBeCloseTo(pb[i],12));
    }
  });
  it('tessellates the entire hex without triangles outside its boundary', () => {
    const triangles=hexTriangles(4);
    expect(triangles.length).toBe(6*4*4*3*2);
    for(let i=0;i<triangles.length;i+=2) expect(Math.hypot(triangles[i],triangles[i+1])).toBeLessThanOrEqual(1.000001);
    let area=0;
    for(let i=0;i<triangles.length;i+=6) area+=Math.abs((triangles[i+2]-triangles[i])*(triangles[i+5]-triangles[i+1])-(triangles[i+4]-triangles[i])*(triangles[i+3]-triangles[i+1]))/2;
    expect(area).toBeCloseTo(3*Math.sqrt(3)/2,10);
  });
});
describe('rolling origin', () => {
  it('reaches the exact neighbor in all six directions, and reverses without drift', () => {
    const from={q:1000000,r:-1000000};
    for(const d of directions) {
      const to={q:from.q+d.q,r:from.r+d.r}, roll={from,to,start:100,duration:400};
      expect(sampleRoll(roll,100)).toEqual(from); expect(sampleRoll(roll,500)).toEqual(to);
      expect(sampleRoll(roll,300)).toEqual({q:from.q+d.q/2,r:from.r+d.r/2});
      expect(sampleRoll({from:to,to:from,start:500,duration:400},900)).toEqual(from);
      expect(key(sampleRoll(roll,1000))).toBe(key(to));
    }
  });
  it('retargets from the in-flight origin and supports zero duration', () => {
    const initial={from:{q:0,r:0},to:{q:1,r:0},start:0,duration:400};
    const at=sampleRoll(initial,200);
    const retarget={from:at,to:{q:1,r:1},start:200,duration:400};
    expect(sampleRoll(retarget,200)).toEqual(at);
    expect(sampleRoll(retarget,600)).toEqual(retarget.to);
    expect(sampleRoll({...retarget,duration:0},200)).toEqual(retarget.to);
    expect(ease(-1)).toBe(0); expect(ease(2)).toBe(1);
  });
});
