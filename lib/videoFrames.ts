'use client';

// Prepares a phone video for book recognition in the browser: evenly spaced JPEG frames
// and the sound as a small mono WAV, kept under the size the site's server accepts.
import { supabase } from './supabase';
import type { BookHit } from './recommendations';

const BUDGET = 3.8 * 1024 * 1024; // bytes sent to the server in one request

function waitFor(el: HTMLVideoElement, event: string) {
  return new Promise<void>((resolve, reject) => {
    const ok = () => { cleanup(); resolve(); };
    const bad = () => { cleanup(); reject(new Error('video')); };
    const cleanup = () => { el.removeEventListener(event, ok); el.removeEventListener('error', bad); };
    el.addEventListener(event, ok, { once: true });
    el.addEventListener('error', bad, { once: true });
  });
}

/** Frames spread over the whole video. */
export async function videoFrames(file: File, count: number, width = 720, quality = 0.7, onStep?: (i: number, n: number) => void): Promise<Blob[]> {
  const url = URL.createObjectURL(file);
  const v = document.createElement('video');
  v.muted = true; v.playsInline = true; v.preload = 'auto'; v.src = url;
  try {
    await waitFor(v, 'loadeddata');
    const d = v.duration;
    if (!Number.isFinite(d) || d <= 0) throw new Error('duration');
    const scale = Math.min(1, width / (v.videoWidth || width));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round((v.videoWidth || width) * scale);
    canvas.height = Math.round((v.videoHeight || width) * scale);
    const ctx = canvas.getContext('2d')!;
    const out: Blob[] = [];
    for (let i = 0; i < count; i++) {
      v.currentTime = Math.min(d - 0.05, (d * (i + 0.5)) / count);
      await waitFor(v, 'seeked');
      ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', quality));
      if (blob) out.push(blob);
      onStep?.(i + 1, count);
    }
    return out;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function videoDuration(file: File): Promise<number> {
  const url = URL.createObjectURL(file);
  const v = document.createElement('video');
  v.preload = 'metadata'; v.src = url;
  try { await waitFor(v, 'loadedmetadata'); return v.duration; } finally { URL.revokeObjectURL(url); }
}

/** The sound as mono 16-bit WAV at the given rate, at most `maxSeconds` long. Null if the browser cannot read it. */
export async function videoAudio(file: File, rate: number, maxSeconds: number): Promise<Blob | null> {
  try {
    const buf = await file.arrayBuffer();
    const ctx = new AudioContext();
    const audio = await ctx.decodeAudioData(buf);
    void ctx.close();
    const seconds = Math.min(audio.duration, maxSeconds);
    const off = new OfflineAudioContext(1, Math.ceil(seconds * rate), rate);
    const src = off.createBufferSource();
    src.buffer = audio;
    src.connect(off.destination);
    src.start(0, 0, seconds);
    const mono = (await off.startRendering()).getChannelData(0);
    const data = new DataView(new ArrayBuffer(44 + mono.length * 2));
    const str = (o: number, s: string) => { for (let i = 0; i < s.length; i++) data.setUint8(o + i, s.charCodeAt(i)); };
    str(0, 'RIFF'); data.setUint32(4, 36 + mono.length * 2, true); str(8, 'WAVE');
    str(12, 'fmt '); data.setUint32(16, 16, true); data.setUint16(20, 1, true); data.setUint16(22, 1, true);
    data.setUint32(24, rate, true); data.setUint32(28, rate * 2, true); data.setUint16(32, 2, true); data.setUint16(34, 16, true);
    str(36, 'data'); data.setUint32(40, mono.length * 2, true);
    for (let i = 0; i < mono.length; i++) data.setInt16(44 + i * 2, Math.max(-1, Math.min(1, mono[i])) * 0x7fff, true);
    return new Blob([data.buffer], { type: 'audio/wav' });
  } catch {
    return null;
  }
}

export interface ScanMatch extends BookHit { score: number; }
export interface ScanBook { title: string; author?: string; featured: boolean; source?: string; copies?: number; matches: ScanMatch[]; }
export interface ScanResult { model: string; frames: number; audio: boolean; books: ScanBook[]; }

/** Which instructions the recognition uses: 'video' for recommendation videos, 'shelf' for books to add to stock. */
export type ScanMode = 'video' | 'shelf';

/** Prepare the video, send it, and return the books found with their matches in stock. */
export async function scanVideo(file: File, onProgress: (text: string) => void, mode: ScanMode = 'video'): Promise<ScanResult> {
  onProgress('קורא את הסרטון…');
  const d = await videoDuration(file);
  // Shelf frames are larger, so fewer of them keep the answer within the time limit.
  const frameCount = Math.max(8, Math.min(mode === 'shelf' ? 16 : 40, Math.ceil(d / 1.5)));
  onProgress('מחלץ את הקול…');
  const audio = await videoAudio(file, d <= 120 ? 16000 : 8000, 180);
  // Books on shelves need sharper frames to read the spines.
  const frames = await videoFrames(file, frameCount, mode === 'shelf' ? 1280 : 720, mode === 'shelf' ? 0.8 : 0.7, (i, n) => onProgress(`חותך תמונות מהסרטון: ${i} מתוך ${n}`));

  // Keep within the request size: drop the sound first, then every other frame.
  let parts = [...frames];
  let sound: Blob | null = audio;
  const size = () => parts.reduce((a, b) => a + b.size, 0) + (sound?.size ?? 0);
  if (size() > BUDGET) sound = null;
  while (size() > BUDGET && parts.length > 8) parts = parts.filter((_, i) => i % 2 === 0);

  const form = new FormData();
  parts.forEach((b, i) => form.append('frames', b, `f${i}.jpg`));
  if (sound) form.append('audio', sound, 'audio.wav');
  if (mode !== 'video') form.append('mode', mode);
  return sendScan(form, onProgress);
}

/** Draw part of an image (sx, sy, sw, sh) at most maxSide pixels on its long side, as JPEG. */
async function crop(img: ImageBitmap, sx: number, sy: number, sw: number, sh: number, maxSide: number, quality: number): Promise<Blob> {
  const scale = Math.min(1, maxSide / Math.max(sw, sh));
  const c = document.createElement('canvas');
  c.width = Math.round(sw * scale); c.height = Math.round(sh * scale);
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height);
  return new Promise<Blob>((ok, bad) => c.toBlob((b) => (b ? ok(b) : bad(new Error('encode'))), 'image/jpeg', quality));
}

/**
 * Photos of books: each photo is sent whole, followed by two overlapping close-up halves
 * (left and right, or top and bottom), so spines and small print stay readable.
 */
export async function scanImages(files: File[], onProgress: (text: string) => void): Promise<ScanResult> {
  // One request per picture keeps each answer fast; two run at a time and the lists are merged.
  const one = async (file: File, halves: boolean) => {
    const img = await createImageBitmap(file);
    const out: Blob[] = [await crop(img, 0, 0, img.width, img.height, 1600, 0.8)];
    if (halves) {
      const wide = img.width >= img.height;
      const w = wide ? Math.round(img.width * 0.55) : img.width, h = wide ? img.height : Math.round(img.height * 0.55);
      out.push(await crop(img, 0, 0, w, h, 1600, 0.8));
      out.push(await crop(img, img.width - w, img.height - h, w, h, 1600, 0.8));
    }
    const form = new FormData();
    out.forEach((b, i) => form.append('frames', b, `f${i}.jpg`));
    form.append('mode', 'shelf');
    return sendScan(form, () => {});
  };
  let done = 0;
  const results: ScanResult[] = new Array(files.length);
  const report = () => onProgress(`מזהה ספרים בתמונות: ${done} מתוך ${files.length} הושלמו (עד דקה לכל תמונה)`);
  report();
  let next = 0;
  let failure: Error | null = null;
  const worker = async () => {
    while (next < files.length) {
      const i = next++;
      try {
        try { results[i] = await one(files[i], true); }
        catch (e) { if (!/עמוס|איטי/.test((e as Error).message)) throw e; results[i] = await one(files[i], false); }
      } catch (e) { failure = e as Error; }
      done++; report();
    }
  };
  await Promise.all([worker(), worker()]);
  const ok = results.filter(Boolean);
  if (!ok.length) throw failure ?? new Error('הזיהוי לא הצליח.');
  // The same book seen in two pictures is listed once, with the larger count of copies.
  const key = (t: string) => t.replace(/[^\p{L}\p{N}]+/gu, ' ').trim().toLowerCase();
  const seen = new Map<string, ScanBook>();
  for (const r of ok) for (const b of r.books) {
    const k = key(b.title);
    const had = seen.get(k);
    if (!had) seen.set(k, { ...b });
    else {
      had.copies = Math.max(had.copies || 1, b.copies || 1);
      if (!had.author && b.author) had.author = b.author;
      if (!had.matches?.length && b.matches?.length) had.matches = b.matches;
    }
  }
  return { model: ok[0].model, frames: ok.reduce((a, r) => a + r.frames, 0), audio: false, books: [...seen.values()] };
}

async function sendScan(form: FormData, onProgress: (text: string) => void): Promise<ScanResult> {
  onProgress('שולח ל-Gemini ומזהה ספרים… (עד דקה)');
  const { data } = await supabase().auth.getSession();
  const res = await fetch('/video-scan', {
    method: 'POST',
    headers: { Authorization: `Bearer ${data.session?.access_token ?? ''}` },
    body: form,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (json.error === 'missing key') throw new Error('עדיין לא הוגדר מפתח של Gemini בהגדרות של Codata.');
    if (json.error === 'not staff') throw new Error('צריך להיות מחובר כצוות.');
    if (json.error === 'busy' || res.status === 504) throw new Error('Gemini עמוס או איטי כרגע. נסו שוב בעוד כמה דקות.');
    throw new Error(`הזיהוי לא הצליח: ${json.error || res.status}`);
  }
  return json as ScanResult;
}
