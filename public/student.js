const ui = Object.fromEntries([
  'page-title', 'panel-label', 'room-label', 'question-source', 'question-category-row', 'question-category', 'question-chapter-row', 'question-chapter',
  'question-topic-row', 'question-topic', 'intro', 'join-form', 'room-code', 'nickname',
  'join-button', 'notice', 'notice-icon', 'notice-text', 'retry-button', 'answer-form',
  'choices', 'short-field', 'short-answer', 'essay-field', 'essay-answer', 'answer-button', 'answer-result', 'result-badge',
  'result-details', 'form-error', 'live-update', 'student-name', 'question-timer', 'timer-status', 'countdown'
].map(id => [id, document.getElementById(id)]));

const roomParameter = new URLSearchParams(window.location.search).get('code')?.trim().toUpperCase();
const sessionKey = 'cadastral-classroom-student';
let session = readSession();
let state = null;
let connectionError = false;
let sendingAnswer = false;
let needsFreshState = false;
let pollTimer;
let countdownInterval;
let deadline = null;
let requestingState = false;
let dataRevision = 0;
let shownQuestion = '';
let announcedView = '';

if (/^[A-Z0-9]{6}$/.test(roomParameter ?? '')) {
  ui['room-code'].value = roomParameter;
  if (session?.roomCode !== roomParameter) session = null;
}

function readSession() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(sessionKey));
    return saved?.token && saved.roomCode && saved.nickname ? saved : null;
  } catch {
    return null;
  }
}

function saveSession(currentSession) {
  session = currentSession;
  try {
    if (session) sessionStorage.setItem(sessionKey, JSON.stringify(session));
    else sessionStorage.removeItem(sessionKey);
  } catch {
    // The current visit still works when browser storage is unavailable.
  }
}

async function request(path, body) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  const headers = {};
  if (session) headers['x-participant-token'] = session.token;
  if (body) headers['content-type'] = 'application/json';
  const options = { headers, signal: controller.signal };
  if (body) {
    options.method = 'POST';
    options.body = JSON.stringify(body);
  }
  try {
    const response = await fetch(path, options);
    const data = await response.json();
    if (!response.ok) {
      const error = new Error(data.error ?? '요청을 처리하지 못했습니다.');
      error.status = response.status;
      throw error;
    }
    return data;
  } finally {
    clearTimeout(timeout);
  }
}

function setError(message = '') {
  ui['form-error'].textContent = message;
  ui['form-error'].hidden = !message;
}

function showNotice(message, icon, retry = false) {
  ui.notice.hidden = !message;
  ui.notice.classList.toggle('connection-error', retry);
  ui['notice-text'].textContent = message;
  ui['notice-icon'].textContent = icon;
  ui['retry-button'].hidden = !retry;
}

function answerText(question, value) {
  if (value === null || value === undefined) return '—';
  return question.type === 'multiple' ? question.options[value] ?? '—' : value;
}

function resultRow(label, value) {
  const row = document.createElement('div');
  const term = document.createElement('dt');
  const description = document.createElement('dd');
  term.textContent = label;
  description.textContent = value;
  row.append(term, description);
  return row;
}

function showResult(question, response, closed) {
  const essay = question.type === 'essay';
  let message = '제출 완료';
  let tone = '';
  if (closed && !response) {
    message = '미제출';
    tone = 'neutral';
  } else if (essay && response && typeof response.correct !== 'boolean') {
    message = '채점 대기';
    tone = 'pending';
  } else if (closed) {
    if (response.correct) {
      message = '✓ 정답입니다';
    } else {
      message = '× 오답입니다';
      tone = 'incorrect';
    }
  }

  ui['result-badge'].className = `result-badge ${tone}`;
  ui['result-badge'].textContent = message;
  const ownAnswer = resultRow('내 답안', answerText(question, response?.value));
  ownAnswer.classList.toggle('essay-response', essay);
  ui['result-details'].replaceChildren(ownAnswer);

  if (closed && !essay) {
    const correct = question.type === 'multiple'
      ? answerText(question, question.correctIndex)
      : question.acceptedAnswers?.join(' 또는 ') ?? '—';
    ui['result-details'].append(resultRow('정답', correct));
  }
  return message;
}

function buildOptions(question, closesAt) {
  const options = question.type === 'multiple' ? question.options : [];
  const key = JSON.stringify([question.id, question.type, options, closesAt]);
  if (shownQuestion === key) return;
  shownQuestion = key;
  ui['short-answer'].value = '';
  ui['essay-answer'].value = '';

  const choices = options.map((option, index) => {
    const label = document.createElement('label');
    label.className = 'choice';
    const input = document.createElement('input');
    input.className = 'visually-hidden';
    input.type = 'radio';
    input.name = 'answer';
    input.value = index;
    const number = document.createElement('span');
    number.className = 'choice-number';
    number.setAttribute('aria-hidden', 'true');
    number.textContent = index + 1;
    const text = document.createElement('span');
    text.className = 'choice-text';
    text.textContent = option;
    label.append(input, number, text);
    return label;
  });
  ui.choices.replaceChildren(...choices);
}

