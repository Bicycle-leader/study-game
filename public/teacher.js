const $ = (id) => document.getElementById(id);

const kindLabels = { multiple: '객관식', short: '단답형', essay: '서술형' };
const stageLabels = { waiting: '출제 대기', open: '응답 받는 중', closed: '접수 마감' };
const defaultEssaySeconds = 120;
const warmupCategory = '기초학습';
const optionMarkers = ['A', 'B', 'C', 'D'];
const emptySummary = { total: 0, correctCount: 0, incorrectCount: 0, pendingCount: 0, optionCounts: [] };
const dateFormatter = new Intl.DateTimeFormat('ko-KR', { dateStyle: 'short', timeStyle: 'short' });
const rendered = new Map();
const tabs = Array.from(document.querySelectorAll('[data-tab]'));
const hosted = document.documentElement.hasAttribute('data-hosted');

let teacherToken = sessionStorage.getItem('study-game-teacher') || '';
let state = null;
let selectedId = null;
let editingId = null;
let busy = false;
let revision = 0;
let toastTimeout;
let renderedQrUrl;
let presenting = false;
let joining = true;
let managing = false;
let activeTab = 'overview';
let countdown = null;
let countdownTick = null;
let essaySession = null;
let pendingEssayId = null;

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function api(path, data) {
  const headers = {};
  if (data !== undefined) headers['Content-Type'] = 'application/json';
  if (teacherToken) headers.Authorization = `Bearer ${teacherToken}`;
  let response;
  try {
    response = await fetch(path, {
      method: data === undefined ? 'GET' : 'POST',
      headers,
      body: data === undefined ? undefined : JSON.stringify(data),
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    throw new ApiError('서버에 연결할 수 없습니다. 연결을 확인해 주세요.', 0);
  }
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(result.error || '요청을 처리하지 못했습니다.', response.status);
  return result;
}

function setText(id, value) {
  const node = $(id);
  if (node && node.textContent !== String(value)) node.textContent = value;
}

function el(tag, className, content) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (content !== undefined) node.textContent = content;
  return node;
}

function renderList(id, signature, items) {
  const container = $(id);
  if (!container) return;
  const key = JSON.stringify(signature);
  if (rendered.get(id) === key) return;
  const focusedId = container.contains(document.activeElement) && document.activeElement.dataset.questionId;
  container.replaceChildren(...items());
  if (focusedId) {
    Array.from(container.querySelectorAll('[data-question-id]'))
      .find((child) => child.dataset.questionId === focusedId)?.focus();
  }
  rendered.set(id, key);
}

function empty(title, detail) {
  const node = el('div', 'empty-state');
  node.append(el('strong', 'empty-title', title), el('p', 'empty-detail', detail));
  return node;
}

function formatDate(value) {
  const date = new Date(value);
  return value && !Number.isNaN(date.valueOf()) ? dateFormatter.format(date) : '';
}

function scopedQuestions() {
  const questions = state?.questions || [];
  if (!Array.isArray(state?.scopeQuestionIds)) return questions;
  const ids = new Set(state.scopeQuestionIds);
  return questions.filter(({ id }) => ids.has(id));
}

function selectedQuestion() {
  return scopedQuestions().find((item) => item.id === selectedId);
}

function releasedQuestion() {
  if (state?.stage === 'waiting') return null;
  return state?.questions.find((item) => item.id === state.activeQuestionId);
}

function nextQuestion() {
  if (!state) return null;
  if (Object.hasOwn(state, 'nextQuestionId')) {
    return state.questions.find(({ id }) => id === state.nextQuestionId) || null;
  }
  const index = state.questions.findIndex((item) => item.id === state.activeQuestionId);
  return state.questions[index + 1];
}

function questionToOpen() {
  return managing ? selectedQuestion() : nextQuestion();
}

function hasPendingExport(history = []) {
  const seen = new Set();
  return history.some((entry) => {
    if (seen.has(entry.questionId)) return false;
    seen.add(entry.questionId);
    return entry.type === 'essay' && entry.pendingCount > 0;
  });
}

function hasClosedEssay(questionId) {
  if (state?.stage === 'open' && state.activeQuestionId === questionId) return false;
  return Boolean(state?.history?.some((entry) => entry.questionId === questionId && entry.type === 'essay'));
}

function syncControls() {
  const question = selectedQuestion();
  const isActive = Boolean(question && state.activeQuestionId === question.id);
  const isOpen = state?.stage === 'open';
  const isWaiting = !state || state.stage === 'waiting';
  const isClosedEssay = state?.stage === 'closed' && releasedQuestion()?.type === 'essay';
  const pendingExport = hasPendingExport(state?.history);
  const isUsed = question && (
    (isActive && state.summary?.total > 0) ||
    state.history?.some((entry) => entry.questionId === question.id && entry.total > 0)
  );
  if (pendingEssayId && (isOpen || questionToOpen()?.id !== pendingEssayId)) closeEssayTimeDialog();
  const controls = {
    'toggle-question-management': { disabled: busy || !state, hidden: presenting },
    'bank-panel': { hidden: !managing },
    'add-question': { disabled: busy || !state },
    'edit-question': { disabled: busy || !question || Boolean(isUsed), hidden: !managing },
    'open-question': { disabled: busy || !question || isOpen, hidden: !managing || isOpen },
    'next-question': { disabled: busy || !nextQuestion() || isOpen, hidden: managing || isOpen },
    'question-scope': { disabled: busy || isOpen || !state?.scope },
    'close-question': { disabled: busy || !isOpen, hidden: !isOpen },
    'wait-question': { disabled: busy || isWaiting, hidden: isWaiting || isOpen },
    'grade-essay': { disabled: busy || !isClosedEssay || !state.summary?.total, hidden: presenting || !isClosedEssay },
    'copy-code': { disabled: !state },
    'copy-link': { disabled: !state },
    'show-qr': { disabled: !state?.joinUrl },
    'enter-class': { disabled: !state },
    'essay-time-limit': { disabled: busy },
    'essay-time-cancel': { disabled: busy },
    'essay-time-open': { disabled: busy },
    'copy-join-link': { disabled: !state?.joinUrl },
    'download-history': { disabled: busy || !state?.history?.length || pendingExport, hidden: presenting },
    'history-download-note': { hidden: presenting || !pendingExport },
    'reset-class': { disabled: busy || !state, hidden: presenting },
  };
  for (const [id, properties] of Object.entries(controls)) {
    const node = $(id);
    if (node) Object.assign(node, properties);
  }
  $('overview-panel').classList.toggle('is-managing', managing);
  $('toggle-question-management').setAttribute('aria-expanded', String(managing));
  setText('toggle-question-management', managing ? '문제 목록 닫기' : '문제 목록 보기');
  const edit = $('edit-question');
  if (edit) edit.title = isUsed ? '응답이 제출된 문항은 수정할 수 없습니다.' : '문항 수정';
}

function scopeValue({ kind, chapter, topic }) {
  return JSON.stringify({ kind, chapter, topic });
}

function scopeOption(scope, name, count) {
  const option = el('option', '', `${name} · ${count}문항`);
  option.value = scopeValue(scope);
  return option;
}

function renderScope() {
  const visible = !joining && !presenting && Boolean(state?.scope);
  $('scope-controls').hidden = !visible;
  if (!visible) {
    renderList('question-scope', null, () => []);
    setText('scope-status', '');
    return;
  }

  const select = $('question-scope');
  const { scope, questions } = state;
  const sources = questions.map(({ category, chapter, topic }) => [category, chapter, topic]);
  renderList('question-scope', sources, () => {
    const chapters = new Map();
    let warmupTotal = 0;
    for (const [category, sourceChapter, topic] of sources) {
      if (category === warmupCategory) {
        warmupTotal += 1;
        continue;
      }
      const chapter = sourceChapter || category;
      if (!chapter) continue;
      if (!chapters.has(chapter)) chapters.set(chapter, { count: 0, topics: new Map() });
      const entry = chapters.get(chapter);
      entry.count += 1;
      if (topic) entry.topics.set(topic, (entry.topics.get(topic) || 0) + 1);
    }

    const options = [scopeOption({ kind: 'all' }, '전체 문제', questions.length)];
    if (warmupTotal) options.push(scopeOption({ kind: 'warmup' }, warmupCategory, warmupTotal));
    if (!chapters.size) return options;

    const chapterOptions = el('optgroup');
    chapterOptions.label = '챕터';
    for (const [chapter, { count }] of chapters) {
      chapterOptions.append(scopeOption({ kind: 'chapter', chapter }, chapter, count));
    }
    options.push(chapterOptions);
    for (const [chapter, { topics }] of chapters) {
      if (!topics.size) continue;
      const topicOptions = el('optgroup');
      topicOptions.label = `목차 · ${chapter}`;
      for (const [topic, count] of [...topics].sort(([a], [b]) => a.localeCompare(b, 'ko', { numeric: true }))) {
        topicOptions.append(scopeOption({ kind: 'topic', chapter, topic }, topic, count));
      }
      options.push(topicOptions);
    }
    return options;
  });

  const value = scopeValue(scope);
  if (select.value !== value) select.value = value;
  const count = scopedQuestions().length;
  let status = `선택한 범위의 ${count}문항을 순서대로 출제합니다.`;
  if (!count) status = '선택한 범위에 출제할 문항이 없습니다.';
  else if (state.stage === 'open') status = '접수 마감 후 출제 범위를 바꿀 수 있습니다.';
  else if (!nextQuestion()) status = '선택한 범위의 마지막 문항까지 출제했습니다.';
  setText('scope-status', status);
}

function renderQuestionList() {
  const { activeQuestionId, stage } = state;
  const questions = scopedQuestions();
  const signature = managing ? [questions, selectedId, activeQuestionId, stage] : null;
  renderList('question-list', signature, () => {
    if (!managing) return [];
    if (!questions.length) return [empty('표시할 문항이 없습니다', '출제 범위를 바꾸거나 새 문제를 만들어 보세요.')];

    const categorized = questions.some((question) => question.category);
    const groups = new Map();
    const items = [];
    for (const question of questions) {
      const button = el('button', 'question-item');
      button.type = 'button';
      button.dataset.questionId = question.id;
      const isSelected = question.id === selectedId;
      const isLive = question.id === activeQuestionId && stage === 'open';
      button.classList.toggle('is-selected', isSelected);
      button.classList.toggle('is-live', isLive);
      button.setAttribute('aria-pressed', String(isSelected));
      const content = el('span', 'question-item-copy');
      content.append(el('span', 'question-item-kind', kindLabels[question.type]));
      const chapter = question.chapter !== question.category ? question.chapter : '';
      const source = [chapter, question.topic].filter(Boolean).join(' · ');
      if (source) content.append(el('span', 'question-item-source', source));
      content.append(el('strong', 'question-item-title', question.title));
      const number = state.questions.indexOf(question) + 1;
      button.append(el('span', 'question-item-number', String(number).padStart(2, '0')), content);
      if (isLive) button.append(el('span', 'question-item-live', '진행 중'));
      if (!categorized) {
        items.push(button);
        continue;
      }

      const heading = question.category || '추가 문항';
      if (!groups.has(heading)) {
        const group = el('section', 'question-group');
        group.append(el('h3', '', heading));
        groups.set(heading, group);
        items.push(group);
      }
      groups.get(heading).append(button);
    }
    return items;
  });
}

function renderQuestion() {
  const question = managing ? selectedQuestion() : releasedQuestion();
  const stage = question ? state.stage : 'waiting';
  const questionStage = question && question.id !== state.activeQuestionId ? 'preview' : stage;
  const index = question ? state.questions.indexOf(question) + 1 : null;
  setText('current-question-number', index === null ? '' : `문항 ${String(index).padStart(2, '0')}`);
  setText('question-title', question?.title || (managing ? '문항을 선택해 주세요' : '아직 열린 문제가 없습니다'));
  setText('question-kind', question ? kindLabels[question.type] : '');
  const allSubmitted = questionStage === 'closed' && state.closeReason === 'all-submitted';
  setText('question-state', allSubmitted ? '접수 마감 · 전원 제출' : stageLabels[questionStage] || '미리 보기');
  const chapter = question?.chapter || question?.category;
  const group = question?.category !== chapter ? question?.category : '';
  const topic = !presenting || questionStage === 'closed' ? question?.topic : '';
  setText('question-source-group', group || '');
  setText('question-source-chapter', chapter ? `챕터 ${chapter}` : '');
  setText('question-source-topic', topic ? `목차 ${topic}` : '');
  $('question-source').hidden = !chapter && !topic;
  const badge = $('question-state');
  if (badge) badge.dataset.stage = questionStage;

  const showKey = !presenting || questionStage === 'closed';
  renderList('question-options', [question, showKey], () => {
    if (!question || question.type === 'essay') return [];
    const isShort = question.type === 'short';
    if (isShort && !showKey) return [];
    const answers = isShort ? question.acceptedAnswers : question.options;
    return answers.map((answer, index) => {
      const isCorrect = showKey && (isShort || index === question.correctIndex);
      const row = el('div', 'question-option');
      row.classList.toggle('is-correct', isCorrect);
      const marker = el('span', 'option-marker', isShort ? '✓' : (optionMarkers[index] || index + 1));
      if (isShort) marker.setAttribute('aria-hidden', 'true');
      row.append(marker, el('span', 'option-text', answer));
      if (isCorrect) row.append(el('span', 'option-key', '정답'));
      return row;
    });
  });
}

function accuracy({ correctCount, incorrectCount, total }, isEssay = false) {
  const denominator = isEssay ? correctCount + incorrectCount : total;
  return denominator ? `${Math.round(100 * correctCount / denominator)}%` : isEssay ? '—' : '0%';
}

function countBreakdown(items, total, kind) {
  const list = el('ul', `${kind}-count-list count-breakdown`);
  for (const { label, count, result } of items) {
    const row = el('li', `${kind}-count-row`);
    if (result) row.dataset.result = result;
    const meter = el('meter', 'count-meter');
    meter.max = Math.max(1, total);
    meter.value = count;
    meter.setAttribute('aria-hidden', 'true');
    row.append(
      el('span', `${kind}-count-label`, label),
      el('strong', `${kind}-count-value`, `${count}건`),
      meter,
    );
    list.append(row);
  }
  return list;
}

function renderResponseSummary() {
  const stage = state?.stage;
  const question = releasedQuestion();
  const summary = question ? (state.summary || emptySummary) : emptySummary;
  const hideResults = presenting && stage === 'open';
  const isEssay = question?.type === 'essay';
  setText('response-count', `${summary.total}건`);
  setText('response-question-title', managing && question && selectedId !== question.id ? question.title : '');
  setText('metric-submissions', `${summary.total}명`);
  setText('metric-correct', hideResults ? '' : summary.correctCount);
  setText('metric-rate-label', isEssay ? '채점한 답안의 정답률' : '정답률');
  setText('metric-rate', hideResults ? '' : accuracy(summary, isEssay));

  renderList('response-list', [question?.id, question?.type, hideResults ? null : summary], () => {
    if (hideResults) return [];
    if (!question) return [empty('응답 집계 대기', '문제를 열면 제출 현황을 볼 수 있습니다.')];
    if (question.type === 'multiple') {
      return [countBreakdown(summary.optionCounts, summary.total, 'option')];
    }
    const grades = [
      { label: '정답', count: summary.correctCount, result: 'correct' },
      { label: '오답', count: summary.incorrectCount, result: 'incorrect' },
    ];
    if (isEssay) grades.push({ label: '미채점', count: summary.pendingCount ?? 0, result: 'pending' });
    return [countBreakdown(grades, summary.total, 'grade')];
  });
}

function renderHistory() {
  if (joining || presenting) {
    renderList('history-list', null, () => []);
    return;
  }
  const history = state.history || [];
  const openQuestionId = state.stage === 'open' ? state.activeQuestionId : null;
  renderList('history-list', [history, openQuestionId], () => {
    if (!history.length) return [empty('표시할 응답 기록이 없습니다', '응답을 마감하면 문항의 채점 결과가 기록됩니다.')];

    const gradedQuestions = new Set();
    return history.map((record) => {
      const row = el('div', 'history-row');
      const title = el('strong', 'history-title', record.title);
      const isEssay = record.type === 'essay';
      const pending = isEssay ? ` · 미채점 ${record.pendingCount ?? 0}건` : '';
      const rate = isEssay && record.pendingCount > 0 ? '채점한 답안의 정답률' : '정답률';
      const detail = `${kindLabels[record.type]} · ${formatDate(record.closedAt)} · 제출 ${record.total}건 · 정답 ${record.correctCount}건 · 오답 ${record.incorrectCount}건${pending} · ${rate} ${accuracy(record, isEssay)}`;
      row.append(title, el('span', 'history-detail', detail));
      if (isEssay && record.questionId !== openQuestionId && !gradedQuestions.has(record.questionId)) {
        gradedQuestions.add(record.questionId);
        const button = el('button', 'button button-secondary essay-grade-button', '서술형 채점');
        button.type = 'button';
        button.disabled = record.total === 0;
        button.dataset.essayId = record.questionId;
        button.setAttribute('aria-haspopup', 'dialog');
        button.setAttribute('aria-label', `${record.title} 서술형 채점`);
        row.append(button);
      }
      if (record.optionCounts?.length) row.append(countBreakdown(record.optionCounts, record.total, 'option'));
      return row;
    });
  });
}

function renderParticipants() {
  const privateView = !joining && !presenting;
  const participants = privateView ? state.participants : [];
  renderList('participant-list', [privateView, participants], () => {
    if (!privateView) return [];
    if (!participants.length) {
      return [empty('아직 참여한 학생이 없습니다', '참여 링크 또는 강의실 코드를 학생에게 공유해 주세요.')];
    }
    return participants.map((participant) => {
      const row = el('div', 'participant-row');
      row.append(el('strong', 'participant-name', participant.nickname));
      row.append(el('span', 'participant-detail', `${formatDate(participant.joinedAt)} 입장`));
      return row;
    });
  });
}

function render() {
  const scoped = scopedQuestions();
  if (!scoped.some((item) => item.id === selectedId)) {
    const active = scoped.find((item) => item.id === state.activeQuestionId);
    selectedId = active?.id || nextQuestion()?.id || scoped[0]?.id || null;
  }
  if (joining) renderJoinQr();
  renderScope();
  if (!state) {
    for (const id of ['question-list', 'history-list', 'participant-list']) renderList(id, null, () => []);
    renderQuestion();
    renderResponseSummary();
    syncControls();
    return;
  }
  if (essaySession && !hasClosedEssay(essaySession.questionId)) closeEssayDialog();
  document.body.dataset.stage = state.stage;
  setText('room-code', state.roomCode);
  setText('metric-participants', `${state.participants.length}명`);
  setText('metric-total-questions', `${state.scope && state.scope.kind !== 'all' ? '범위' : '전체'} ${scoped.length}문항`);
  const joinLink = $('join-link');
  if (joinLink?.tagName === 'A') joinLink.href = `/join?code=${encodeURIComponent(state.roomCode)}`;
  if (joinLink) joinLink.title = state.joinUrl;
  renderQuestionList();
  renderQuestion();
  renderResponseSummary();
  renderHistory();
  renderParticipants();
  syncControls();
}

function setConnection(status) {
  const label = { connecting: '연결 중', online: '실시간 연결', offline: '연결 끊김', login: '로그인 필요' }[status];
  const indicator = $('connection-status');
  if (indicator) indicator.dataset.status = status;
  setText($('connection-label') ? 'connection-label' : 'connection-status', label);
}

function showToast(message, isError = false) {
  const toast = $('toast');
  if (!toast) return;
  toast.hidden = false;
  toast.dataset.status = isError ? 'error' : 'success';
  toast.textContent = message;
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => { toast.hidden = true; }, 4200);
}

