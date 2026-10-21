// The app-media manifest reader: what the page generators import to put a real logo or a real screenshot on a page.
//
//   content/story/app-media.json       written by `pnpm run story:media` (scripts/story/build-app-media.mts), never by hand
//   portal/apps/<id>/logo.<hash10>.webp, shot.<hash10>.webp      the apps' logos (128 px) and screenshots (960 px wide)
//   portal/ci/<hub|portal>-<id>.<hash10>.webp                    Companion Hub and Companion account page screenshots
//
// The rules a page follows (reference/story/story-v2.md "App media"):
//   - a logo identifies the app it names, so it always sits beside that app's name, and carries its alt text;
//   - a screenshot is real and unedited: it is shown whole, with its caption, and never composited into anything;
//   - every image is lazy, with its width and height set (no layout shift); the front page loads none above the fold;
//   - an app with no entry, or a `null` logo or shot, is simply shown without one: never a stand-in.
// `logoImg` and `shotFigure` below write exactly that markup; a page that writes its own must keep those four properties.
//
// Pure Node, no image library: a file's size is read from its own header (`imageSize`), so the checks need no ffmpeg.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const ROOT = path.resolve(import.meta.dirname, '..', '..', '..');
export const MANIFEST = path.join('content', 'story', 'app-media.json');

// ---------------------------------------------------------------------------------------------------------- the manifest

export type MediaImage = { file: string; w: number; h: number; alt: string; source: string };
export type MediaShot = MediaImage & { caption: string };
export type CiShot = MediaShot & { id: string };
export type AppMedia = { name: string; logo: MediaImage | null; shot: MediaShot | null };
export type Rejected = { kind: 'logo' | 'shot' | 'ci'; id: string; source: string; reason: string };
export type MediaManifest = {
  v: 1;
  sources: { marketplace: string; hub: string; portal: string };
  apps: Record<string, AppMedia>;
  ci: { hub: CiShot[]; portal: CiShot[] };
  /** apps a family uses that have neither a logo nor a screenshot, on purpose (empty while every app has a logo) */
  noMedia: string[];
  rejected: Rejected[];
};

/** The manifest, or null when the file is not there (a checkout that has not run `pnpm run story:media`: pages then show no media). */
export function readMedia(root: string = ROOT): MediaManifest | null {
  const file = path.join(root, MANIFEST);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8')) as MediaManifest;
}

/** One app's media, or null (no entry: show the app by name alone). */
export function appMedia(m: MediaManifest | null, id: string): AppMedia | null {
  return (m && m.apps[id]) || null;
}

/** Companion Hub or the Companion account page: the real screenshots, in the order a visitor would meet them. */
export function ciShots(m: MediaManifest | null, which: 'hub' | 'portal'): CiShot[] {
  return (m && m.ci[which]) || [];
}

// ---------------------------------------------------------------------------------------------------------- the words

export const LOGO_BUDGET = 12 * 1024;
export const SHOT_BUDGET = 90 * 1024;
export const LOGO_PX = 128;
export const SHOT_PX = 960;
export const CAPTION_TAIL = 'Not a recording of this family.';
/** The caption of an app's screenshot, exactly (story-v2.md): the owner's wording, never edited per app. */
export const appCaption = (name: string): string => `Real screenshot of ${name} from a Companion Hub QA run. ${CAPTION_TAIL}`;
export const HUB_CAPTION_HEAD = 'Real screenshot of Companion Hub';
export const PORTAL_CAPTION_HEAD = 'Real screenshot of the Companion account page';

// ---------------------------------------------------------------------------------------------------------- the apps a story uses

/** The three first-party apps every family may meet. */
export const FIRST_PARTY = ['ci-hermes', 'ci-memory', 'ci-openclaw'];

