import assets from './assets.mjs';
import { ApiError, applyQuizMutation, createQuizState, readEssayReview, readLectureState, readStudentState, readTeacherState, settleQuizTimer } from './quiz-engine.mjs';

const encoder = new TextEncoder();
const sessionLifetime = 12 * 60 * 60;
const jsonLimit = 16 * 1024;
const lectureImageLimit = 2_000_000;
const lectureImageFormats = {
  png: { contentType: 'image/png', signature: [137, 80, 78, 71, 13, 10, 26, 10] },
  // RIFF stores the container byte length between its identifier and the WebP identifier.
  webp: { contentType: 'image/webp', signature: [82, 73, 70, 70, null, null, null, null, 87, 69, 66, 80] },
};
const allowedTeacherActions = new Set(['questions', 'question-sources', 'extend-choices', 'scope', 'lecture', 'open', 'close', 'wait', 'reset', 'essay-grade', 'replace-questions']);

function randomHex(bytes) {
  return Array.from(crypto.getRandomValues(new Uint8Array(bytes)), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function sessionKey(secret) {
  if (!secret) throw new ApiError(503, '강사 로그인 설정을 확인해 주세요.');
  return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

async function issueTeacherToken(secret) {
  const payload = `${Math.floor(Date.now() / 1000) + sessionLifetime}.${randomHex(16)}`;
  const signature = await crypto.subtle.sign('HMAC', await sessionKey(secret), encoder.encode(payload));
  return `${payload}.${btoa(String.fromCharCode(...new Uint8Array(signature)))}`;
}

async function requireTeacher(request, env) {
  const token = request.headers.get('Authorization') || '';
  const match = token.match(/^Bearer (\d{10})\.([0-9a-f]{32})\.([A-Za-z0-9+/]{43}=)$/);
  if (match && Number(match[1]) > Math.floor(Date.now() / 1000)) {
    const signature = Uint8Array.from(atob(match[3]), (character) => character.charCodeAt(0));
    if (await crypto.subtle.verify('HMAC', await sessionKey(env.TEACHER_SESSION_SECRET), signature, encoder.encode(`${match[1]}.${match[2]}`))) return;
  }
  throw new ApiError(401, '강사 로그인이 필요합니다.');
}

async function matchesKey(key, secret) {
  if (typeof key !== 'string' || !key || !secret) return false;
  const passwordKey = await sessionKey(secret);
  const challenge = encoder.encode('jijeok-class-teacher-login');
  const signature = await crypto.subtle.sign('HMAC', passwordKey, challenge);
  return crypto.subtle.verify('HMAC', await sessionKey(key), signature, challenge);
}

async function login(request, env) {
  const { key } = await readJson(request);
  const email = request.headers.get('oai-authenticated-user-email');
  const userId = request.headers.get('oai-authenticated-user-id');
  const isOwner = userId && email && email.toLowerCase() === env.TEACHER_EMAIL?.toLowerCase();
  if (!isOwner && !(await matchesKey(key, env.TEACHER_KEY))) {
    throw new ApiError(401, '사이트를 만든 ChatGPT 계정으로 로그인하거나 강사 접속 키를 확인해 주세요.');
  }
  return json({ token: await issueTeacherToken(env.TEACHER_SESSION_SECRET) });
}

async function readJson(request) {
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('Content-Type') || '')) {
    throw new ApiError(415, '요청을 JSON 형식으로 보내 주세요.');
  }
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError(400, '요청 형식이 올바르지 않습니다.');
  let size = 0;
  let contents = '';
  const decoder = new TextDecoder();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > jsonLimit) {
        await reader.cancel();
        throw new ApiError(413, '요청 내용이 너무 깁니다.');
      }
      contents += decoder.decode(value, { stream: true });
    }
    contents += decoder.decode();
  } finally {
    reader.releaseLock();
  }
  try {
    const body = JSON.parse(contents);
    if (body && typeof body === 'object' && !Array.isArray(body)) return body;
  } catch {
    throw new ApiError(400, '요청 형식이 올바르지 않습니다.');
  }
  throw new ApiError(400, '요청 형식이 올바르지 않습니다.');
}

