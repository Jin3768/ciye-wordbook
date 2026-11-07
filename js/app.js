import { $, $$, esc, attr, ICON, toast, debounce, store, speak, EXAM_LABEL, CORE_EXAM } from './util.js';
import { S, initData, indexRow, getEntry, filtered, startedWith, searchZh, byFreq, topWords, recentWords, savedWords, randomWord, suggest } from './data.js';
import { entryHTML, sectionInner, exampleAt, exampleCount, TRAPS } from './entry.js';

const TODAY = ['abandon','address','sustainable','appreciate','company','courage','discover','effort','explore','focus','forgive','grateful','habit','imagine','improve','kindness','patience','progress','respect','trust'];
const FILTERS = [
  ['all','全部'],['zk','中考'],['gk','高考'],['cet4','四级'],['cet6','六级'],['ky','考研'],['ielts','雅思'],['toefl','托福'],['gre','GRE'],
];
const FEATURED = ['abandon','address','sustainable','appreciate','company','curious','discover','explore','focus','forgive','grateful','habit','imagine','improve','kindness','patience','progress','respect','resilient','trust','adapt','balance','create','effort','embrace','listen','simple','wonder'];

const CACHE_NAME = 'ciye-v7';
const OFFLINE_KEY = 'ciye.offline.v1';
const state = {
  view: 'search',
  query: '',
  filter: 'all',
  letter: '',
  list: [],
  active: 0,
  selected: null,
  limit: 200,
  loading: false,
  token: 0,
  lesson: null,
  lastFocus: null,
  welcomeToken: 0,
};

const app = $('#app');
const panel = $('#panel');
const list = $('#list');
const reader = $('#reader');
const readerScroll = $('#readerScroll');
const q = $('#q');
const lesson = $('#lesson');
const sheet = $('#sheet');

/* ---------- boot ---------- */
store.load();
applySettings();
renderFilters();
renderAlpha();
bind();
showLoading();

initData().then(async () => {
  updateSavedCount();
  renderPanel();
  const initial = parseHash();
  if (initial) {
    await openWord(initial, { push: false });
  } else {
    await renderWelcome();
  }
  registerSW();
}).catch(err => {
  console.error(err);
  showDataError();
});

/* ---------- chrome ---------- */
function applySettings() {
  const st = store.data.settings || {};
  document.documentElement.dataset.theme = st.theme === 'dark' ? 'dark' : 'light';
}

function renderFilters() {
  $('#filters').innerHTML = FILTERS.map(([k, label]) =>
    `<button class="chip${state.filter === k ? ' is-active' : ''}" data-filter="${k}">${label}</button>${k === 'ky' ? '<span class="filter-break" aria-hidden="true"></span>' : ''}`
  ).join('');
}

function renderAlpha() {
  const letters = 'abcdefghijklmnopqrstuvwxyz'.split('');
  $('#alpha').innerHTML = letters.map(l =>
    `<button data-letter="${l}" class="${state.letter === l ? 'is-active' : ''}" aria-label="浏览 ${l.toUpperCase()}">${l.toUpperCase()}</button>`
  ).join('');
}

function markBook(on) {
  const b = $('.book-btn', readerScroll);
  if (!b) return;
  b.classList.toggle('is-saved', on);
  b.setAttribute('aria-pressed', on ? 'true' : 'false');
  b.setAttribute('aria-label', on ? '移出生词本' : '加入生词本');
}

function updateSavedCount() {
  const n = Object.keys(store.data.saved).length;
  const el = $('#savedCount');
  el.textContent = n;
  el.hidden = !n;
}

/* ---------- panel ---------- */
function panelHeadHTML() {
  if (state.view === 'saved' && !state.query) {
    return `<span>生词本</span><b>${savedWords().length} 词</b>`;
  }
  if (state.query) {
    return `<span>${state.list.length ? '搜索结果' : '没有找到'}</span><b>${state.list.length} 词</b>`;
  }
  if (state.filter !== 'all') {
    const label = (FILTERS.find(f => f[0] === state.filter) || [])[1] || '';
    return `<span>${label}词汇</span><b>${state.fullCount || 0} 词</b>`;
  }
  if (state.letter) {
    return `<span>${state.letter.toUpperCase()} 开头</span><b>${state.fullCount || 0} 词</b>`;
  }
  const recent = recentWords();
  return `<span>${recent.length ? '最近查过 · 今日推荐' : '今日推荐'}</span><b>${state.fullCount || S.words.length} 词</b>`;
}

function panelFootHTML() {
  if (state.view === 'saved' && !state.query) {
    const n = savedWords().length;
    return n ? `<span>共 ${n} 个词</span><button data-review-start>开始复习</button>` : `<span>点星标收藏的词会留在这里</span>`;
  }
  if (state.query) {
    return `<span>支持英文和中文查询</span>`;
  }
  if (state.list.length < (state.fullCount || 0)) {
    return `<span>共 ${state.fullCount} 词</span><button data-more>显示更多</button>`;
  }
  return `<span>共 ${S.words.length.toLocaleString()} 词 · 本地词库</span><button data-random>随机一词</button>`;
}

