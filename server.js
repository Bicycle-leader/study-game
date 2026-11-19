'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');

const PORT = Number(process.env.PORT ?? 3000);
const PUBLIC_DIR = path.join(__dirname, 'public');
const STATE_FILE = path.resolve(process.env.QUIZ_STATE_FILE || path.join(__dirname, '.quiz-state.json'));
const configuredTeacherKey = process.env.TEACHER_KEY;
const teacherKey = configuredTeacherKey || crypto.randomBytes(5).toString('hex');
const teacherToken = crypto.randomBytes(32).toString('hex');
const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

async function main() {
  const {
    ApiError, createQuizState, readTeacherState, readStudentState, readEssayReview, applyQuizMutation, settleQuizTimer,
  } = await import('./quiz-engine.mjs');
  const quizContext = {
    randomHex: (length) => crypto.randomBytes(length).toString('hex'),
    randomUUID: crypto.randomUUID,
  };

  function loadState() {
    try {
      return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      return createQuizState(quizContext);
    }
  }

  function saveState(nextState) {
    const temporaryFile = `${STATE_FILE}.${process.pid}.tmp`;
    try {
      fs.writeFileSync(temporaryFile, JSON.stringify(nextState), { mode: 0o600 });
      fs.renameSync(temporaryFile, STATE_FILE);
    } finally {
      fs.rmSync(temporaryFile, { force: true });
    }
  }

  function updateState(nextState) {
    if (nextState === state) return;
    saveState(nextState);
    state = nextState;
  }

  function sendJson(response, status, body) {
    response.writeHead(status, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    response.end(JSON.stringify(body));
  }

  async function readJson(request) {
    if (!/^application\/json(?:\s*;|$)/i.test(request.headers['content-type'] || '')) {
      throw new ApiError(415, '요청을 JSON 형식으로 보내 주세요.');
    }
    const limit = 16 * 1024;
    let size = 0;
    const chunks = [];
    for await (const chunk of request.iterator({ destroyOnReturn: false })) {
      size += chunk.length;
      if (size > limit) {
        request.resume();
        throw new ApiError(413, '요청 내용이 너무 깁니다.');
      }
      chunks.push(chunk);
    }
    try {
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      if (body && typeof body === 'object' && !Array.isArray(body)) return body;
    } catch {
      throw new ApiError(400, '요청 형식이 올바르지 않습니다.');
    }
    throw new ApiError(400, '요청 형식이 올바르지 않습니다.');
  }

  function isLoopback(address) {
    return address === '::1' || address === '127.0.0.1' || address === '::ffff:127.0.0.1';
  }

  function isHostRequest(request) {
    const host = request.headers.host || '';
    return isLoopback(request.socket.remoteAddress) && /^(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(host);
  }

  function safeEqual(value, secret) {
    if (typeof value !== 'string') return false;
    const supplied = Buffer.from(value);
    const expected = Buffer.from(secret);
    return supplied.length === expected.length && crypto.timingSafeEqual(supplied, expected);
  }

  function requireTeacher(request) {
    if (!safeEqual(request.headers.authorization, `Bearer ${teacherToken}`)) {
      throw new ApiError(401, '강사 인증이 필요합니다. 다시 로그인해 주세요.');
    }
  }

  function networkAddress() {
    const interfaces = Object.entries(os.networkInterfaces());
    const physical = interfaces.filter(([name]) => !/virtual|vethernet|vmware|loopback|wsl|hyper-v|tailscale/i.test(name));
    for (const [, addresses] of [...physical, ...interfaces]) {
      const matching = addresses.find(({ family, internal, address }) => family === 'IPv4' && !internal && !address.startsWith('169.254.'));
      if (matching) return matching.address;
    }
    return '127.0.0.1';
  }

  function studentJoinUrl(request) {
    const address = request?.socket.localAddress;
    const localPort = request?.socket.localPort || server.address().port;
    const host = address && !isLoopback(address) ? address : networkAddress();
    const origin = process.env.PUBLIC_URL || `http://${host}:${localPort}`;
    const url = new URL('/join', origin);
    url.searchParams.set('code', state.roomCode);
    return url.href;
  }

  async function handleApi(request, response, url) {
    const participantToken = request.headers['x-participant-token'];
    const route = `${request.method} ${url.pathname}`;
    if (route === 'GET /api/teacher/essay') {
      requireTeacher(request);
      updateState(settleQuizTimer(state));
      return sendJson(response, 200, readEssayReview(state, url.searchParams.get('questionId')));
    }
    if (route === 'GET /api/state') {
      const isTeacher = Boolean(request.headers.authorization);
      if (isTeacher) requireTeacher(request);
      const now = Date.now();
      updateState(settleQuizTimer(state, now));
      const payload = isTeacher
        ? readTeacherState(state, studentJoinUrl(request), now)
        : readStudentState(state, url.searchParams.get('code'), participantToken, now);
      return sendJson(response, 200, payload);
    }
    if (route === 'POST /api/teacher/login') {
      const { key } = await readJson(request);
      const canLoginLocally = !configuredTeacherKey && (key === undefined || key === '') && isHostRequest(request);
      if (!canLoginLocally && !safeEqual(key, teacherKey)) throw new ApiError(401, '강사 비밀번호를 확인해 주세요.');
      return sendJson(response, 200, { token: teacherToken });
    }
    let action;
    if (request.method === 'POST' && (url.pathname === '/api/join' || url.pathname === '/api/answer')) {
      action = url.pathname.slice('/api/'.length);
    } else if (request.method === 'POST' && url.pathname.startsWith('/api/teacher/')) {
      requireTeacher(request);
      action = url.pathname.slice('/api/teacher/'.length);
      if (action === 'join' || action === 'answer') throw new ApiError(404, '요청한 기능을 찾을 수 없습니다.');
    } else {
      throw new ApiError(404, '요청한 기능을 찾을 수 없습니다.');
    }

    const body = await readJson(request);
    const now = Date.now();
    updateState(settleQuizTimer(state, now));
    const result = applyQuizMutation(state, action, body, { ...quizContext, participantToken, now });
    updateState(result.state);
    sendJson(response, result.status, result.payload);
  }

  async function serveStatic(request, response, url) {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      throw new ApiError(405, '지원하지 않는 요청입니다.');
    }
    let pathname;
    try {
      pathname = decodeURIComponent(url.pathname);
    } catch {
      throw new ApiError(400, '페이지 주소가 올바르지 않습니다.');
    }
    if (pathname === '/') pathname = '/index.html';
    if (pathname === '/join' || pathname === '/join/') pathname = '/student.html';
    const filename = path.resolve(PUBLIC_DIR, `.${pathname}`);
    if (!filename.startsWith(`${PUBLIC_DIR}${path.sep}`) || !path.extname(filename)) {
      throw new ApiError(404, '페이지를 찾을 수 없습니다.');
    }
    let content;
    try {
      content = await fs.promises.readFile(filename);
    } catch (error) {
      if (error.code === 'ENOENT' || error.code === 'EISDIR' || error.code === 'ENOTDIR') {
        throw new ApiError(404, '페이지를 찾을 수 없습니다.');
      }
      throw error;
    }
    response.writeHead(200, {
      'Content-Type': mimeTypes[path.extname(filename).toLowerCase()] || 'application/octet-stream',
      'Content-Length': content.length,
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff',
    });
    response.end(request.method === 'HEAD' ? undefined : content);
  }

  let state = loadState();

  const server = http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url, 'http://localhost');
      if (url.pathname.startsWith('/api/')) {
        await handleApi(request, response, url);
      } else {
        await serveStatic(request, response, url);
      }
    } catch (error) {
      if (error instanceof ApiError) {
        sendJson(response, error.status, { error: error.message });
      } else {
        console.error(error);
        sendJson(response, 500, { error: '서버에서 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' });
      }
    }
  });

  server.listen(PORT, '0.0.0.0', () => {
    saveState(state);
    console.log(`강사 화면  http://localhost:${server.address().port}/`);
    console.log(`학생 참여  ${studentJoinUrl()}`);
    console.log(`참여 코드  ${state.roomCode}`);
    if (!configuredTeacherKey) console.log(`강사 비밀번호  ${teacherKey}`);
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