function showLogin(message = '') {
  setConnection('login');
  setText('login-error', message);
  closeEssayDialog();
  closeQuestionDialog();
  closeEssayTimeDialog();
  const dialog = $('login-dialog');
  if (dialog && !dialog.open) dialog.showModal();
}

function forgetLogin() {
  teacherToken = '';
  sessionStorage.removeItem('study-game-teacher');
  state = null;
  setJoinScreen(true, false);
  syncCountdown({}, performance.now());
  showLogin(hosted ? '강사 로그인 시간이 만료되었습니다.' : '강사 로그인 키를 입력해 주세요.');
}

function updateCountdown() {
  const seconds = Math.max(0, Math.ceil((countdown.deadline - performance.now()) / 1000));
  countdown.seconds = Math.min(countdown.seconds, seconds);
  const minutesText = String(Math.floor(countdown.seconds / 60)).padStart(2, '0');
  const secondsText = String(countdown.seconds % 60).padStart(2, '0');
  setText('countdown-value', `${minutesText}:${secondsText}`);
  $('countdown').dataset.urgent = String(countdown.seconds <= 5);
  if (countdown.seconds === 0) {
    clearInterval(countdownTick);
    countdownTick = null;
  }
}

function syncCountdown({ stage, activeQuestionId, closesAt, serverNow }, receivedAt) {
  const isOpen = stage === 'open' && Number.isFinite(closesAt) && Number.isFinite(serverNow);
  $('countdown').hidden = !isOpen;
  if (!isOpen) {
    clearInterval(countdownTick);
    countdownTick = null;
    countdown = null;
    setText('countdown-value', '00:00');
    return;
  }
  const sameDeadline = countdown?.closesAt === closesAt && countdown.questionId === activeQuestionId;
  countdown = {
    closesAt,
    questionId: activeQuestionId,
    deadline: receivedAt + (closesAt - serverNow),
    seconds: sameDeadline ? countdown.seconds : Infinity,
  };
  updateCountdown();
  if (countdown.seconds > 0 && countdownTick === null) {
    countdownTick = setInterval(updateCountdown, 100);
  }
}

