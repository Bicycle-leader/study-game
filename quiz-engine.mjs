const seedQuestions = [
  {
    id: 'parcel-number',
    type: 'multiple',
    title: '토지의 위치를 특정하기 위해 필지마다 부여하는 번호는 무엇인가요?',
    options: ['지목', '지번', '경계점', '축척'],
    correctIndex: 1,
    acceptedAnswers: [],
  },
  {
    id: 'boundary-line',
    type: 'short',
    title: '지적도에서 토지의 경계를 나타내는 선을 무엇이라고 하나요?',
    options: [],
    correctIndex: null,
    acceptedAnswers: ['경계선', '토지 경계선'],
  },
  {
    id: 'map-scale',
    type: 'multiple',
    title: '축척이 1:1,000인 지적도에서 도면 위의 1cm는 실제 거리로 몇 m인가요?',
    options: ['1 m', '10 m', '100 m', '1,000 m'],
    correctIndex: 1,
    acceptedAnswers: [],
  },
];
const standardAnswerSeconds = 30;
const defaultEssaySeconds = 120;
const maxEssaySeconds = 900;
const essayLimit = 2_000;
const warmupCategory = '기초학습';
const defaultQuestionScope = { kind: 'all' };

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function createRoomCode(randomHex) {
  return randomHex(3).toUpperCase();
}

export function createQuizState({ randomHex }) {
  return {
    roomCode: createRoomCode(randomHex),
    stage: 'waiting',
    activeQuestionId: null,
    closesAt: null,
    questions: structuredClone(seedQuestions),
    participants: [],
    responses: [],
    history: [],
  };
}

function getParticipant(state, token) {
  return token ? state.participants.find((participant) => participant.token === token) : null;
}

function publicParticipant(participant) {
  if (!participant) return null;
  const { id, nickname, joinedAt } = participant;
  return { id, nickname, joinedAt };
}

function requireRoom(state, code) {
  if (typeof code !== 'string' || code.trim().toUpperCase() !== state.roomCode) {
    throw new ApiError(404, '수업을 찾을 수 없습니다. 참여 코드를 확인해 주세요.');
  }
}

function normalizeAnswer(answer) {
  return answer.normalize('NFKC').replace(/\s+/gu, '').toLowerCase();
}

function gradeResponse(question, response) {
  const { value } = response;
  if (question.type === 'essay') return response.correct;
  if (question.type === 'multiple') return value === question.correctIndex;
  return question.acceptedAnswers.some((answer) => normalizeAnswer(answer) === normalizeAnswer(value));
}

function publicResponse(response, question, showResult) {
  if (!response) return null;
  const { participantId, nickname, value, submittedAt } = response;
  const details = { participantId, nickname, value, submittedAt };
  if (showResult) {
    const correct = gradeResponse(question, response);
    if (typeof correct === 'boolean') details.correct = correct;
  }
  return details;
}

function findQuestion(state, id) {
  return state.questions.find((question) => question.id === id) || null;
}

function requiredQuestion(state, id) {
  const question = findQuestion(state, id);
  if (!question) throw new ApiError(404, '문제를 찾을 수 없습니다.');
  return question;
}

function matchesQuestionScope(question, scope) {
  if (scope.kind === 'all') return true;
  if (scope.kind === 'warmup') return question.category === warmupCategory;
  if (question.category === warmupCategory || (question.chapter || question.category) !== scope.chapter) return false;
  return scope.kind === 'chapter' || question.topic === scope.topic;
}

function summarizeResponses(question, responses) {
  const optionCounts = question?.type === 'multiple'
    ? question.options.map((label) => ({ label, count: 0 }))
    : [];
  let correctCount = 0;
  let incorrectCount = 0;
  for (const response of responses) {
    const grade = gradeResponse(question, response);
    if (grade === true) correctCount += 1;
    if (grade === false) incorrectCount += 1;
    const { value } = response;
    if (Number.isInteger(value) && optionCounts[value]) optionCounts[value].count += 1;
  }
  const summary = { total: responses.length, correctCount, incorrectCount, optionCounts };
  if (question?.type === 'essay') summary.pendingCount = summary.total - correctCount - incorrectCount;
  return summary;
}

function summarizeQuestion(state, question) {
  const responses = question ? state.responses.filter((response) => response.questionId === question.id) : [];
  return summarizeResponses(question, responses);
}