function renderPanel() {
  panel.classList.toggle('is-saved', state.view === 'saved' && !state.query);
  $('#searchBox').hidden = state.view === 'saved' && !state.query;
  $('#filters').hidden = state.view === 'saved' && !state.query;
  $('#alpha').hidden = state.view === 'saved' && !state.query;

  let items = [];
  let full = [];
  if (state.query) {
    items = /[\u4e00-\u9fff]/.test(state.query) ? searchZh(state.query, state.filter, state.letter) : startedWith(state.query, state.filter, state.letter);
    full = items;
  } else if (state.view === 'saved') {
    items = savedWords();
    full = items;
  } else if (state.filter !== 'all' || state.letter) {
    full = filtered({ filter: state.filter, letter: state.letter });
    items = state.letter ? full : byFreq(full);
  } else {
    const recent = recentWords();
    const seen = new Set(recent.map(w => w.w.toLowerCase()));
    const featured = FEATURED.map(w => indexRow(w)).filter(w => w && !seen.has(w.w.toLowerCase()));
    full = [...recent, ...featured];
    items = full;
  }
  state.list = items.slice(0, state.limit);
  state.fullCount = full.length;

  $('#panelHead').innerHTML = panelHeadHTML();
  $('#panelFoot').innerHTML = panelFootHTML();
  $('#clearBtn').hidden = !q.value;
  $('#searchKbd').hidden = !!q.value;

  if (!state.list.length) {
    list.innerHTML = emptyListHTML();
    return;
  }
  list.innerHTML = state.list.map(itemHTML).join('');
  setActive(0, false);
}

function itemHTML(w, i) {
  const tags = [];
  for (const t of w.t) {
    if (CORE_EXAM.has(t) && tags.length < 2) tags.push(`<span class="mini-tag core">${EXAM_LABEL[t]}</span>`);
  }
  if (!tags.length && w.o) tags.push('<span class="mini-tag">牛津</span>');
  return `<div role="listitem">
    <button class="word-item" data-open="${attr(w.w)}" data-i="${i}">
      <span class="wi-main">
        <span class="wi-word">${esc(w.w)}<span class="wi-ipa">${esc(w.p || '')}</span></span>
        <span class="wi-brief">${esc(w.b || '')}</span>
      </span>
      <span class="wi-tags">${tags.join('')}</span>
    </button>
  </div>`;
}

function emptyListHTML() {
  if (state.query) {
    const sug = suggest(state.query);
    return `<div class="empty-list"><strong>没有找到 “${esc(state.query)}”</strong>
      换个拼写试试，或者用中文查。
      ${sug.length ? `<div class="suggest">${sug.map(w => `<button data-open="${attr(w.w)}">${esc(w.w)}</button>`).join('')}</div>` : ''}
    </div>`;
  }
  if (state.view === 'saved') {
    return `<div class="empty-list"><strong>生词本还是空的</strong>
      查词时点右上角的星标，就能把词收进来。
      <div class="suggest"><button data-view="search">去查词</button></div>
    </div>`;
  }
  return `<div class="empty-list"><strong>这里还没有词</strong>换个筛选条件试试。</div>`;
}

function setActive(i, scroll = true) {
  const nodes = $$('.word-item', list);
  if (!nodes.length) return;
  state.active = Math.max(0, Math.min(nodes.length - 1, i));
  nodes.forEach((n, k) => {
    n.classList.toggle('is-active', k === state.active);
    n.setAttribute('aria-selected', k === state.active ? 'true' : 'false');
  });
  if (scroll) nodes[state.active].scrollIntoView({ block: 'nearest' });
}

function visibleListItems() { return $$('.word-item', list); }

/* ---------- welcome ---------- */
function showLoading() {
  readerScroll.innerHTML = `<div class="loading">
    <p class="loading-title">正在打开词库</p>
    <div class="sk w2"></div><div class="sk w1"></div><div class="sk w3"></div>
    <div class="sk w4"></div><div class="sk w4"></div><div class="sk w3"></div>
  </div>`;
  const rows = Array.from({ length: 8 }, () => `<div class="word-item"><span class="wi-main"><span class="wi-word">　</span><span class="wi-brief">　</span></span></div>`).join('');
  list.innerHTML = rows;
  $('#panelHead').innerHTML = '<span>正在翻词库</span><b>…</b>';
  $('#panelFoot').innerHTML = '';
}

async function todayEntry() {
  const d = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
  for (let k = 0; k < TODAY.length; k++) {
    const w = TODAY[(d + k) % TODAY.length];
    const row = indexRow(w);
    if (row) {
      const e = await getEntry(w);
      if (e) return e;
    }
  }
  const fallback = topWords(1)[0];
  return fallback ? getEntry(fallback.w) : null;
}