async function loadState() {
  const requestedAt = revision;
  try {
    const fresh = await api('/api/state');
    if (requestedAt !== revision) return;
    state = fresh;
    syncCountdown(fresh, performance.now());
    setConnection('online');
    render();
  } catch (error) {
    if (requestedAt !== revision) return;
    if (error.status === 401) forgetLogin();
    else {
      if (error.status === 403) {
        closeEssayDialog();
        closeQuestionDialog();
        closeEssayTimeDialog();
      }
      setConnection('offline');
    }
  }
}

async function poll() {
  if (teacherToken && !busy) await loadState();
  setTimeout(poll, 1300);
}

async function logIn(key) {
  const { token } = await api('/api/teacher/login', { key });
  teacherToken = token;
  sessionStorage.setItem('study-game-teacher', token);
  $('login-dialog')?.close();
  await loadState();
}

async function mutate(path, payload, { message, after, onError } = {}) {
  if (busy) return;
  busy = true;
  revision += 1;
  syncControls();
  try {
    const result = await api(`/api/teacher/${path}`, payload);
    after?.(result);
    await loadState();
    if (message) showToast(message);
  } catch (error) {
    if (error.status === 401) {
      forgetLogin();
    } else if (onError) {
      onError(error.message, error.status);
    } else {
      showToast(error.message, true);
    }
  } finally {
    busy = false;
    syncControls();
  }
}

