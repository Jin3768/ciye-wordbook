import { esc, attr, ICON, highlight, fmtRank, EXAM_LABEL, CORE_EXAM, formsOf } from './util.js';

/* Curated “熟词僻义” — the meanings exams love to test. */
export const TRAPS = {
  address:  { zh:'处理；应对（问题）', en:'We need to address this problem.', z:'我们需要解决这个问题。' },
  company:  { zh:'陪伴', en:'I really enjoy your company.', z:'我很喜欢有你陪伴。' },
  fine:     { zh:'罚款', en:'He paid a fine for parking there.', z:'他因在那里停车而被罚款。' },
  last:     { zh:'持续', en:'The meeting lasted two hours.', z:'会议持续了两个小时。' },
  mean:     { zh:'吝啬的', en:"He's too mean to pay for dinner.", z:'他太小气，不肯付晚饭钱。' },
  course:   { zh:'过程', en:'In the course of the talk, she mentioned it.', z:'在谈话过程中，她提到了这件事。' },
  book:     { zh:'预订', en:'I booked a table for two.', z:'我订了一张两人桌。' },
  change:   { zh:'零钱', en:'Keep the change.', z:'不用找零了。' },
  charge:   { zh:'收费；指控', en:'They charged me ten dollars for the book.', z:'这本书他们收了我十美元。' },
  hold:     { zh:'容纳', en:'The hall can hold 500 people.', z:'大厅能容纳五百人。' },
  issue:    { zh:'发行；发放', en:'The bank issued a new card.', z:'银行发行了一张新卡。' },
  land:     { zh:'获得（工作）', en:'She landed a job in Shanghai.', z:'她在上海找到了一份工作。' },
  light:    { zh:'点燃', en:'He lit a candle.', z:'他点燃了一根蜡烛。' },
  matter:   { zh:'要紧；有关系', en:"It doesn't matter.", z:'没关系。' },
  order:    { zh:'点餐；订购', en:'We ordered two coffees.', z:'我们点了两杯咖啡。' },
  present:  { zh:'展示；陈述', en:'She presented her plan to the class.', z:'她向全班展示了她的计划。' },
  pretty:   { zh:'相当；很', en:'The test was pretty easy.', z:'这次考试相当容易。' },
  race:     { zh:'种族', en:'We should treat all races equally.', z:'我们应该平等对待所有种族。' },
  raise:    { zh:'抚养', en:'She raised three children.', z:'她抚养了三个孩子。' },
  rest:     { zh:'剩余部分', en:"I'll finish the rest tomorrow.", z:'剩下的我明天完成。' },
  right:    { zh:'权利', en:'Everyone has the right to vote.', z:'每个人都有投票权。' },
  room:     { zh:'空间', en:'There is no room for a piano.', z:'没有空间放钢琴了。' },
  run:      { zh:'经营', en:'She runs a small bookstore.', z:'她经营一家小书店。' },
  save:     { zh:'节省', en:'Taking the subway saves time.', z:'坐地铁能节省时间。' },
  sound:    { zh:'听起来', en:'That sounds like a good idea.', z:'那听起来是个好主意。' },
  spare:    { zh:'空闲的', en:'What do you do in your spare time?', z:'你空闲时间做什么？' },
  stand:    { zh:'忍受', en:"I can't stand the noise.", z:'我受不了这噪音。' },
  state:    { zh:'陈述；说明', en:'Please state your name and address.', z:'请说出你的姓名和地址。' },
  stick:    { zh:'坚持', en:'Stick to your plan.', z:'坚持你的计划。' },
  story:    { zh:'楼层', en:'They live in a ten-story building.', z:'他们住在一栋十层楼里。' },
  tell:     { zh:'分辨', en:'Can you tell the difference?', z:'你能分辨出区别吗？' },
  term:     { zh:'术语', en:'This is a medical term.', z:'这是一个医学术语。' },
  tip:      { zh:'小费', en:'We left a tip on the table.', z:'我们在桌上留了小费。' },
  treat:    { zh:'请客', en:'Let me treat you to lunch.', z:'让我请你吃午饭。' },
  watch:    { zh:'手表', en:'My watch is five minutes fast.', z:'我的手表快了五分钟。' },
  well:     { zh:'井', en:'They got water from a well.', z:'他们从井里取水。' },
  will:     { zh:'遗嘱', en:'She made a will before the surgery.', z:'手术前她立了遗嘱。' },
  work:     { zh:'起作用', en:'The medicine worked.', z:'药起作用了。' },
  wound:    { zh:'伤口', en:'Clean the wound with water.', z:'用水清洗伤口。' },
  novel:    { zh:'新颖的', en:"That's a novel idea.", z:'那是个新颖的想法。' },
  firm:     { zh:'公司', en:'She works for a law firm.', z:'她在一家律师事务所工作。' },
  major:    { zh:'主修', en:'She majored in history.', z:'她主修历史。' },
  practice: { zh:'做法；惯例', en:"It's a common practice here.", z:'这是这里的常见做法。' },
};

