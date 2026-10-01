// Gamepad for the player, on a desktop, a tablet or a phone with a controller paired. Loaded by viewer-tier.ts when a pad connects
// (browsers show a pad only after a first press, which fires `gamepadconnected`), polled once per frame from there.
//
//   left stick   walk (entering the free camera, like W A S D does)      right stick   look
//   triggers     RT rises, LT sinks                                       A  play or pause        B  back to the shot
//   Y            next time of day                                         bumpers  previous or next shot
//
// The standard mapping only (the layout every browser documents); a pad that does not report it is ignored rather than guessed at.
// The moves are the free camera's own (viewer-fp.ts), at the speed of the keyboard's. Live player only.
import { deadzone, lookBy, walkBy } from './viewer-fp.js';

const DEAD = 0.18, FLY_SPEED = 4, LOOK_SPEED = 2.2;   // m/s as viewer.ts's FLY_SPEED; rad/s at full deflection

export function mountPad(ctx: { api: any; toast(m: string, ms?: number): void; act: { playPause(): void; shot(step: number): void; tod(): void; back(): void; enter(): void; poke(): void; flying(): boolean; dirty(): void } }) {
  const { api, act } = ctx, rig = { camera: api.camera, controls: api.controls };
  let was: boolean[] = [], told = false;
  const pad = (): Gamepad | null => {
    try { for (const g of navigator.getGamepads() || []) if (g && g.connected && g.mapping === 'standard') return g; } catch { /* the Gamepad API blocked by a policy */ }
    return null;
  };
  const hint = () => { if (!told) { told = true; ctx.toast('Controller found. Left stick walks, right stick looks, A plays.', 4200); } };
  if (pad()) hint();
  addEventListener('gamepadconnected', () => { if (pad()) hint(); });

  return {
    tick(dt: number) {
      const g = pad();
      if (!g) { was = []; return; }
      hint();
      const b = g.buttons.map(x => x.pressed);
      const edge = (i: number) => b[i] && !was[i];
      // a press is the viewer being there: the idle fade waits, as for a key
      if (edge(0)) { act.poke(); act.playPause(); }
      if (edge(1)) { act.poke(); act.back(); }
      if (edge(3)) { act.poke(); act.tod(); }
      if (edge(4)) { act.poke(); act.shot(-1); }
      if (edge(5)) { act.poke(); act.shot(1); }
      was = b;
      const [lx, ly] = deadzone(g.axes[0] || 0, g.axes[1] || 0, DEAD), [rx, ry] = deadzone(g.axes[2] || 0, g.axes[3] || 0, DEAD);
      const up = ((g.buttons[7] && g.buttons[7].value) || 0) - ((g.buttons[6] && g.buttons[6].value) || 0);
      if (!(lx || ly || rx || ry || Math.abs(up) > 0.1)) return;
      act.poke();
      if (!act.flying()) act.enter();
      if (lx || ly || Math.abs(up) > 0.1) walkBy(rig, -ly * FLY_SPEED * dt, lx * FLY_SPEED * dt, up * FLY_SPEED * dt);
      // (stick up is -1: pushing up looks up; pushing right turns right, which is a negative yaw)
      if (rx || ry) lookBy(rig, -rx * LOOK_SPEED * dt, -ry * LOOK_SPEED * dt);
      act.dirty();
    },
  };
}