function getTypeControl() {
  return $('question-type');
}

function getQuestionType() {
  const control = getTypeControl();
  if (control?.tagName === 'SELECT') return control.value;
  return document.querySelector('[name="question-type"]:checked')?.value || 'multiple';
}

function setQuestionType(type) {
  const control = getTypeControl();
  if (control?.tagName === 'SELECT') {
    control.value = type;
  } else {
    document.querySelectorAll('[name="question-type"]').forEach((input) => {
      input.checked = input.value === type;
    });
  }
}

function syncQuestionType() {
  const type = getQuestionType();
  for (const kind of Object.keys(kindLabels)) {
    const fields = $(`${kind}-fields`);
    fields.hidden = type !== kind;
    fields.querySelectorAll('input, textarea').forEach((input) => { input.disabled = fields.hidden; });
  }
}

function closeQuestionDialog() {
  $('question-dialog').close();
  $('grading-guide').value = '';
}

function openQuestionDialog(question) {
  if (joining || presenting) return;
  const form = $('question-form');
  const dialog = $('question-dialog');
  if (!form || !dialog) return;
  form.reset();
  editingId = question?.id || null;
  setQuestionType(question?.type || 'multiple');
  setText('question-dialog-title', question ? '문항 수정' : '새 문항 추가');
  setText('question-error', '');
  $('question-input').value = question?.title || '';
  $('question-chapter').value = question?.chapter || '';
  $('question-topic').value = question?.topic || '';
  form.querySelectorAll('[data-option]').forEach((input, index) => {
    input.value = question?.options?.[index] || '';
  });
  form.querySelectorAll('[name="correct-index"]').forEach((input) => {
    input.checked = Number(input.value) === (question?.correctIndex ?? 0);
  });
  $('accepted-answers').value = question?.acceptedAnswers?.join('\n') || '';
  $('grading-guide').value = question?.gradingGuide || '';
  syncQuestionType();
  dialog.showModal();
  $('question-input').focus();
}