function readHistoryEntry(state, entry) {
  if (Array.isArray(entry.optionCounts)) return entry;
  const question = findQuestion(state, entry.questionId)
    || state.archivedQuestions?.find((item) => item.id === entry.questionId);
  if (entry.type !== 'multiple' || question?.type !== 'multiple' || !Number.isInteger(entry.total) || entry.total < 1) {
    return { ...entry, optionCounts: [] };
  }
  // A reopened question retains its earlier responses and appends new ones.
  const responses = state.responses.filter((response) => response.questionId === question.id).slice(0, entry.total);
  const { total, correctCount, incorrectCount, optionCounts } = summarizeResponses(question, responses);
  const counted = optionCounts.reduce((sum, option) => sum + option.count, 0);
  const matchesEntry = total === entry.total && counted === total
    && correctCount === entry.correctCount && incorrectCount === entry.incorrectCount;
  return { ...entry, optionCounts: matchesEntry ? optionCounts : [] };
}

function currentCloseReason(state) {
  const latest = state.history?.[0];
  return state.stage === 'closed' && latest?.questionId === state.activeQuestionId ? latest?.closeReason ?? null : null;
}

export function readTeacherState(state, joinUrl, now = Date.now()) {
  const question = findQuestion(state, state.activeQuestionId);
  const scope = state.scope ?? defaultQuestionScope;
  const scopeQuestionIds = state.questions.filter((saved) => matchesQuestionScope(saved, scope)).map(({ id }) => id);
  // Rooms saved before scope selection used the last opened question as their sequence position.
  const lastQuestionId = Object.hasOwn(state, 'scopeLastQuestionId') ? state.scopeLastQuestionId : state.activeQuestionId;
  const nextQuestionId = scopeQuestionIds[scopeQuestionIds.indexOf(lastQuestionId) + 1] ?? null;
  return {
    roomCode: state.roomCode,
    stage: state.stage,
    activeQuestionId: state.activeQuestionId,
    closesAt: state.stage === 'open' ? state.closesAt ?? null : null,
    closeReason: currentCloseReason(state),
    serverNow: now,
    questions: state.questions,
    scope,
    scopeQuestionIds,
    nextQuestionId,
    participants: state.participants.map(publicParticipant),
    summary: summarizeQuestion(state, question),
    history: (state.history || []).map((entry) => readHistoryEntry(state, entry)),
    joinUrl,
  };
}

export function readStudentState(state, code, participantToken, now = Date.now()) {
  requireRoom(state, code);
  const participant = getParticipant(state, participantToken);
  if (participantToken && !participant) {
    throw new ApiError(401, '참여 정보가 만료되었습니다. 닉네임으로 다시 참여해 주세요.');
  }
  const question = state.stage === 'waiting' ? null : findQuestion(state, state.activeQuestionId);
  const showResult = state.stage === 'closed';
  const ownResponse = participant && question && state.responses.find(
    (response) => response.questionId === question.id && response.participantId === participant.id,
  );
  let visibleQuestion = null;
  if (question) {
    const { id, type, title, options, category, chapter, topic } = question;
    visibleQuestion = { id, type, title, options };
    if (category) visibleQuestion.category = category;
    if (chapter) visibleQuestion.chapter = chapter;
    if (showResult && topic) visibleQuestion.topic = topic;
    if (showResult && participant && type === 'multiple') visibleQuestion.correctIndex = question.correctIndex;
    if (showResult && participant && type === 'short') visibleQuestion.acceptedAnswers = question.acceptedAnswers;
  }
  return {
    roomCode: state.roomCode,
    stage: state.stage,
    closesAt: state.stage === 'open' ? state.closesAt ?? null : null,
    closeReason: currentCloseReason(state),
    serverNow: now,
    question: visibleQuestion,
    participant: publicParticipant(participant),
    response: publicResponse(ownResponse, question, showResult),
  };
}

function cleanText(value, maxLength, message) {
  const result = typeof value === 'string' ? value.trim() : '';
  if (!result || [...result].length > maxLength) throw new ApiError(400, message);
  return result;
}

function validateEssayDuration(seconds = defaultEssaySeconds) {
  if (!Number.isInteger(seconds) || seconds < standardAnswerSeconds || seconds > maxEssaySeconds) {
    throw new ApiError(400, '서술형 제한시간은 30~900초 사이의 정수로 입력해 주세요.');
  }
  return seconds;
}

