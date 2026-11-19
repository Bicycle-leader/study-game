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
    stage: 'open',
    activeQuestionId: seedQuestions[0].id,
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

function gradeQuestion(question, value) {
  if (question.type === 'multiple') return value === question.correctIndex;
  return question.acceptedAnswers.some((answer) => normalizeAnswer(answer) === normalizeAnswer(value));
}

function publicResponse(response, question, showResult) {
  if (!response) return null;
  const { participantId, nickname, value, submittedAt } = response;
  const details = { participantId, nickname, value, submittedAt };
  if (showResult) details.correct = gradeQuestion(question, value);
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

function summarizeResponses(question, responses) {
  const optionCounts = question?.type === 'multiple'
    ? question.options.map((label) => ({ label, count: 0 }))
    : [];
  let correctCount = 0;
  for (const { value } of responses) {
    if (gradeQuestion(question, value)) correctCount += 1;
    if (Number.isInteger(value) && optionCounts[value]) optionCounts[value].count += 1;
  }
  return { total: responses.length, correctCount, incorrectCount: responses.length - correctCount, optionCounts };
}

function summarizeQuestion(state, question) {
  const responses = question ? state.responses.filter((response) => response.questionId === question.id) : [];
  return summarizeResponses(question, responses);
}

function readHistoryEntry(state, entry) {
  if (Array.isArray(entry.optionCounts)) return entry;
  const question = findQuestion(state, entry.questionId);
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

export function readTeacherState(state, joinUrl) {
  const question = findQuestion(state, state.activeQuestionId);
  return {
    roomCode: state.roomCode,
    stage: state.stage,
    activeQuestionId: state.activeQuestionId,
    questions: state.questions,
    participants: state.participants.map(publicParticipant),
    summary: summarizeQuestion(state, question),
    history: (state.history || []).map((entry) => readHistoryEntry(state, entry)),
    joinUrl,
  };
}

export function readStudentState(state, code, participantToken) {
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
    const { id, type, title, options } = question;
    visibleQuestion = showResult && participant ? question : { id, type, title, options };
  }
  return {
    roomCode: state.roomCode,
    stage: state.stage,
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

function saveQuestion(state, body, randomUUID) {
  const existing = body.id ? requiredQuestion(state, body.id) : null;
  if (existing && state.responses.some((response) => response.questionId === existing.id)) {
    throw new ApiError(409, '답안을 받은 문제는 수정할 수 없습니다. 새 문제를 만들어 주세요.');
  }
  const title = cleanText(body.title, 250, '문제를 1~250자로 입력해 주세요.');
  const question = { id: existing?.id || randomUUID(), type: body.type, title, options: [], correctIndex: null, acceptedAnswers: [] };
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
  } else {
    throw new ApiError(400, '객관식 또는 단답형을 선택해 주세요.');
  }
  const questions = existing
    ? state.questions.map((saved) => saved.id === question.id ? question : saved)
    : [...state.questions, question];
  return { state: { ...state, questions }, status: existing ? 200 : 201, payload: { question } };
}

function closeQuestion(state) {
  if (state.stage === 'closed') return state;
  if (state.stage !== 'open') throw new ApiError(409, '채점할 문제가 열려 있지 않습니다.');
  const question = requiredQuestion(state, state.activeQuestionId);
  const entry = {
    questionId: question.id,
    title: question.title,
    type: question.type,
    closedAt: new Date().toISOString(),
    ...summarizeQuestion(state, question),
  };
  return { ...state, stage: 'closed', history: [entry, ...(state.history || [])] };
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

function submitAnswer(state, body, participantToken) {
  const participant = getParticipant(state, participantToken);
  if (!participant) throw new ApiError(401, '닉네임으로 수업에 먼저 참여해 주세요.');
  if (state.stage !== 'open') throw new ApiError(409, '답안을 받는 시간이 아닙니다.');
  const question = requiredQuestion(state, state.activeQuestionId);
  if (body.questionId !== undefined && body.questionId !== question.id) {
    throw new ApiError(409, '문제가 바뀌었습니다. 새 문제를 확인해 주세요.');
  }
  if (state.responses.some((response) => response.questionId === question.id && response.participantId === participant.id)) {
    throw new ApiError(409, '이미 이 문제에 답안을 제출했습니다.');
  }
  let value = body.value;
  if (question.type === 'short') {
    value = cleanText(value, 160, '단답형 답안을 1~160자로 입력해 주세요.');
  } else if (!Number.isInteger(value) || value < 0 || value >= question.options.length) {
    throw new ApiError(400, '보기에서 답안을 하나 선택해 주세요.');
  }
  const response = {
    questionId: question.id,
    participantId: participant.id,
    nickname: participant.nickname,
    value,
    submittedAt: new Date().toISOString(),
  };
  return {
    state: { ...state, responses: [...state.responses, response] },
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
  switch (action) {
    case 'questions':
      return saveQuestion(state, body, context.randomUUID);
    case 'open':
      requiredQuestion(state, body.id);
      if (state.activeQuestionId !== body.id) requireClosedCollection(state);
      return accepted({ ...state, activeQuestionId: body.id, stage: 'open' });
    case 'close':
      return accepted(closeQuestion(state));
    case 'wait':
      requireClosedCollection(state);
      return accepted({ ...state, stage: 'waiting' });
    case 'reset':
      return accepted(resetRoom(state, context.randomHex));
    case 'join':
      return joinRoom(state, body, context);
    case 'answer':
      return submitAnswer(state, body, context.participantToken);
    default:
      throw new ApiError(404, '요청한 기능을 찾을 수 없습니다.');
  }
}