function readQuestion(form) {
  const title = $('question-input').value.trim();
  if (!title) throw new Error('문제 내용을 입력해 주세요.');
  const type = getQuestionType();
  const chapter = $('question-chapter').value.trim();
  const topic = $('question-topic').value.trim();
  const category = editingId ? undefined : chapter || undefined;
  const question = { id: editingId || undefined, type, title, category, chapter, topic };
  if (type === 'essay') {
    question.gradingGuide = $('grading-guide').value.trim();
    return question;
  }
  if (type === 'short') {
    const answers = $('accepted-answers').value.split('\n').map((answer) => answer.trim()).filter(Boolean);
    if (!answers.length) throw new Error('정답으로 인정할 답안을 한 개 이상 입력해 주세요.');
    question.acceptedAnswers = answers;
    return question;
  }

  const options = Array.from(form.querySelectorAll('[data-option]'), (input) => input.value.trim());
  const correctInput = form.querySelector('[name="correct-index"]:checked');
  const selectedOption = correctInput ? Number(correctInput.value) : -1;
  if (options.filter(Boolean).length < 2) throw new Error('보기를 두 개 이상 입력해 주세요.');
  if (!options[selectedOption]) throw new Error('내용이 입력된 보기를 정답으로 선택해 주세요.');
  question.options = options.filter(Boolean);
  question.correctIndex = options.slice(0, selectedOption).filter(Boolean).length;
  return question;
}

