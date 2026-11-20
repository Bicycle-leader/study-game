import firstHalf from './exam-01-25.mjs';
import secondHalf from './exam-26-50.mjs';
import classBasics from './class-basics.mjs';
import classApplied from './class-applied.mjs';

export const examGuides = { ...firstHalf, ...secondHalf };
const classGuides = new Map([...classBasics, ...classApplied].map((entry) => [entry.title, entry]));

export const boundaryGuide = {
  reasoning: '지번은 필지를 부르는 번호이고 경계점은 선이 꺾이는 점입니다. 지적도에서 이웃한 두 필지를 나누는 것은 경계점들을 이어 그린 경계선입니다.',
  pitfall: '담장이나 울타리는 땅 위에서 보이는 시설입니다. 지적도에 등록된 선과 실제 시설의 위치는 서로 다를 수 있습니다.',
  outline: [
    ['정의', '경계점과 경계선을 점과 선으로 구별합니다.'],
    ['도면에서의 기능', '서로 이웃하는 두 필지를 그린 뒤, 맞닿은 선이 어느 땅까지가 한 필지인지 보여 준다고 설명합니다.'],
    ['현장 확인', '도면의 경계와 현지 담장이 다를 때 확인할 등록 자료와 측량성과를 적습니다.'],
  ],
  model: '필지의 경계는 지적공부에 등록된 경계점들을 연결한 선으로 나타낸다. 이 선은 인접 필지의 공간적 범위를 구분한다. 현지 담장과 위치가 다르면 등록된 경계 및 측량성과와 대조하여 차이를 확인한다.',
};

export function customGuide(question, lesson) {
  const entry = classGuides.get(question.title);
  if (entry?.type === question.type && (
    question.type === 'essay' || (question.type === 'multiple' && question.options[question.correctIndex] === entry.answer)
    || (question.type === 'short' && question.acceptedAnswers.includes(entry.answer))
  )) return entry.guide;
  const topic = lesson?.title || question.topic || question.chapter;
  if (question.type === 'essay') {
    return {
      reasoning: lesson?.lead || '자신이 쓴 답에서 문제의 요구에 직접 답하는 문장을 찾아보세요. 그 문장을 뒷받침하는 정의, 판단 기준, 적용 근거가 차례로 이어지는지 점검하세요.',
      outline: [
        ['쟁점', topic ? `이 문항에서 다루는 ‘${topic}’의 범위를 한 문장으로 정합니다.` : '설명·비교·대책 중 문제가 요구하는 작업을 먼저 밝힙니다.'],
        ['근거와 적용', '판단 기준을 쓰고, 문제에 나온 조건이 그 기준에 어떻게 해당하는지 연결합니다.'],
        ['결론', '처음 제기한 쟁점에 직접 답하고, 현장에서 추가로 확인할 자료가 있으면 제시합니다.'],
      ],
    };
  }
  const answer = question.type === 'multiple' ? question.options[question.correctIndex] : question.acceptedAnswers[0];
  const negative = /않은|않는|아닌|틀린|옳지|잘못된|없는 것/.test(question.title);
  return {
    reasoning: question.explanation || (negative
      ? `주어진 기준에 들어맞지 않는 항목을 고르는 문제입니다. 정답으로 지정된 ‘${answer}’와 나머지 항목을 같은 기준으로 나누어 보세요.`
      : `문제가 요구하는 답은 ‘${answer}’입니다. 질문에서 판단에 쓰인 조건에 밑줄을 긋고, 그 조건이 이 답을 가리키는 이유를 한 문장으로 설명해 보세요.`),
    outline: [
      ['판단 기준', lesson?.lead || '문제에 제시된 용어나 판단 기준을 먼저 정의합니다.'],
      ['조건 적용', negative ? `‘${answer}’가 기준에서 벗어나는 이유를 다른 보기 한 가지와 비교합니다.` : `문제의 조건과 ‘${answer}’를 연결하는 근거를 적습니다.`],
      ['실무 확인', lesson?.takeaway || '같은 판단을 현장에서 적용할 때 어떤 자료로 확인할지 한 가지 제시합니다.'],
    ],
  };
}