export function badges(entry) {
  const out = [];
  for (const t of entry.t) {
    if (!EXAM_LABEL[t]) continue;
    out.push(`<span class="badge ${CORE_EXAM.has(t) ? 'exam' : ''}">${EXAM_LABEL[t]}</span>`);
  }
  if (entry.o) out.push('<span class="badge oxford">牛津 3000</span>');
  if (entry.simple || !entry.g) out.push('<span class="badge simple">简明</span>');
  return out.join('');
}

function ipa(entry) {
  const p = entry.p || '';
  if (!p || p.toLowerCase() === entry.w.toLowerCase()) return '';
  return p;
}

function prounciation(entry) {
  const p = ipa(entry);
  return `<span class="ipa">${p ? '/' + esc(p) + '/' : '—'}</span>
    <button class="speak-btn" data-speak="${attr(entry.w)}" data-speak-kind="word" aria-label="朗读 ${attr(entry.w)}">${ICON.speaker}</button>`;
}

function sensesHTML(entry) {
  if (!entry.s || !entry.s.length) return '<p class="empty-note">这个词的释义还在整理。</p>';
  return entry.s.map(gr => {
    const domain = gr.p && gr.p.startsWith('[');
    const parts = gr.g.map((g, i) => {
      const hot = gr.h && gr.h.includes(i);
      return `<span class="gloss${hot ? ' is-hot' : ''}"${hot ? ' title="常考义"' : ''}>${esc(g)}</span>`;
    });
    return `<div class="sense-row">
      <span class="pos${domain ? ' domain' : ''}">${esc(gr.p || '释义')}</span>
      <p class="glosses">${parts.join('<span class="dot">·</span>')}</p>
    </div>`;
  }).join('');
}

function hotList(entry) {
  const out = [];
  for (const gr of entry.s || []) {
    if (gr.p && gr.p.startsWith('[')) continue;
    const words = (gr.h || []).map(i => gr.g[i]).filter(Boolean);
    if (words.length) out.push({ p: gr.p, words });
    if (out.length >= 3) break;
  }
  if (!out.length && entry.s && entry.s.length) {
    const gr = entry.s[0];
    if (gr.g && gr.g.length) out.push({ p: gr.p, words: gr.g.slice(0, 2) });
  }
  return out;
}

function examHTML(entry, trapOnly = false) {
  const hot = hotList(entry);
  const core = entry.t.filter(x => CORE_EXAM.has(x));
  const other = entry.t.filter(x => !CORE_EXAM.has(x));
  const all = [...core, ...other];
  let line;
  if (core.length) line = `${core.map(t => EXAM_LABEL[t]).join('、')} 词表都收录。`;
  else if (other.length) line = `${other.map(t => EXAM_LABEL[t]).join('、')} 词表收录。`;
  else line = entry.r && entry.r <= 8000 ? '考试词表未单独收录，属于日常高频词。' : '考试词表未单独收录，先按日常词掌握。';

  const meta = [];
  if (entry.r) meta.push(`词频 <b>第 ${fmtRank(entry.r)} 位</b>`);
  if (entry.c) meta.push(`柯林斯 <span class="stars">${'★'.repeat(entry.c)}${'☆'.repeat(5 - entry.c)}</span>`);
  if (entry.o) meta.push('牛津 <b>3000</b> 核心词');

  const focus = hot.length ? `<div class="focus">
      <div class="focus-k">优先记</div>
      ${hot.map(h => `<div class="focus-v"><span class="fp">${esc(h.p || '')}</span>${esc(h.words.join('；'))}</div>`).join('')}
    </div>` : '';

  const trap = TRAPS[entry.w.toLowerCase()];
  const trapHTML = trap ? `<div class="trap">
      <div class="trap-k">熟词僻义</div>
      <div class="trap-zh">${esc(trap.zh)}</div>
      <p class="trap-en" lang="en">${highlight(trap.en, entry)}</p>
      <p class="trap-z">${esc(trap.z)}</p>
    </div>` : '';

  if (trapOnly) return trapHTML;

  return `<div class="exam-lines">
    ${focus}
    ${trapHTML}
    <p class="exam-tip">${esc(line)}${meta.length ? '' : ''}</p>
    ${meta.length ? `<div class="exam-meta">${meta.map(x => `<span>${x}</span>`).join('')}</div>` : ''}
  </div>`;
}

function rootsHTML(entry, innerOnly = false) {
  const parts = entry.parts || [];
  const split = parts.length ? `<div class="split" aria-label="词根词缀拆解">
    ${parts.map((p, i) => `${i ? '<span class="split-op">+</span>' : ''}
      <span class="part" data-kind="${attr(p.k)}">
        <span class="kind">${p.k === 'prefix' ? '前缀' : p.k === 'suffix' ? '后缀' : '词根'}</span>
        <b>${esc(p.t)}</b>
        <small>${esc(p.z || p.m || '')}</small>
      </span>`).join('')}
  </div>` : (entry.root ? '' : '<p class="root-fallback">这个词没有可靠的词根拆解，整体记忆更合适。</p>');

  const note = entry.root ? `<p class="root-note">${esc(entry.root)}</p>` : '';
  const mem = entry.mem ? `<details class="memory"><summary>记忆辅助</summary><p>${esc(entry.mem)}</p></details>` : '';
  return `${split}${note}${mem}`;
}