/** Every app id the 30 families use (`beat.app.id` and `beat.with`), the persona pools, the plan's signature apps and the first-party trio: the apps that should have media. */
export function usedAppIds(root: string = ROOT): string[] {
  const ids = new Set<string>(FIRST_PARTY);
  const dir = path.join(root, 'content', 'families');
  if (fs.existsSync(dir)) {
    for (const f of fs.readdirSync(dir)) {
      if (!/^[a-z]+(-[a-z]+){0,2}\.json$/.test(f) || f === 'films.json') continue;
      let story: any;
      try { story = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); } catch { continue; }
      for (const b of Array.isArray(story?.beats) ? story.beats : []) {
        if (b?.app?.id) ids.add(String(b.app.id));
        for (const w of Array.isArray(b?.with) ? b.with : []) ids.add(String(typeof w === 'string' ? w : w?.id));
      }
    }
  }
  const read = (rel: string): any => { try { return JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8')); } catch { return null; } };
  for (const a of Object.values(read(path.join('content', 'story', 'personas.json'))?.archetypes || {}) as any[]) for (const id of a?.apps || []) ids.add(String(id));
  const walk = (o: any): void => { if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) { if (k === 'signatureApps' && Array.isArray(v)) v.forEach(x => ids.add(String(x))); else walk(v); } };
  walk(read(path.join('content', 'story', 'cast-plan.json')));
  ids.delete('undefined');
  return [...ids].sort();
}

/** Used apps with no entry in the manifest and not listed in `noMedia`: the stale-manifest warning's list. */
export function staleApps(m: MediaManifest | null, root: string = ROOT): string[] {
  const used = usedAppIds(root);
  if (!m) return used;
  return used.filter(id => !m.apps[id] && !m.noMedia.includes(id));
}

// ---------------------------------------------------------------------------------------------------------- markup

const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** A site-root-relative file ('portal/apps/x/logo.<hash>.webp') as a page at `depth` folders below the root names it ('../portal/…' at depth 1). */
export const mediaUrl = (file: string, depth = 0): string => `${depth > 0 ? '../'.repeat(depth) : './'}${file}`;

export type ImgOpts = { depth?: number; className?: string; /** the first picture of a page the visitor sees at once: `eager`; everything else is lazy */ eager?: boolean };

/** `<img>` for a logo or a screenshot: the alt text, the size, lazy loading and async decoding. */
export function imageTag(img: MediaImage, o: ImgOpts = {}): string {
  const cls = o.className ? ` class="${esc(o.className)}"` : '';
  return `<img${cls} src="${esc(mediaUrl(img.file, o.depth))}" alt="${esc(img.alt)}" width="${img.w}" height="${img.h}" loading="${o.eager ? 'eager' : 'lazy'}" decoding="async">`;
}
/** An app's logo as an `<img>`, or '' when it has none. It identifies the app named beside it: never use it without that name. */
export const logoImg = (a: AppMedia | null, o: ImgOpts = {}): string => (a && a.logo ? imageTag(a.logo, o) : '');
/** A screenshot with its caption, as a `<figure>`; '' when there is none. Never put anything over the picture. */
export function shotFigure(shot: MediaShot | null, o: ImgOpts & { figureClass?: string } = {}): string {
  if (!shot) return '';
  const cls = o.figureClass ? ` class="${esc(o.figureClass)}"` : '';
  return `<figure${cls}>${imageTag(shot, o)}<figcaption>${esc(shot.caption)}</figcaption></figure>`;
}


// ---------------------------------------------------------------------------------------------------------- the built pages

/**
 * What a built page must do with the media (portal:build step "app media", and its test): every <img> of a file under portal/apps/ or portal/ci/
 * names a file the manifest shipped (`named`: file -> its caption, '' for a logo) that is in the output, has alt text, its width and height and a
 * loading attribute (lazy on the front page, which loads none above the fold), and a page that shows a screenshot carries its caption.
 * `pages` are the built pages by their path under the output (`index.html`, `family/x.html`); `has` says whether a file is in the output.
 */
