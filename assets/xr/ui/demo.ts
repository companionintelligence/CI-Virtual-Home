// assets/xr/ui/demo.ts : the XR Presenter driven end to end by MOCK beats, with no story code present. A stand-in Director (a few dozen lines)
// plays the part of assets/story/director.ts: it gives the presenter its PresenterHost, hands it BeatViews built around where the person
// stands, ticks the beat clock, and does what the Director does with the events that come back (next, prev, chapter, replay, exit).
//
// It exists for three reasons: the conformance tests need a presenter to exercise before the story branch is merged; the first person with a
// headset needs a tour to look at without a baked story; and it is the worked example of what the Director must call. It is loaded only on
// demand (index.ts debug.demo() is a dynamic import), so nothing of it is in a visitor's download.
//
//   const d = await createDemoDirector(ui);   d.start();   ...   d.stop();
//   const report = await runDemo(ui);         // the whole script: start card, four beats with words, next, a chapter jump, the end card
import type { XrFrame } from '../host.js';
import type {
  BeatClock, BeatView, ChapterView, ClipRef, Disclosure, EnterResult, MemberView, PlaybackModel, Presenter, PresenterEvent, PresenterHost, PresenterSettings, PresenterStory, V3,
} from '../presenter.js';
import type { XrUiImpl } from './index.js';
import type { XrPresenterApi } from './tour-presenter.js';

const DISCLOSURE: Disclosure = {
  fictional: 'Fictional family. Real software.',
  scripted: 'Scenes are written for this site. They show what the listed apps do. They are not recordings of a real session.',
  stylised: 'The Companion Core is drawn as a stylised illustration, not a photograph.',
  synthetic: 'Narration is generated locally with an open text-to-speech model. It is not a recording of a person.',
  beta: 'Companion OS, Companion Memory and Companion Agents are in beta.',
  signoff: 'UnCloud your life.',
};
const MEMBERS: MemberView[] = [
  { id: 'mia', name: 'Mia', initial: 'M', role: 'parent', colour: 'chart-2', companion: { name: 'Hermes', runtime: 'Hermes' } },
  { id: 'theo', name: 'Theo', initial: 'T', role: 'teen', colour: 'chart-5', companion: null },
];
const CHAPTERS: ChapterView[] = [
  { id: 'welcome', kind: 'ftue', title: 'Welcome', index: 0, beat0: 0, beats: 1 },
  { id: 'kitchen', kind: 'room', title: 'The kitchen', index: 1, beat0: 1, beats: 2 },
  { id: 'goodbye', kind: 'outro', title: 'Goodbye', index: 2, beat0: 3, beats: 1 },
];
const STORY: PresenterStory = {
  slug: 'demo', surname: 'Demo', tagline: 'A short tour built from mock beats, to try the headset interface.', address: '12 Example Road',
  members: MEMBERS, chapters: CHAPTERS, beatCount: 4,
  closing: { body: 'That was the tour. Your own home can do all of this, and none of it needs the cloud.', ctaLabel: 'See the Companion Core', ctaUrl: 'https://example.invalid/core' },
  disclosure: DISCLOSURE, core: null, durations: 'estimated', fonts: { family: 'Manrope', weights: [500, 600, 700, 800] },
};

const clip = (id: string, speaker: string, text: string, wps = 3.2): ClipRef => {
  const ws = text.split(/\s+/); let t = 0;
  return { id, url: '', durationMs: Math.round(ws.length * 1000 / wps), speaker, voice: 'mock', words: ws.map(w => { const a = t; t += 1000 / wps; return [w, Math.round(a), Math.round(t)] as [string, number, number]; }) };
};

interface Spot { az: number; dist: number; w: number; h: number; level?: string | null }
const SPOTS: Spot[] = [{ az: 0, dist: 3.2, w: 1.4, h: 1.2 }, { az: -35, dist: 3.6, w: 1.0, h: 1.0 }, { az: 40, dist: 3.4, w: 0.8, h: 0.9 }, { az: 8, dist: 3.8, w: 1.6, h: 1.4 }];

export interface DemoOpts {
  /** XR frames to wait; the default listens to the session's own loop (window.__houseViewer.xr.onFrame), because a headset's page rAF is paused */
  frames?: (n: number) => Promise<void>;
  wordsPerSecond?: number;
}

export interface DemoDirector {
  readonly presenter: XrPresenterApi;
  readonly events: PresenterEvent[];
  readonly enter: Array<EnterResult & { id: string }>;
  index(): number;
  beats(): BeatView[];
  state(): 'idle' | 'beat' | 'end' | 'stopped';
  start(): Promise<void>;
  /** play the current beat's clock to its end (words advance), without moving on */
  speak(): Promise<void>;
  go(index: number, from?: 'next' | 'prev' | 'jump' | 'chapter' | 'replay'): Promise<EnterResult>;
  stop(): void;
  model(): PlaybackModel;
}