function exampleHTML(entry, i = 0) {
  const list = entry.ex || [];
  if (!list.length) return '<p class="empty-note">这个词的例句还在补；先记住释义和词根，遇到阅读再补一句。</p>';
  const ex = list[i] || list[0];
  return `<figure class="example" data-ex-index="${i}">
    <blockquote>
      <p class="ex-en" lang="en">${highlight(ex.e, entry)}</p>
      <p class="ex-zh">${esc(ex.z)}</p>
    </blockquote>
    <div class="ex-bar">
      <button class="icon-btn" data-speak="${attr(ex.e)}" data-speak-kind="sentence" aria-label="朗读例句">${ICON.speaker}</button>
      ${list.length > 1 ? '<button class="text-btn" data-next-ex>换一句</button>' : ''}
      <span class="ex-count">${i + 1} / ${list.length}</span>
    </div>
  </figure>`;
}

export function sectionInner(entry, key) {
  if (key === 'meaning') return `${entry.g ? `<p class="gist">${esc(entry.g)}</p>` : ''}${sensesHTML(entry)}`;
  if (key === 'exam') return examHTML(entry);
  if (key === 'roots') return rootsHTML(entry);
  if (key === 'example') return exampleHTML(entry, 0);
  return '';
}

const SEC_META = {
  meaning: { ch: '义', title: '全部中文意思', note: '先看全，再挑重点' },
  exam: { ch: '考', title: '常考什么', note: '词表与词频标注' },
  roots: { ch: '根', title: '词根词缀', note: '拆开看，记得住' },
  example: { ch: '例', title: '生活例句', note: '一句就够' },
};

export function sectionHTML(entry, key) {
  const m = SEC_META[key];
  const note = key === 'meaning' && (entry.simple || !entry.g) ? '简明释义' : m.note;
  return `<section class="sec" id="sec-${key}" data-sec="${m.ch}">
    <div class="sec-head">
      <span class="sec-bar" aria-hidden="true"></span>
      <h2 class="sec-title">${m.title}</h2>
      <span class="sec-note">${note}</span>
    </div>
    ${sectionInner(entry, key)}
  </section>`;
}

export function entryHTML(entry, { saved = false } = {}) {
  const trap = TRAPS[entry.w.toLowerCase()];
  return `<article class="entry${entry.simple || !entry.g ? ' is-simple' : ''}" data-word="${attr(entry.w)}">
    <header class="entry-head">
      <button class="back-btn" data-back>${ICON.arrowLeft}<span>返回词表</span></button>
      <div class="head-top">
        <div class="head-main">
          <h1 class="head-word" lang="en">${esc(entry.w)}</h1>
          <div class="head-pron">${prounciation(entry)}</div>
          <div class="badges">${badges(entry)}</div>
          <p class="head-brief">${esc(entry.b || '')}</p>
        </div>
        <div class="head-actions">
          <button class="lesson-btn" data-lesson aria-label="逐步讲解 ${attr(entry.w)}">${ICON.play}<span>逐步讲</span></button>
          <button class="book-btn${saved ? ' is-saved' : ''}" data-book="${attr(entry.w)}" aria-pressed="${saved}" aria-label="${saved ? '移出生词本' : '加入生词本'}">${ICON.star}</button>
        </div>
      </div>
    </header>
    <div class="entry-body">
      <nav class="stepper" aria-label="词条小节">
        <span class="stepper-line" aria-hidden="true"></span>
        ${['meaning','exam','roots','example'].map(k => `<button class="step-tab${k === 'meaning' ? ' is-active' : ''}" data-goto="${k}" data-sec="${SEC_META[k].ch}" aria-label="${SEC_META[k].title}">${SEC_META[k].ch}</button>`).join('')}
      </nav>
      <div class="sections">
        ${sectionHTML(entry, 'meaning')}
        ${sectionHTML(entry, 'exam')}
        ${sectionHTML(entry, 'roots')}
        ${sectionHTML(entry, 'example')}
        <div class="entry-actions">
          <button class="btn primary" data-known>${ICON.check} 记住了</button>
          <button class="btn" data-again>还要再看</button>
          <button class="btn ghost" data-random>随机一词 ${ICON.arrowRight}</button>
        </div>
        <p class="source-line">收词参照《牛津高阶英汉双解词典》第 7 版 · 释义整理自 ECDICT · 讲解来自开源词书 · 例句来自词书与 Tatoeba</p>
      </div>
    </div>
  </article>`;
}

export function exampleCount(entry) { return (entry.ex || []).length; }
export function exampleAt(entry, i) { return exampleHTML(entry, i); }
