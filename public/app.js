const el = id => document.getElementById(id);
const api = async (path, options = {}) => {
  const response = await fetch(path, { credentials: 'same-origin', ...options, headers: { ...(options.body ? { 'content-type': 'application/json' } : {}), ...options.headers } });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Anfrage fehlgeschlagen');
  return data;
};
const body = obj => JSON.stringify(obj);
function message(id, value, type = '') { const node = el(id); node.textContent = value; node.className = 'message ' + type; }
function showSession(role) {
  const loggedIn = !!role;
  el('login-panel').hidden = loggedIn;
  el('app-panel').hidden = !loggedIn;
  el('logout').hidden = !loggedIn;
  el('admin-navigation').hidden = role !== 'admin';
  selectTab('exam');
}
function selectTab(tab) {
  el('exam-view').hidden = tab !== 'exam';
  el('admin-view').hidden = tab !== 'admin';
  el('tab-admin').classList.toggle('active', tab === 'admin');
  if (tab === 'admin') loadList();
}
async function refreshChallenge() {
  el('solution').value = '';
  el('challenge-number').textContent = '-----';
  try {
    const result = await api('/api/challenge');
    el('challenge-number').textContent = result.challenge;
    message('login-message', '');
  } catch (e) { message('login-message', e.message, 'error'); }
}
el('new-challenge').addEventListener('click', refreshChallenge);
el('admin-checkbox').addEventListener('change', e => { el('admin-label').hidden = !e.target.checked; el('admin-code').required = e.target.checked; });
el('login-form').addEventListener('submit', async e => {
  e.preventDefault(); message('login-message', 'Anmeldung wird geprüft …');
  try {
    const admin = el('admin-checkbox').checked;
    const data = await api('/api/login', { method: 'POST', body: body({ solution: el('solution').value, role: admin ? 'admin' : 'examiner', adminCode: admin ? el('admin-code').value : undefined }) });
    HTMLFormElement.prototype.reset.call(el('login-form')); el('admin-label').hidden = true; showSession(data.role);
  } catch (e) { message('login-message', e.message, 'error'); await refreshChallenge(); }
});
el('logout').addEventListener('click', async () => { try { await api('/api/logout', { method: 'POST' }); } finally { showSession(null); resetExam(); await refreshChallenge(); } });
el('back-to-exam').addEventListener('click', () => selectTab('exam'));
el('tab-admin').addEventListener('click', () => selectTab('admin'));
// Zähler verhindert, dass verspätete Antworten einer alten Abfrage den Reset überschreiben.
let examRequestVersion = 0;
let examRequestController = null;
let displayedQuestions = [];
let activeQuestionIndex = 0;
let resetCount = 0;
let pendingFocusTimer = null;
function setSummaryVisibility(visible) {
  const summary = el('summary');
  summary.hidden = !visible;
  summary.style.display = visible ? '' : 'none';
  summary.setAttribute('aria-hidden', String(!visible));
}
function assertExamCleared() {
  const summary = el('summary');
  const cleared = summary.childElementCount === 0 && summary.hidden &&
    summary.style.display === 'none' && !displayedQuestions.length;
  if (!cleared) console.error('[RS Prüfungsfragen] Reset-Prüfung fehlgeschlagen', {
    children: summary.childElementCount, hidden: summary.hidden,
    display: summary.style.display, questions: displayedQuestions.length,
    // Kein zusätzlicher Druckbereich vorhanden.
  });
  return cleared;
}