export async function createDemoDirector(ui: XrUiImpl, o: DemoOpts = {}): Promise<DemoDirector> {
  const xr = (window as any).__houseViewer?.xr;
  const frames = o.frames || ((n: number) => new Promise<void>(res => { let k = 0; const off = xr.onFrame(() => { if (++k >= n) { off(); res(); } }); }));
  const wps = o.wordsPerSecond ?? 8;
  const events: PresenterEvent[] = [], enter: Array<EnterResult & { id: string }> = [];
  let settings: PresenterSettings = { textScale: 1, contrast: 'normal', posture: 'standing', handedness: 'right', autoAdvance: 'step', reducedMotion: false };
  let idx = 0, st: 'idle' | 'beat' | 'end' | 'stopped' = 'idle', busy = false, playing = true, muted = false, chaptersOpen = false;
  let view: BeatView | null = null; let queued: PresenterEvent | null = null;
  const beats = buildBeats(ui);

  const model = (): PlaybackModel => ({
    playing, muted, hasAudio: true, audioFailed: false, beatIndex: idx, beatCount: beats.length, chapterIndex: view ? view.chapter.index : 0,
    canPrev: idx > 0, canNext: true, chaptersOpen, ended: st === 'end', settings,
  });
  const host: PresenterHost = {
    story: STORY, ambient() {}, now: () => performance.now(), log: (l, m) => { if (l !== 'info') console.warn('demo director:', m); },
    settings: { get: () => settings, set: (p) => { settings = { ...settings, ...p }; presenter.update(model()); } },
    emit(e) { events.push(e); void handle(e); },
  };
  const presenter = ui.presenter(host);
  if (!presenter) throw new Error('the XR UI is not mounted');

  async function handle(e: PresenterEvent): Promise<void> {
    if (st === 'stopped') return;
    if (busy) { if (e.type === 'next' || e.type === 'prev') queued = queued ? queued : e; return; }
    if (e.type === 'next') { if (st === 'beat') { if (idx + 1 >= beats.length) await finish(); else await go(idx + 1, 'next'); } }
    else if (e.type === 'prev') { if (st === 'beat' && idx > 0) await go(idx - 1, 'prev'); }
    else if (e.type === 'chapter') { const c = CHAPTERS.find(x => x.id === (e as any).id); if (c) { chaptersOpen = false; await go(c.beat0, 'chapter'); } }
    else if (e.type === 'replay') await go(0, 'replay');
    else if (e.type === 'play') { playing = true; presenter!.update(model()); }
    else if (e.type === 'pause') { playing = false; presenter!.update(model()); }
    else if (e.type === 'mute') { muted = (e as any).muted; presenter!.update(model()); }
  }

  async function go(i: number, from: 'next' | 'prev' | 'jump' | 'chapter' | 'replay' | 'start' = 'jump'): Promise<EnterResult> {
    busy = true;
    try {
      if (view && st === 'beat') await presenter!.exitBeat(view, { to: from === 'next' ? 'next' : from === 'prev' ? 'prev' : from === 'chapter' ? 'chapter' : from === 'replay' ? 'replay' : 'jump', reducedMotion: false, signal: new AbortController().signal });
      idx = i; view = beats[i]; st = 'beat';
      const r = await presenter!.enterBeat(view, { from: from as any, reducedMotion: false, signal: new AbortController().signal });
      enter.push({ ...r, id: view.id });
      presenter!.update(model());
      return r;
    } finally {
      busy = false;
      if (queued) { const q = queued; queued = null; void handle(q); }
    }
  }
  async function finish(): Promise<void> {
    busy = true;
    try {
      if (view) await presenter!.exitBeat(view, { to: 'end', reducedMotion: false, signal: new AbortController().signal });
      st = 'end'; view = null;
      await presenter!.showEnd({ closing: STORY.closing, hasNextFamily: true, core: STORY.core, disclosure: DISCLOSURE });
      presenter!.update(model());
    } finally { busy = false; }
  }

  const d: DemoDirector = {
    presenter, events, enter, index: () => idx, beats: () => beats, state: () => st, model,
    async start() {
      await presenter!.prepare(STORY);
      await presenter!.start({ audio: 'narrated', beat: 0, paused: false });
      presenter!.update(model());
      await frames(20);              // the title card is on show for a moment
      await go(0, 'start');
    },
    async speak() {
      if (!view) return;
      const clips = [view.narration, view.sayClip].filter(Boolean) as ClipRef[];
      for (const c of clips) {
        for (let wi = -1; wi < c.words.length; wi++) {
          const clock: BeatClock = {
            beatT: 0, phase: c.id === view.narration?.id ? 'narration' : 'say', line: { id: c.id, ms: wi < 0 ? 0 : c.words[wi][1], wordIndex: wi, speaker: c.speaker },
            playing: true, muted: false, source: 'wall', progress: Math.max(0, (wi + 1) / c.words.length), nextInS: null,
          };
          presenter!.tick(clock);
          await frames(Math.max(1, Math.round(72 / wps)));
        }
      }
      presenter!.tick({ beatT: 0, phase: 'tail', line: null, playing: true, muted: false, source: 'wall', progress: 1, nextInS: null });
    },
    go: (i, from) => go(i, from),
    stop() { st = 'stopped'; try { presenter!.dispose(); } catch { /* gone */ } },
  };
  return d;
}