async function renderWelcome() {
  if (!S.loaded) { showLoading(); return; }
  const token = ++state.welcomeToken;
  const e = await todayEntry();
  if (token !== state.welcomeToken || state.selected) return;
  const recent = recentWords().slice(0, 7);
  const tags = S.meta.tags || {};
  const stats = ['cet4','cet6','ky','gk'].map(t => tags[t] ? `${EXAM_LABEL[t]} ${tags[t].toLocaleString()}` : '').filter(Boolean).join(' · ');
  const rich = (S.meta && S.meta.rich) || S.words.length;
  const simple = (S.meta && S.meta.simple) || 0;
  const ex = e && e.ex && e.ex[0];

  readerScroll.innerHTML = `<div class="welcome">
    <div class="welcome-seal" aria-hidden="true">日课</div>
    <p class="welcome-kicker">今日一词</p>
    <h1 class="today-word" lang="en">${esc(e ? e.w : 'word')}</h1>
    <div class="today-pron"><span class="ipa">${e && e.p ? '/' + esc(e.p) + '/' : ''}</span>
      ${e ? `<button class="speak-btn" data-speak="${attr(e.w)}" data-speak-kind="word" aria-label="朗读">${ICON.speaker}</button>` : ''}
    </div>
    <p class="today-brief">${esc(e ? e.b : '')}</p>
    ${ex ? `<div class="today-ex"><p class="en" lang="en">${esc(ex.e)}</p><p class="zh">${esc(ex.z)}</p></div>` : ''}
    <div class="welcome-actions">
      ${e ? `<button class="btn primary" data-open="${attr(e.w)}">打开词条 ${ICON.arrowRight}</button>` : ''}
      <button class="btn" data-random>随机一词</button>
    </div>
    <div class="method">
      <span class="method-label">每一页</span>
      <span class="method-step"><span class="method-seal">义</span><span class="method-name">全部意思</span></span>
      <span class="method-arrow">→</span>
      <span class="method-step"><span class="method-seal">考</span><span class="method-name">常考义</span></span>
      <span class="method-arrow">→</span>
      <span class="method-step"><span class="method-seal">根</span><span class="method-name">词根词缀</span></span>
      <span class="method-arrow">→</span>
      <span class="method-step"><span class="method-seal">例</span><span class="method-name">生活例句</span></span>
    </div>
    ${recent.length ? `<div class="recent"><h3>最近查过</h3><div class="recent-list">${recent.map(w => `<button class="recent-item" data-open="${attr(w.w)}">${esc(w.w)}</button>`).join('')}</div></div>` : ''}
    <p class="welcome-stats">共 ${S.words.length.toLocaleString()} 词 · ${rich.toLocaleString()} 个精讲${simple ? ` · ${simple.toLocaleString()} 个简明` : ''} · ${stats}</p>
  </div>`;
}

/* ---------- open / render entry ---------- */
async function openWord(word, { push = true } = {}) {
  if (!word) return;
  const row = indexRow(word);
  if (!row) { toast('词库里还没有这个词'); return; }
  if (state.selected && state.selected.w.toLowerCase() === row.lower) {
    if (window.innerWidth <= 860) app.classList.add('reader-open');
    return;
  }
  const token = ++state.token;
  state.welcomeToken++;
  state.loading = true;
  readerScroll.innerHTML = `<div class="loading"><div class="sk w2"></div><div class="sk w1"></div><div class="sk w3"></div><div class="sk w4"></div></div>`;
  let entry = null;
  try {
    entry = await getEntry(row.w);
  } catch (err) {
    console.error(err);
    toast('这个词没加载出来，再试一次');
    state.loading = false;
    return;
  }
  if (token !== state.token) return;
  state.loading = false;
  if (!entry) { toast('词库里还没有这个词'); return; }

  state.selected = entry;
  readerScroll.innerHTML = entryHTML(entry, { saved: !!store.data.saved[entry.w] });
  readerScroll.scrollTop = 0;
  store.addHistory(entry.w);
  updateSavedCount();
  app.classList.add('reader-open');
  if (window.innerWidth > 860) app.classList.remove('reader-open');
  if (push) {
    const h = '#/w/' + encodeURIComponent(entry.w);
    if (location.hash !== h) location.hash = h;
  }
  requestAnimationFrame(() => updateStepper(true));
  renderPanel();
  const active = state.list.findIndex(x => x.w.toLowerCase() === entry.w.toLowerCase());
  if (active >= 0) setActive(active, false);
}

function closeReader() {
  app.classList.remove('reader-open');
  if (location.hash.startsWith('#/w/')) {
    history.replaceState(null, '', location.pathname + location.search);
  }
  state.selected = null;
  if (state.view === 'saved') {
    renderPanel();
    renderSavedEmpty();
  } else {
    renderWelcome();
    renderPanel();
  }
  reader.focus({ preventScroll: true });
}