function closeEssayDialog() {
  const session = essaySession;
  essaySession = null;
  const dialog = $('essay-dialog');
  if (dialog.open) dialog.close();
  for (const id of ['essay-question-title', 'essay-rubric-text', 'essay-status', 'essay-error']) setText(id, '');
  $('essay-question-title').hidden = true;
  $('essay-rubric').hidden = true;
  $('essay-rubric').open = false;
  $('essay-entries').replaceChildren();
  if (session && !session.trigger.isConnected && !presenting && activeTab === 'history') {
    const trigger = Array.from($('history-list').querySelectorAll('[data-essay-id]'))
      .find((button) => button.dataset.essayId === session.questionId);
    trigger?.focus();
  }
}

function updateEssayStatus(entries) {
  const pending = entries.filter((entry) => entry.correct === null).length;
  setText('essay-status', entries.length ? `답안 ${entries.length}건 · 미채점 ${pending}건` : '제출된 답안이 없습니다.');
}

function updateEssayEntry(row, correct) {
  const status = row.querySelector('.essay-entry-result');
  status.dataset.grade = String(correct);
  status.textContent = correct === null ? '미채점' : correct ? '정답' : '오답';
  row.querySelectorAll('[data-grade].essay-action').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.grade === String(correct)));
  });
}

function createEssayEntry(entry, index) {
  const heading = `답안 ${index + 1}`;
  const row = el('li', 'essay-entry');
  row.dataset.responseId = entry.id;
  const top = el('div', 'essay-entry-heading');
  top.append(el('strong', '', heading), el('span', 'essay-entry-result'));
  const actions = el('div', 'essay-entry-actions');
  for (const [correct, label] of [[true, '정답'], [false, '오답']]) {
    const button = el('button', 'button button-secondary essay-action', label);
    button.type = 'button';
    button.dataset.grade = String(correct);
    button.setAttribute('aria-label', `${heading} ${label} 처리`);
    actions.append(button);
  }
  row.append(top, el('p', 'essay-entry-text', entry.value), actions);
  updateEssayEntry(row, entry.correct);
  return row;
}

async function openEssayDialog(questionId, trigger) {
  if (!teacherToken || joining || presenting || busy || !hasClosedEssay(questionId)) return;
  const dialog = $('essay-dialog');
  if (dialog.open) return;
  const session = { questionId, trigger, entries: [] };
  essaySession = session;
  setText('essay-status', '답안을 불러오는 중입니다.');
  dialog.showModal();
  try {
    const { question, entries } = await api(`/api/teacher/essay?questionId=${encodeURIComponent(questionId)}`);
    if (essaySession !== session || presenting) return;
    if (question?.id !== questionId || !Array.isArray(entries)) throw new Error('답안을 불러올 수 없습니다.');
    session.entries = entries;
    setText('essay-question-title', question.title);
    $('essay-question-title').hidden = false;
    setText('essay-rubric-text', question.gradingGuide || '');
    $('essay-rubric').hidden = !question.gradingGuide;
    $('essay-entries').replaceChildren(...entries.map(createEssayEntry));
    updateEssayStatus(entries);
  } catch (error) {
    if (essaySession !== session) return;
    if (error.status === 401) {
      forgetLogin();
      return;
    }
    if (error.status === 403) {
      closeEssayDialog();
      showToast(error.message, true);
      return;
    }
    setText('essay-status', '');
    setText('essay-error', error.message);
  }
}

async function gradeEssayEntry(event) {
  const button = event.target.closest('.essay-action');
  const session = essaySession;
  if (!button || !session || busy || presenting || !hasClosedEssay(session.questionId)) return;
  const row = button.closest('.essay-entry');
  const entry = session.entries.find((item) => item.id === row.dataset.responseId);
  const correct = button.dataset.grade === 'true';
  if (!entry || entry.correct === correct) return;
  setText('essay-error', '');
  const controls = Array.from($('essay-entries').querySelectorAll('.essay-action'));
  controls.forEach((control) => control.setAttribute('aria-disabled', 'true'));
  try {
    await mutate('essay-grade', { questionId: session.questionId, responseId: entry.id, correct }, {
      after: () => {
        if (essaySession !== session) return;
        entry.correct = correct;
        updateEssayEntry(row, correct);
        updateEssayStatus(session.entries);
      },
      onError: (message, status) => {
        if (essaySession !== session) return;
        if (status === 403) {
          closeEssayDialog();
          showToast(message, true);
        } else {
          setText('essay-error', message);
        }
      },
    });
  } finally {
    controls.forEach((control) => control.removeAttribute('aria-disabled'));
  }
}

async function copy(value, label) {
  if (!value) return;
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(value);
    } else {
      const field = el('textarea');
      const active = document.activeElement;
      field.value = value;
      field.readOnly = true;
      field.style.position = 'fixed';
      field.style.opacity = '0';
      document.body.append(field);
      field.select();
      const copied = document.execCommand('copy');
      field.remove();
      active?.focus();
      if (!copied) throw new Error('copy failed');
    }
    showToast(`${label} 복사 완료`);
  } catch {
    window.prompt(`${label}을 복사해 주세요.`, value);
  }
}

