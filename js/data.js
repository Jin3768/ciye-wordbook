import { store } from './util.js';

const DATA = 'data';
export const S = {
  words: [],            // index rows, objects
  byWord: new Map(),
  byLetter: new Map(),  // letter -> index rows
  chunks: new Map(),    // letter -> entries array
  entryMap: new Map(),  // lower word -> entry
  meta: null,
  letters: [],
  loaded: false,
};

function toObj([w,b,t,r,p,zh,o,s]) {
  return { w, b, t: t ? t.split(' ') : [], r: r || 0, p, zh: zh || '', o: !!o, simple: !!s, lower: w.toLowerCase() };
}

export async function initData() {
  const res = await fetch(`${DATA}/index.json`, { cache: 'no-cache' });
  if (!res.ok) throw new Error('index ' + res.status);
  const idx = await res.json();
  S.words = idx.items.map(toObj).sort((a, b) => a.lower.localeCompare(b.lower, 'en'));
  S.byWord = new Map(S.words.map(w => [w.lower, w]));
  for (const w of S.words) {
    const k = /^[a-z]/.test(w.lower) ? w.lower[0] : '_';
    if (!S.byLetter.has(k)) S.byLetter.set(k, []);
    S.byLetter.get(k).push(w);
  }
  S.letters = Object.keys(idx.letters || {}).sort();
  const meta = await fetch(`${DATA}/meta.json`, { cache: 'no-cache' }).then(r => r.ok ? r.json() : null).catch(() => null);
  S.meta = meta || { count: S.words.length, letters: idx.letters };
  S.loaded = true;
}

export function indexRow(word) {
  return S.byWord.get(String(word).toLowerCase()) || null;
}

export async function getEntry(word) {
  const row = indexRow(word);
  if (!row) return null;
  if (S.entryMap.has(row.lower)) return S.entryMap.get(row.lower);
  const letter = /^[a-z]/.test(row.lower) ? row.lower[0] : '_';
  if (!S.chunks.has(letter)) {
    const res = await fetch(`${DATA}/w/${letter}.json`, { cache: 'force-cache' });
    if (!res.ok) throw new Error('chunk ' + letter);
    const list = await res.json();
    S.chunks.set(letter, list);
    for (const e of list) S.entryMap.set(e.w.toLowerCase(), e);
  }
  return S.entryMap.get(row.lower) || null;
}

export function filtered({ filter = 'all', letter = '' } = {}) {
  let arr = S.words;
  if (filter !== 'all') arr = arr.filter(w => w.t.includes(filter));
  if (letter) arr = arr.filter(w => (w.lower[0] || '_') === letter);
  return arr;
}

export function startedWith(q, filter = 'all', letter = '') {
  const ql = q.trim().toLowerCase();
  if (!ql) return [];
  let arr = filtered({ filter, letter });
  const starts = [];
  const contains = [];
  for (const w of arr) {
    const lw = w.w.toLowerCase();
    if (lw === ql) return [w];
    if (lw.startsWith(ql)) starts.push(w);
    else if (lw.includes(ql)) contains.push(w);
  }
  starts.sort((a, b) => a.w.length - b.w.length || rank(a) - rank(b));
  contains.sort((a, b) => rank(a) - rank(b));
  return starts.concat(contains).slice(0, 90);
}

export function searchZh(q, filter = 'all', letter = '') {
  const ql = q.trim();
  if (!/[\u4e00-\u9fff]/.test(ql)) return [];
  const scored = [];
  for (const w of filtered({ filter, letter })) {
    let s = 0;
    if (w.b === ql) s += 8;
    else if (w.b.startsWith(ql)) s += 5;
    else if (w.b.includes(ql)) s += 3;
    if (w.zh.split(' ').includes(ql)) s += 3;
    else if (w.zh.includes(ql)) s += 1;
    if (s) scored.push([s, w]);
  }
  scored.sort((a, b) => b[0] - a[0] || rank(a[1]) - rank(b[1]));
  return scored.slice(0, 90).map(x => x[1]);
}

function rank(w) { return w.r > 0 ? w.r : 1e9; }
export function byFreq(list) { return [...list].sort((a, b) => rank(a) - rank(b)); }

const STOP = new Set('the a an and or but if of to in on at by for with from as is are was were be been being this that these those it its he she they we you i my your his her their our not no do does did have has had will would can could may might must should there here what which who when where why how than then so very just also more most some any all each every other another such only own same too now out up down over under again further once about into through during before after above below between both few many much little long short good bad new old big small high low early late'.split(' '));
export function topWords(n = 40, filter = 'all') {
  const arr = byFreq(filtered({ filter }));
  const content = arr.filter(w => !STOP.has(w.w.toLowerCase()) && w.w.length > 1);
  return (content.length >= n ? content : arr).slice(0, n);
}

export function recentWords() {
  const arr = [];
  for (const w of store.data.history) {
    const row = indexRow(w);
    if (row) arr.push(row);
  }
  return arr;
}

export function savedWords() {
  return Object.keys(store.data.saved)
    .map(w => indexRow(w))
    .filter(Boolean)
    .sort((a, b) => (store.data.saved[b.w]?.ts || 0) - (store.data.saved[a.w]?.ts || 0));
}

export function randomWord(filter = 'all') {
  const arr = filtered({ filter });
  if (!arr.length) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

export function suggest(q) {
  const ql = q.trim().toLowerCase();
  if (ql.length < 3) return [];
  const first = ql[0];
  const pool = S.words.filter(w => w.lower[0] === first || Math.abs(w.w.length - ql.length) <= 1);
  const scored = [];
  for (const w of pool) {
    const d = lev(ql, w.lower);
    if (d <= 2 || (ql.length >= 7 && d <= 3)) scored.push([d, w]);
  }
  scored.sort((a, b) => a[0] - b[0] || rank(a[1]) - rank(b[1]));
  return scored.slice(0, 6).map(x => x[1]);
}

function lev(a, b) {
  if (Math.abs(a.length - b.length) > 3) return 9;
  const m = a.length, n = b.length;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n];
}