function renderSavedEmpty() {
  const n = savedWords().length;
  if (!n) {
    readerScroll.innerHTML = `<div class="reader-empty"><div><div class="big">藏</div><p>还没有收藏的词。查词时点右上角的星标，词就会留在这里。</p></div></div>`;
  } else {
    renderWelcome();
  }
}

function parseHash() {
  const m = location.hash.match(/^#\/w\/(.+)$/);
  return m ? decodeURIComponent(m[1]) : '';
}

/* ---------- stepper ---------- */
let stepperRaf = 0;
function updateStepper(force = false) {
  if (stepperRaf && !force) return;
  stepperRaf = requestAnimationFrame(() => {
    stepperRaf = 0;
    if (!state.selected) return;
    const secs = $$('.sec', readerScroll);
    if (!secs.length) return;
    const top = readerScroll.getBoundingClientRect().top;
    let current = 'meaning';
    for (const sec of secs) {
      const y = sec.getBoundingClientRect().top - top;
      if (y < 120) current = sec.id.replace('sec-', '');
    }
    $$('.step-tab', readerScroll).forEach(t => t.classList.toggle('is-active', t.dataset.goto === current));
  });
}

readerScroll.addEventListener('scroll', updateStepper, { passive: true });

function gotoSection(key) {
  const sec = $('#sec-' + key, readerScroll);
  if (!sec) return;
  const mobile = window.innerWidth <= 860;
  const offset = mobile ? 58 : 14;
  const y = sec.getBoundingClientRect().top - readerScroll.getBoundingClientRect().top + readerScroll.scrollTop - offset;
  readerScroll.scrollTo({ top: y, behavior: 'smooth' });
  $$('.step-tab', readerScroll).forEach(t => t.classList.toggle('is-active', t.dataset.goto === key));
}

/* ---------- example cycling ---------- */
function cycleExample() {
  if (!state.selected) return;
  const fig = $('.example', readerScroll);
  if (!fig) return;
  const n = exampleCount(state.selected);
  if (n < 2) return;
  const i = (Number(fig.dataset.exIndex || 0) + 1) % n;
  fig.outerHTML = exampleAt(state.selected, i);
}

/* ---------- lesson ---------- */
const LESSON_STEPS = [
  ['meaning','全部中文意思','先知道这个词能表示什么'],
  ['exam','常考什么','考试里最值得先记的义项'],
  ['roots','词根词缀','拆开看，找一个记忆抓手'],
  ['example','生活例句','放进一句日常话里'],
];

function openLesson() {
  if (!state.selected) return;
  state.lastFocus = document.activeElement;
  state.lesson = { entry: state.selected, step: 0 };
  lesson.hidden = false;
  renderLesson();
  setTimeout(() => $('.lesson-close', lesson)?.focus(), 30);
}

function renderLesson() {
  const { entry, step } = state.lesson;
  const [key, title, hint] = LESSON_STEPS[step];
  const inner = sectionInner(entry, key);
  lesson.innerHTML = `<div class="lesson-panel" role="dialog" aria-modal="true" aria-label="逐步讲解 ${attr(entry.w)}">
    <div class="lesson-top">
      <div class="progress" style="width:${((step + 1) / 4) * 100}%"></div>
      <div class="lesson-kicker">第 ${step + 1} 步 / 共 4 步</div>
      <div class="lesson-title"><b>${esc(entry.w)}</b><span>${esc(title)}</span></div>
      <button class="icon-btn lesson-close" data-close-lesson aria-label="关闭讲解">${ICON.close}</button>
    </div>
    <div class="lesson-body">
      <div class="sec" data-sec="${['义','考','根','例'][step]}">
        ${inner}
        <p class="lesson-hint">${esc(hint)}</p>
      </div>
    </div>
    <div class="lesson-foot">
      <div class="lesson-dots" aria-hidden="true">${[0,1,2,3].map(i => `<i class="${i <= step ? 'on' : ''}"></i>`).join('')}</div>
      <button class="btn" data-lesson-prev ${step === 0 ? 'disabled' : ''}>上一步</button>
      <button class="btn primary" data-lesson-next>${step === 3 ? '完成' : '下一步'}</button>
    </div>
  </div>`;
}

function lessonMove(d) {
  if (!state.lesson) return;
  const next = state.lesson.step + d;
  if (next < 0) return;
  if (next > 3) { closeLesson(); toast('这一页讲完了'); return; }
  state.lesson.step = next;
  renderLesson();
  const body = $('.lesson-body', lesson);
  if (body) body.scrollTop = 0;
  setTimeout(() => $('[data-lesson-next]', lesson)?.focus(), 10);
}

function closeLesson() {
  lesson.hidden = true;
  lesson.innerHTML = '';
  state.lesson = null;
  state.lastFocus?.focus?.();
}

/* ---------- offline ---------- */
function offlineData() {
  try { return JSON.parse(localStorage.getItem(OFFLINE_KEY) || 'null'); } catch (_) { return null; }
}
function offlineReady() {
  const d = offlineData();
  return !!(d && d.cache === CACHE_NAME && d.count === S.words.length);
}
function offlineSupported() {
  return 'caches' in window && (location.protocol === 'https:' || ['localhost','127.0.0.1'].includes(location.hostname));
}
function offlineButtonHTML() {
  if (!offlineSupported()) return `<span class="offline-hint">需要 HTTPS 页面</span>`;
  return `<button class="text-btn" data-offline>${offlineReady() ? '重新下载' : '下载全部词库'}</button>`;
}
function offlineStatusText() {
  if (!offlineSupported()) return '当前是局域网 HTTP 页面，不能装离线包；用 HTTPS 地址安装到主屏幕后即可下载。';
  if (offlineReady()) {
    const d = offlineData();
    const when = new Date(d.ts).toLocaleDateString('zh-CN');
    return `已下载 · 可离线使用（${when}）`;
  }
  return '下载后可以关掉 Mac，在主屏幕直接打开。';
}
function updateOfflineUI() {
  const b = $('[data-offline]', sheet);
  const status = $('#offlineStatus', sheet);
  if (b) b.textContent = offlineReady() ? '重新下载' : '下载全部词库';
  if (status && !offlineReady()) status.textContent = offlineStatusText();
  if (status && offlineReady()) status.textContent = offlineStatusText();
}
async function downloadOffline(btn) {
  if (!offlineSupported()) { toast('需要用 HTTPS 地址打开才能离线'); return; }
  const letters = S.letters && S.letters.length ? S.letters : ['_'];
  const urls = ['data/index.json', 'data/meta.json', ...letters.map(l => `data/w/${l}.json`)];
  let cache;
  try {
    await navigator.serviceWorker?.ready;
    cache = await caches.open(CACHE_NAME);
  } catch (e) {
    toast('浏览器没有开放离线缓存');
    return;
  }
  btn.disabled = true;
  btn.textContent = '准备中…';
  let done = 0;
  try {
    for (const url of urls) {
      const res = await fetch(url, { cache: 'reload' });
      if (!res.ok) throw new Error(url + ' ' + res.status);
      await cache.put(url, res.clone());
      done++;
      if (done % 2 === 0 || done === urls.length) {
        btn.textContent = `下载中 ${done}/${urls.length}`;
        const bar = $('#offlineBar', sheet);
        if (bar) bar.style.width = `${Math.round(done / urls.length * 100)}%`;
      }
    }
    localStorage.setItem(OFFLINE_KEY, JSON.stringify({ cache: CACHE_NAME, ts: Date.now(), count: S.words.length }));
    btn.disabled = false;
    btn.textContent = '重新下载';
    const status = $('#offlineStatus', sheet);
    if (status) status.textContent = offlineStatusText();
    toast('离线词库已下载，可以关掉 Mac 试试');
  } catch (e) {
    console.error(e);
    btn.disabled = false;
    btn.textContent = '重试下载';
    toast('下载中断了，再试一次');
  }
}

/* ---------- settings ---------- */
function openSettings() {
  const st = store.data.settings;
  const tags = S.meta?.tags || {};
  const installed = window.navigator.standalone === true;
  sheet.hidden = false;
  sheet.innerHTML = `<div class="sheet-panel" role="dialog" aria-modal="true" aria-label="设置">
    <div class="sheet-head"><h2>设置</h2><button class="icon-btn" data-close-sheet aria-label="关闭设置">${ICON.close}</button></div>
    <div class="setting">
      <div><div class="setting-label">发音</div><div class="setting-hint">点词条里的喇叭试听</div></div>
      <div class="seg">
        <button data-setting="accent" data-value="uk" class="${st.accent !== 'us' ? 'on' : ''}">英音</button>
        <button data-setting="accent" data-value="us" class="${st.accent === 'us' ? 'on' : ''}">美音</button>
      </div>
    </div>
    <div class="setting">
      <div><div class="setting-label">阅读主题</div><div class="setting-hint">夜里看词时用暗色</div></div>
      <div class="seg">
        <button data-setting="theme" data-value="light" class="${st.theme !== 'dark' ? 'on' : ''}">纸白</button>
        <button data-setting="theme" data-value="dark" class="${st.theme === 'dark' ? 'on' : ''}">夜间</button>
      </div>
    </div>
    <div class="setting">
      <div><div class="setting-label">添加到主屏幕</div><div class="setting-hint">${installed ? '已经以独立窗口运行' : 'Safari 分享按钮 → 添加到主屏幕。离线安装需要 HTTPS。'}</div></div>
    </div>
    <div class="setting offline-setting">
      <div><div class="setting-label">完全离线</div><div class="setting-hint">下载全部词库后，Mac 关机也能在 iPad 主屏幕打开。</div></div>
      <div class="offline-action">${offlineButtonHTML()}</div>
    </div>
    <div class="offline-meter"><span id="offlineBar"></span></div>
    <p class="offline-status" id="offlineStatus">${offlineStatusText()}</p>
    <div class="about">
      <h3>词库</h3>
      <p>${S.words.length.toLocaleString()} 个词 · ${((S.meta && S.meta.rich) || S.words.length).toLocaleString()} 精讲${(S.meta && S.meta.simple) ? ` + ${S.meta.simple.toLocaleString()} 简明` : ''} · 四级 ${(tags.cet4 || 0).toLocaleString()} · 六级 ${(tags.cet6 || 0).toLocaleString()} · 考研 ${(tags.ky || 0).toLocaleString()}</p>
      <h3>来源与许可</h3>
      <p>收词范围参照《牛津高阶英汉双解词典》第 7 版。释义整理自 <a href="https://github.com/skywind3000/ECDICT" target="_blank" rel="noopener">ECDICT</a>（MIT）；讲解内容来自 <a href="https://github.com/Ceelog/DictionaryByGPT4" target="_blank" rel="noopener">DictionaryByGPT4</a>（CC BY-SA 4.0）；例句来自词书与 <a href="https://tatoeba.org" target="_blank" rel="noopener">Tatoeba</a>（CC BY 2.0 FR）。本页仅供个人学习使用。</p>
      <h3>本地数据</h3>
      <p>生词本、最近记录和设置只保存在这台设备的浏览器里。</p>
    </div>
    <button class="reset-btn" data-reset>清除本地记录</button>
  </div>`;
  setTimeout(() => $('.sheet-panel button', sheet)?.focus(), 30);
}

function closeSheet() { sheet.hidden = true; sheet.innerHTML = ''; }

function setSetting(key, value) {
  store.data.settings[key] = value;
  store.save();
  applySettings();
  if (key === 'accent') {
    const b = $(`[data-setting="accent"][data-value="${value}"]`, sheet);
    speak('A word a day.', value === 'us' ? 'us' : 'uk', b);
  }
  $$(`[data-setting="${key}"]`, sheet).forEach(b => b.classList.toggle('on', b.dataset.value === value));
}

/* ---------- review (lightweight flashcards) ---------- */
const review = $('#review');
const reviewState = { queue: [], i: 0, revealed: false, known: 0, again: 0, busy: false, entry: null };

function startReview() {
  const words = savedWords().map(w => w.w);
  if (!words.length) { toast('生词本还是空的'); return; }
  reviewState.queue = words.sort(() => Math.random() - 0.5);
  reviewState.i = 0; reviewState.revealed = false; reviewState.known = 0; reviewState.again = 0;
  review.hidden = false;
  showCard();
}

async function showCard() {
  const word = reviewState.queue[reviewState.i];
  if (!word) { showReviewSummary(); return; }
  reviewState.busy = true;
  reviewState.entry = null;
  review.innerHTML = `<div class="review-top"><b>复习生词</b><span class="review-progress">${reviewState.i + 1} / ${reviewState.queue.length}</span><button class="icon-btn" data-close-review aria-label="退出复习">${ICON.close}</button></div>
    <div class="review-body"><div class="flash"><div class="flash-word">${esc(word)}</div><div class="flash-ipa">正在翻页…</div></div></div>`;
  let entry = null;
  try { entry = await getEntry(word); } catch (_) {}
  if (!entry) { nextCard(); return; }
  reviewState.entry = entry;
  reviewState.busy = false;
  paintCard();
}

function paintCard() {
  const e = reviewState.entry;
  if (!e) return;
  const hot = [];
  for (const gr of e.s || []) {
    if (gr.p.startsWith('[')) continue;
    const words = (gr.h || []).map(i => gr.g[i]).filter(Boolean);
    if (words.length) hot.push(`${gr.p} ${words.join('；')}`);
  }
  const ex = e.ex && e.ex[0];
  review.innerHTML = `<div class="review-top"><b>复习生词</b><span class="review-progress">${reviewState.i + 1} / ${reviewState.queue.length}</span><button class="icon-btn" data-close-review aria-label="退出复习">${ICON.close}</button></div>
    <div class="review-body">
      <div class="flash">
        <div class="flash-word" lang="en">${esc(e.w)}</div>
        <div class="flash-ipa">/${esc(e.p || '')}/ <button class="icon-btn" data-speak="${attr(e.w)}" data-speak-kind="word" aria-label="朗读" style="display:inline-grid;width:32px;height:32px;vertical-align:middle">${ICON.speaker}</button></div>
        ${reviewState.revealed ? `<div class="flash-reveal">
            <div class="zh">${esc(hot.slice(0, 2).join(' · ') || e.b)}</div>
            ${ex ? `<div class="ex" lang="en">${esc(ex.e)}</div><div class="exz">${esc(ex.z)}</div>` : ''}
          </div>` : `<div class="flash-actions"><button class="btn" data-reveal>看释义</button></div>`}
      </div>
    </div>
    <div class="review-foot">
      <button class="btn" data-review-again>再看一次</button>
      <button class="btn primary" data-review-known>记住了</button>
    </div>`;
}

function nextCard() {
  reviewState.i++;
  reviewState.revealed = false;
  if (reviewState.i >= reviewState.queue.length) showReviewSummary();
  else showCard();
}

function showReviewSummary() {
  review.innerHTML = `<div class="review-top"><b>复习完成</b><button class="icon-btn" data-close-review aria-label="关闭">${ICON.close}</button></div>
    <div class="review-body"><div class="flash" style="text-align:center">
      <div class="flash-word" style="font-size:40px">这一轮结束</div>
      <p style="color:var(--muted);font-size:13px;line-height:1.9;margin:16px 0 0">记住了 ${reviewState.known} 个 · 还要再看 ${reviewState.again} 个<br>明天再复习一遍，会更牢。</p>
      <div class="flash-actions"><button class="btn primary" data-close-review>回到词表</button></div>
    </div></div>`;
}

function reviewAnswer(known) {
  if (reviewState.busy) return;
  const word = reviewState.queue[reviewState.i];
  if (!word) return;
  if (known) { store.setStatus(word, 'known'); reviewState.known++; }
  else { store.setStatus(word, 'learning'); reviewState.again++; reviewState.queue.push(word); }
  nextCard();
  updateSavedCount();
}

/* ---------- events ---------- */
function bind() {
  document.addEventListener('click', (ev) => {
    const t = ev.target.closest('[data-open],[data-view],[data-filter],[data-letter],[data-goto],[data-speak],[data-book],[data-lesson],[data-next-ex],[data-back],[data-random],[data-known],[data-again],[data-more],[data-review-start],[data-offline],[data-close-lesson],[data-lesson-prev],[data-lesson-next],[data-setting],[data-close-sheet],[data-reset],[data-close-review],[data-reveal],[data-review-known],[data-review-again]');
    if (!t) {
      if (ev.target === lesson) closeLesson();
      if (ev.target === sheet) closeSheet();
      if (ev.target === review) { review.hidden = true; }
      return;
    }
    if (t.dataset.open) { openWord(t.dataset.open); return; }
    if (t.dataset.view) {
      state.view = t.dataset.view;
      $$('.nav-btn').forEach(b => b.classList.toggle('is-active', b.dataset.view === state.view));
      refreshView();
      return;
    }
    if (t.dataset.filter) {
      state.filter = t.dataset.filter;
      state.letter = ''; state.limit = 200;
      state.query = ''; q.value = '';
      renderFilters(); renderAlpha(); renderPanel();
      if (window.innerWidth <= 860) app.classList.remove('reader-open');
      return;
    }
    if (t.dataset.letter) {
      state.letter = state.letter === t.dataset.letter ? '' : t.dataset.letter;
      state.filter = 'all'; state.limit = 200;
      state.query = ''; q.value = '';
      renderFilters(); renderAlpha(); renderPanel();
      if (window.innerWidth <= 860) app.classList.remove('reader-open');
      return;
    }
    if (t.dataset.goto) { gotoSection(t.dataset.goto); return; }
    if (t.dataset.speak) {
      speak(t.dataset.speak, store.data.settings.accent, t);
      return;
    }
    if (t.dataset.book) {
      const word = t.dataset.book;
      const added = store.toggleSaved(word);
      t.classList.toggle('is-saved', added);
      t.setAttribute('aria-pressed', added ? 'true' : 'false');
      t.setAttribute('aria-label', added ? '移出生词本' : '加入生词本');
      updateSavedCount();
      if (state.view === 'saved') renderPanel();
      toast(added ? '已加入生词本' : '已移出生词本');
      return;
    }
    if (t.dataset.lesson !== undefined) { openLesson(); return; }
    if (t.dataset.nextEx !== undefined) { cycleExample(); return; }
    if (t.dataset.back !== undefined) { closeReader(); return; }
    if (t.dataset.random !== undefined) { const w = randomWord(state.filter); if (w) openWord(w.w); return; }
    if (t.dataset.known !== undefined) {
      if (state.selected) {
        store.setStatus(state.selected.w, 'known'); updateSavedCount();
        markBook(true); toast('记下了');
      }
      return;
    }
    if (t.dataset.again !== undefined) {
      if (state.selected) {
        store.setStatus(state.selected.w, 'learning'); updateSavedCount(); renderPanel();
        markBook(true); toast('放进生词本，之后再复习');
      }
      return;
    }
    if (t.dataset.more !== undefined) { state.limit += 200; renderPanel(); return; }
    if (t.dataset.reviewStart !== undefined) { startReview(); return; }
    if (t.dataset.offline !== undefined) { downloadOffline(t); return; }
    if (t.dataset.closeLesson !== undefined) { closeLesson(); return; }
    if (t.dataset.lessonPrev !== undefined) { lessonMove(-1); return; }
    if (t.dataset.lessonNext !== undefined) { lessonMove(1); return; }
    if (t.dataset.setting) { setSetting(t.dataset.setting, t.dataset.value); return; }
    if (t.dataset.closeSheet !== undefined) { closeSheet(); return; }
    if (t.dataset.reset !== undefined) {
      if (confirm('清除生词本、最近记录和设置？')) {
        store.clear(); applySettings(); updateSavedCount(); renderFilters(); renderAlpha(); renderPanel();
        closeSheet(); toast('已清除本地记录');
      }
      return;
    }
    if (t.dataset.closeReview !== undefined) { review.hidden = true; return; }
    if (t.dataset.reveal !== undefined) { reviewState.revealed = true; paintCard(); return; }
    if (t.dataset.reviewKnown !== undefined) { reviewAnswer(true); return; }
    if (t.dataset.reviewAgain !== undefined) { reviewAnswer(false); return; }
  });

  q.addEventListener('input', debounce(() => {
    state.query = q.value.trim();
    state.limit = 200;
    if (state.query && state.view === 'saved') {
      state.view = 'search';
      $$('.nav-btn').forEach(b => b.classList.toggle('is-active', b.dataset.view === 'search'));
    }
    renderPanel();
  }, 70));

  q.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') { q.value = ''; state.query = ''; renderPanel(); q.blur(); return; }
    if (ev.key === 'ArrowDown') { ev.preventDefault(); setActive(state.active + 1); return; }
    if (ev.key === 'ArrowUp') { ev.preventDefault(); setActive(state.active - 1); return; }
    if (ev.key === 'Enter') {
      ev.preventDefault();
      const el = visibleListItems()[state.active] || visibleListItems()[0];
      if (el) openWord(el.dataset.open);
    }
  });

  $('#clearBtn').addEventListener('click', () => { q.value = ''; state.query = ''; renderPanel(); q.focus(); });
  $('#randomBtn').addEventListener('click', () => { const w = randomWord(state.filter); if (w) openWord(w.w); });
  $('#settingsBtn').addEventListener('click', openSettings);

  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') {
      if (!lesson.hidden) { closeLesson(); return; }
      if (!sheet.hidden) { closeSheet(); return; }
      if (!review.hidden) { review.hidden = true; return; }
    }
    if (ev.key === '/' && lesson.hidden && sheet.hidden && review.hidden) {
      if (document.activeElement && ['INPUT','TEXTAREA'].includes(document.activeElement.tagName)) return;
      ev.preventDefault(); q.focus(); q.select();
    }
    if (!lesson.hidden && ev.key === 'Tab') trapFocus(ev, lesson);
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth > 860) app.classList.remove('reader-open');
    else if (state.selected) app.classList.add('reader-open');
  });

  window.addEventListener('hashchange', async () => {
    const w = parseHash();
    if (w) await openWord(w, { push: false });
    else if (!state.loading) { app.classList.remove('reader-open'); state.selected = null; renderWelcome(); }
  });
}