const responseHeaders = { 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin', 'X-Robots-Tag': 'noindex' };

function json(body, status = 200) {
  return Response.json(body, { status, headers: { ...responseHeaders, 'Cache-Control': 'no-store' } });
}

async function readLectureImage(request, { contentType, signature }) {
  if (request.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase() !== contentType) {
    throw new ApiError(415, '강의 이미지의 확장자와 파일 형식이 일치해야 합니다.');
  }
  if (Number(request.headers.get('Content-Length')) > lectureImageLimit) {
    throw new ApiError(413, '강의 이미지가 2 MB를 초과합니다.');
  }
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError(400, '강의 이미지가 비어 있습니다.');
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > lectureImageLimit) {
        await reader.cancel();
        throw new ApiError(413, '강의 이미지가 2 MB를 초과합니다.');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  if (size <= signature.length || !signature.every((value, index) => value === null || value === bytes[index])) {
    throw new ApiError(400, '강의 이미지 형식이 올바르지 않습니다.');
  }
  return bytes;
}

async function storeLectureImage(request, bucket, key, hashPrefix, format) {
  const bytes = await readLectureImage(request, format);
  const checksum = await crypto.subtle.digest('SHA-256', bytes);
  const sha256 = Array.from(new Uint8Array(checksum), (byte) => byte.toString(16).padStart(2, '0')).join('');
  if (!sha256.startsWith(hashPrefix)) throw new ApiError(400, '강의 이미지 식별자가 일치하지 않습니다.');

  const stored = await bucket.put(key, bytes, {
    onlyIf: new Headers({ 'If-None-Match': '*' }),
    httpMetadata: { contentType: format.contentType },
    customMetadata: { sha256 },
    sha256: checksum,
  });
  if (stored) return json({ ok: true }, 201);
  const existing = await bucket.head(key);
  if (existing?.customMetadata?.sha256 === sha256) return json({ ok: true });
  throw new ApiError(409, '이 주소에는 이미 다른 강의 이미지가 저장되어 있습니다.');
}

async function serveLectureImage(request, env, pathname) {
  const match = /^\/assets\/lecture\/([0-9]{2}-([a-f0-9]{12})\.(png|webp))$/.exec(pathname);
  if (!match) throw new ApiError(404, '강의 이미지를 찾을 수 없습니다.');
  if (request.method === 'PUT') await requireTeacher(request, env);
  else if (request.method !== 'GET' && request.method !== 'HEAD') {
    throw new ApiError(405, '지원하지 않는 요청입니다.');
  }
  const { BUCKET: bucket } = env;
  if (!bucket) throw new ApiError(503, '강의 이미지 저장소를 사용할 수 없습니다.');

  const [, filename, hashPrefix, extension] = match;
  const format = lectureImageFormats[extension];
  const key = `lecture/${filename}`;
  if (request.method === 'PUT') return storeLectureImage(request, bucket, key, hashPrefix, format);
  const object = request.method === 'HEAD' ? await bucket.head(key) : await bucket.get(key);
  if (!object) throw new ApiError(404, '강의 이미지를 찾을 수 없습니다.');
  return new Response(object.body ?? null, {
    headers: {
      ...responseHeaders,
      'Content-Type': format.contentType,
      'Content-Length': String(object.size),
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}

async function loadQuiz(db) {
  const read = db.prepare('SELECT version, state_json FROM quiz_state WHERE id = 1');
  let row = await read.first();
  if (!row) {
    const initial = createQuizState({ randomHex });
    await db.prepare('INSERT OR IGNORE INTO quiz_state (id, state_json) VALUES (1, ?)').bind(JSON.stringify(initial)).run();
    row = await read.first();
  }
  return { version: row.version, state: JSON.parse(row.state_json) };
}

async function updateQuiz(db, version, state) {
  const write = await db.prepare('UPDATE quiz_state SET state_json = ?, version = version + 1 WHERE id = 1 AND version = ?')
    .bind(JSON.stringify(state), version).run();
  return write.meta.changes === 1;
}

async function runQuizOperation(db, operation) {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const { version, state } = await loadQuiz(db);
    const now = Date.now();
    const settled = settleQuizTimer(state, now);
    if (settled !== state) {
      // Commit the timer change first, including when the requested action will be rejected.
      if (await updateQuiz(db, version, settled)) continue;
    } else {
      const response = await operation({ state, version, now });
      if (response) return response;
    }
    // Reapply the mutation after a concurrent submission or teacher action changes the room.
    await new Promise((resolve) => setTimeout(resolve, 10 + Math.random() * Math.min(40 + attempt * 20, 180)));
  }
  throw new ApiError(503, '요청이 몰리고 있습니다. 잠시 후 다시 시도해 주세요.');
}

function mutateQuiz(db, action, body, participantToken) {
  return runQuizOperation(db, async ({ state, version, now }) => {
    const result = applyQuizMutation(state, action, body, {
      participantToken, randomHex, randomUUID: () => crypto.randomUUID(), now,
    });
    if (result.state === state || await updateQuiz(db, version, result.state)) return json(result.payload, result.status);
    return null;
  });
}

async function handleApi(request, env, url) {
  const participantToken = request.headers.get('X-Participant-Token');
  if (request.method === 'GET' && url.pathname === '/api/lecture') {
    const { state } = await loadQuiz(env.DB);
    return json(readLectureState(state, url.searchParams.get('code')));
  }
  if (request.method === 'GET' && url.pathname === '/api/teacher/essay') {
    await requireTeacher(request, env);
    return runQuizOperation(env.DB, ({ state }) => json(readEssayReview(state, url.searchParams.get('questionId'))));
  }
  if (request.method === 'GET' && url.pathname === '/api/state') {
    const isTeacher = request.headers.has('Authorization');
    if (isTeacher) await requireTeacher(request, env);
    return runQuizOperation(env.DB, ({ state, now }) => {
      if (!isTeacher) return json(readStudentState(state, url.searchParams.get('code'), participantToken, now));
      const joinUrl = new URL('/join', url);
      joinUrl.searchParams.set('code', state.roomCode);
      return json(readTeacherState(state, joinUrl.href, now));
    });
  }
  if (request.method === 'POST') {
    if (url.pathname === '/api/teacher/login') return login(request, env);
    if (url.pathname === '/api/join' || url.pathname === '/api/answer') {
      return mutateQuiz(env.DB, url.pathname.slice('/api/'.length), await readJson(request), participantToken);
    }
    const action = url.pathname.startsWith('/api/teacher/') && url.pathname.slice('/api/teacher/'.length);
    if (allowedTeacherActions.has(action)) {
      await requireTeacher(request, env);
      return mutateQuiz(env.DB, action, await readJson(request));
    }
  }
  throw new ApiError(404, '요청한 기능을 찾을 수 없습니다.');
}

function serveAsset(request, pathname) {
  if (request.method !== 'GET' && request.method !== 'HEAD') throw new ApiError(405, '지원하지 않는 요청입니다.');
  if (pathname === '/') pathname = '/index.html';
  if (pathname === '/join' || pathname === '/join/') pathname = '/student.html';
  if (pathname === '/lecture' || pathname === '/lecture/') pathname = '/lecture.html';
  if (!Object.hasOwn(assets, pathname)) throw new ApiError(404, '페이지를 찾을 수 없습니다.');
  const asset = assets[pathname];
  const headers = { ...responseHeaders, 'Content-Type': asset.contentType, 'Cache-Control': 'no-cache' };
  const body = request.method === 'HEAD' ? null : Uint8Array.from(atob(asset.base64), (character) => character.charCodeAt(0));
  return new Response(body, { headers });
}

export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);
      if (url.pathname.startsWith('/api/')) return await handleApi(request, env, url);
      if (url.pathname.startsWith('/assets/lecture/')) return await serveLectureImage(request, env, url.pathname);
      return serveAsset(request, url.pathname);
    } catch (error) {
      if (error instanceof ApiError) return json({ error: error.message }, error.status);
      console.error(error);
      return json({ error: '서버에서 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' }, 500);
    }
  },
};