function clearExamResults() {
  displayedQuestions = [];
  activeQuestionIndex = 0;
  // Sichtbare Fragenkarten vollständig entfernen.
  const summary = el('summary');
  setSummaryVisibility(false);
  summary.replaceChildren();
  if (pendingFocusTimer !== null) {
    window.clearTimeout(pendingFocusTimer);
    pendingFocusTimer = null;
  }
}
function resetExam() {
  // Eine verspätete Antwort darf nach einem Reset nichts neu rendern.
  const currentReset = ++resetCount;
  ++examRequestVersion;
  if (examRequestController) {
    examRequestController.abort();
    examRequestController = null;
  }
  const form = el('exam-form');
  HTMLFormElement.prototype.reset.call(form);
  for (const field of form.querySelectorAll('input')) { field.value = ''; field.defaultValue = ''; }
  EXAM_INPUTS.forEach((field, index) => validateExamInput(field, index, {show:false}));
  clearExamResults();
  selectTab('exam');
  if (!assertExamCleared()) {
    // Sicherheitsnetz: vollständigen Ergebnisbereich durch frischen Knoten ersetzen.
    const oldSummary = el('summary');
    const fresh = document.createElement('section');
    fresh.id = 'summary';
    fresh.hidden = true;
    fresh.style.display = 'none';
    fresh.setAttribute('aria-hidden', 'true');
    fresh.setAttribute('aria-live', 'polite');
    oldSummary.replaceWith(fresh);
  }
  message('exam-message', 'Zurückgesetzt – neue Fragennummern eingeben.', 'ok');
  el('exam-start').scrollIntoView({ behavior: 'instant', block: 'start' });
  form.querySelector('input')?.focus({ preventScroll: true });
  console.info('[RS Prüfungsfragen] Reset abgeschlossen', {reset: currentReset, ok: assertExamCleared()});
}
window.rsResetExam = resetExam;
// Event-Delegation erfasst Reset sowohl oben als auch nach den Antworten.
// Bewusst nur EIN Handler: verhindert versehentliche Mehrfachausführung.
document.addEventListener('click', event => { const b = event.target.closest?.('[data-reset-exam]'); if (b) { event.preventDefault(); resetExam(); } });
const TOPIC_NAMES = {
  1: 'Gerätelehre und Sanitätstechnik',
  2: 'Sanitätshilfe',
  3: 'Rettungswesen'
};

// Exakte Fachbereichsintervalle aus dem 300-Fragen-Katalog (V7.1, Nov. 2025).
// ACHTUNG: Die Nummern sind je Fachbereich nicht durchgehend!
const TOPIC_RANGES = {
  1: [[1, 5], [10, 56], [62, 93], [283, 300]],
  2: [[6, 9], [57, 61], [94, 189]],
  3: [[190, 282]]
};
const EXAM_INPUTS = [...el('exam-form').querySelectorAll('.number-position input')];
const topicForSlot = index => index < 2 ? 1 : index < 4 ? 2 : 3;
const inTopic = (number, topic) => TOPIC_RANGES[topic].some(([from, to]) => number >= from && number <= to);
const rangesLabel = topic => TOPIC_RANGES[topic].map(([from, to]) => from === to ? String(from) : `${from}–${to}`).join(', ');
function validateExamInput(field, index, {show = true} = {}) {
  const raw = field.value.trim();
  const topic = topicForSlot(index);
  const valid = !raw || (/^\d+$/.test(raw) && Number.isSafeInteger(Number(raw)) && inTopic(Number(raw), topic));
  const holder = field.closest('.number-position');
  const feedback = holder.querySelector('.number-error');
  holder.classList.toggle('number-invalid', show && !valid);
  field.setAttribute('aria-invalid', String(show && !valid));
  if (feedback) feedback.textContent = show && !valid ? `Erlaubt: ${rangesLabel(topic)}` : '';
  return valid;
}
EXAM_INPUTS.forEach((field, index) => {
  field.min = '1'; field.max = '300'; field.step = '1';
  field.setAttribute('aria-describedby', `number-error-${index+1}`);
  field.addEventListener('input', () => validateExamInput(field, index));
  field.addEventListener('blur', () => validateExamInput(field, index));
});


// Rendert die vorhandenen Original-Textbausteine, ohne deren Wortlaut zu verändern.
// Abschnitte vor Listen werden als Untertitel dargestellt, Aufzählungen als ruhige Listenzeilen.
function renderAnswerContent(target, q) {
  target.replaceChildren();
  const source = q.content || (q.blocks || []).map(content => ({type: 'text', content}));
  const texts = source.filter(item => item.type !== 'image');
  let currentList = null;
  const appendPlain = (value, kind) => {
    const node = document.createElement(kind === 'heading' ? 'h4' : 'p');
    node.className = kind === 'heading' ? 'answer-section-title' : 'answer-paragraph';
    node.textContent = value;
    target.append(node);
  };
  for (let i = 0; i < texts.length; i++) {
    const raw = String(texts[i].content ?? '').trim();
    if (!raw) continue;
    const bullet = raw.match(/^[•●▪]\s*/u);
    if (bullet) {
      if (!currentList) {
        currentList = document.createElement('ul');
        currentList.className = 'answer-list';
        target.append(currentList);
      }
      const li = document.createElement('li');
      li.textContent = raw.slice(bullet[0].length);
      currentList.append(li);
    } else {
      currentList = null;
      const next = texts.slice(i + 1).find(item => String(item.content ?? '').trim());
      const nextBullet = next && /^[•●▪]\s*/u.test(String(next.content).trim());
      appendPlain(raw, nextBullet && raw.length <= 120 && !raw.includes('\n') ? 'heading' : 'paragraph');
    }
  }
  const images = source.filter(item => item.type === 'image');
  if (images.length) {
    const figureWrap = document.createElement('div');
    figureWrap.className = 'answer-figures';
    for (const item of images) {
      const img = document.createElement('img');
      img.src = item.path;
      img.alt = `Abbildung aus der Antwort zu Frage ${q.number}`;
      img.loading = 'lazy';
      img.className = 'answer-image';
      figureWrap.append(img);
    }
    target.append(figureWrap);
  }
  if (!target.childNodes.length) target.textContent = 'Noch keine Gesamtantwort hinterlegt.';
}