function questionLabel(value, label, limit) {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || [...value.trim()].length > limit) {
    throw new ApiError(400, `${label} 입력은 ${limit}자까지 가능합니다.`);
  }
  return value.trim() || undefined;
}

function questionSource({ chapter, topic }) {
  return { chapter: questionLabel(chapter, '교재 챕터', 60), topic: questionLabel(topic, '교재 목차', 120) };
}

function validateQuestionScope({ kind, chapter, topic }) {
  if (kind === 'all' || kind === 'warmup') return { kind };
  if (kind !== 'chapter' && kind !== 'topic') throw new ApiError(400, '출제 범위를 선택해 주세요.');
  const chapterName = cleanText(chapter, 60, '출제할 챕터를 선택해 주세요.');
  if (kind === 'chapter') return { kind, chapter: chapterName };
  return { kind, chapter: chapterName, topic: cleanText(topic, 120, '출제할 목차를 선택해 주세요.') };
}

function selectQuestionScope(state, body) {
  const scope = validateQuestionScope(body);
  const current = state.scope ?? defaultQuestionScope;
  if (current.kind === scope.kind && current.chapter === scope.chapter && current.topic === scope.topic) return accepted(state);
  if (state.stage === 'open') throw new ApiError(409, '답안 접수를 마감한 뒤 출제 범위를 바꿔 주세요.');
  if ((scope.kind === 'chapter' || scope.kind === 'topic') && !state.questions.some((question) => matchesQuestionScope(question, scope))) {
    throw new ApiError(400, '선택한 범위에 출제할 문항이 없습니다.');
  }
  return accepted({ ...state, scope, scopeLastQuestionId: null });
}

function validateQuestion(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new ApiError(400, '문제의 형식을 확인해 주세요.');
  const title = cleanText(body.title, 250, '문제를 1~250자로 입력해 주세요.');
  const question = { type: body.type, title, options: [], correctIndex: null, acceptedAnswers: [] };
  const labels = { category: questionLabel(body.category, '문제 분류', 60), ...questionSource(body) };
  for (const [key, value] of Object.entries(labels)) {
    if (value) question[key] = value;
  }
  if (body.type === 'multiple') {
    if (!Array.isArray(body.options) || body.options.length < 2 || body.options.length > 6) {
      throw new ApiError(400, '객관식 보기를 2~6개 입력해 주세요.');
    }
    const options = body.options.map((option) => cleanText(option, 100, '각 보기를 1~100자로 입력해 주세요.'));
    if (new Set(options.map(normalizeAnswer)).size !== options.length) {
      throw new ApiError(400, '서로 다른 보기를 입력해 주세요.');
    }
    if (!Number.isInteger(body.correctIndex) || body.correctIndex < 0 || body.correctIndex >= options.length) {
      throw new ApiError(400, '정답 보기를 하나 선택해 주세요.');
    }
    question.options = options;
    question.correctIndex = body.correctIndex;
  } else if (body.type === 'short') {
    if (!Array.isArray(body.acceptedAnswers) || !body.acceptedAnswers.length || body.acceptedAnswers.length > 10) {
      throw new ApiError(400, '인정할 단답형 정답을 1~10개 입력해 주세요.');
    }
    question.acceptedAnswers = body.acceptedAnswers.map((answer) => cleanText(answer, 160, '각 정답을 1~160자로 입력해 주세요.'));
  } else if (body.type === 'essay') {
    const guide = body.gradingGuide ?? '';
    if (typeof guide !== 'string' || [...guide.trim()].length > essayLimit) {
      throw new ApiError(400, '채점 기준은 2,000자까지 입력할 수 있습니다.');
    }
    question.gradingGuide = guide.trim();
    if (body.durationSeconds !== undefined) question.durationSeconds = validateEssayDuration(body.durationSeconds);
  } else {
    throw new ApiError(400, '객관식, 단답형 또는 서술형을 선택해 주세요.');
  }
  return question;
}

