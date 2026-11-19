const $ = (id) => document.getElementById(id);

const kindLabels = { multiple: '객관식', short: '단답형' };
const stageLabels = { waiting: '출제 대기', open: '응답 받는 중', closed: '채점 완료' };
const optionMarkers = ['A', 'B', 'C', 'D'];
const emptySummary = { total: 0, correctCount: 0, incorrectCount: 0, optionCounts: [] };
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
let activeTab = 'overview';

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
    Array.from(container.children).find((child) => child.dataset.questionId === focusedId)?.focus();
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

function selectedQuestion() {
  return state?.questions.find((item) => item.id === selectedId);
}

function syncControls() {
  const question = selectedQuestion();
  const isActive = Boolean(question && state.activeQuestionId === question.id);
  const isOpen = state?.stage === 'open';
  const isWaiting = !state || state.stage === 'waiting';
  const isUsed = question && (
    (isActive && state.summary?.total > 0) ||
    state.history?.some((entry) => entry.questionId === question.id && entry.total > 0)
  );
  const controls = {
    'add-question': { disabled: busy || !state, hidden: presenting },
    'edit-question': { disabled: busy || !question || Boolean(isUsed), hidden: presenting },
    'open-question': { disabled: busy || !question || (isActive && isOpen), hidden: isActive && isOpen },
    'close-question': { disabled: busy || !isOpen, hidden: !isOpen },
    'wait-question': { disabled: busy || isWaiting, hidden: isWaiting || isOpen },
    'copy-code': { disabled: !state },
    'copy-link': { disabled: !state },
    'show-qr': { disabled: !state?.joinUrl },
    'download-history': { disabled: busy || !state?.history?.length, hidden: presenting },
    'reset-class': { disabled: busy || !state, hidden: presenting },
  };
  for (const [id, properties] of Object.entries(controls)) {
    const node = $(id);
    if (node) Object.assign(node, properties);
  }
  const edit = $('edit-question');
  if (edit) edit.title = isUsed ? '응답이 제출된 문항은 수정할 수 없습니다.' : '문항 수정';
}

function renderQuestionList() {
  const { activeQuestionId, questions, stage } = state;
  renderList('question-list', [questions, selectedId, activeQuestionId, stage], () => {
    if (!questions.length) return [empty('등록된 문항이 없습니다', '문항 추가 버튼으로 첫 문제를 만들어 보세요.')];

    return questions.map((question, index) => {
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
      content.append(el('strong', 'question-item-title', question.title));
      button.append(el('span', 'question-item-number', String(index + 1).padStart(2, '0')), content);
      if (isLive) button.append(el('span', 'question-item-live', '진행 중'));
      return button;
    });
  });
}