function announce(key, message) {
  if (announcedView === key) return;
  announcedView = key;
  ui['live-update'].textContent = message;
}

function observeDeadline(latest, serverNow) {
  const { question, stage, closesAt } = latest;
  if (stage !== 'open' || !question || !Number.isFinite(closesAt) || !Number.isFinite(serverNow)) {
    deadline = null;
    return;
  }

  // Use the server's remaining time at receipt to avoid closing early on slow uploads.
  const candidate = performance.now() + (closesAt - serverNow);
  const sameOpening = deadline?.questionId === question.id && deadline.closesAt === closesAt;
  deadline = { questionId: question.id, closesAt, localTime: sameOpening ? Math.min(deadline.localTime, candidate) : candidate };
}

function millisecondsLeft() {
  return deadline ? Math.max(0, deadline.localTime - performance.now()) : null;
}

function refreshCountdown() {
  const remaining = millisecondsLeft();
  const closed = state?.stage === 'closed' || remaining === 0;
  const timer = ui['question-timer'];
  timer.hidden = !state?.question || (!closed && remaining === null);
  ui['answer-button'].disabled = sendingAnswer || needsFreshState || closed;
  ui.choices.disabled = closed;
  ui['short-answer'].disabled = closed;
  ui['essay-answer'].disabled = closed;

  if (!timer.hidden) {
    const seconds = closed ? 0 : Math.ceil(remaining / 1000);
    const time = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
    const message = closed ? '접수 마감' : '남은 시간';
    if (ui.countdown.textContent !== time) ui.countdown.textContent = time;
    if (ui['timer-status'].textContent !== message) ui['timer-status'].textContent = message;
    timer.classList.toggle('is-urgent', !closed && seconds <= 10);
    timer.classList.toggle('is-closed', closed);
  }

  if (remaining === 0 && state?.stage === 'open') {
    ui.intro.textContent = '접수가 마감되었습니다. 채점 결과를 기다리고 있어요.';
    if (!connectionError) announce(`deadline-${deadline.questionId}-${deadline.closesAt}`, '접수가 마감되었습니다.');
  }

  if (remaining > 0) {
    countdownInterval ??= setInterval(refreshCountdown, 175);
  } else {
    clearInterval(countdownInterval);
    countdownInterval = undefined;
  }
}

function render() {
  const inRoom = Boolean(session);
  const question = state?.question;
  const closed = state?.stage === 'closed';
  const expired = millisecondsLeft() === 0;
  const response = state?.response;
  const takingAnswers = state?.stage === 'open' && !response;

  ui['join-form'].hidden = inRoom;
  ui['room-label'].hidden = !inRoom;
  ui['room-label'].textContent = inRoom ? `코드 ${session.roomCode}` : '';
  ui['student-name'].textContent = inRoom ? `참여 중 · ${session.nickname}` : '수업용 실시간 퀴즈';
  ui['answer-form'].hidden = !question || !takingAnswers;
  ui['answer-result'].hidden = !question || (!closed && !response);
  showNotice('', '');

  const chapter = inRoom ? question?.chapter : '';
  const topic = inRoom && closed ? question?.topic : '';
  const category = inRoom && question?.category !== chapter ? question?.category : '';
  ui['question-source'].hidden = !category && !chapter && !topic;
  for (const [name, label] of Object.entries({ category, chapter, topic })) {
    ui[`question-${name}-row`].hidden = !label;
    ui[`question-${name}`].textContent = label || '';
  }

  if (!inRoom) {
    ui['panel-label'].textContent = '실시간 퀴즈';
    ui['page-title'].textContent = '수업 참여하기';
    ui.intro.textContent = '강사가 알려준 입장 코드와 화면에 표시할 닉네임을 입력하세요.';
    announce('join', '');
    refreshCountdown();
    return;
  }

  if (!question) {
    shownQuestion = '';
    ui['panel-label'].textContent = '실시간 퀴즈';
    ui['page-title'].textContent = state ? '문제를 기다리고 있어요' : '수업에 연결하고 있어요';
    ui.intro.textContent = '강사가 문제를 열면 이 화면에 표시됩니다.';
    if (state) showNotice('수업방에 입장했습니다.', '✓');
    announce('waiting', ui['page-title'].textContent);
  } else {
    const multiple = question.type === 'multiple';
    const essay = question.type === 'essay';
    ui['panel-label'].textContent = multiple ? '객관식 문제' : essay ? '서술형 문제' : '단답형 문제';
    ui['page-title'].textContent = question.title;
    ui.choices.hidden = !multiple;
    ui['short-field'].hidden = multiple || essay;
    ui['essay-field'].hidden = !essay;

    if (takingAnswers) {
      buildOptions(question, state.closesAt);
      ui.intro.textContent = multiple ? '보기 중 정답 하나를 선택해 주세요.' : essay ? '질문에 대한 답안을 작성해 주세요.' : '답안을 짧게 입력해 주세요.';
      if (!expired) {
        const details = [category, chapter, question.title].filter(Boolean).join('. ');
        announce(`open-${question.id}-${state.closesAt}`, `문제가 열렸습니다. ${details}`);
      }
    } else {
      const result = showResult(question, response, closed);
      if (essay && response && typeof response.correct !== 'boolean') {
        ui.intro.textContent = '강사가 채점하면 결과가 표시됩니다.';
      } else {
        ui.intro.textContent = closed ? '답안 제출이 마감되었습니다.' : '강사가 문제를 마감하면 채점 결과가 표시됩니다.';
      }
      if (!expired) announce(`${closed}-${question.id}-${result}`, topic ? `${result}. 목차 ${topic}` : result);
    }
  }

  if (connectionError) {
    showNotice('수업방에 다시 연결하고 있어요.', '!', true);
    announce('connection-error', '수업방과의 연결이 끊어졌습니다.');
  }
  refreshCountdown();
}