function saveQuestion(state, body, randomUUID) {
  const existing = body.id ? requiredQuestion(state, body.id) : null;
  if (existing && state.responses.some((response) => response.questionId === existing.id)) {
    throw new ApiError(409, '답안을 받은 문제는 수정할 수 없습니다. 새 문제를 만들어 주세요.');
  }
  const { category, chapter, topic, durationSeconds } = existing || {};
  const question = { id: existing?.id || randomUUID(), ...validateQuestion({ category, chapter, topic, durationSeconds, ...body }) };
  const questions = existing
    ? state.questions.map((saved) => saved.id === question.id ? question : saved)
    : [...state.questions, question];
  return { state: { ...state, questions }, status: existing ? 200 : 201, payload: { question } };
}

function updateQuestionSources(state, { sources }) {
  if (!Array.isArray(sources) || sources.length === 0) {
    throw new ApiError(400, '출처를 표시할 문제를 입력해 주세요.');
  }
  const labels = new Map();
  for (const source of sources) {
    if (!source || typeof source.id !== 'string' || labels.has(source.id)) {
      throw new ApiError(400, '각 문제의 출처를 한 번만 입력해 주세요.');
    }
    const question = requiredQuestion(state, source.id);
    if (question.title !== source.title) throw new ApiError(409, '문제 내용이 바뀌었습니다. 문제 목록을 다시 확인해 주세요.');
    labels.set(question.id, questionSource(source));
  }
  const questions = state.questions.map((question) => {
    const source = labels.get(question.id);
    if (!source || (source.chapter === question.chapter && source.topic === question.topic)) return question;
    return { ...question, ...source };
  });
  return accepted(questions.every((question, index) => question === state.questions[index]) ? state : { ...state, questions });
}

function closeQuestion(state, closedAt, reason) {
  if (state.stage === 'closed') return state;
  if (state.stage !== 'open') throw new ApiError(409, '채점할 문제가 열려 있지 않습니다.');
  const question = requiredQuestion(state, state.activeQuestionId);
  const entry = {
    questionId: question.id,
    title: question.title,
    type: question.type,
    closedAt: new Date(closedAt).toISOString(),
    ...summarizeQuestion(state, question),
  };
  if (reason) entry.closeReason = reason;
  return { ...state, stage: 'closed', closesAt: null, history: [entry, ...(state.history || [])] };
}

function allParticipantsSubmitted(state, questionId) {
  if (!state.participants.length || state.responses.length < state.participants.length) return false;
  const awaiting = new Set(state.participants.map(({ id }) => id));
  for (const response of state.responses) {
    if (response.questionId !== questionId) continue;
    awaiting.delete(response.participantId);
    if (!awaiting.size) return true;
  }
  return false;
}

function closeIfEveryoneSubmitted(state, now) {
  return allParticipantsSubmitted(state, state.activeQuestionId) ? closeQuestion(state, now, 'all-submitted') : state;
}

function questionDefinition({ type, title, options, correctIndex, acceptedAnswers, gradingGuide }) {
  return JSON.stringify([type, title, options, correctIndex, acceptedAnswers, gradingGuide || '']);
}

function replaceQuestions(state, body, { now, randomUUID }) {
  if (!Array.isArray(body.questions) || body.questions.length === 0) {
    throw new ApiError(400, '교체할 문제를 한 개 이상 입력해 주세요.');
  }
  const definitions = body.questions.map(validateQuestion);
  const storedByDefinition = new Map();
  for (const question of state.questions) {
    const key = questionDefinition(question);
    const matches = storedByDefinition.get(key) ?? [];
    matches.push(question);
    storedByDefinition.set(key, matches);
  }
  const questions = definitions.map((question) => {
    const matching = storedByDefinition.get(questionDefinition(question))?.shift();
    if (!matching) return { id: randomUUID(), ...question };
    if (question.durationSeconds === undefined && matching.durationSeconds !== undefined) {
      question.durationSeconds = matching.durationSeconds;
    }
    const { category, chapter, topic, durationSeconds } = matching;
    if (category === question.category && chapter === question.chapter && topic === question.topic && durationSeconds === question.durationSeconds) {
      return matching;
    }
    return { id: matching.id, ...question };
  });
  if (questions.length === state.questions.length && questions.every((question, index) => question.id === state.questions[index].id)) {
    const sameQuestions = questions.every((question, index) => question === state.questions[index]);
    return accepted(sameQuestions ? state : { ...state, questions });
  }

  const archived = state.stage === 'open' ? closeQuestion(state, now) : state;
  const activeIds = new Set(questions.map(({ id }) => id));
  return accepted({
    ...archived,
    stage: 'waiting',
    activeQuestionId: null,
    scopeLastQuestionId: null,
    closesAt: null,
    questions,
    archivedQuestions: [...(state.archivedQuestions || []), ...state.questions.filter(({ id }) => !activeIds.has(id))],
  });
}

