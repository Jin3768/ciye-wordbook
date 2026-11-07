const HTML_ESC = {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'};
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => HTML_ESC[c]);
export const attr = (s) => esc(s).replace(/`/g, '&#96;');
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export const ICON = {
  search: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.8-3.8"/></svg>',
  close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  speaker: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16 8.5a5 5 0 0 1 0 7"/><path d="M18.6 6a9 9 0 0 1 0 12"/></svg>',
  star: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3z"/></svg>',
  arrowLeft: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H5M11 18l-6-6 6-6"/></svg>',
  arrowRight: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  shuffle: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/></svg>',
  settings: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09A1.7 1.7 0 0 0 15 4.6a1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9c.2.6.75 1 1.4 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.51 1Z"/></svg>',
  book: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5v14z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/></svg>',
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 5 5L20 7"/></svg>',
  chevron: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg>',
  refresh: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11a8 8 0 1 0-2 5.3"/><path d="M20 4v7h-7"/></svg>',
  play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l12-7.5z"/></svg>',
};

export function toast(msg, ms = 1800) {
  const el = $('#toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove('show'), ms);
}

export function debounce(fn, ms = 90) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

export function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

/* ---------- persistence ---------- */
const KEY = 'ciye.v1';
const DEFAULT = {
  saved: {},            // word -> {status:'known'|'learning', ts}
  history: [],          // recent words, newest first
  settings: { accent: 'uk', theme: 'light' },
};
export const store = {
  data: JSON.parse(JSON.stringify(DEFAULT)),
  load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return this.data;
      const parsed = JSON.parse(raw);
      this.data = {
        saved: parsed.saved && typeof parsed.saved === 'object' ? parsed.saved : {},
        history: Array.isArray(parsed.history) ? parsed.history.filter(x => typeof x === 'string').slice(0, 30) : [],
        settings: { ...DEFAULT.settings, ...(parsed.settings || {}) },
      };
    } catch (_) { /* ignore */ }
    return this.data;
  },
  save() {
    try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch (_) { /* ignore */ }
  },
  addHistory(word) {
    const h = this.data.history.filter(x => x !== word);
    h.unshift(word);
    this.data.history = h.slice(0, 24);
    this.save();
  },
  toggleSaved(word) {
    if (this.data.saved[word]) delete this.data.saved[word];
    else this.data.saved[word] = { status: 'learning', ts: Date.now() };
    this.save();
    return !!this.data.saved[word];
  },
  setStatus(word, status) {
    this.data.saved[word] = { status, ts: Date.now() };
    this.save();
  },
  clear() {
    this.data = JSON.parse(JSON.stringify(DEFAULT));
    this.save();
  },
};

/* ---------- speech ---------- */
let lastBtn = null;
export function speak(text, lang, btn = null) {
  if (!('speechSynthesis' in window) || !text) {
    toast('这台设备暂时不能朗读');
    return;
  }
  window.speechSynthesis.cancel();
  if (lastBtn) lastBtn.classList.remove('is-speaking');
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang === 'us' ? 'en-US' : 'en-GB';
  u.rate = 0.88;
  u.pitch = 1;
  const voices = window.speechSynthesis.getVoices();
  const v = voices.find(x => x.lang === u.lang) || voices.find(x => x.lang && x.lang.startsWith('en'));
  if (v) u.voice = v;
  if (btn) {
    lastBtn = btn;
    btn.classList.add('is-speaking');
    u.onend = u.onerror = () => btn.classList.remove('is-speaking');
  }
  window.speechSynthesis.speak(u);
}

/* ---------- misc ---------- */
export function formsOf(entry) {
  const set = new Set([entry.w.toLowerCase()]);
  const f = entry.f || '';
  for (const bit of f.split('·')) {
    const m = bit.trim().match(/^[^\s]+\s+(.+)$/);
    if (m) set.add(m[1].trim().toLowerCase());
  }
  const w = entry.w.toLowerCase();
  ['s','es','ed','d','ing'].forEach(s => set.add(w + s));
  if (w.endsWith('e')) set.add(w.slice(0, -1) + 'ing');
  if (w.endsWith('y')) { set.add(w.slice(0, -1) + 'ies'); set.add(w.slice(0, -1) + 'ied'); }
  return [...set].filter(Boolean).sort((a, b) => b.length - a.length);
}

export function highlight(text, entry) {
  const forms = formsOf(entry).map(f => f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (!forms.length) return esc(text);
  const re = new RegExp(`\\b(${forms.join('|')})\\b`, 'gi');
  return esc(text).replace(re, '<mark>$1</mark>');
}

export function fmtRank(n) {
  if (!n) return '';
  return n.toLocaleString('en-US');
}

export const EXAM_LABEL = { zk:'中考', gk:'高考', cet4:'四级', cet6:'六级', ky:'考研', ielts:'雅思', toefl:'托福', gre:'GRE' };
export const CORE_EXAM = new Set(['zk','gk','cet4','cet6','ky']);
