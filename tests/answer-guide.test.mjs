import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import basics from '../guides/class-basics.mjs';
import applied from '../guides/class-applied.mjs';
import * as engine from '../quiz-engine.mjs';

const { applyQuizMutation, createQuizState, readStudentState, readTeacherAnswerGuides } = engine;

function classroom() {
  const context = { randomHex: (bytes) => randomBytes(bytes).toString('hex'), randomUUID };
  let state = createQuizState(context);
  let now = 1_000;
  function act(action, body = {}, participantToken) {
    const result = applyQuizMutation(state, action, body, { ...context, now: ++now, participantToken });
    state = result.state;
    return result.payload;
  }
  return {
    get state() { return state; },
    act,
    join: (nickname) => act('join', { code: state.roomCode, nickname }).token,
    guides: (closedOnly = false) => readTeacherAnswerGuides(state, closedOnly).entries,
    poll: (token) => readStudentState(state, state.roomCode, token, now),
  };
}

function assertNoGuide(payload) {
  assert.doesNotMatch(JSON.stringify(payload), /"(?:guide|concept|explanation|reasoning|pitfall|outline|model|reviewCount|canReviewCurrent|gradingGuide)":/);
}

function assertGuideLayout(guide) {
  assert.ok(guide.concept?.trim());
  assert.equal(guide.outline.length, 3);
  assert.equal(new Set(guide.outline.map(([heading]) => heading)).size, 3);
  for (const [heading, lines] of guide.outline) {
    assert.ok(heading.trim());
    assert.equal(lines.length, 2);
    assert.notEqual(lines[0][0], lines[1][0]);
    for (const [label, content] of lines) {
      assert.ok(label.trim());
      assert.ok(content.trim());
      assert.doesNotMatch(content, /[\r\n]/);
    }
  }
}

test('the teacher can prepare all fifty lessons and present them after close; students see only grading', () => {
  const room = classroom();
  const student = room.join('연습생');
  const exam = room.state.questions.filter(({ examNumber }) => Number.isInteger(examNumber));
  const preparation = room.guides();
  assert.equal(exam.length, 50);
  assert.deepEqual(room.guides(true), []);
  assertGuideLayout(preparation.find(({ type }) => type === 'short').guide);
  assert.equal(Object.hasOwn(engine, 'readStudentAnswerGuides'), false);
  assertNoGuide(room.poll(student));

  for (const question of exam) {
    room.act('open', { id: question.id });
    const open = room.poll(student);
    assertNoGuide(open);
    assert.equal(open.question.correctIndex, undefined);
    room.act('answer', { questionId: question.id, value: question.correctIndex }, student);
    const closed = room.poll(student);
    assert.equal(closed.stage, 'closed');
    assertNoGuide(closed);
    assert.equal(closed.response.correct, true);
    assert.equal(closed.question.correctIndex, question.correctIndex);
  }

  const entries = room.guides(true);
  assert.equal(entries.length, 50);
  assert.equal(new Set(entries.map(({ guide }) => guide.concept)).size, 50);
  for (const question of exam) {
    const entry = entries.find(({ id }) => id === question.id);
    assert.equal(entry.title, question.title);
    assert.equal(entry.options[entry.correctIndex], question.options[question.correctIndex]);
    assert.equal(entry.examNumber, question.examNumber);
    assertGuideLayout(entry.guide);
    assert.deepEqual(entry.guide, preparation.find(({ id }) => id === question.id).guide);
  }
});

test('the teacher’s presentation excludes a reopened question and reset clears closed history', () => {
  const room = classroom();
  const first = room.join('첫째');
  const second = room.join('둘째');
  const [q1, q2] = room.state.questions;
  const presentedIds = () => room.guides(true).map(({ id }) => id);
  room.act('open', { id: q1.id });
  room.act('answer', { value: q1.correctIndex }, first);
  assert.equal(room.state.stage, 'open');
  assert.deepEqual(presentedIds(), []);
  assertNoGuide(room.poll(first));
  room.act('close');
  assert.deepEqual(presentedIds(), [q1.id]);
  assertNoGuide(room.poll(second));
  room.act('open', { id: q2.id });
  assert.deepEqual(presentedIds(), [q1.id]);
  room.act('close');
  room.act('open', { id: q1.id });
  assert.deepEqual(presentedIds(), [q2.id]);
  room.act('answer', { value: (q1.correctIndex + 1) % q1.options.length }, second);
  assert.deepEqual(presentedIds(), [q1.id, q2.id]);
  assert.equal(room.poll(second).response.correct, false);
  room.act('wait');
  assert.deepEqual(presentedIds(), [q1.id, q2.id]);
  assertNoGuide(room.poll(first));
  room.act('reset', { keepRoomCode: true });
  assert.deepEqual(presentedIds(), []);
  assert.ok(room.guides().some(({ id }) => id === q1.id));
});

test('archived questions retain their guides in the teacher’s closed history', () => {
  const room = classroom();
  const student = room.join('응시자');
  const original = room.state.questions[0];
  room.act('open', { id: original.id });
  room.act('answer', { value: original.correctIndex }, student);
  const before = room.guides(true);
  room.act('replace-questions', { questions: [{ type: 'short', title: '새 수업 문항', acceptedAnswers: ['새 답'] }] });
  assert.deepEqual(room.guides(true), before);
  assert.ok(!room.guides().some(({ id }) => id === original.id));
  assertNoGuide(room.poll(student));
});