function renderJoinQr() {
  const { joinUrl, roomCode, participants, summary } = state || {};
  const submittedStudents = releasedQuestion() ? summary?.total ?? 0 : 0;
  $('join-details').hidden = !roomCode;
  $('qr-loading').hidden = Boolean(joinUrl);
  setText('qr-room-code', roomCode || '');
  setText('qr-participants', `${participants?.length || 0}명`);
  setText('qr-submissions', `${submittedStudents}명`);

  const link = $('qr-student-link');
  link.hidden = !joinUrl;
  const image = $('qr-image');
  const error = $('qr-error');
  if (!joinUrl) {
    link.removeAttribute('href');
    image.removeAttribute('src');
    image.hidden = true;
    error.hidden = true;
    renderedQrUrl = undefined;
    return;
  }
  link.href = joinUrl;
  if (renderedQrUrl === joinUrl) return;

  try {
    const qr = window.qrcode(0, 'M');
    qr.addData(joinUrl);
    qr.make();
    // Keep the four-module white border so phone cameras can find the symbol.
    image.src = qr.createDataURL(10, 40);
    image.hidden = false;
    error.hidden = true;
    renderedQrUrl = joinUrl;
  } catch {
    image.removeAttribute('src');
    image.hidden = true;
    error.hidden = false;
    renderedQrUrl = undefined;
  }
}

function activateTab(name) {
  if (presenting || joining) name = 'overview';
  activeTab = name;
  $('teacher-tabs').hidden = presenting || joining;
  tabs.forEach((tab) => {
    const selected = tab.dataset.tab === name;
    tab.classList.toggle('is-active', selected);
    tab.setAttribute('aria-selected', String(selected));
    if (tab.getAttribute('role') === 'tab') tab.tabIndex = selected ? 0 : -1;
  });
  document.querySelectorAll('[data-panel]').forEach((panel) => {
    panel.hidden = joining || panel.dataset.panel !== name;
  });
}

function setJoinScreen(active, focus = true) {
  joining = active;
  document.body.classList.toggle('is-joining', active);
  $('join-screen').hidden = !active;
  $('class-hero').hidden = active;
  $('class-metrics').hidden = active;
  if (active) {
    managing = false;
    closeEssayDialog();
    closeQuestionDialog();
    closeEssayTimeDialog();
  }
  activateTab('overview');
  render();
  if (focus) $(active ? 'join-heading' : 'question-heading').focus();
}

function listen(id, event, handler) {
  $(id)?.addEventListener(event, handler);
}

listen('login-dialog', 'cancel', (event) => event.preventDefault());
listen('login-form', 'submit', async (event) => {
  event.preventDefault();
  const button = event.currentTarget.querySelector('[type="submit"]');
  if (button) button.disabled = true;
  setText('login-error', '');
  try {
    await logIn($('login-key').value);
    $('login-key').value = '';
  } catch (error) {
    showLogin(error.message);
  } finally {
    if (button) button.disabled = false;
  }
});

listen('question-form', 'submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  setText('question-error', '');
  let question;
  try {
    question = readQuestion(form);
  } catch (error) {
    setText('question-error', error.message);
    return;
  }

  const submit = form.querySelector('[type="submit"]');
  if (submit) submit.disabled = true;
  await mutate('questions', question, {
    message: editingId ? '문항을 수정했습니다.' : '문항을 추가했습니다.',
    after: ({ question }) => {
      selectedId = question.id;
      closeQuestionDialog();
    },
    onError: (message) => setText('question-error', message),
  });
  if (submit) submit.disabled = false;
});

listen('question-form', 'change', syncQuestionType);
listen('question-dialog', 'close', () => {
  if (!$('question-dialog').open) $('grading-guide').value = '';
});
document.querySelectorAll('[data-dismiss]').forEach((button) => {
  button.addEventListener('click', () => button.closest('dialog')?.close());
});

listen('question-list', 'click', (event) => {
  const item = event.target.closest('[data-question-id]');
  if (item && managing && !busy) {
    selectedId = item.dataset.questionId;
    render();
  }
});

listen('question-scope', 'change', (event) => {
  const value = event.currentTarget.value;
  if (!value || joining || presenting || busy || !state?.scope || state.stage === 'open') return;
  mutate('scope', JSON.parse(value), {
    after: () => {
      selectedId = null;
      closeEssayTimeDialog();
    },
    onError: (message) => {
      renderScope();
      showToast(message, true);
    },
  });
});

listen('toggle-question-management', 'click', () => {
  if (joining || presenting || busy || !state) return;
  managing = !managing;
  render();
});
listen('add-question', 'click', () => openQuestionDialog());
listen('edit-question', 'click', () => openQuestionDialog(selectedQuestion()));
function closeEssayTimeDialog() {
  pendingEssayId = null;
  const dialog = $('essay-time-dialog');
  if (dialog.open) dialog.close();
  setText('essay-time-error', '');
}

function releaseQuestion(question, durationSeconds) {
  mutate('open', { id: question.id, durationSeconds }, {
    message: '학생들의 답안을 받기 시작합니다.',
    after: () => {
      managing = false;
      selectedId = question.id;
      closeEssayTimeDialog();
    },
    onError: (message) => {
      if (pendingEssayId === question.id) setText('essay-time-error', message);
      else showToast(message, true);
    },
  });
}

function prepareQuestion(question) {
  if (joining || !question || busy || state.stage === 'open') return;
  if (question.type !== 'essay') {
    releaseQuestion(question);
    return;
  }
  pendingEssayId = question.id;
  setText('essay-time-error', '');
  const input = $('essay-time-limit');
  input.value = question.durationSeconds ?? defaultEssaySeconds;
  $('essay-time-dialog').showModal();
  input.select();
}

