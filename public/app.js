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
  const summary = el('summary');
  summary.hidden = true;
  summary.style.setProperty('display', 'none', 'important');
  el('summary-content').replaceChildren();
  selectTab('exam');
  message('exam-message', 'Die Auswahl wurde zurückgesetzt. Bereit für den nächsten Prüfling.', 'ok');
  // Scroll ohne Animation und Fokus auf das erste leere Feld.
  const heading = el('exam-start');
  heading.scrollIntoView({ behavior: 'instant', block: 'start' });
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
el('print').addEventListener('click', () => window.print());
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
  el('summary').hidden = true;
  el('summary').style.setProperty('display', 'none', 'important');
  el('summary-content').replaceChildren();
  message('exam-message', 'Fragen werden geladen …');
  try {
    const { questions } = await api('/api/questions/selection', { method: 'POST', body: body({ numbers }), signal: examRequestController.signal });
    if (requestVersion !== examRequestVersion) return;
    const root = el('summary-content'); root.replaceChildren();
    for (const q of questions) {
      const card = document.createElement('article'); card.className = 'summary-card';
      const pill = document.createElement('span'); pill.className = 'pill'; pill.textContent = `Frage ${q.number}`; card.append(pill);
      const title = document.createElement('h3'); title.textContent = q.missing ? 'Frage im Katalog nicht vorhanden' : q.question; if (q.missing) title.className = 'missing'; card.append(title);
      if (!q.missing) {
        const label = document.createElement('strong'); label.className = 'answer-title'; label.textContent = 'Antwort'; card.append(label);
        const answer = document.createElement('div'); answer.className = 'answer';
        if (q.blocks.length) { for (const b of q.blocks) { const p = document.createElement('p'); p.textContent = b; answer.append(p); } }
        else answer.textContent = 'Noch keine Antwort hinterlegt.';
        card.append(answer);
      }
      root.append(card);
    }
    el('summary').style.removeProperty('display');
    el('summary').hidden = false;
    const missing = questions.some(q => q.missing);
    message('exam-message', missing ? 'Mindestens eine Fragennummer ist nicht im Katalog vorhanden.' : `${questions.length} ${questions.length === 1 ? 'Frage wurde' : 'Fragen wurden'} geladen.`, missing ? 'error' : 'ok');
    el('summary').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (e) {
    if (requestVersion !== examRequestVersion || e.name === 'AbortError') return;
    message('exam-message', e.message, 'error');
  } finally { if (requestVersion === examRequestVersion) examRequestController = null; }
});
let editingNum = null;
async function loadList() {
  const q = el('question-search').value;
  try {
    const data = await api('/api/questions?q=' + encodeURIComponent(q));
    const root = el('question-list'); root.replaceChildren();
    if (!data.questions.length) { const p = document.createElement('p'); p.className = 'message'; p.textContent = 'Noch keine Fragen vorhanden. Über „Neue Frage“ kannst du beginnen.'; root.append(p); }
    for (const item of data.questions) {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'question-row';
      const number = document.createElement('strong'); number.textContent = `#${item.number}`;
      const text = document.createElement('span'); text.textContent = item.question; button.append(number, text);
      button.addEventListener('click', () => loadQuestion(item.number)); root.append(button);
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
function blankEditor() { editingNum = null; el('edit-number').readOnly = false; el('edit-form').reset(); el('blocks').replaceChildren(); addBlock(); message('edit-message', ''); }
el('new-question').addEventListener('click', () => { blankEditor(); el('edit-panel').scrollIntoView({ behavior: 'smooth' }); el('edit-number').focus(); });
el('cancel-edit').addEventListener('click', blankEditor);
el('add-block').addEventListener('click', () => addBlock());
async function loadQuestion(number) {
  try {
    const { question } = await api(`/api/questions/${number}`);
    editingNum = number; el('edit-number').value = number; el('edit-number').readOnly = true;
    el('edit-question').value = question.question;
    el('blocks').replaceChildren(); for (const block of question.blocks) addBlock(block);
    if (!question.blocks.length) addBlock();
    message('edit-message', 'Frage geladen. Änderungen erst nach „Speichern“ dauerhaft.');
    el('edit-panel').scrollIntoView({ behavior: 'smooth' });
  } catch (e) { message('edit-message', e.message, 'error'); }
}
el('new-question').addEventListener('click', () => { el('edit-number').readOnly = false; });
el('cancel-edit').addEventListener('click', () => { el('edit-number').readOnly = false; });
el('edit-form').addEventListener('submit', async e => {
  e.preventDefault();
  const data = { number: Number(el('edit-number').value), question: el('edit-question').value, blocks: [...el('blocks').querySelectorAll('textarea')].map(x => x.value) };
  if (editingNum !== null && data.number !== editingNum) return message('edit-message', 'Die Nummer einer bestehenden Frage kann nicht geändert werden.', 'error');
  try { await api('/api/questions', { method: 'PUT', body: body(data) }); editingNum = data.number; el('edit-number').readOnly = true; message('edit-message', 'Frage und Antwortbausteine gespeichert.', 'ok'); await loadList(); }
  catch (e) { message('edit-message', e.message, 'error'); }
});
(async () => { showSession(null); blankEditor(); await refreshChallenge(); })();