function completedEssay(state, questionId) {
  const question = findQuestion(state, questionId)
    || state.archivedQuestions?.find((item) => item.id === questionId);
  if (question?.type !== 'essay') throw new ApiError(404, '서술형 문제를 찾을 수 없습니다.');
  const completion = state.history?.find((entry) => entry.questionId === question.id);
  if (!completion || (state.stage === 'open' && state.activeQuestionId === question.id)) {
    throw new ApiError(409, '답안 제출이 마감된 뒤 채점할 수 있습니다.');
  }
  return { question, responses: state.responses.filter((response) => response.questionId === question.id).slice(0, completion.total) };
}

export function readEssayReview(state, questionId) {
  const { question, responses } = completedEssay(state, questionId);
  return {
    question: { id: question.id, title: question.title, gradingGuide: question.gradingGuide || '' },
    entries: responses.map(({ reviewId, value, correct }) => ({ id: reviewId, value, correct: correct ?? null }))
      .sort((left, right) => left.id.localeCompare(right.id)),
  };
}

function gradeEssay(state, body) {
  if (typeof body.correct !== 'boolean' || typeof body.responseId !== 'string' || !body.responseId) {
    throw new ApiError(400, '채점할 답안과 결과를 선택해 주세요.');
  }
  const { question, responses } = completedEssay(state, body.questionId);
  const target = responses.find((response) => response.reviewId === body.responseId);
  if (!target) throw new ApiError(404, '채점할 답안을 찾을 수 없습니다.');
  if (target.correct === body.correct) return accepted(state);

  const graded = { ...target, correct: body.correct };
  const updatedResponses = state.responses.map((response) => response === target ? graded : response);
  const gradedResponses = responses.map((response) => response === target ? graded : response);
  const history = state.history.map((entry) => entry.questionId === question.id
    ? { ...entry, ...summarizeResponses(question, gradedResponses.slice(0, entry.total)) }
    : entry);
  return accepted({ ...state, responses: updatedResponses, history });
}

export function settleQuizTimer(state, now = Date.now()) {
  if (state.stage !== 'open') return state;
  if (Number.isSafeInteger(state.closesAt) && now >= state.closesAt) return closeQuestion(state, state.closesAt);
  if (!Number.isSafeInteger(state.closesAt)) {
    const durationSeconds = findQuestion(state, state.activeQuestionId)?.durationSeconds ?? standardAnswerSeconds;
    return closeIfEveryoneSubmitted({ ...state, closesAt: now + durationSeconds * 1000 }, now);
  }
  return closeIfEveryoneSubmitted(state, now);
}

function resetRoom(state, randomHex) {
  let roomCode;
  do {
    roomCode = createRoomCode(randomHex);
  } while (roomCode === state.roomCode);
  return {
    roomCode,
    questions: state.questions,
    stage: 'waiting',
    activeQuestionId: null,
    closesAt: null,
    participants: [],
    responses: [],
    history: [],
  };
}

function joinRoom(state, body, { randomHex, randomUUID }) {
  requireRoom(state, body.code);
  const nickname = cleanText(body.nickname, 20, '닉네임을 1~20자로 입력해 주세요.');
  if (state.participants.some((participant) => normalizeAnswer(participant.nickname) === normalizeAnswer(nickname))) {
    throw new ApiError(409, '이미 사용 중인 닉네임입니다. 다른 닉네임을 입력해 주세요.');
  }
  const participant = {
    id: randomUUID(),
    nickname,
    joinedAt: new Date().toISOString(),
    token: randomHex(32),
  };
  return {
    state: { ...state, participants: [...state.participants, participant] },
    status: 201,
    payload: { token: participant.token, participant: publicParticipant(participant) },
  };
}