interface Spec { title: string; body: string; member?: MemberView; say?: string; note?: string; chips?: string[]; phone?: { header: string; rows: string[] } }

function buildBeats(ui: XrUiImpl): BeatView[] {
  // anchored on where the person stands NOW, so the same mock tour works in any house. Each beat stands somewhere else (a metre or two away, on
  // a floor the locomotion module calls walkable when it is present), so every beat is a real blink.
  const h = ui.debug.head(), world = ui.debug.world();
  const base: V3 = [h.pos[0], 0, h.pos[2]], yaw0 = h.yawDeg * Math.PI / 180;
  const rot = (dx: number, dz: number): [number, number] => [base[0] + dx * Math.cos(yaw0) + dz * Math.sin(yaw0), base[2] - dx * Math.sin(yaw0) + dz * Math.cos(yaw0)];
  const OFFSETS: Array<Array<[number, number]>> = [
    [[0, 0]], [[-1.5, 1.0], [-1.0, 0.6], [1.5, 1.0], [0, 0]], [[0, -1.5], [0.8, -1.0], [-0.8, 1.2], [0, 0]], [[1.2, 1.2], [1.0, 0.5], [-1.2, 0.8], [0, 0]],
  ];
  const free = (from: V3, azRad: number) => ui.debug.freeDistance([from[0], 1.4, from[2]], [-Math.sin(azRad), 0, -Math.cos(azRad)]);
  const stand = (i: number): V3 => {
    for (const [dx, dz] of OFFSETS[i]) {
      const [x, z] = rot(dx, dz);
      try {
        if (world && !(world.floorY(x, z, null) != null && world.walkable(x, z, null, 0.3))) continue;
        const d = Math.hypot(x - base[0], z - base[2]);
        if (d > 0.05 && free([base[0], 0, base[2]], Math.atan2(-(x - base[0]), -(z - base[2]))) < d + 0.4) continue;   // nothing solid between here and there
        return [x, 1.6, z];
      } catch { /* next */ }
    }
    return [base[0], 1.6, base[2]];
  };
  // the subject: along the spot's bearing if the way is open, else the most open bearing; never nearer than 1.8 m or farther than the wall
  const at = (s: Spot, eye: V3): { eye: V3; focus: V3; box: BeatView['anchor']['box'] } => {
    let best = { az: s.az, open: -1 };
    for (const daz of [0, 25, -25, 50, -50, 80, -80, 120, -120, 180]) {
      const open = free(eye, yaw0 - (s.az + daz) * Math.PI / 180);
      if (open >= s.dist + 0.5) { best = { az: s.az + daz, open }; break; }
      if (open > best.open) best = { az: s.az + daz, open };
    }
    const a = yaw0 - best.az * Math.PI / 180, dist = Math.max(1.8, Math.min(s.dist, best.open - 0.45));
    const fx = eye[0] - Math.sin(a) * dist, fz = eye[2] - Math.cos(a) * dist;
    const focus: V3 = [fx, 1.0, fz];
    return { eye, focus, box: [fx - s.w / 2, 0.2, fz - s.w / 2, fx + s.w / 2, 0.2 + s.h, fz + s.w / 2] };
  };
  const mk = (i: number, id: string, ch: number, spot: Spot, v: Spec): BeatView => {
    const a = at(spot, stand(i)), member = v.member ?? null;
    return {
      index: i, count: 4, id, chapter: CHAPTERS[ch], member, companion: member?.companion ?? null, say: v.say ? { speaker: member ? member.id : 'narrator', text: v.say } : null,
      popup: { kind: v.phone ? 'phone' : 'card', title: v.title, body: v.body, note: v.note ?? null, chips: v.chips ?? [], phone: v.phone ? { header: v.phone.header, rows: v.phone.rows } as any : null },
      app: null, emphasis: { ring: true, wake: false }, narration: clip(id, 'narrator', v.body), sayClip: v.say ? clip(id + '.say', 'Hermes', v.say) : null,
      anchor: { role: 'subject', box: a.box, focus: a.focus, level: null }, rest: { eye: a.eye, target: a.focus, fov: 60, level: null },
      timing: { t0: i * 8, t1: i * 8 + 8, popupAt: 0.3, speechAt: 0.5, sayAt: v.say ? 5 : null, readS: 6, narrationS: 6, sayS: 3 },
    };
  };
  return [
    mk(0, 'b0', 0, SPOTS[0], { title: 'Welcome to the demo home', body: 'This is a short tour made of mock beats. It shows how a card, a caption and a leader line look in a headset.' }),
    mk(1, 'b1', 1, SPOTS[1], {
      title: 'Photos find themselves', member: MEMBERS[0], phone: { header: 'Last summer', rows: ['The lake, June 14', 'Dad on the dock', 'Sunset from the boat'] },
      body: 'Mia asks her companion for last summer, and the photos she took come up on the kitchen screen, with nothing sent anywhere.',
      say: 'Here is the weekend at the lake.', note: 'Everything stays on this home.', chips: ['Companion Memory', 'replaces Photos'],
    }),
    mk(2, 'b2', 1, SPOTS[2], {
      title: 'Dinner without the app hunt', member: MEMBERS[1],
      body: 'Theo needs a recipe for four. His companion reads the family notes, picks one, and puts the list on the fridge door.',
      note: 'Installing apps uses the internet.', chips: ['Companion Agents'],
    }),
    mk(3, 'b3', 2, SPOTS[3], { title: 'That is the tour', body: 'Every stop here ran on one small box in the house. Ask about it, or keep walking around.' }),
  ];
}