test('grading an essay does not disclose the guide, private rubric, or other students’ answers', () => {
  const room = classroom();
  const first = room.join('학생 가');
  const second = room.join('학생 나');
  const gradingGuide = '교사용 비공개 채점 문구';
  const myAnswer = '첫째 학생이 제출한 개인 서술';
  const theirAnswer = '둘째 학생이 제출한 개인 서술';
  room.act('scope', { kind: 'all' });
  const { question } = room.act('questions', { type: 'essay', title: basics.find(({ type }) => type === 'essay').title, gradingGuide });
  room.act('open', { id: question.id });
  room.act('answer', { value: myAnswer }, first);
  room.act('answer', { value: theirAnswer }, second);
  assertNoGuide(room.poll(first));
  const response = room.state.responses.find(({ value }) => value === myAnswer);
  room.act('essay-grade', { questionId: question.id, responseId: response.reviewId, correct: true });
  const payload = room.poll(first);
  assert.equal(payload.response.value, myAnswer);
  assert.equal(payload.response.correct, true);
  assertNoGuide(payload);
  assert.ok(!JSON.stringify(payload).includes(theirAnswer));
  const [presented] = room.guides(true);
  assertGuideLayout(presented.guide);
  assert.ok(!JSON.stringify(presented).includes(myAnswer));
  assert.ok(!JSON.stringify(presented).includes(gradingGuide));
});

test('editing a built-in question’s answer uses the general guide instead of the outdated concept', () => {
  const room = classroom();
  const question = room.state.questions[0];
  const original = readTeacherAnswerGuides(room.state).entries.find(({ id }) => id === question.id);
  const changedIndex = (question.correctIndex + 1) % question.options.length;
  room.act('questions', { ...question, title: '강사가 보기와 정답의 뜻을 다시 정한 문제', correctIndex: changedIndex });
  const student = room.join('새 답안');
  room.act('open', { id: question.id });
  room.act('answer', { value: changedIndex }, student);
  const [entry] = room.guides(true);
  assert.equal(entry.correctIndex, changedIndex);
  assertGuideLayout(entry.guide);
  assert.notEqual(entry.guide.concept, original.guide.concept);
  assert.notDeepEqual(entry.guide.outline, original.guide.outline);
});

test('the twenty existing classroom questions get their own guides regardless of their stored IDs', () => {
  const room = classroom();
  const lessons = [...basics, ...applied];
  assert.equal(new Set(lessons.map(({ title }) => title)).size, 20);
  const matchedIds = lessons.map(({ title, type, answer }) => {
    const question = { title, type };
    if (type === 'multiple') Object.assign(question, { options: ['가', '나', answer, '라', '마'], correctIndex: 2 });
    if (type === 'short') question.acceptedAnswers = [answer];
    return room.act('questions', question).question.id;
  });
  const entries = readTeacherAnswerGuides(room.state).entries;
  for (const [index, id] of matchedIds.entries()) {
    const { guide } = entries.find((entry) => entry.id === id);
    assert.deepEqual(guide, lessons[index].guide);
    assertGuideLayout(guide);
  }
});

test('only the authenticated teacher can download guides over HTTP, including after a student submits', async (t) => {
  const room = classroom();
  const participantToken = room.join('응시자');
  const question = room.state.questions[0];
  room.act('open', { id: question.id });
  room.act('answer', { questionId: question.id, value: question.correctIndex }, participantToken);
  const filename = join(tmpdir(), 'quiz-guide-access-' + randomUUID() + '.json');
  await writeFile(filename, JSON.stringify(room.state), { flag: 'wx' });
  const key = randomUUID();
  const server = spawn(process.execPath, [fileURLToPath(new URL('../server.js', import.meta.url))], {
    env: { ...process.env, PORT: '0', QUIZ_STATE_FILE: filename, TEACHER_KEY: key },
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  const closed = once(server, 'close');
  const lines = createInterface({ input: server.stdout });
  t.after(async () => {
    lines.close();
    server.kill();
    await closed;
    await rm(filename, { force: true });
  });
  const [line] = await once(lines, 'line', { signal: AbortSignal.timeout(10000) });
  const [, port] = line.match(/localhost:(\d+)/) || [];
  assert.ok(port, 'the local test server should print its bound port');
  const base = 'http://127.0.0.1:' + port;
  const member = { 'X-Participant-Token': participantToken };
  const rejected = await fetch(base + '/api/student/guides?code=' + room.state.roomCode, { headers: member });
  assert.equal(rejected.status, 403);
  assertNoGuide(await rejected.json());

  const teacherPath = base + '/api/teacher/guides';
  assert.equal((await fetch(teacherPath)).status, 401);
  assert.equal((await fetch(teacherPath, { headers: member })).status, 401);
  const login = await fetch(base + '/api/teacher/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key }),
  });
  assert.equal(login.status, 200);
  const { token } = await login.json();
  const teacher = { Authorization: 'Bearer ' + token };
  const full = await fetch(teacherPath, { headers: teacher });
  assert.equal(full.status, 200);
  assert.equal((await full.json()).entries.length, room.state.questions.length);
  const presentation = await fetch(teacherPath + '?scope=closed', { headers: teacher });
  assert.equal(presentation.status, 200);
  const { entries } = await presentation.json();
  assert.deepEqual(entries.map(({ id }) => id), [question.id]);
  assertGuideLayout(entries[0].guide);
  const payload = await fetch(base + '/api/state?code=' + room.state.roomCode, { headers: member });
  assert.equal(payload.status, 200);
  const studentState = await payload.json();
  assertNoGuide(studentState);
  assert.equal(studentState.response.correct, true);
});