function submitAnswer(state, body, { participantToken, now, randomUUID }) {
  const participant = getParticipant(state, participantToken);
  if (!participant) throw new ApiError(401, '닉네임으로 수업에 먼저 참여해 주세요.');
  if (state.stage === 'closed') throw new ApiError(409, '답안 제출이 마감되었습니다.');
  if (state.stage !== 'open') throw new ApiError(409, '답안을 받는 시간이 아닙니다.');
  const question = requiredQuestion(state, state.activeQuestionId);
  if (body.questionId !== undefined && body.questionId !== question.id) {
    throw new ApiError(409, '문제가 바뀌었습니다. 새 문제를 확인해 주세요.');
  }
  if (body.closesAt !== undefined && body.closesAt !== state.closesAt) {
    throw new ApiError(409, '문제의 제출 시간이 바뀌었습니다. 다시 확인해 주세요.');
  }
  if (state.responses.some((response) => response.questionId === question.id && response.participantId === participant.id)) {
    throw new ApiError(409, '이미 이 문제에 답안을 제출했습니다.');
  }
  let value = body.value;
  if (question.type === 'essay') {
    if (typeof value !== 'string' || !value.trim() || [...value].length > essayLimit) {
      throw new ApiError(400, '서술형 답안을 1~2,000자로 입력해 주세요.');
    }
  } else if (question.type === 'short') {
    value = cleanText(value, 160, '단답형 답안을 1~160자로 입력해 주세요.');
  } else if (!Number.isInteger(value) || value < 0 || value >= question.options.length) {
    throw new ApiError(400, '보기에서 답안을 하나 선택해 주세요.');
  }
  const response = {
    questionId: question.id,
    participantId: participant.id,
    nickname: participant.nickname,
    value,
    submittedAt: new Date(now).toISOString(),
  };
  if (question.type === 'essay') response.reviewId = randomUUID();
  return {
    state: closeIfEveryoneSubmitted({ ...state, responses: [...state.responses, response] }, now),
    status: 201,
    payload: { response: publicResponse(response, question, false) },
  };
}

function requireClosedCollection(state) {
  if (state.stage === 'open' && state.responses.some((answer) => answer.questionId === state.activeQuestionId)) {
    throw new ApiError(409, '답안을 받고 있는 문제를 먼저 마감해 주세요.');
  }
}

function accepted(state) {
  return { state, status: 200, payload: { ok: true } };
}

export function applyQuizMutation(state, action, body, context) {
  const now = context.now ?? Date.now();
  state = settleQuizTimer(state, now);
  switch (action) {
    case 'questions':
      return saveQuestion(state, body, context.randomUUID);
    case 'question-sources':
      return updateQuestionSources(state, body);
    case 'replace-questions':
      return replaceQuestions(state, body, { now, randomUUID: context.randomUUID });
    case 'essay-grade':
      return gradeEssay(state, body);
    case 'scope':
      return selectQuestionScope(state, body);
    case 'open': {
      const question = requiredQuestion(state, body.id);
      if (state.activeQuestionId === body.id && state.stage === 'open') return accepted(state);
      if (!matchesQuestionScope(question, state.scope ?? defaultQuestionScope)) {
        throw new ApiError(409, '선택한 출제 범위에 속하지 않는 문항입니다.');
      }
      const alreadyComplete = allParticipantsSubmitted(state, question.id);
      if (alreadyComplete && state.activeQuestionId === question.id && state.stage === 'closed') return accepted(state);
      if (state.activeQuestionId !== body.id) requireClosedCollection(state);
      const isEssay = question.type === 'essay';
      const durationSeconds = isEssay
        ? validateEssayDuration(body.durationSeconds === undefined ? question.durationSeconds : body.durationSeconds)
        : standardAnswerSeconds;
      const questions = isEssay && durationSeconds !== question.durationSeconds
        ? state.questions.map((saved) => saved.id === question.id ? { ...saved, durationSeconds } : saved)
        : state.questions;
      const opened = {
        ...state,
        questions,
        activeQuestionId: body.id,
        scopeLastQuestionId: body.id,
        stage: 'open',
        closesAt: now + durationSeconds * 1000,
      };
      return accepted(alreadyComplete ? closeQuestion(opened, now, 'all-submitted') : opened);
    }
    case 'close':
      return accepted(closeQuestion(state, now));
    case 'wait':
      requireClosedCollection(state);
      return accepted({ ...state, stage: 'waiting', closesAt: null });
    case 'reset':
      return accepted(resetRoom(state, context.randomHex));
    case 'join':
      return joinRoom(state, body, context);
    case 'answer':
      return submitAnswer(state, body, { ...context, now });
    default:
      throw new ApiError(404, '요청한 기능을 찾을 수 없습니다.');
  }
}