function renderQuestion() {
  const question = selectedQuestion();
  const questionStage = question && question.id === state.activeQuestionId ? state.stage : 'preview';
  const index = question ? state.questions.indexOf(question) + 1 : null;
  setText('current-question-number', index === null ? '' : `문항 ${String(index).padStart(2, '0')}`);
  setText('question-title', question?.title || '문항을 선택해 주세요');
  setText('question-kind', question ? kindLabels[question.type] : '문항');
  setText('question-state', stageLabels[questionStage] || '미리 보기');
  const badge = $('question-state');
  if (badge) badge.dataset.stage = questionStage;

  const showKey = !presenting || questionStage === 'closed';
  renderList('question-options', [question, showKey], () => {
    if (!question) return [];
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

function accuracy({ correctCount, total }) {
  return total ? `${Math.round(100 * correctCount / total)}%` : '0%';
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
  const { activeQuestionId, summary = emptySummary, stage } = state;
  const activeQuestion = state.questions.find((question) => question.id === activeQuestionId);
  const hideResults = presenting && stage === 'open';
  setText('response-count', `${summary.total}건`);
  setText('response-question-title', activeQuestion && selectedId !== activeQuestionId ? activeQuestion.title : '');
  setText('metric-submissions', summary.total);
  setText('metric-correct', hideResults ? '' : summary.correctCount);
  setText('metric-rate', hideResults ? '' : accuracy(summary));

  renderList('response-list', [activeQuestion?.id, hideResults ? null : summary], () => {
    if (hideResults) return [];
    if (!activeQuestion) return [empty('출제된 문항이 없습니다', '문제를 열면 제출 현황을 볼 수 있습니다.')];
    if (activeQuestion.type === 'multiple') {
      return [countBreakdown(summary.optionCounts, summary.total, 'option')];
    }
    return [countBreakdown([
      { label: '정답', count: summary.correctCount, result: 'correct' },
      { label: '오답', count: summary.incorrectCount, result: 'incorrect' },
    ], summary.total, 'grade')];
  });
}

function renderHistory() {
  const history = state.history || [];
  const visibleHistory = presenting && state.stage === 'open'
    ? history.filter((entry) => entry.questionId !== state.activeQuestionId)
    : history;
  renderList('history-list', visibleHistory, () => {
    if (!visibleHistory.length) return [empty('표시할 응답 기록이 없습니다', '응답을 마감하면 문항의 채점 결과가 기록됩니다.')];

    return visibleHistory.map((record) => {
      const row = el('div', 'history-row');
      const title = el('strong', 'history-title', record.title);
      const detail = `${kindLabels[record.type]} · ${formatDate(record.closedAt)} · 제출 ${record.total}건 · 정답 ${record.correctCount}건 · 오답 ${record.incorrectCount}건 · 정답률 ${accuracy(record)}`;
      row.append(title, el('span', 'history-detail', detail));
      if (record.optionCounts?.length) row.append(countBreakdown(record.optionCounts, record.total, 'option'));
      return row;
    });
  });
}

function renderParticipants() {
  const participants = presenting ? [] : state.participants;
  renderList('participant-list', [presenting, participants], () => {
    if (presenting) return [];
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
  if (!state?.questions.some((item) => item.id === selectedId)) {
    selectedId = state?.activeQuestionId || state?.questions[0]?.id || null;
  }
  if (!state) {
    syncControls();
    return;
  }
  document.body.dataset.stage = state.stage;
  setText('room-code', state.roomCode);
  setText('metric-participants', state.participants.length);
  setText('metric-total-questions', `전체 ${state.questions.length}문항`);
  const joinLink = $('join-link');
  if (joinLink?.tagName === 'A') joinLink.href = `/join?code=${encodeURIComponent(state.roomCode)}`;
  if (joinLink) joinLink.title = state.joinUrl;
  if ($('qr-dialog')?.open) renderJoinQr();
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
  $('qr-dialog')?.close();
  const dialog = $('login-dialog');
  if (dialog && !dialog.open) dialog.showModal();
}

function forgetLogin() {
  teacherToken = '';
  sessionStorage.removeItem('study-game-teacher');
  showLogin(hosted ? '강사 로그인 시간이 만료되었습니다.' : '강사 로그인 키를 입력해 주세요.');
}

async function loadState() {
  const requestedAt = revision;
  try {
    const fresh = await api('/api/state');
    if (requestedAt !== revision) return;
    state = fresh;
    setConnection('online');
    render();
  } catch (error) {
    if (requestedAt !== revision) return;
    if (error.status === 401) forgetLogin();
    else setConnection('offline');
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
      $('question-dialog')?.close();
      forgetLogin();
    } else if (onError) {
      onError(error.message);
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
  const isShort = getQuestionType() === 'short';
  const multiple = $('multiple-fields');
  const short = $('short-fields');
  if (multiple) {
    multiple.hidden = isShort;
    multiple.querySelectorAll('input').forEach((input) => { input.disabled = isShort; });
  }
  if (short) {
    short.hidden = !isShort;
    short.querySelectorAll('input, textarea').forEach((input) => { input.disabled = !isShort; });
  }
}

function openQuestionDialog(question) {
  const form = $('question-form');
  const dialog = $('question-dialog');
  if (!form || !dialog) return;
  form.reset();
  editingId = question?.id || null;
  setQuestionType(question?.type || 'multiple');
  setText('question-dialog-title', question ? '문항 수정' : '새 문항 추가');
  setText('question-error', '');
  $('question-input').value = question?.title || '';
  form.querySelectorAll('[data-option]').forEach((input, index) => {
    input.value = question?.options?.[index] || '';
  });
  form.querySelectorAll('[name="correct-index"]').forEach((input) => {
    input.checked = Number(input.value) === (question?.correctIndex ?? 0);
  });
  $('accepted-answers').value = question?.acceptedAnswers?.join('\n') || '';
  syncQuestionType();
  dialog.showModal();
  $('question-input').focus();
}

function readQuestion(form) {
  const title = $('question-input').value.trim();
  if (!title) throw new Error('문제 내용을 입력해 주세요.');
  const type = getQuestionType();
  const question = { id: editingId || undefined, type, title };
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
  const { joinUrl, roomCode } = state;
  setText('qr-room-code', roomCode);
  $('qr-student-link').href = joinUrl;
  if (renderedQrUrl === joinUrl) return;

  const image = $('qr-image');
  const error = $('qr-error');
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
  if (presenting && name === 'participants') name = 'overview';
  activeTab = name;
  tabs.forEach((tab) => {
    const selected = tab.dataset.tab === name;
    tab.classList.toggle('is-active', selected);
    tab.setAttribute('aria-selected', String(selected));
    if (tab.getAttribute('role') === 'tab') tab.tabIndex = selected ? 0 : -1;
  });
  document.querySelectorAll('[data-panel]').forEach((panel) => {
    panel.hidden = panel.dataset.panel !== name;
  });
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
      $('question-dialog').close();
    },
    onError: (message) => setText('question-error', message),
  });
  if (submit) submit.disabled = false;
});

listen('question-form', 'change', syncQuestionType);
document.querySelectorAll('[data-dismiss]').forEach((button) => {
  button.addEventListener('click', () => button.closest('dialog')?.close());
});

listen('question-list', 'click', (event) => {
  const item = event.target.closest('[data-question-id]');
  if (item && !busy) {
    selectedId = item.dataset.questionId;
    render();
  }
});

listen('add-question', 'click', () => openQuestionDialog());
listen('edit-question', 'click', () => openQuestionDialog(selectedQuestion()));
listen('open-question', 'click', () => {
  if (!selectedId) return;
  mutate('open', { id: selectedId }, { message: '학생들의 답안을 받기 시작합니다.' });
});
listen('close-question', 'click', () => {
  const activeId = state?.activeQuestionId;
  mutate('close', {}, {
    message: '응답을 마감했습니다. 학생 화면에 채점 결과가 표시됩니다.',
    after: () => { selectedId = activeId; },
  });
});
listen('wait-question', 'click', () => mutate('wait', {}, { message: '학생 화면을 대기 상태로 전환했습니다.' }));
listen('download-history', 'click', () => {
  if (presenting || busy || !state?.history?.length) return;
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
      selectedId = null;
      activateTab('overview');
    },
  });
});
listen('copy-code', 'click', () => copy(state?.roomCode, '참여 코드'));
listen('copy-link', 'click', () => copy(state?.joinUrl, '참여 링크'));
listen('show-qr', 'click', () => {
  if (!state?.joinUrl) return;
  renderJoinQr();
  $('qr-dialog').showModal();
});

function setPresentation(active) {
  presenting = active;
  document.body.classList.toggle('is-projecting', active);
  if (active) {
    $('question-dialog')?.close();
    if (activeTab === 'participants') activateTab('overview');
  }
  $('participants-tab').hidden = active;
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