export interface DemoReport {
  enters: Array<{ id: string; reach: string; ms: number; ok: boolean | null; mode: string | null; notes: string[]; texts: string[]; footprint: { nodes: number; textureBytes: number; drawCalls: number } }>;
  events: PresenterEvent[];
  maxFootprint: { textureBytes: number; drawCalls: number; panels: number };
  endTexts: string[]; chapterTexts: string[]; faults: string[];
}

/** The whole script. Returns what a test needs to judge it; leaves the UI in the end-card state until stop() */
export async function runDemo(ui: XrUiImpl, o: DemoOpts = {}): Promise<{ report: DemoReport; director: DemoDirector }> {
  const d = await createDemoDirector(ui, o);
  const frames = o.frames || ((n: number) => new Promise<void>(res => { let k = 0; const off = (window as any).__houseViewer.xr.onFrame(() => { if (++k >= n) { off(); res(); } }); }));
  const max = { textureBytes: 0, drawCalls: 0, panels: 0 };
  const sample = () => { const f = ui.debug.footprint(); max.textureBytes = Math.max(max.textureBytes, f.textureBytes); max.drawCalls = Math.max(max.drawCalls, f.drawCalls); max.panels = Math.max(max.panels, ui.debug.panels().length); };
  const faults: string[] = [];
  const enters: DemoReport['enters'] = [];
  const snap = (id: string, r: EnterResult) => { sample(); enters.push({ id, reach: String(r.reach), ms: r.ms, ok: r.placement ? r.placement.ok : null, mode: r.placement ? r.placement.mode : null, notes: r.notes, texts: d.presenter.debug.texts(), footprint: ui.debug.footprint() }); };
  const n = () => d.enter.length;
  await d.start();
  snap('b0', d.enter[0]);
  await d.speak(); sample();
  // next, through the same path a ray press takes
  for (let i = 1; i < 4; i++) {
    d.presenter.press('next');
    await waitFor(() => d.state() === 'beat' && d.index() === i && n() === i + 1, frames);
    snap(d.enter[i].id, d.enter[i]);
    await d.speak(); sample();
  }
  // the chapter menu: open it as the Director would (chaptersOpen), pick chapter 2
  d.presenter.update({ ...d.model(), chaptersOpen: true }); await frames(8);
  const chapterTexts = ui.debug.menu().texts.slice(); sample();
  ui.debug.press('menu', 'chapter:kitchen');
  await waitFor(() => d.state() === 'beat' && d.index() === 1 && n() === 5, frames);
  sample();
  for (let i = 2; i < 4; i++) { d.presenter.press('next'); await waitFor(() => d.state() === 'beat' && d.index() === i && n() === 4 + i, frames); }
  // the end card
  d.presenter.press('next');
  await waitFor(() => d.state() === 'end', frames); await frames(10); sample();
  const endTexts = d.presenter.debug.texts();
  return { report: { enters, events: d.events.slice(), maxFootprint: max, endTexts, chapterTexts, faults }, director: d };
}

async function waitFor(cond: () => boolean, frames: (n: number) => Promise<void>, maxFrames = 600): Promise<void> {
  for (let i = 0; i < maxFrames; i++) { if (cond()) return; await frames(1); }
  throw new Error('the demo flow did not reach the expected state');
}
export type { Presenter, XrFrame };
