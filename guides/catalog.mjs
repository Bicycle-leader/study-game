import firstHalf from './exam-01-25.mjs';
import secondHalf from './exam-26-50.mjs';
import classBasics from './class-basics.mjs';
import classApplied from './class-applied.mjs';

export const examGuides = { ...firstHalf, ...secondHalf };
const classGuides = new Map([...classBasics, ...classApplied].map((entry) => [entry.title, entry]));

export const boundaryGuide = {
  concept: '지적도에서는 경계점과 경계점을 이은 선으로 한 필지의 범위를 나타냅니다. 두 필지가 맞닿으면 그 선이 어느 쪽까지가 각 필지인지 보여 줍니다. 담장이나 울타리는 현장에서 관찰되는 시설입니다. 위치가 도면의 경계와 다를 때에는 등록된 경계 자료와 측량성과를 함께 확인합니다.',
  outline: [
    ['필지 경계의 구성', [
      ['경계점', '경계선이 꺾이거나 이어지는 위치를 점으로 나타낸다.'],
      ['경계선', '경계점을 이은 선이 필지 사이의 범위를 가른다.'],
    ]],
    ['지적도에서의 확인', [
      ['대상 필지', '소재와 지번으로 도면에서 필지를 찾는다.'],
      ['인접 필지', '이웃한 필지와 맞닿은 선이 공통 경계를 이룬다.'],
    ]],
    ['현장 자료의 대조', [
      ['현장 경계', '담장과 표지 등 현장에서 확인한 위치를 기록한다.'],
      ['성과 확인', '등록 경계와 측량성과를 대조하여 차이를 검토한다.'],
    ]],
  ],
};

export function customGuide(question, lesson) {
  const entry = classGuides.get(question.title);
  if (entry?.type === question.type && (
    question.type === 'essay' || (question.type === 'multiple' && question.options[question.correctIndex] === entry.answer)
    || (question.type === 'short' && question.acceptedAnswers.includes(entry.answer))
  )) return entry.guide;
  const topic = lesson?.title || question.topic;
  return {
    concept: question.explanation || lesson?.lead || '문항에 나온 용어의 뜻과 적용 범위를 짚어 줍니다. 개념이 실제로 어떻게 쓰이는지 문항의 조건이나 강의 사례와 연결해 설명합니다.',
    outline: [
      ['개념과 범위', [
        ['핵심 용어', topic ? `‘${topic}’에 관한 문항의 핵심 용어를 정의합니다.` : '문항에서 사용하는 중심 용어를 한 문장으로 정의합니다.'],
        ['적용 범위', '정의가 적용되는 대상과 조건을 적습니다.'],
      ]],
      ['기준과 적용', [
        ['판단 기준', '관련 법정 요건이나 기술 기준의 핵심을 정리합니다.'],
        ['문항 적용', '문제에 주어진 사실을 판단 기준과 연결합니다.'],
      ]],
      ['결론과 확인', [
        ['결론', '문항에서 요청한 판단이나 절차를 한 문장으로 제시합니다.'],
        ['확인 자료', '결론을 검토할 때 필요한 자료를 한 가지 적습니다.'],
      ]],
    ],
  };
}
