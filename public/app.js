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
    el('login-form').reset(); el('admin-label').hidden = true; showSession(data.role);
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
function clearExamResults() {
  displayedQuestions = [];
  activeQuestionIndex = 0;
  const summary = el('summary');
  // Sofort verstecken, dann alle von JS generierten Elemente entfernen.
  summary.hidden = true;
  summary.replaceChildren();
  summary.setAttribute('aria-hidden', 'true');
}
function resetExam() {
  // Auch Ergebnisse von noch laufenden API-Anfragen dürfen nicht mehr erscheinen.
  examRequestVersion += 1;
  if (examRequestController) {
    examRequestController.abort();
    examRequestController = null;
  }
  // Alle fünf Felder ausdrücklich leeren (nicht nur form.reset(), das Defaultwerte wiederherstellen könnte).
  const form = el('exam-form');
  for (const field of form.querySelectorAll('input')) field.value = '';
  form.reset();
  for (const field of form.querySelectorAll('input')) field.value = '';
  clearExamResults();
  selectTab('exam');
  message('exam-message', 'Die Auswahl wurde zurückgesetzt. Bereit für den nächsten Prüfling.', 'ok');
  // Scroll ohne Animation und Fokus auf das erste leere Feld.
  const heading = el('exam-start');
  heading.scrollIntoView({ behavior: 'auto', block: 'start' });
  const first = form.querySelector('input');
  if (first) first.focus({ preventScroll: true });
}
// Event-Delegation erfasst Reset sowohl oben als auch nach den Antworten.
// Bewusst nur EIN Handler: verhindert versehentliche Mehrfachausführung.
document.addEventListener('click', event => {
  const resetButton = event.target.closest('[data-reset-exam]');
  if (!resetButton) return;
  event.preventDefault();
  resetExam();
});
// Auch der Druckbutton entsteht erst, wenn Ergebnisse angezeigt werden.
document.addEventListener('click', event => {
  if (event.target.closest('#print')) window.print();
});
function createQuestionCard(q) {
  const card = document.createElement('article'); card.className = 'summary-card';
  const pill = document.createElement('span'); pill.className = 'pill'; pill.textContent = `Frage ${q.number}`; card.append(pill);
  const title = document.createElement('h3'); title.textContent = q.missing ? 'Frage im Katalog nicht vorhanden' : q.question;
  if (q.missing) title.className = 'missing'; card.append(title);
  if (!q.missing) {
    const label = document.createElement('strong'); label.className = 'answer-title'; label.textContent = 'Antwort'; card.append(label);
    const answer = document.createElement('div'); answer.className = 'answer';
    if (q.blocks.length) for (const b of q.blocks) {
      const p = document.createElement('p'); p.textContent = b; answer.append(p);
    } else answer.textContent = 'Noch keine Antwort hinterlegt.';
    card.append(answer);
  }
  return card;
}
function moveQuestion(delta) {
  const next = activeQuestionIndex + delta;
  if (next < 0 || next >= displayedQuestions.length) return;
  activeQuestionIndex = next;
  renderQuestionCarousel();
}
function renderQuestionCarousel() {
  const stage = el('carousel-stage');
  if (!stage) return;
  stage.replaceChildren();
  for (const offset of [-1,0,1]) {
    const index = activeQuestionIndex + offset;
    const slot = document.createElement('div');
    slot.className = 'carousel-slot ' + (offset === 0 ? 'selected' : 'peek');
    if (index >= 0 && index < displayedQuestions.length) {
      if (offset === 0) slot.append(createQuestionCard(displayedQuestions[index]));
      else {
        const peek = document.createElement('button');
        peek.type = 'button'; peek.className = 'peek-card';
        peek.setAttribute('aria-label', `Zu Frage ${displayedQuestions[index].number} wechseln`);
        const badge = document.createElement('span'); badge.textContent = `Frage ${displayedQuestions[index].number}`;
        peek.append(badge); peek.addEventListener('click', () => moveQuestion(offset)); slot.append(peek);
      }
    }
    stage.append(slot);
  }
  el('carousel-prev').disabled = activeQuestionIndex === 0;
  el('carousel-next').disabled = activeQuestionIndex === displayedQuestions.length - 1;
  el('carousel-counter').textContent = `${activeQuestionIndex + 1} von ${displayedQuestions.length}`;
}
function prepareSummary() {
  const summary = el('summary');
  summary.replaceChildren();
  const heading = document.createElement('div'); heading.className = 'section-head space-top';
  const title = document.createElement('h2'); title.textContent = 'Prüfungszusammenfassung';
  const print = document.createElement('button'); print.id = 'print'; print.type = 'button'; print.className = 'button secondary'; print.textContent = 'Drucken / PDF';
  heading.append(title, print);
  const carousel = document.createElement('div'); carousel.className = 'question-carousel';
  const prev = document.createElement('button'); prev.type='button'; prev.id='carousel-prev'; prev.className='nav-arrow'; prev.textContent='‹'; prev.setAttribute('aria-label','Vorherige Frage'); prev.addEventListener('click',()=>moveQuestion(-1));
  const next = document.createElement('button'); next.type='button'; next.id='carousel-next'; next.className='nav-arrow'; next.textContent='›'; next.setAttribute('aria-label','Nächste Frage'); next.addEventListener('click',()=>moveQuestion(1));
  const stage = document.createElement('div'); stage.id='carousel-stage'; stage.className='carousel-stage'; stage.tabIndex=0; stage.setAttribute('aria-label','Fragenkarten, Pfeiltasten links und rechts zum Wechseln');
  stage.addEventListener('keydown',event => { if (event.key==='ArrowRight' || event.key==='ArrowLeft') { event.preventDefault(); moveQuestion(event.key==='ArrowRight'?1:-1); } });
  let touchX = null;
  stage.addEventListener('touchstart',event=>{touchX=event.touches[0]?.clientX??null},{passive:true});
  stage.addEventListener('touchend',event=>{if(touchX===null)return; const diff=event.changedTouches[0].clientX-touchX; touchX=null;if(Math.abs(diff)>55)moveQuestion(diff<0?1:-1);},{passive:true});
  const counter = document.createElement('div'); counter.className='carousel-counter'; counter.id='carousel-counter'; counter.setAttribute('aria-live','polite');
  carousel.append(prev,stage,next);
  const actions = document.createElement('div'); actions.className = 'action-row space-top';
  const reset = document.createElement('button'); reset.type='button'; reset.className='button secondary'; reset.dataset.resetExam=''; reset.textContent='↻ Zurücksetzen'; actions.append(reset);
  const printAll = document.createElement('div'); printAll.className='print-all';
  for (const q of displayedQuestions) printAll.append(createQuestionCard(q));
  summary.append(heading,carousel,counter,actions,printAll);
  summary.removeAttribute('aria-hidden');
}
el('exam-form').addEventListener('submit', async e => {
  e.preventDefault();
  const fields = [...el('exam-form').querySelectorAll('input')];
  const entries = fields.map(field => field.value.trim()).filter(Boolean);
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
    displayedQuestions = questions;
    activeQuestionIndex = 0;
    prepareSummary();
    renderQuestionCarousel();
    el('summary').hidden = false;
    const missing = questions.some(q => q.missing);
    message('exam-message', missing ? 'Mindestens eine Fragennummer ist nicht im Katalog vorhanden.' : `${questions.length} ${questions.length === 1 ? 'Frage wurde' : 'Fragen wurden'} geladen.`, missing ? 'error' : 'ok');
    el('summary').scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.setTimeout(() => el('carousel-stage')?.focus({ preventScroll: true }), 250);
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
  return {number: el('edit-number').value, question: el('edit-question').value, blocks: [...el('blocks').querySelectorAll('textarea')].map(x => x.value)};
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
function addBlock(value = '') {
  const wrap = document.createElement('div'); wrap.className = 'answer-block';
  const heading = document.createElement('div'); heading.className = 'block-heading';
  const text = document.createElement('span'); text.textContent = 'Antwortbaustein';
  const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'button secondary'; remove.textContent = 'Entfernen'; remove.addEventListener('click', () => wrap.remove());
  const area = document.createElement('textarea'); area.rows = 4; area.maxLength = 20000; area.value = value; area.setAttribute('aria-label', 'Antwortbaustein');
  heading.append(text, remove); wrap.append(heading, area); el('blocks').append(wrap);
}
function blankEditor() { editingNum = null; el('edit-number').readOnly = false; el('edit-form').reset(); el('blocks').replaceChildren(); addBlock(); editSnapshot = JSON.stringify(editorValues()); refreshAdminNavigator(); message('edit-message', ''); }
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
    el('blocks').replaceChildren(); for (const block of question.blocks) addBlock(block);
    if (!question.blocks.length) addBlock();
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
  const data = { number: Number(el('edit-number').value), question: el('edit-question').value, blocks: [...el('blocks').querySelectorAll('textarea')].map(x => x.value) };
  if (editingNum !== null && data.number !== editingNum) return message('edit-message', 'Die Nummer einer bestehenden Frage kann nicht geändert werden.', 'error');
  try { await api('/api/questions', { method: 'PUT', body: body(data) }); editingNum = data.number; el('edit-number').readOnly = true; editSnapshot = JSON.stringify(editorValues()); message('edit-message', 'Frage und Antwortbausteine gespeichert.', 'ok'); await loadList(); refreshAdminNavigator(); }
  catch (e) { message('edit-message', e.message, 'error'); }
});
(async () => { showSession(null); blankEditor(); await refreshChallenge(); })();