function createQuestionCard(q) {
  const topic = q._topic || 1;
  const card = document.createElement('article');
  card.className = 'summary-card topic-' + topic;
  const meta = document.createElement('div'); meta.className = 'question-meta';
  const pill = document.createElement('span'); pill.className = 'pill'; pill.textContent = `Frage ${q.number}`;
  const subject = document.createElement('span'); subject.className = 'question-topic'; subject.textContent = TOPIC_NAMES[topic];
  meta.append(pill, subject); card.append(meta);
  const title = document.createElement('h3');
  title.textContent = q.missing ? 'Frage im Katalog nicht vorhanden' : q.question;
  if (q.missing) title.className = 'missing';
  card.append(title);
  if (!q.missing) {
    const switcher = document.createElement('div'); switcher.className = 'answer-switch';
    const full = document.createElement('button'); full.type = 'button'; full.className = 'answer-option selected'; full.textContent = 'Gesamtantwort';
    const short = document.createElement('button'); short.type = 'button'; short.className = 'answer-option'; short.textContent = 'Kurzantwort';
    const area = document.createElement('div'); area.className = 'answer refined-answer';
    const draw = mode => {
      area.replaceChildren();
      full.classList.toggle('selected', mode === 'full');
      short.classList.toggle('selected', mode === 'short');
      full.setAttribute('aria-pressed', String(mode === 'full'));
      short.setAttribute('aria-pressed', String(mode === 'short'));
      if (mode === 'short') {
        const p = document.createElement('p'); p.className = 'answer-paragraph';
        p.textContent = q.short_answer?.trim() || 'Keine Kurzantwort hinterlegt.';
        area.append(p);
      } else renderAnswerContent(area, q);
    };
    full.addEventListener('click', () => draw('full'));
    short.addEventListener('click', () => draw('short'));
    switcher.append(full, short); card.append(switcher, area);
    draw('full');
  }
  return card;
}
function moveQuestion(delta) {
  const next = activeQuestionIndex + delta;
  if (next < 0 || next >= displayedQuestions.length) return;
  activeQuestionIndex = next;
  renderQuestionCarousel();
}
function jumpToQuestion(index) {
  if (!Number.isInteger(index) || index < 0 || index >= displayedQuestions.length) return;
  activeQuestionIndex = index;
  renderQuestionCarousel();
}
function renderQuestionCarousel() {
  const stage = el('carousel-stage');
  if (!stage) return;
  stage.replaceChildren(createQuestionCard(displayedQuestions[activeQuestionIndex]));
  el('carousel-prev').disabled = activeQuestionIndex === 0;
  el('carousel-next').disabled = activeQuestionIndex === displayedQuestions.length - 1;
  el('carousel-counter').textContent = `${activeQuestionIndex + 1} von ${displayedQuestions.length}`;
  const nav = el('question-pills');
  nav.replaceChildren();
  displayedQuestions.forEach((q, index) => {
    const chip = document.createElement('button'); chip.type = 'button';
    chip.className = 'question-chip topic-' + (q._topic || 1) + (index === activeQuestionIndex ? ' active' : '');
    chip.textContent = `Frage ${q.number}`;
    chip.setAttribute('aria-label', `Frage ${q.number} – ${TOPIC_NAMES[q._topic || 1]}`);
    chip.setAttribute('aria-current', index === activeQuestionIndex ? 'step' : 'false');
    chip.addEventListener('click', () => jumpToQuestion(index));
    nav.append(chip);
  });
}
function prepareSummary() {
  const summary = el('summary');
  summary.replaceChildren();
  const carousel = document.createElement('div'); carousel.className = 'question-carousel-v13';
  const prev = document.createElement('button'); prev.type = 'button'; prev.id = 'carousel-prev';
  prev.className = 'nav-arrow'; prev.textContent = '‹'; prev.setAttribute('aria-label', 'Vorherige Frage');
  prev.addEventListener('click', () => moveQuestion(-1));
  const next = document.createElement('button'); next.type = 'button'; next.id = 'carousel-next';
  next.className = 'nav-arrow'; next.textContent = '›'; next.setAttribute('aria-label', 'Nächste Frage');
  next.addEventListener('click', () => moveQuestion(1));
  const stage = document.createElement('div'); stage.id = 'carousel-stage'; stage.className = 'carousel-stage-v13';
  stage.tabIndex = 0; stage.setAttribute('aria-label', 'Aktuelle Frage – Pfeiltasten links und rechts zum Wechseln');
  stage.addEventListener('keydown', event => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault(); moveQuestion(event.key === 'ArrowRight' ? 1 : -1);
    }
  });
  let touchX = null;
  stage.addEventListener('touchstart', event => { touchX = event.touches[0]?.clientX ?? null; }, {passive: true});
  stage.addEventListener('touchend', event => {
    if (touchX === null) return;
    const delta = event.changedTouches[0].clientX - touchX; touchX = null;
    if (Math.abs(delta) > 65) moveQuestion(delta < 0 ? 1 : -1);
  }, {passive: true});
  carousel.append(prev, stage, next);
  const nav = document.createElement('nav'); nav.className = 'question-pills'; nav.id = 'question-pills';
  nav.setAttribute('aria-label', 'Direkt zu einer ausgewählten Frage wechseln');
  const counter = document.createElement('div'); counter.className = 'carousel-counter';
  counter.id = 'carousel-counter'; counter.setAttribute('aria-live', 'polite');
  const actions = document.createElement('div'); actions.className = 'action-row space-top';
  const reset = document.createElement('button'); reset.type = 'button';
  reset.className = 'button secondary'; reset.dataset.resetExam = '';
  reset.textContent = '↻ Zurücksetzen'; actions.append(reset);
  summary.append(carousel, nav, counter, actions);
  setSummaryVisibility(true);
}
el('exam-form').addEventListener('submit', async e => {
  e.preventDefault();
  const fields = [...el('exam-form').querySelectorAll('input')];
  const selectedSlots = fields.map((field, index) => ({ value: field.value.trim(), position: index })).filter(slot => slot.value);
  const entries = selectedSlots.map(slot => slot.value);
  const badSlot = EXAM_INPUTS.findIndex((field, index) => !validateExamInput(field, index));
  if (badSlot !== -1) {
    EXAM_INPUTS[badSlot].focus();
    return message('exam-message', `Frage ${badSlot + 1}: Diese Nummer gehört nicht zu ${TOPIC_NAMES[topicForSlot(badSlot)]}. Erlaubt: ${rangesLabel(topicForSlot(badSlot))}.`, 'error');
  }
  if (!entries.length || entries.length > 5 || entries.some(s => !/^\d+$/.test(s) || !Number.isInteger(Number(s)) || Number(s)<1 || Number(s)>9999)) {
    return message('exam-message', 'Bitte 1 bis 5 gültige Fragennummern eingeben.', 'error');
  }
  const numbers = entries.map(Number);
  if (new Set(numbers).size !== numbers.length) return message('exam-message', 'Bitte keine Fragennummer doppelt eingeben.', 'error');
  // Alte Ergebnisse sofort entfernen, auch wenn die neue Anfrage fehlschlägt.
  examRequestVersion += 1;
  const requestVersion = examRequestVersion;
  if (examRequestController) examRequestController.abort();
  examRequestController = new AbortController();
  clearExamResults();
  message('exam-message', 'Fragen werden geladen …');
  try {
    const { questions } = await api('/api/questions/selection', { method: 'POST', body: body({ numbers }), signal: examRequestController.signal });
    if (requestVersion !== examRequestVersion) return;
    displayedQuestions = questions.map((q, index) => ({...q, _topic: selectedSlots[index].position < 2 ? 1 : selectedSlots[index].position < 4 ? 2 : 3}));
    activeQuestionIndex = 0;
    prepareSummary();
    renderQuestionCarousel();
    setSummaryVisibility(true);
    const missing = questions.some(q => q.missing);
    message('exam-message', missing ? 'Mindestens eine Fragennummer ist nicht im Katalog vorhanden.' : `${questions.length} ${questions.length === 1 ? 'Frage wurde' : 'Fragen wurden'} geladen.`, missing ? 'error' : 'ok');
    el('summary').scrollIntoView({ behavior: 'smooth', block: 'start' });
    pendingFocusTimer = window.setTimeout(() => { if (requestVersion === examRequestVersion) el('carousel-stage')?.focus({ preventScroll: true }); pendingFocusTimer = null; }, 250);
  } catch (e) {
    if (requestVersion !== examRequestVersion || e.name === 'AbortError') return;
    message('exam-message', e.message, 'error');
  } finally { if (requestVersion === examRequestVersion) examRequestController = null; }
});
let editingNum = null;
let adminQuestionNumbers = [];
let adminLoadVersion = 0;
function refreshAdminNavigator() {
  const wrap = el('admin-navigator');
  if (editingNum === null) { wrap.hidden = true; el('edit-position').textContent = 'Neue Frage'; return; }
  wrap.hidden = false;
  const index = adminQuestionNumbers.indexOf(editingNum);
  el('edit-position').textContent = index >= 0 ? `Frage ${index + 1} von ${adminQuestionNumbers.length}` : `Frage ${editingNum}`;
  el('admin-prev').disabled = index <= 0;
  el('admin-next').disabled = index < 0 || index >= adminQuestionNumbers.length - 1;
  const root = el('admin-peek'); root.replaceChildren();
  for (const offset of [-1, 0, 1]) {
    const number = adminQuestionNumbers[index + offset];
    const tile = document.createElement('button'); tile.type = 'button';
    tile.className = 'admin-mini-card' + (offset === 0 ? ' current' : '');
    if (number !== undefined) {
      tile.textContent = `Frage ${number}`;
      tile.disabled = offset === 0;
      if (offset) tile.addEventListener('click',()=>navigateAdmin(offset));
    } else { tile.textContent = ' '; tile.disabled = true; }
    root.append(tile);
  }
}
function hasUnsavedAdminChanges() {
  return editingNum !== null && editSnapshot !== JSON.stringify(editorValues());
}
let editSnapshot = '';
function editorValues() {
  return {number: el('edit-number').value, question: el('edit-question').value, short_answer:el('edit-short').value,subject_area:el('edit-subject').value,content:readEditorContent()};
}
async function navigateAdmin(delta) {
  if (hasUnsavedAdminChanges() && !window.confirm('Ungespeicherte Änderungen verwerfen und zur nächsten Frage wechseln?')) return;
  const index = adminQuestionNumbers.indexOf(editingNum);
  const target = adminQuestionNumbers[index + delta];
  if (target !== undefined) await loadQuestion(target);
}
el('admin-prev').addEventListener('click',()=>navigateAdmin(-1));
el('admin-next').addEventListener('click',()=>navigateAdmin(1));
async function loadList() {
  const q = el('question-search').value;
  try {
    const data = await api('/api/questions?q=' + encodeURIComponent(q));
    adminQuestionNumbers = data.questions.map(item => item.number);
    refreshAdminNavigator();
    const root = el('question-list'); root.replaceChildren();
    if (!data.questions.length) { const p = document.createElement('p'); p.className = 'message'; p.textContent = 'Noch keine Fragen vorhanden. Über „Neue Frage“ kannst du beginnen.'; root.append(p); }
    for (const item of data.questions) {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'question-row';
      const number = document.createElement('strong'); number.textContent = `#${item.number}`;
      const text = document.createElement('span'); text.textContent = item.question; button.append(number, text);
      button.addEventListener('click', () => {
        if (hasUnsavedAdminChanges() && !window.confirm('Ungespeicherte Änderungen verwerfen?')) return;
        loadQuestion(item.number);
      }); root.append(button);
    }
  } catch (e) { message('edit-message', e.message, 'error'); }
}
let searchTimer;
el('question-search').addEventListener('input', () => { clearTimeout(searchTimer); searchTimer = setTimeout(loadList, 200); });
function readEditorContent() {
  return [...el('blocks').children].map(wrap => wrap.dataset.kind==='image'
    ? {type:'image',path:wrap.dataset.path}
    : {type:'text',content:wrap.querySelector('textarea').value});
}
function addImage(path) {
  const wrap=document.createElement('div'); wrap.className='answer-block media-block'; wrap.dataset.kind='image';wrap.dataset.path=path;
  const img=document.createElement('img'); img.src=path;img.className='answer-image';img.alt='Grafik der Gesamtantwort';
  const caption=document.createElement('div'); caption.className='block-heading';
  const label=document.createElement('span');label.textContent='Grafik: '+path.split('/').pop();
  const remove=document.createElement('button');remove.type='button';remove.className='button secondary';remove.textContent='Grafik entfernen';remove.onclick=()=>wrap.remove();
  caption.append(label,remove);wrap.append(caption,img);el('blocks').append(wrap);
}
function addBlock(value = '') {
  const wrap = document.createElement('div'); wrap.className = 'answer-block'; wrap.dataset.kind='text';
  const heading = document.createElement('div'); heading.className = 'block-heading';
  const text = document.createElement('span'); text.textContent = 'Textbaustein';
  const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'button secondary'; remove.textContent = 'Entfernen'; remove.addEventListener('click', () => wrap.remove());
  const area = document.createElement('textarea'); area.rows = 4; area.maxLength = 20000; area.value = value; area.setAttribute('aria-label', 'Gesamtantwort-Textbaustein');
  heading.append(text, remove); wrap.append(heading, area); el('blocks').append(wrap);
}
function blankEditor() { editingNum = null; el('edit-number').readOnly = false; HTMLFormElement.prototype.reset.call(el('edit-form')); el('blocks').replaceChildren(); addBlock(); editSnapshot = JSON.stringify(editorValues()); refreshAdminNavigator(); message('edit-message', ''); }
el('new-question').addEventListener('click', () => { blankEditor(); el('edit-panel').scrollIntoView({ behavior: 'smooth' }); el('edit-number').focus(); });
el('cancel-edit').addEventListener('click', blankEditor);
el('add-block').addEventListener('click', () => addBlock());
async function loadQuestion(number) {
  const version = ++adminLoadVersion;
  try {
    const { question } = await api(`/api/questions/${number}`);
    if (version !== adminLoadVersion) return;
    editingNum = number; el('edit-number').value = number; el('edit-number').readOnly = true;
    el('edit-question').value = question.question;
    el('edit-short').value=question.short_answer || ''; el('edit-subject').value=question.subject_area || '';
    el('blocks').replaceChildren(); for(const item of question.content || (question.blocks||[]).map(content=>({type:'text',content}))) {if(item.type==='image') addImage(item.path);else addBlock(item.content);}
    if (!el('blocks').children.length) addBlock();
    editSnapshot = JSON.stringify(editorValues());
    refreshAdminNavigator();
    message('edit-message', 'Frage geladen. Änderungen erst nach „Speichern“ dauerhaft.');
    el('edit-panel').scrollIntoView({ behavior: 'smooth', block: 'start' });
    el('edit-question').focus({preventScroll:true});
  } catch (e) { message('edit-message', e.message, 'error'); }
}
el('new-question').addEventListener('click', () => { el('edit-number').readOnly = false; });
el('cancel-edit').addEventListener('click', () => { el('edit-number').readOnly = false; });
el('edit-form').addEventListener('submit', async e => {
  e.preventDefault();
  const data = { number: Number(el('edit-number').value), question: el('edit-question').value, short_answer:el('edit-short').value, subject_area:el('edit-subject').value, content:readEditorContent() };
  if (editingNum !== null && data.number !== editingNum) return message('edit-message', 'Die Nummer einer bestehenden Frage kann nicht geändert werden.', 'error');
  try { await api('/api/questions', { method: 'PUT', body: body(data) }); editingNum = data.number; el('edit-number').readOnly = true; editSnapshot = JSON.stringify(editorValues()); message('edit-message', 'Frage und Antwortbausteine gespeichert.', 'ok'); await loadList(); refreshAdminNavigator(); }
  catch (e) { message('edit-message', e.message, 'error'); }
});
(async () => { showSession(null); blankEditor(); await refreshChallenge(); })();
