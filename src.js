const encoder = new TextEncoder();
const json = (value, status = 200, extra = {}) => new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', ...extra } });
const error = (message, status = 400) => json({ error: message }, status);
const safeEqual = async (a, b) => {
  const [x, y] = await Promise.all([crypto.subtle.digest('SHA-256', encoder.encode(String(a))), crypto.subtle.digest('SHA-256', encoder.encode(String(b)))]);
  const av = new Uint8Array(x), bv = new Uint8Array(y);
  let diff = 0; for (let i = 0; i < av.length; i++) diff |= av[i] ^ bv[i];
  return diff === 0;
};
const b64 = bytes => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64 = text => Uint8Array.from(atob(text.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - text.length % 4) % 4)), c => c.charCodeAt(0));
async function sign(value, secret) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64(new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(value))));
}
async function auth(request, env) {
  const cookie = (request.headers.get('cookie') || '').split(';').map(s => s.trim()).find(s => s.startsWith('rs_session='));
  if (!cookie || !env.SESSION_SECRET) return null;
  try {
    const token = cookie.slice('rs_session='.length);
    const [body, signature] = token.split('.');
    if (!body || !signature || !(await safeEqual(signature, await sign(body, env.SESSION_SECRET)))) return null;
    const payload = JSON.parse(new TextDecoder().decode(unb64(body)));
    if (payload.exp < Date.now() || !['examiner', 'admin'].includes(payload.role)) return null;
    return payload;
  } catch { return null; }
}
const cookie = (value, maxAge) => `rs_session=${value}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${maxAge}`;
const getIPKey = async (request, env) => b64(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode((request.headers.get('cf-connecting-ip') || 'unknown') + ':' + env.SESSION_SECRET))));
// Die Rechenregel ist öffentlich. Dies ist eine Bedienersperre, keine starke Authentifizierung.
const challengeCookie = (value, maxAge) => `rs_challenge=${value}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${maxAge}`;
function readCookie(request, name) {
  const part = (request.headers.get('cookie') || '').split(';').map(s => s.trim()).find(s => s.startsWith(`${name}=`));
  return part ? part.slice(name.length + 1) : null;
}
function randomDigit(min, max) {
  // Rejection sampling zur Vermeidung eines Modulo-Bias.
  const width = max - min + 1;
  const threshold = Math.floor(256 / width) * width;
  let v; do { v = crypto.getRandomValues(new Uint8Array(1))[0]; } while (v >= threshold);
  return min + v % width;
}
function newChallengeNumber() {
  // Die vier äußeren Ziffern sind 1..9, damit 10 - Ziffer immer genau eine Ziffer ergibt.
  return [randomDigit(1,9), randomDigit(1,9), randomDigit(0,9), randomDigit(1,9), randomDigit(1,9)].join('');
}
function challengeSolution(digits) {
  return [digits[0],digits[1],digits[3],digits[4]].reverse().map(d => 10 - Number(d)).join('');
}
async function issueChallenge(env) {
  if (!env.SESSION_SECRET) return error('SESSION_SECRET ist nicht konfiguriert.', 503);
  const digits = newChallengeNumber();
  const payload = b64(encoder.encode(JSON.stringify({ digits, exp: Date.now() + 5 * 60 * 1000 })));
  const signature = await sign(payload, env.SESSION_SECRET);
  return json({ challenge: digits, expiresInSeconds: 300 }, 200, {
    'set-cookie': challengeCookie(`${payload}.${signature}`, 300)
  });
}
async function verifyChallenge(request, env, response) {
  const token = readCookie(request, 'rs_challenge');
  if (!token || !env.SESSION_SECRET) return false;
  try {
    const parts = token.split('.');
    if (parts.length !== 2 || !(await safeEqual(parts[1], await sign(parts[0], env.SESSION_SECRET)))) return false;
    const obj = JSON.parse(new TextDecoder().decode(unb64(parts[0])));
    if (typeof obj.digits !== 'string' || !/^[1-9][1-9][0-9][1-9][1-9]$/.test(obj.digits) || obj.exp < Date.now()) return false;
    return typeof response === 'string' && /^[0-9]{4}$/.test(response) && await safeEqual(response, challengeSolution(obj.digits));
  } catch { return false; }
}
async function login(request, env) {
  if (!env.ADMIN_CODE || !env.SESSION_SECRET) return error('Server-Secrets sind noch nicht vollständig konfiguriert.', 503);
  const key = await getIPKey(request, env);
  const now = Math.floor(Date.now() / 1000);
  const attempt = await env.DB.prepare('SELECT window_start, failures FROM login_attempts WHERE client_key = ?').bind(key).first();
  if (attempt && now - attempt.window_start < 900 && attempt.failures >= 10) return error('Zu viele Anmeldeversuche. Bitte in 15 Minuten erneut versuchen.', 429);
  const body = await request.json().catch(() => ({}));
  const valid = await verifyChallenge(request, env, body.solution);
  const admin = valid && typeof body.adminCode === 'string' && body.adminCode.length > 0 && await safeEqual(body.adminCode, env.ADMIN_CODE);
  const wantsAdmin = body.role === 'admin';
  if (!valid || (wantsAdmin && !admin)) {
    await env.DB.prepare(`INSERT INTO login_attempts(client_key,window_start,failures) VALUES (?, ?, 1)
      ON CONFLICT(client_key) DO UPDATE SET window_start=CASE WHEN ?-window_start >= 900 THEN ? ELSE window_start END,
      failures=CASE WHEN ?-window_start >= 900 THEN 1 ELSE failures+1 END`)
      .bind(key, now, now, now, now, now).run();
    return error('Zugangscodes ungültig.', 401);
  }
  await env.DB.prepare('DELETE FROM login_attempts WHERE client_key = ?').bind(key).run();
  const role = wantsAdmin ? 'admin' : 'examiner';
  const ttl = 8 * 3600;
  const raw = b64(encoder.encode(JSON.stringify({ role, exp: Date.now() + ttl * 1000 })));
  const result = json({ role }, 200, { 'set-cookie': cookie(`${raw}.${await sign(raw, env.SESSION_SECRET)}`, ttl) });
  result.headers.append('set-cookie', challengeCookie('', 0));
  return result;
}
function validNum(n) { return Number.isInteger(n) && n >= 1 && n <= 9999; }
async function loadQuestions(env, nums) {
  if (!nums.length) return [];
  const placeholders = nums.map(() => '?').join(',');
  const q = await env.DB.prepare(`SELECT number, question FROM questions WHERE number IN (${placeholders})`).bind(...nums).all();
  const blocks = await env.DB.prepare(`SELECT question_number,position,content FROM answer_blocks WHERE question_number IN (${placeholders}) ORDER BY question_number,position`).bind(...nums).all();
  const map = new Map(q.results.map(row => [row.number, { ...row, blocks: [] }]));
  for (const block of blocks.results) map.get(block.question_number)?.blocks.push(block.content);
  return nums.map(n => map.get(n) || { number: n, missing: true });
}
async function api(request, env) {
  const url = new URL(request.url), path = url.pathname;
  const method = request.method;
  if (!env.DB) return error('D1-Datenbank ist nicht verbunden.', 503);
  const origin = request.headers.get('origin');
  if (!['GET', 'HEAD'].includes(method) && origin !== url.origin) return error('Ungültiger Anfrageursprung.', 403);
  if (path === '/api/challenge' && method === 'GET') return issueChallenge(env);
  if (path === '/api/login' && method === 'POST') return login(request, env);
  if (path === '/api/logout' && method === 'POST') return json({ ok: true }, 200, { 'set-cookie': cookie('', 0) });
  const session = await auth(request, env);
  if (path === '/api/me' && method === 'GET') return json({ role: session?.role || null });
  if (!session) return error('Bitte anmelden.', 401);
  if (path === '/api/questions/selection' && method === 'POST') {
    const data = await request.json().catch(() => ({}));
    const numbers = data.numbers;
    if (!Array.isArray(numbers) || numbers.length !== 5 || numbers.some(n => !validNum(n)) || new Set(numbers).size !== 5) return error('Genau fünf unterschiedliche gültige Fragennummern eingeben.');
    return json({ questions: await loadQuestions(env, numbers) });
  }
  if (session.role !== 'admin') return error('Nur Administratoren haben Zugriff.', 403);
  if (path === '/api/questions' && method === 'GET') {
    const search = (url.searchParams.get('q') || '').trim().slice(0, 100);
    const rows = search ? await env.DB.prepare('SELECT number,question,updated_at FROM questions WHERE CAST(number AS TEXT) LIKE ? OR question LIKE ? ORDER BY number LIMIT 500').bind(`%${search}%`, `%${search}%`).all() : await env.DB.prepare('SELECT number,question,updated_at FROM questions ORDER BY number LIMIT 1000').all();
    return json({ questions: rows.results });
  }
  if (path === '/api/questions' && method === 'PUT') {
    const data = await request.json().catch(() => ({}));
    const number = Number(data.number);
    if (!validNum(number) || typeof data.question !== 'string' || !data.question.trim() || data.question.length > 10000 || !Array.isArray(data.blocks) || data.blocks.length > 100 || data.blocks.some(b => typeof b !== 'string' || b.length > 20000)) return error('Ungültige Frage oder Antwortbausteine.');
    const blocks = data.blocks.map(b => b.trim()).filter(Boolean);
    const queries = [env.DB.prepare(`INSERT INTO questions(number,question,updated_at) VALUES(?,?,datetime('now'))
      ON CONFLICT(number) DO UPDATE SET question=excluded.question,updated_at=datetime('now')`).bind(number, data.question.trim()),
      env.DB.prepare('DELETE FROM answer_blocks WHERE question_number = ?').bind(number),
      ...blocks.map((content, position) => env.DB.prepare('INSERT INTO answer_blocks(question_number,position,content) VALUES(?,?,?)').bind(number, position, content))];
    await env.DB.batch(queries);
    return json({ ok: true });
  }
  if (path.startsWith('/api/questions/') && method === 'GET') {
    const number = Number(path.split('/').pop());
    if (!validNum(number)) return error('Ungültige Nummer.');
    return json({ question: (await loadQuestions(env, [number]))[0] });
  }
  if (path === '/api/export' && method === 'GET') {
    const rows = await env.DB.prepare('SELECT number FROM questions ORDER BY number').all();
    return json({ questions: await loadQuestions(env, rows.results.map(x => x.number)) }, 200, { 'content-disposition': 'attachment; filename="rs-fragen-export.json"' });
  }
  return error('API-Endpunkt nicht gefunden.', 404);
}
export default {
  async fetch(request, env) {
    try {
      const pathname = new URL(request.url).pathname;
      if (pathname.startsWith('/api/')) return await api(request, env);
      const response = await env.ASSETS.fetch(request);
      const headers = new Headers(response.headers);
      if (pathname === '/' || pathname === '/index.html') {
        headers.set('cache-control', 'no-store');
        // Jede Navigation / Aktualisierung verlangt eine neue Rechenaufgabe.
        headers.append('set-cookie', cookie('', 0));
        headers.append('set-cookie', challengeCookie('', 0));
      }
      headers.set('x-content-type-options', 'nosniff');
      headers.set('referrer-policy', 'no-referrer');
      headers.set('content-security-policy', "default-src 'self'; connect-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
      return new Response(response.body, { status: response.status, headers });
    } catch (e) {
      console.error(e);
      return error('Interner Serverfehler.', 500);
    }
  }
};