listen('open-question', 'click', () => { if (managing) prepareQuestion(selectedQuestion()); });
listen('next-question', 'click', () => { if (!managing) prepareQuestion(nextQuestion()); });
listen('essay-time-form', 'submit', (event) => {
  event.preventDefault();
  const question = questionToOpen();
  if (busy || !pendingEssayId || question?.id !== pendingEssayId || state.stage === 'open') return;
  setText('essay-time-error', '');
  releaseQuestion(question, $('essay-time-limit').valueAsNumber);
});
listen('essay-time-cancel', 'click', closeEssayTimeDialog);
listen('essay-time-dialog', 'cancel', (event) => {
  if (busy) event.preventDefault();
});
listen('essay-time-dialog', 'close', () => {
  if (!$('essay-time-dialog').open) closeEssayTimeDialog();
});
listen('close-question', 'click', () => {
  const activeId = state?.activeQuestionId;
  const isEssay = releasedQuestion()?.type === 'essay';
  mutate('close', {}, {
    message: isEssay ? '서술형 답안 접수를 마감했습니다.' : '응답을 마감했습니다. 학생 화면에 채점 결과가 표시됩니다.',
    after: () => { selectedId = activeId; },
  });
});
listen('wait-question', 'click', () => mutate('wait', {}, { message: '학생 화면을 대기 상태로 전환했습니다.' }));
listen('grade-essay', 'click', (event) => openEssayDialog(state?.activeQuestionId, event.currentTarget));
listen('history-list', 'click', (event) => {
  const button = event.target.closest('[data-essay-id]');
  if (button && !button.disabled) openEssayDialog(button.dataset.essayId, button);
});
listen('close-essay', 'click', closeEssayDialog);
listen('essay-entries', 'click', gradeEssayEntry);
listen('essay-dialog', 'cancel', (event) => {
  event.preventDefault();
  closeEssayDialog();
});
listen('essay-dialog', 'close', () => {
  if (essaySession && !$('essay-dialog').open) closeEssayDialog();
});
listen('download-history', 'click', () => {
  if (presenting || busy || !state?.history?.length || hasPendingExport(state.history)) return;
  try {
    const workbook = window.createHistoryWorkbook(state.history);
    const url = URL.createObjectURL(workbook);
    const link = el('a');
    link.href = url;
    link.download = '지적클래스-응답집계.xlsx';
    link.hidden = true;
    document.body.append(link);
    try {
      link.click();
    } finally {
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    }
  } catch {
    showToast('엑셀 파일을 만들 수 없습니다. 다시 시도해 주세요.', true);
  }
});
listen('reset-class', 'click', () => {
  if (!window.confirm('새 수업을 시작할까요? 문제 목록은 보존되며 참여 학생, 제출 답안 및 응답 기록이 삭제됩니다.')) return;
  mutate('reset', {}, {
    message: '새 수업이 시작되었습니다. 새로운 참여 링크를 공유하세요.',
    after: () => {
      state = null;
      selectedId = null;
      setJoinScreen(true);
    },
  });
});
listen('copy-code', 'click', () => copy(state?.roomCode, '참여 코드'));
listen('copy-link', 'click', () => copy(state?.joinUrl, '참여 링크'));
listen('copy-join-link', 'click', () => copy(state?.joinUrl, '참여 링크'));
listen('show-qr', 'click', () => { if (state?.joinUrl) setJoinScreen(true); });
listen('enter-class', 'click', () => { if (state) setJoinScreen(false); });

function setPresentation(active) {
  presenting = active;
  document.body.classList.toggle('is-projecting', active);
  if (active) {
    managing = false;
    closeQuestionDialog();
    closeEssayDialog();
    closeEssayTimeDialog();
  }
  activateTab(active ? 'overview' : activeTab);
  const button = $('fullscreen');
  const label = active ? '발표 종료' : '발표 화면';
  button.setAttribute('aria-pressed', String(active));
  button.setAttribute('aria-label', label);
  setText('fullscreen-label', label);
  render();
}

listen('fullscreen', 'click', async () => {
  const active = !document.body.classList.contains('is-projecting');
  setPresentation(active);
  try {
    if (active) await document.documentElement.requestFullscreen?.();
    else if (document.fullscreenElement) await document.exitFullscreen();
  } catch {
    if (!active && document.fullscreenElement) setPresentation(true);
  }
});
document.addEventListener('fullscreenchange', () => setPresentation(Boolean(document.fullscreenElement)));

tabs.forEach((tab) => {
  tab.addEventListener('click', () => activateTab(tab.dataset.tab));
  tab.addEventListener('keydown', (event) => {
    const visibleTabs = tabs.filter((item) => !item.hidden);
    const index = visibleTabs.indexOf(tab);
    const count = visibleTabs.length;
    const destinations = { ArrowLeft: (index - 1 + count) % count, ArrowRight: (index + 1) % count, Home: 0, End: count - 1 };
    if (!Object.hasOwn(destinations, event.key)) return;
    event.preventDefault();
    const destination = visibleTabs[destinations[event.key]];
    activateTab(destination.dataset.tab);
    destination.focus();
  });
});

async function start() {
  if (hosted) {
    $('hosted-login').hidden = false;
    setText('login-key-help', '강사 접속 키를 받은 경우 입력하세요.');
  } else if (window.location.protocol === 'https:') {
    setText('login-key-help', '온라인 수업에 설정한 강사 접속 키를 입력하세요.');
  }
  activateTab('overview');
  setConnection('connecting');
  syncControls();
  if (teacherToken) await loadState();
  if (!teacherToken) {
    try {
      await logIn('');
    } catch (error) {
      showLogin(error.status === 401 ? '' : error.message);
    }
  }
  await poll();
}

start();