export function checkPageImages(pages: { file: string; html: string }[], named: Map<string, string>, has: (rel: string) => boolean): { problems: string[]; shown: number } {
  const problems: string[] = [];
  let shown = 0;
  for (const { file: p, html: t } of pages) {
    for (const m of t.matchAll(/<img\b[^>]*>/g)) {
      const tag = m[0], src = (tag.match(/\bsrc="([^"]*)"/) || [])[1] || '';
      const clean = src.split(/[?#]/)[0];
      if (!/(^|\/)portal\/(apps|ci)\//.test(clean)) continue;
      shown++;
      const file = path.posix.normalize(path.posix.join(path.posix.dirname(p), clean));
      if (!named.has(file)) { problems.push(`${p}: ${src} is not a file ${MANIFEST} names`); continue; }
      if (!has(file)) problems.push(`${p}: ${src} is not in the output`);
      if (!/\balt="(?=[^"]*[^"\s])[^"]*"/.test(tag)) problems.push(`${p}: ${src} has no alt text`);
      if (!/\bwidth="\d+"/.test(tag) || !/\bheight="\d+"/.test(tag)) problems.push(`${p}: ${src} has no width and height (the page would shift as it loads)`);
      const loading = (tag.match(/\bloading="([^"]*)"/) || [])[1];
      if (loading !== 'lazy' && loading !== 'eager') problems.push(`${p}: ${src} has no loading="lazy" or "eager"`);
      if (p === 'index.html' && loading !== 'lazy') problems.push(`${p}: ${src} loads eagerly; the front page loads no app media above the fold`);
      const caption = named.get(file);
      if (caption && !t.includes(esc(caption))) problems.push(`${p}: shows ${src}, a real screenshot, without its caption "${caption}"`);
    }
  }
  return { problems, shown };
}

// ---------------------------------------------------------------------------------------------------------- files

export const hash10 = (bytes: Uint8Array): string => crypto.createHash('sha256').update(bytes).digest('hex').slice(0, 10);

/** Width and height from a PNG, JPEG or WebP header (null when the bytes are none of them). */
export function imageSize(b: Uint8Array): { w: number; h: number; type: 'png' | 'jpeg' | 'webp' } | null {
  const buf = Buffer.from(b.buffer, b.byteOffset, b.byteLength);
  if (buf.length > 24 && buf.readUInt32BE(0) === 0x89504e47 && buf.toString('latin1', 12, 16) === 'IHDR') return { type: 'png', w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) { i++; continue; }
      const marker = buf[i + 1];
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { i += 2; continue; }
      const len = buf.readUInt16BE(i + 2);
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) return { type: 'jpeg', h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
      i += 2 + len;
    }
    return null;
  }
  if (buf.length > 30 && buf.toString('latin1', 0, 4) === 'RIFF' && buf.toString('latin1', 8, 12) === 'WEBP') {
    const kind = buf.toString('latin1', 12, 16);
    if (kind === 'VP8X') return { type: 'webp', w: 1 + buf.readUIntLE(24, 3), h: 1 + buf.readUIntLE(27, 3) };
    if (kind === 'VP8 ') return { type: 'webp', w: buf.readUInt16LE(26) & 0x3fff, h: buf.readUInt16LE(28) & 0x3fff };
    if (kind === 'VP8L') { const v = buf.readUInt32LE(21); return { type: 'webp', w: (v & 0x3fff) + 1, h: ((v >> 14) & 0x3fff) + 1 }; }
  }
  return null;
}

/** A WebP carries an alpha channel (a VP8X chunk with the alpha flag, or lossless VP8L with its alpha hint). */
export function webpHasAlpha(b: Uint8Array): boolean {
  const buf = Buffer.from(b.buffer, b.byteOffset, b.byteLength);
  const kind = buf.toString('latin1', 12, 16);
  if (kind === 'VP8X') return (buf[20] & 0x10) !== 0;
  if (kind === 'VP8L') return (buf[25] & 0x10) !== 0;
  return false;
}

/** JSON with sorted keys at every level (arrays keep their order) and a final newline: the same manifest, byte for byte. */
export function stable(v: unknown, indent = 0): string {
  const pad = '  '.repeat(indent + 1), end = '  '.repeat(indent);
  if (Array.isArray(v)) return v.length ? `[\n${v.map(x => pad + stable(x, indent + 1)).join(',\n')}\n${end}]` : '[]';
  if (v && typeof v === 'object') {
    const keys = Object.keys(v as object).sort();
    return keys.length ? `{\n${keys.map(k => `${pad}${JSON.stringify(k)}: ${stable((v as any)[k], indent + 1)}`).join(',\n')}\n${end}}` : '{}';
  }
  return JSON.stringify(v);
}

// ---------------------------------------------------------------------------------------------------------- the checks

const DASH = /[–—]/;
const FILE_RE = /^portal\/(?:apps\/[a-z0-9-]+\/(?:logo|shot)|ci\/(?:hub|portal)-[a-z0-9-]+)\.([0-9a-f]{10})\.webp$/;

/**
 * Every rule the manifest must meet, as problems (an empty list is a clean manifest). Used by `portal:build` (a family page or the manifest
 * naming a file that is not there, or an image with no alt) and by scripts/test-app-media.mts. `root` is a checkout (the files are read from it).
 */
export function checkManifest(m: MediaManifest, root: string = ROOT): string[] {
  const out: string[] = [];
  const bad = (msg: string): void => { out.push(msg); };
  if (!m || m.v !== 1) return ['app-media.json: v is not 1'];
  for (const k of ['marketplace', 'hub', 'portal'] as const) if (!/^[0-9a-f]{40}$/.test(m.sources?.[k] || '')) bad(`sources.${k} is not a full commit sha`);
  const shaOk = (src: string): boolean => { const at = src.lastIndexOf('@'); const sha = at < 0 ? '' : src.slice(at + 1); return /^[0-9a-f]{12}$/.test(sha) && Object.values(m.sources || {}).some(s => s.startsWith(sha)); };
  const seen = new Set<string>();
  const image = (where: string, img: MediaImage | null, kind: 'logo' | 'shot', budget: number, withId = false): void => {
    if (!img) return;
    const keys = Object.keys(img).sort().join();
    const want = kind === 'shot' ? (withId ? 'alt,caption,file,h,id,source,w' : 'alt,caption,file,h,source,w') : 'alt,file,h,source,w';
    if (keys !== want) bad(`${where}: keys are ${keys}, want ${want}`);
    if (!FILE_RE.test(img.file || '')) { bad(`${where}: file ${JSON.stringify(img.file)} is not portal/apps/<id>/(logo|shot).<hash10>.webp or portal/ci/(hub|portal)-<id>.<hash10>.webp`); return; }
    if (seen.has(img.file)) bad(`${where}: ${img.file} is named twice`);
    seen.add(img.file);
    const abs = path.join(root, img.file);
    if (!fs.existsSync(abs)) { bad(`${where}: ${img.file} does not exist`); return; }
    const bytes = fs.readFileSync(abs);
    if (hash10(bytes) !== FILE_RE.exec(img.file)![1]) bad(`${where}: ${img.file} is not named by the hash of its bytes`);
    if (bytes.length > budget) bad(`${where}: ${img.file} is ${bytes.length} bytes, over its ${budget}`);
    const size = imageSize(bytes);
    if (!size || size.type !== 'webp') bad(`${where}: ${img.file} is not a WebP`);
    else if (size.w !== img.w || size.h !== img.h) bad(`${where}: the manifest says ${img.w} x ${img.h}, the file is ${size.w} x ${size.h}`);
    if (kind === 'logo' && (img.w !== LOGO_PX || img.h !== LOGO_PX)) bad(`${where}: a logo is ${LOGO_PX} x ${LOGO_PX}`);
    if (kind === 'shot' && img.w !== SHOT_PX) bad(`${where}: a screenshot is ${SHOT_PX} px wide`);
    if (!img.alt || !img.alt.trim()) bad(`${where}: no alt text`);
    else if (DASH.test(img.alt) || /[!]/.test(img.alt)) bad(`${where}: the alt text has a dash or an exclamation mark`);
    if (!img.source || !/^CI-(Marketplace|Hub|Portal) \S+@[0-9a-f]{12}$/.test(img.source) || !shaOk(img.source)) bad(`${where}: source ${JSON.stringify(img.source)} is not "<repo> <path>@<sha12>" of one of the pinned commits`);
  };
  const caption = (where: string, s: MediaShot, want: (c: string) => boolean, what: string): void => {
    if (!s.caption || !want(s.caption)) bad(`${where}: the caption is not ${what}`);
    else if (DASH.test(s.caption) || /[!]/.test(s.caption)) bad(`${where}: the caption has a dash or an exclamation mark`);
  };
  for (const [id, a] of Object.entries(m.apps || {})) {
    const where = `apps.${id}`;
    if (!/^[a-z0-9-]+$/.test(id)) bad(`${where}: not an app id`);
    if (!a.name || !a.name.trim()) bad(`${where}: no name`);
    if (Object.keys(a).sort().join() !== 'logo,name,shot') bad(`${where}: keys are ${Object.keys(a).sort().join()}, want logo,name,shot`);
    image(`${where}.logo`, a.logo, 'logo', LOGO_BUDGET);
    image(`${where}.shot`, a.shot, 'shot', SHOT_BUDGET);
    if (a.logo && !a.logo.file.startsWith(`portal/apps/${id}/logo.`)) bad(`${where}.logo: file is not under portal/apps/${id}/`);
    if (a.shot && !a.shot.file.startsWith(`portal/apps/${id}/shot.`)) bad(`${where}.shot: file is not under portal/apps/${id}/`);
    if (a.shot) caption(`${where}.shot`, a.shot, c => c === appCaption(a.name), `exactly "${appCaption(a.name)}"`);
    if (!a.logo && !a.shot) bad(`${where}: neither a logo nor a screenshot: list it in noMedia instead`);
  }
  for (const id of m.noMedia || []) if (m.apps?.[id]) bad(`noMedia lists ${id}, which has an entry`);
  for (const which of ['hub', 'portal'] as const) {
    const list = m.ci?.[which];
    if (!Array.isArray(list)) { bad(`ci.${which} is not a list`); continue; }
    if (list.length < 3 || list.length > 6) bad(`ci.${which} has ${list.length} screenshots, want 3 to 6 (or none, when the repos have no real one: say so in the report)`);
    const ids = new Set<string>();
    for (const s of list) {
      const where = `ci.${which}.${s.id}`;
      if (!/^[a-z0-9-]+$/.test(s.id || '')) bad(`${where}: not an id`);
      if (ids.has(s.id)) bad(`${where}: id used twice`);
      ids.add(s.id);
      image(where, s, 'shot', SHOT_BUDGET, true);
      if (!s.file.startsWith(`portal/ci/${which}-${s.id}.`)) bad(`${where}: file is not portal/ci/${which}-${s.id}.<hash10>.webp`);
      const head = which === 'hub' ? HUB_CAPTION_HEAD : PORTAL_CAPTION_HEAD;
      caption(where, s, c => c.startsWith(`${head}.`) || c.startsWith(`${head} `) || c.startsWith(`${head},`), `a "${head}" sentence`);
      if (s.caption && !s.caption.endsWith(CAPTION_TAIL)) bad(`${where}: the caption does not end "${CAPTION_TAIL}"`);
    }
  }
  const rej = m.rejected;
  if (!Array.isArray(rej)) bad('rejected is not a list');
  else for (const r of rej) {
    if (!['logo', 'shot', 'ci'].includes(r.kind) || !r.id || !r.source || !r.reason || !r.reason.trim()) bad(`rejected ${JSON.stringify(r).slice(0, 80)}: needs kind, id, source and a reason`);
    else if (DASH.test(r.reason)) bad(`rejected ${r.id}: the reason has a dash`);
  }
  return out;
}
