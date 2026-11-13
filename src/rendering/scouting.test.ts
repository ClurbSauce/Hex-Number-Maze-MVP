import { describe, expect, it } from 'vitest';
import { disk, distance, key } from '../engine/hex';
import { roundHex, SCOUT_REACH, scoutOffset } from './scouting';

describe('drag scouting', () => {
  it('moves the viewing origin opposite the pointer in all planar directions', () => {
    expect(scoutOffset({q:0,r:0}, Math.sqrt(3)*100, 0, .01, 1).q).toBeCloseTo(-1);
    expect(scoutOffset({q:0,r:0}, 0, 150, .01, 1)).toEqual({q:.5,r:-1});
    const back=scoutOffset({q:-1,r:0}, -Math.sqrt(3)*100,0,.01,1);
    expect(back.q).toBeCloseTo(0); expect(back.r).toBe(0);
  });
  it('caps exploration and keeps exactly two visible rings inside the supplied pool', () => {
    const player={q:1000000,r:-1000000};
    const pool=new Set(disk(player,2+SCOUT_REACH).map(key));
    for(let dx=-1000;dx<=1000;dx+=37) for(let dy=-1000;dy<=1000;dy+=61) {
      const offset=scoutOffset({q:0,r:0},dx,dy,.025,1);
      expect(distance(offset)).toBeLessThanOrEqual(SCOUT_REACH+1e-10);
      const rounded=roundHex(offset);
      expect(distance(rounded)).toBeLessThanOrEqual(SCOUT_REACH);
      const visible=disk({q:player.q+rounded.q,r:player.r+rounded.r},2);
      expect(visible).toHaveLength(19);
      expect(visible.every(c=>pool.has(key(c)))).toBe(true);
    }
  });
  it('can inspect previously hidden cells without modifying the player position', () => {
    const player={q:0,r:0}, original=new Set(disk(player,2).map(key));
    const offset=roundHex(scoutOffset({q:0,r:0},-150,0,.02,1));
    expect(disk(offset,2).some(c=>!original.has(key(c)))).toBe(true);
    expect(player).toEqual({q:0,r:0});
  });
});