function trapFocus(ev, root) {
  const nodes = $$('button, [href], input, summary, [tabindex]:not([tabindex="-1"])', root).filter(n => !n.disabled && n.offsetParent !== null);
  if (!nodes.length) return;
  const first = nodes[0], last = nodes[nodes.length - 1];
  if (ev.shiftKey && document.activeElement === first) { ev.preventDefault(); last.focus(); }
  else if (!ev.shiftKey && document.activeElement === last) { ev.preventDefault(); first.focus(); }
}

function refreshView() {
  if (state.view === 'saved') {
    state.query = ''; q.value = '';
    state.filter = 'all'; state.letter = '';
    renderFilters(); renderAlpha(); renderPanel();
    if (!savedWords().length) renderSavedEmpty();
    else if (!state.selected) renderWelcome();
    if (window.innerWidth <= 860) app.classList.remove('reader-open');
  } else {
    renderPanel();
    if (!state.selected) renderWelcome();
  }
}

/* ---------- errors / SW ---------- */
function showDataError() {
  readerScroll.innerHTML = `<div class="reader-empty"><div><div class="big">词</div><p>词库没有加载出来。请确认页面是通过 http:// 或 https:// 打开的，而不是直接双击 HTML 文件。</p></div></div>`;
  list.innerHTML = `<div class="empty-list"><strong>数据加载失败</strong>把整个 ciye 文件夹放到静态服务器上，再从 Safari 打开。</div>`;
  $('#panelHead').innerHTML = '<span>离线数据</span><b>—</b>';
}

function registerSW() {
  const ok = location.protocol === 'https:' || ['localhost','127.0.0.1'].includes(location.hostname);
  if (!ok || !('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