function schedulePoll() {
  clearTimeout(pollTimer);
  if (session) pollTimer = setTimeout(syncState, 1500);
}

async function syncState() {
  if (!session || requestingState || sendingAnswer) return;
  clearTimeout(pollTimer);
  requestingState = true;
  const currentSession = session;
  const revision = dataRevision;
  try {
    const { serverNow, ...latest } = await request(`/api/state?code=${encodeURIComponent(currentSession.roomCode)}`);
    if (session !== currentSession || revision !== dataRevision) return;
    const changedView = state?.question?.id !== latest.question?.id || state?.stage !== latest.stage || state?.closesAt !== latest.closesAt;
    const changed = changedView || connectionError || JSON.stringify(state) !== JSON.stringify(latest);
    observeDeadline(latest, serverNow);
    state = latest;
    connectionError = false;
    needsFreshState = false;
    if (changedView) setError();
    if (changed) render();
    else refreshCountdown();
  } catch (error) {
    if (session !== currentSession || revision !== dataRevision) return;
    if (error.status === 401 || error.status === 404) {
      ui['room-code'].value = currentSession.roomCode;
      ui.nickname.value = currentSession.nickname;
      state = null;
      deadline = null;
      needsFreshState = false;
      saveSession(null);
      render();
      setError('참여 정보가 만료되었습니다. 입장 코드를 확인하고 다시 참여해 주세요.');
    } else if (!connectionError) {
      connectionError = true;
      render();
    }
  } finally {
    requestingState = false;
    schedulePoll();
  }
}

ui['join-form'].addEventListener('submit', async event => {
  event.preventDefault();
  setError();
  const code = ui['room-code'].value.trim().toUpperCase();
  const nickname = ui.nickname.value.trim();
  if (!nickname) {
    setError('닉네임을 입력해 주세요.');
    ui.nickname.focus();
    return;
  }

  ui['join-button'].disabled = true;
  try {
    const joined = await request('/api/join', { code, nickname });
    saveSession({ token: joined.token, roomCode: code, nickname: joined.participant.nickname });
    const url = new URL(window.location.href);
    url.searchParams.set('code', code);
    window.history.replaceState(null, '', url);
    connectionError = false;
    render();
    ui['page-title'].focus();
    await syncState();
  } catch (error) {
    setError(error.status ? error.message : '수업방에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.');
  } finally {
    ui['join-button'].disabled = false;
  }
});

ui['answer-form'].addEventListener('submit', async event => {
  event.preventDefault();
  if (!state?.question || state.stage !== 'open' || state.response || sendingAnswer || needsFreshState) return;
  if (millisecondsLeft() === 0) {
    refreshCountdown();
    return;
  }
  setError();
  const { question, closesAt } = state;
  let value;

  if (question.type === 'multiple') {
    const selected = ui.choices.querySelector('input:checked');
    if (!selected) {
      setError('제출할 보기를 선택해 주세요.');
      ui.choices.querySelector('input')?.focus();
      return;
    }
    value = Number(selected.value);
  } else {
    const essay = question.type === 'essay';
    const field = ui[essay ? 'essay-answer' : 'short-answer'];
    const trimmed = field.value.trim();
    if (!trimmed) {
      setError('답안을 입력해 주세요.');
      field.focus();
      return;
    }
    value = essay ? field.value : trimmed;
  }

  sendingAnswer = true;
  dataRevision += 1;
  ui['answer-button'].disabled = true;
  try {
    const submitted = await request('/api/answer', { value, questionId: question.id, closesAt });
    state.response = submitted.response;
    connectionError = false;
    render();
    ui['page-title'].focus();
  } catch (error) {
    needsFreshState = error.status === 409 || error.status === 401;
    setError(error.status ? error.message : '답안을 제출할 수 없습니다. 잠시 후 다시 시도해 주세요.');
  } finally {
    sendingAnswer = false;
    refreshCountdown();
    syncState();
  }
});

ui['join-form'].addEventListener('input', () => setError());
ui['answer-form'].addEventListener('input', () => setError());
ui['retry-button'].addEventListener('click', syncState);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    refreshCountdown();
    syncState();
  }
});

render();
syncState();
