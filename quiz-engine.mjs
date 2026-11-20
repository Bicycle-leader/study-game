import { lecturePages } from './public/lecture-content.mjs';
import { examGuides, boundaryGuide, customGuide } from './guides/catalog.mjs';

const lecturePageCount = lecturePages.length;
const lectureDeckVersion = 2;

const questionBankVersion = 1;
const topicsByLabel = new Map(lecturePages.filter((page) => !page.image).map((page) => [page.label, page]));

function examQuestion(id, label, difficulty, title, options, correctIndex, explanation) {
  const { chapter, title: topic } = topicsByLabel.get(label);
  return { id, type: 'multiple', chapter, topic, difficulty, title, options, correctIndex, explanation, acceptedAnswers: [] };
}

const examQuestions = [
  examQuestion('parcel-number', '01', '기본',
    '토지의 위치를 특정하기 위해 필지마다 부여하는 번호는 무엇인가요?',
    ['지목', '지번', '경계점', '축척', '면적'], 1,
    '지번은 지번부여지역 안에서 각 필지를 구별하는 번호입니다.'),
  examQuestion('exam-review-principles', '02', '심화',
    '분할 민원에서 ㉠ 이미 제출한 서류를 기관끼리 공유하고, ㉡ 측량성과와 도면을 대조했다. 각 조치에 해당하는 원리를 바르게 짝지은 것은?',
    ['㉠ 정확성 · ㉡ 민주성', '㉠ 공기능성 · ㉡ 능률성', '㉠ 민주성 · ㉡ 정확성', '㉠ 능률성 · ㉡ 정확성', '㉠ 능률성 · ㉡ 민주성'], 3,
    '서류 공유는 중복 업무를 줄여 능률성을 높이고, 성과 대조는 기록의 정확성을 높입니다.'),
  examQuestion('exam-napoleonic-purpose', '01', '기본',
    '1807년 프랑스에서 필지별 측량 도면과 토지 장부를 연결한 주된 목적은?',
    ['토지에 대한 과세', '건축물의 안전 검사', '저당권 순위의 공시', '행정구역 명칭의 통일', '도로 통행권의 설정'], 0,
    '나폴레옹 지적은 개별 필지의 도면과 장부를 연결하여 과세의 기초를 마련했습니다.'),
  examQuestion('exam-lot-history', '03', '심화',
    '1998년에는 한 필지였던 땅이 지금은 세 필지다. 세 필지가 어디에서 나왔는지 추적하는 데 가장 알맞은 자료는?',
    ['현재 세 필지의 소유자 주소', '현재 세 필지의 지목별 면적 합계', '세 필지에 적용된 연도별 세율', '분할 시점 지역 전체의 평균 지가', '분할 전후 지번과 이동일을 연결한 이력'], 4,
    '분할 전후 지번의 대응 관계와 토지이동일을 알아야 과거 필지에서 현재 필지까지 이어지는 과정을 복원할 수 있습니다.'),
  examQuestion('exam-public-access', '06', '기본',
    '법정 절차에 따라 지적공부를 열람하고 등본을 발급받게 하는 원칙은?',
    ['지적국정주의', '지적형식주의', '지적공개주의', '직권등록주의', '실질적 심사주의'], 2,
    '지적공개주의는 등록된 토지 정보를 법정 절차로 이용할 수 있게 하는 원칙입니다.'),
  examQuestion('exam-material-review', '06', '심화',
    '담당자가 ㉠ 현지 이용이 지목변경 요건을 충족하는지 조사한 뒤, ㉡ 확인한 사항을 법정 형식의 대장과 도면에 등록했다. 각 단계에 해당하는 기본이념은?',
    ['㉠ 지적국정주의 · ㉡ 직권등록주의', '㉠ 지적형식주의 · ㉡ 실질적 심사주의', '㉠ 직권등록주의 · ㉡ 지적공개주의', '㉠ 실질적 심사주의 · ㉡ 지적공개주의', '㉠ 실질적 심사주의 · ㉡ 지적형식주의'], 4,
    '현황과 요건을 대조하는 일은 실질적 심사주의, 확인한 토지 표시를 법정 공부의 형식에 맞춰 등록하는 일은 지적형식주의에 해당합니다.'),
  examQuestion('exam-administrative-use', '04', '기본',
    '다음 중 지적정보를 행정계획에 활용한 사례는?',
    ['매도인이 매매대금을 수령한다.', '시청이 도로 예정지에 들어갈 필지를 파악한다.', '은행이 대출 약정의 이율을 정한다.', '임차인이 임대인에게 보증금을 지급한다.', '소유자가 매수인과 계약일을 정한다.'], 1,
    '도로 사업의 편입 대상과 면적을 파악하는 일은 공공계획에 필지 정보를 활용하는 행정적 기능입니다.'),
  examQuestion('exam-road-records', '04', '심화',
    '도로 예정선과 겹치는 필지를 찾은 뒤 그 땅에 설정된 저당권도 확인하려 한다. 자료를 확인할 순서로 알맞은 것은?',
    ['지적도 → 지상경계점등록부', '토지대장 → 임야도', '등기기록 을구 → 지적도', '예정선과 지적도 대조 → 해당 필지의 등기기록 을구', '등기기록 갑구 → 토지대장'], 3,
    '예정선과 지적도를 겹쳐 대상 필지를 특정하고, 해당 등기기록의 을구에서 저당권을 확인합니다.'),
  examQuestion('exam-participation', '02', '기본',
    '경계에 영향을 받는 주민에게 자료를 설명하고 의견을 낼 기회를 보장했다. 가장 직접적으로 구현한 원리는?',
    ['민주성', '능률성', '영구성', '저렴성', '신속성'], 0,
    '민주성은 주민이 필요한 정보를 받고 절차에 참여하며 의견을 제시할 수 있게 하는 원리입니다.'),
  examQuestion('exam-digitization-quality', '05', '심화',
    '대장 전산화 전후의 평균 발급 시간이 10분에서 3분으로 줄었다. 기록의 완전성도 나아졌는지 확인할 지표는?',
    ['등본 한 통당 발급 수수료', '하루 평균 온라인 방문자 수', '원본에 있는 변경 이력이 전산 자료에서 누락된 비율', '신청 한 건을 처리한 직원 수', '전산 창구의 평균 대기 시간'], 2,
    '시간은 처리 속도를, 원본과 대조한 변경 이력 누락률은 기록의 완전성을 평가하는 지표입니다.'),

  examQuestion('exam-initial-registers', '10', '기본',
    '1950년 제정 지적법이 규정한 지적공부의 조합은?',
    ['토지대장·건축물대장·지적도·임야도', '토지대장·임야대장·도시계획도·임야도', '토지대장·임야대장·지적도·등기기록', '건축물대장·임야대장·지적도·등기기록', '토지대장·임야대장·지적도·임야도'], 4,
    '제정 지적법은 토지와 임야에 관해 각각 대장과 도면을 두었습니다.'),
  examQuestion('exam-historical-reading', '10', '심화',
    '1955년에 작성된 대장에 오늘날 사용하는 항목이 보이지 않는다. 당시 등록이 잘못되었는지 판단할 때 먼저 대조할 자료는?',
    ['현재 전산대장의 필수 입력 항목', '작성 당시의 법령·서식과 관련 경과규정', '현재 그 토지의 매매계약서', '해당 지역의 최근 항공사진', '최근 분할된 인접 필지의 등기기록'], 1,
    '기록의 형식과 등록 요건은 시대에 따라 달라지므로 작성 시점에 적용된 기준을 확인합니다.'),
  examQuestion('exam-legal-procedure', '07', '기본',
    '다음 중 지적업무를 처리하는 절차의 순서를 나타낸 것은?',
    ['면적·지번·경계', '토지·건물·공작물', '소유자·채권자·점유자', '신청·조사·등록', '지적도·임야도·대장'], 3,
    '신청을 접수하고 현황과 요건을 조사한 뒤 결정한 사항을 등록하는 것은 업무 절차입니다.'),
  examQuestion('exam-public-private-dispute', '09', '심화',
    '같은 필지에서 ㉠ 관청의 지목변경 신청 반려와 ㉡ 형제 간 소유권 귀속이 다투어졌다. 두 쟁점을 바르게 구분한 것은?',
    ['㉠ 행정처분 · ㉡ 사법상 권리관계', '㉠ 사법상 권리관계 · ㉡ 행정처분', '㉠ 경계복원측량 · ㉡ 지목변경', '㉠ 소유권이전 · ㉡ 지적측량 적부심사', '㉠ 분할 · ㉡ 등록전환'], 0,
    '관청의 신청 반려는 행정처분에 관한 문제이고, 누구에게 소유권이 있는지는 사법상 권리관계의 문제입니다.'),
  examQuestion('exam-merged-laws', '10', '기본',
    '2009년에 통합되어 「측량·수로조사 및 지적에 관한 법률」이 된 세 법률은?',
    ['지적법·민법·중재법', '측량법·수로업무법·부동산등기법', '측량법·지적법·수로업무법', '지적법·부동산등기법·민법', '측량법·지적법·민사조정법'], 2,
    '2009년에는 측량·지적·수로업무의 세 법률이 통합되었습니다.'),
  examQuestion('exam-timeline', '10', '심화',
    '㉠ 측량·지적·수로 3개 법률 통합, ㉡ 지적법 제정, ㉢ 대장 비치기관을 세무서에서 지방으로 이관. 오래된 사건부터 나열하면?',
    ['㉠ → ㉡ → ㉢', '㉠ → ㉢ → ㉡', '㉢ → ㉡ → ㉠', '㉡ → ㉢ → ㉠', '㉡ → ㉠ → ㉢'], 3,
    '지적법 제정은 1950년, 비치기관 이관은 1961년 개정, 세 법률 통합은 2009년의 일입니다.'),
  examQuestion('exam-land-management', '08', '기본',
    '필지별 면적과 경계를 도시계획·과세·시설 관리의 공통 자료로 쓰는 목적은?',
    ['권리 순위의 변경', '매매대금의 확정', '분할 전 지번의 복원', '채권의 담보 설정', '국토의 효율적 관리'], 4,
    '여러 기관이 같은 필지 자료를 이용하면 국토를 일관된 기준으로 계획하고 관리할 수 있습니다.'),
  examQuestion('exam-preliminary-area', '08', '심화',
    '시설 계획도에는 현장 조사 면적 243㎡, 토지대장에는 등록 면적 240㎡가 적혀 있다. 두 값을 안내할 때 알맞은 방법은?',
    ['평균인 241.5㎡를 등록 면적으로 표시한다.', '측정한 날이 더 최근인 값을 등록 면적으로 쓴다.', '조사값과 등록값을 나누고 각각의 작성일과 근거를 적는다.', '면적이 큰 값을 두 자료의 공통값으로 표시한다.', '토지대장의 값을 공사 예정 면적으로도 확정한다.'], 2,
    '계획용 조사값과 공부의 등록값은 목적과 효력이 달라서 출처와 작성 시점을 구별해야 합니다.'),

  examQuestion('exam-subdivision', '11', '기본',
    '공부에 등록된 한 필지를 두 필지로 나누어 등록하는 토지이동은?',
    ['합병', '분할', '등록전환', '신규등록', '지목변경'], 1,
    '분할은 한 필지를 둘 이상의 필지로 나누어 등록하는 토지이동입니다.'),
  examQuestion('exam-subdivision-land-use', '11', '심화',
    '한 필지인 밭의 일부가 적법하게 도로로 조성되었다. 도로 부분을 별도 필지로 구분하고 그 용도를 공부에 반영하는 데 관련된 두 절차는?',
    ['분할과 지목변경', '합병과 신규등록', '등록전환과 합병', '신규등록과 등록말소', '등록말소와 분할'], 0,
    '도로 부분을 별도 필지로 구분하는 일은 분할이고, 달라진 주된 용도를 등록하는 일은 지목변경에 해당합니다.'),
  examQuestion('exam-report-application', '13', '기본',
    '토지개발사업 시행자가 관청에 사업 완료 사실을 알리는 절차는?',
    ['등기촉탁', '직권조사', '신고', '재심사', '분할측량'], 2,
    '사업 완료라는 사실을 관청에 알리는 절차는 신고입니다.'),
  examQuestion('exam-title-after-division', '12', '심화',
    '분할 뒤 새 지번이 등기기록 표제부에 반영되었다. 매수인이 해당 필지의 소유권도 이전되었는지 확인하려면?',
    ['표제부의 지번 개수를 센다.', '분할 전후의 지적도 축척을 대조한다.', '을구의 저당권 순위만 확인한다.', '새 지번이 생긴 날짜를 이전일로 본다.', '갑구에서 소유권이전등기 내용을 확인한다.'], 4,
    '분할로 토지의 표시가 바뀌는 것과 매매로 소유권이 바뀌는 것은 별개이며, 소유권에 관한 등기는 갑구에 기록합니다.'),
  examQuestion('map-scale', '18', '기본',
    '축척이 1:1,000인 지적도에서 도면 위의 1cm는 실제 거리로 몇 m인가요?',
    ['1 m', '10 m', '100 m', '1,000 m', '0.1 m'], 1,
    '도면의 1cm에 1,000을 곱하면 실제 거리 1,000cm, 즉 10m가 됩니다.'),
  examQuestion('exam-settlement-amount', '18', '심화',
    '축척변경 청산 대상 필지의 종전 면적은 156㎡, 새 면적은 162㎡다. 이 지번의 의결 단가가 ㎡당 12만 원이면 청산금의 크기는?',
    ['72만 원', '12만 원', '36만 원', '1,872만 원', '1,944만 원'], 0,
    '전체 면적 대신 증감면적 6㎡에 단가 12만 원을 곱하면 72만 원입니다.'),
  examQuestion('exam-unreported-changes', '15', '기본',
    '공부에 기록되지 않은 토지이동을 찾아내는 조사를 가리키는 지적학의 역사적 용어는?',
    ['적부심사', '경계복원측량', '등기촉탁', '지압조사', '축척변경'], 3,
    '지압조사는 신고나 신청이 빠진 토지이동을 찾아내는 토지검사의 한 유형을 가리킵니다.'),
  examQuestion('exam-subrogation-limit', '14', '심화',
    '공공용지 사업시행자가 소유자를 대신해 분할 신청을 준비하던 중, 해당 필지가 면적 오류로 등록사항 정정 대상임을 확인했다. 우선 검토할 절차는?',
    ['예정 면적대로 분할하고 나중에 정정한다.', '현황 면적을 기준으로 소유권을 이전한다.', '대위신청 범위에서 제외되므로 적법한 정정 절차를 확인한다.', '기존 등록을 말소하고 신규등록한다.', '분할 대신 인접 필지와 합병한다.'], 2,
    '등록사항 정정 대상토지는 대위신청 범위에서 제외되므로 면적 오류의 정정 절차를 먼저 살핍니다.'),
  examQuestion('exam-survey-review', '16', '기본',
    '지적측량 적부심사에서 심사하는 직접적인 대상은?',
    ['지적측량성과의 적정성', '소유권이전의 원인', '담보대출의 변제 순위', '임대차계약의 효력', '토지 매매가격의 적정성'], 0,
    '적부심사는 특정 지적측량성과가 적정한지 판단하는 절차입니다.'),
  examQuestion('exam-resurvey-committees', '17', '심화',
    '지적재조사에서 갑은 경계선 위치에, 을은 면적 증감에 따른 조정금에 이의를 냈다. 각 쟁점을 의결하는 위원회는?',
    ['갑 지방지적위원회 · 을 경계결정위원회', '갑 경계결정위원회 · 을 시·군·구 지적재조사위원회', '갑 시·군·구 지적재조사위원회 · 을 중앙지적위원회', '갑 축척변경위원회 · 을 경계결정위원회', '갑 중앙지적위원회 · 을 축척변경위원회'], 1,
    '경계의 위치와 이의는 경계결정위원회가, 조정금에 관한 사항은 시·군·구 지적재조사위원회가 다룹니다.'),
  examQuestion('exam-ground-marker-register', '19', '기본',
    '새로 정한 지상경계점의 위치 설명도, 현장 사진, 표지 종류를 함께 기록하는 장부는?',
    ['토지대장', '임야대장', '건축물대장', '등기기록', '지상경계점등록부'], 4,
    '지상경계점등록부는 현장에서 그 경계점을 다시 확인할 수 있게 위치와 표지에 관한 정보를 기록합니다.'),
  examQuestion('exam-imagery-evidence', '15', '심화',
    '지난해 항공사진에서는 밭이었던 필지가 새 사진에는 포장된 공터로 보인다. 공부의 지목을 검토할 때 다음 단계로 알맞은 것은?',
    ['새 사진의 촬영일을 지목변경 확정일로 삼는다.', '바로 옆 필지와 같은 지목으로 기록한다.', '포장된 면적을 기준으로 소유자를 변경한다.', '현장 이용과 인허가 자료를 대조해 변경 요건을 살핀다.', '과거 사진이 있으므로 그 당시 지목을 그대로 확정한다.'], 3,
    '사진은 변화의 단서이므로 실제 이용과 관련 인허가 자료를 대조한 뒤 지목변경 요건을 판단합니다.'),
  examQuestion('exam-resurvey-purpose', '17', '기본',
    '현황과 맞지 않는 지적공부를 바로잡고 종이 지적을 디지털 지적으로 전환하는 사업은?',
    ['지적재조사', '축척변경', '적부심사', '등기촉탁', '토지감정평가'], 0,
    '지적재조사는 등록사항과 실제 현황의 불일치를 바로잡고 디지털 지적체계로 전환하는 사업입니다.'),
  examQuestion('exam-map-distance', '18', '심화',
    '같은 두 경계점 사이가 축척 1:1,200 도면에서 2.5cm이다. 실제 거리가 그대로라면 1:600 도면에서는 몇 cm인가?',
    ['0.625cm', '1.25cm', '2.5cm', '5cm', '10cm'], 3,
    '실제 거리는 2.5cm × 1,200 = 3,000cm이므로 새 도면에서는 3,000 ÷ 600 = 5cm입니다.'),

  examQuestion('exam-tax-transition', '20', '기본',
    '옛 지세 장부에서 비과세 대상이던 토지가 과세 대상으로 바뀐 것을 가리키는 말은?',
    ['비과세지성', '합병', '등록전환', '환지', '과세지성'], 4,
    '과세지성은 비과세에서 과세로, 비과세지성은 과세에서 비과세로 바뀌는 것을 뜻합니다.'),
  examQuestion('exam-inundation', '21', '심화',
    '폭풍 직후 해안 필지가 물에 잠겼다는 사진 한 장을 받았다. 바다로 변한 토지의 등록말소를 검토할 때 먼저 확인할 사실은?',
    ['소유자가 직전에 납부한 지세', '일시 침수 여부와 토지로 회복될 가능성', '인접 필지의 최근 매매가격', '같은 지번의 과거 저당권 설정액', '소유자의 다른 토지 보유 면적'], 1,
    '일시적 침수와 바다로 변해 회복되기 어려운 경우를 구별하려면 현황과 회복 가능성을 조사해야 합니다.'),
  examQuestion('exam-common-ownership', '23', '기본',
    '여러 사람이 한 토지를 개인별 지분으로 소유하며, 각자 자기 지분을 원칙적으로 처분할 수 있는 형태는?',
    ['총유', '합유', '공유', '지상권', '지역권'], 2,
    '공유에서는 각 공유자가 자신의 지분을 원칙적으로 독립하여 처분할 수 있습니다.'),
  examQuestion('exam-undivided-share', '23', '심화',
    '분할이나 별도 약정이 없는 600㎡ 한 필지를 자매가 각각 2분의 1씩 공유한다. 언니의 지분을 정확하게 설명하면?',
    ['필지 전체에 미치는 2분의 1의 비율이다.', '동쪽 300㎡가 언니의 단독 소유다.', '언니가 먼저 정한 쪽 300㎡가 단독 소유가 된다.', '동생의 동의를 받아야 자기 지분을 처분할 수 있다.', '자매에게 개별 지분이 존재하지 않는다.'], 0,
    '공유지분은 토지 전체에 대한 비율이므로 구체적인 동쪽 또는 서쪽 300㎡가 곧 개인 소유로 특정되지는 않습니다.'),
  examQuestion('exam-superficies', '24', '기본',
    '다른 사람의 토지에 건물·공작물·수목을 소유하기 위해 그 토지를 사용할 수 있는 물권은?',
    ['저당권', '전세권', '지역권', '지상권', '질권'], 3,
    '지상권은 타인의 토지를 건물·공작물·수목의 소유를 위해 사용할 수 있는 권리입니다.'),
  examQuestion('exam-underground-range', '25', '심화',
    '지하 터널을 위한 구분지상권 도면에 통과 구간의 평면 위치만 표시했다. 권리가 미치는 공간을 특정하려면 무엇을 보완해야 하는가?',
    ['터널의 총공사비와 단위 공사비', '지표 위 건물의 사용승인일', '기준 높이에 대한 상한·하한을 표시한 단면', '필지 전체의 공시지가와 종전 면적', '인접 토지소유자의 주소 목록'], 2,
    '구분지상권은 일정한 높이나 깊이의 공간을 사용하므로 평면 위치와 함께 상하 범위를 특정해야 합니다.'),
  examQuestion('exam-dominant-land', '26', '기본',
    '통행지역권에서 이웃 땅의 통로를 이용해 편익을 얻는 토지를 무엇이라 하는가?',
    ['승역지', '과세지', '환지', '편입지', '요역지'], 4,
    '지역권으로 편익을 받는 땅은 요역지이고, 이용을 제공하는 땅은 승역지입니다.'),
  examQuestion('exam-easement-application', '26', '심화',
    'A 소유자는 B를 지나 공도에 나간다. 이어 B 소유자도 C를 지나 농기계를 운반한다. 각각 별개의 통행지역권이 있다면 B의 지위는?',
    ['두 관계 모두 요역지', 'A와의 관계에서는 승역지, C와의 관계에서는 요역지', 'A와의 관계에서는 요역지, C와의 관계에서는 승역지', '두 관계 모두 승역지', '중간에 있으므로 두 관계 모두 요역지·승역지에 해당하지 않음'], 1,
    'B는 A를 위해 통로를 제공하는 관계에서는 승역지이고, C의 통로로 편익을 얻는 관계에서는 요역지입니다.'),
  examQuestion('exam-jeonse-right', '27', '기본',
    '전세금을 지급하고 설정등기를 하여 타인의 부동산을 사용·수익하고 후순위 권리자보다 우선변제를 받을 수 있는 물권은?',
    ['지상권', '소유권', '지역권', '전세권', '유치권'], 3,
    '전세권은 부동산의 사용·수익과 전세금의 우선변제를 함께 내용으로 하는 물권입니다.'),
  examQuestion('exam-acquisition-comparison', '22', '심화',
    '갑은 토지 매매계약을 체결했고 을은 토지를 상속받았다. 둘 다 아직 등기하지 않은 때 소유권 취득에 관한 원칙은?',
    ['갑과 을 모두 계약일에 취득한다.', '갑은 이전등기가 필요하고 을은 상속으로 취득한다.', '갑은 계약으로 취득하고 을은 등기가 필요하다.', '갑과 을 모두 지적도 정리로 취득한다.', '갑과 을 모두 취득에 이전등기가 필요하다.'], 1,
    '매매에 따른 소유권 변동에는 등기가 필요하며, 상속에 따른 취득은 등기 없이 효력이 생깁니다.'),

  examQuestion('exam-description-section', '논술 1', '기본',
    '토지 등기기록에서 소재·지번·지목·면적을 확인하는 부분은?',
    ['갑구', '을구', '표제부', '지상경계점등록부', '토지이동결의서'], 2,
    '표제부는 해당 등기기록이 어느 부동산에 관한 것인지 그 표시를 기록하는 부분입니다.'),
  examQuestion('exam-registry-crosscheck', '논술 1', '심화',
    '매수인이 ㉠ 계약서의 지번·면적, ㉡ 매도인의 소유권, ㉢ 설정된 저당권을 확인한다. 등기기록에서 확인할 부분을 순서대로 고르면?',
    ['갑구 → 표제부 → 을구', '을구 → 갑구 → 표제부', '표제부 → 을구 → 갑구', '갑구 → 을구 → 표제부', '표제부 → 갑구 → 을구'], 4,
    '토지의 표시는 표제부, 소유권은 갑구, 저당권 같은 소유권 외의 권리는 을구에서 확인합니다.'),
  examQuestion('exam-general-boundaries', '28', '기본',
    '잉글랜드·웨일스의 일반경계 방식에서 대부분의 등기 도면이 보여 주는 것은?',
    ['경계의 대략적인 위치', '모든 경계점의 확정 법적 좌표', '건물 내부의 임차 구획', '저당권의 등기 순위', '토지소유자의 납세액'], 0,
    '일반경계 도면은 경계의 대략적 위치를 표시하며, 정확한 법적 경계에는 권원문서 등 다른 자료도 필요합니다.'),
  examQuestion('exam-compare-purpose-evidence', '28', '심화',
    '연구자가 프랑스의 나폴레옹 지적도와 잉글랜드·웨일스의 일반경계 도면을 비교한다. 두 자료를 해석하는 방법으로 알맞은 것은?',
    ['두 도면 모두 세금 부과 자료이므로 경계 표현을 같은 기준으로 본다.', '프랑스 도면은 과세 목적을, 일반경계 도면은 경계 표시의 정밀도와 효력을 살핀다.', '프랑스 도면은 권리 순위를, 일반경계 도면은 납세액을 읽는 데 쓴다.', '축척이 같으면 두 도면의 경계선에 같은 법적 효력을 부여한다.', '두 도면의 선 굵기를 비교해 어느 쪽이 소유권을 확정하는지 결정한다.'], 1,
    '필지도를 비교할 때는 제작 목적과 경계 표시의 효력을 구분해야 하며, 축척만으로 법적 효력을 알 수 없습니다.'),
  examQuestion('exam-mediation', '논술 3', '기본',
    '경계 분쟁에서 제삼자가 대화를 이끌어 당사자 스스로 합의하도록 돕는 절차는?',
    ['등기촉탁', '직권조사', '중재', '적부심사', '조정'], 4,
    '조정에서는 제삼자가 당사자의 합의를 돕고, 중재에서는 중재합의에 따라 중재인이 판단합니다.'),
  examQuestion('exam-linkage-lag', '논술 2', '심화',
    '분할이 완료된 토지대장에는 새 지번이 있지만 등기 표제부에는 종전 지번이 남아 있다. 오류와 반영 지연을 구별할 첫 점검은?',
    ['분할 전후 지번 이력과 표시변경 촉탁·반영 시점을 대조한다.', '두 장부 중 더 큰 면적을 기준으로 지번을 고친다.', '두 장부의 소유자 이름이 같으면 같은 지번으로 처리한다.', '등기부의 지번에 맞추어 분할 이전 상태로 되돌린다.', '표제부 대신 을구의 저당권 순위로 분할일을 추정한다.'], 0,
    '필지의 변경 이력과 처리 시점을 대조하면 어느 단계에서 두 기록의 차이가 생겼는지 추적할 수 있습니다.'),
  examQuestion('exam-shared-identity', '논술 2', '기본',
    '여러 기관의 자료에서 동일한 필지를 연결하는 데 가장 적합한 기준은?',
    ['현재 소유자의 성명', '가장 최근의 매매가격', '담당 공무원의 이름', '필지 단위의 공통 식별자', '지역의 평균 필지 면적'], 3,
    '같은 기준의 필지 식별자를 사용하면 이름이나 가격이 같은 서로 다른 필지를 혼동할 가능성을 줄일 수 있습니다.'),
  examQuestion('exam-settlement-implementation', '논술 3', '심화',
    '담장을 둘러싼 분쟁에서 이웃들이 A 필지의 띠 모양 일부를 떼어 B에게 소유권 이전하기로 합의했다. 합의 이행을 위해 확인할 절차는?',
    ['지목변경과 축척변경', '경계복원측량과 전세권 설정', '이전할 부분의 분할과 소유권이전등기', '토지 전체의 등록말소와 신규등록', '통행지역권 설정과 저당권 말소'], 2,
    '필지 일부의 소유권을 옮기려면 이전 대상을 분할해 특정하고 필요한 소유권이전등기를 진행합니다.'),
].map((question, index) => ({ ...question, examNumber: index + 1 }));

const seedQuestions = [
  ...examQuestions,
  {
    id: 'boundary-line',
    type: 'short',
    title: '지적도에서 토지의 경계를 나타내는 선을 무엇이라고 하나요?',
    options: [],
    correctIndex: null,
    acceptedAnswers: ['경계선', '토지 경계선'],
  },
];
const standardAnswerSeconds = 30;
const defaultEssaySeconds = 120;
const maxEssaySeconds = 900;
const essayLimit = 2_000;
const multipleChoiceCount = 5;
const warmupCategory = '기초학습';
const defaultQuestionScope = { kind: 'all' };
const guidesByDefinition = new Map(seedQuestions.map((question) => [
  questionDefinition(question), question.type === 'multiple' ? examGuides[question.id] : boundaryGuide,
]));
const lessonsByTitle = new Map([...topicsByLabel.values()].map((lesson) => [lesson.title, lesson]));

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
    lecturePageIndex: 0,
    lectureDeckVersion,
    questionBankVersion,
    scope: { kind: 'exam' },
    questions: structuredClone(seedQuestions),
    participants: [],
    responses: [],
    history: [],
  };
}

// Upgrade once, keeping the order and IDs used by existing lessons and their response histories.
export function upgradeQuizState(state) {
  if (state.questionBankVersion >= questionBankVersion) return state;
  const questions = [...state.questions];
  const indexByDefinition = new Map(questions.map((question, index) => [questionDefinition(question), index]));
  const usedIds = new Set([...questions, ...(state.archivedQuestions || [])].map(({ id }) => id));
  for (const seed of examQuestions) {
    const index = indexByDefinition.get(questionDefinition(seed));
    if (index !== undefined) {
      const existing = questions[index];
      questions[index] = {
        ...existing,
        chapter: existing.chapter || seed.chapter,
        topic: existing.topic || seed.topic,
        examNumber: seed.examNumber,
        difficulty: seed.difficulty,
        explanation: seed.explanation,
      };
      continue;
    }
    // A teacher may have edited or archived a question with the original seed ID.
    let id = seed.id;
    for (let suffix = 1; usedIds.has(id); suffix += 1) id = seed.id + '-exam-' + suffix;
    usedIds.add(id);
    questions.push({ ...structuredClone(seed), id });
  }
  return { ...state, questionBankVersion, questions };
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

function isLecturePageIndex(value) {
  return Number.isInteger(value) && value >= 0 && value < lecturePageCount;
}

function lecturePageIndex(state) {
  const savedIndex = state.lecturePageIndex;
  if (!Number.isInteger(savedIndex)) return 0;
  // Earlier rooms stored the positions of the definition pages before the images were inserted.
  const index = state.lectureDeckVersion === undefined ? savedIndex * 2 : savedIndex;
  return isLecturePageIndex(index) ? index : 0;
}

export function readLectureState(state, code) {
  requireRoom(state, code);
  return { roomCode: state.roomCode, pageIndex: lecturePageIndex(state) };
}

function showLecturePage(state, { pageIndex, expectedPageIndex }) {
  if (!isLecturePageIndex(pageIndex) || (expectedPageIndex !== undefined && !isLecturePageIndex(expectedPageIndex))) {
    throw new ApiError(400, '강의 페이지 번호를 확인해 주세요.');
  }
  const current = lecturePageIndex(state);
  if (pageIndex === current) return accepted(state);
  if (expectedPageIndex !== undefined && expectedPageIndex !== current) {
    throw new ApiError(409, '강의 페이지가 바뀌었습니다. 현재 페이지를 확인해 주세요.');
  }
  return accepted({ ...state, lecturePageIndex: pageIndex, lectureDeckVersion });
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
  if (scope.kind === 'exam') return question.type === 'multiple' && Number.isInteger(question.examNumber);
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
  const scopedQuestions = state.questions.filter((saved) => matchesQuestionScope(saved, scope));
  if (scope.kind === 'exam') scopedQuestions.sort((a, b) => a.examNumber - b.examNumber);
  const scopeQuestionIds = scopedQuestions.map(({ id }) => id);
  // Rooms saved before scope selection used the last opened question as their sequence position.
  const lastQuestionId = Object.hasOwn(state, 'scopeLastQuestionId') ? state.scopeLastQuestionId : state.activeQuestionId;
  const nextQuestionId = scopeQuestionIds[scopeQuestionIds.indexOf(lastQuestionId) + 1] ?? null;
  const lectureUrl = new URL('/lecture', joinUrl);
  lectureUrl.searchParams.set('code', state.roomCode);
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
    lecturePageIndex: lecturePageIndex(state),
    lectureUrl: lectureUrl.href,
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
    if (type === 'multiple' && question.examNumber) visibleQuestion.examNumber = question.examNumber;
    if (question.difficulty) visibleQuestion.difficulty = question.difficulty;
    if (showResult && topic) visibleQuestion.topic = topic;
    if (showResult && participant && type === 'multiple') {
      visibleQuestion.correctIndex = question.correctIndex;
    }
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

function guideEntry(question) {
  const { id, type, title, examNumber, options, correctIndex, acceptedAnswers } = question;
  const guide = guidesByDefinition.get(questionDefinition(question)) ||
    customGuide(question, lessonsByTitle.get(question.topic?.replace(/^(?:논술\s*)?\d+\s+/u, '')));
  const entry = { id, title, type, guide };
  if (type === 'multiple') {
    Object.assign(entry, { options, correctIndex });
    if (examNumber) entry.examNumber = examNumber;
  }
  if (type === 'short') entry.acceptedAnswers = acceptedAnswers;
  return entry;
}

export function readTeacherAnswerGuides(state, closedOnly = false) {
  if (!closedOnly) return { entries: state.questions.map(guideEntry) };
  const closed = new Set((state.history || []).map((record) => record.questionId));
  if (state.stage === 'open') closed.delete(state.activeQuestionId);
  const questions = [...state.questions, ...(state.archivedQuestions || [])].filter(({ id }) => closed.has(id));
  return { entries: questions.map(guideEntry) };
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
  if (kind === 'all' || kind === 'exam' || kind === 'warmup') return { kind };
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

function validateQuestion(body, { allowLegacyChoices = false } = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new ApiError(400, '문제의 형식을 확인해 주세요.');
  const title = cleanText(body.title, 250, '문제를 1~250자로 입력해 주세요.');
  const question = { type: body.type, title, options: [], correctIndex: null, acceptedAnswers: [] };
  const labels = { category: questionLabel(body.category, '문제 분류', 60), ...questionSource(body) };
  for (const [key, value] of Object.entries(labels)) {
    if (value) question[key] = value;
  }
  if (body.type === 'multiple') {
    if (!allowLegacyChoices && (!Array.isArray(body.options) || body.options.length !== multipleChoiceCount)) {
      throw new ApiError(400, '객관식 보기를 5개 입력해 주세요.');
    }
    if (allowLegacyChoices && (!Array.isArray(body.options) || body.options.length < 2 || body.options.length > 6)) {
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
  if (existing?.examNumber) {
    question.examNumber = existing.examNumber;
    if (questionDefinition(question) === questionDefinition(existing)) {
      if (existing.difficulty) question.difficulty = existing.difficulty;
      if (existing.explanation) question.explanation = existing.explanation;
    }
  }
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

function extendQuestionChoices(state, { updates }) {
  if (!Array.isArray(updates) || !updates.length) {
    throw new ApiError(400, '보기를 추가할 객관식 문항을 입력해 주세요.');
  }
  const revisions = new Map();
  for (const update of updates) {
    if (!update || typeof update.id !== 'string' || revisions.has(update.id)) {
      throw new ApiError(400, '각 문항의 보기 변경은 한 번만 입력해 주세요.');
    }
    const question = requiredQuestion(state, update.id);
    if (question.type !== 'multiple' || question.title !== update.title) {
      throw new ApiError(409, '문항이 변경되었습니다. 기존 문제를 다시 확인해 주세요.');
    }
    const { options } = validateQuestion({ ...question, options: update.options });
    if (question.options.length > options.length || !question.options.every((option, index) => option === options[index])) {
      throw new ApiError(409, '기존 보기의 내용과 순서를 유지해 주세요.');
    }
    if (question.options.length === options.length) {
      revisions.set(question.id, question);
      continue;
    }
    if (state.stage === 'open' && state.activeQuestionId === question.id) {
      throw new ApiError(409, '해당 문항의 접수가 마감된 뒤 보기를 추가해 주세요.');
    }
    revisions.set(question.id, { ...question, options });
  }
  const questions = state.questions.map((question) => revisions.get(question.id) ?? question);
  if (questions.every((question, index) => question === state.questions[index])) return accepted(state);
  // Resolve older result entries before the additional choices become part of the bank.
  const history = (state.history || []).map((entry) => revisions.has(entry.questionId) ? readHistoryEntry(state, entry) : entry);
  return accepted({ ...state, questions, history });
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
  const definitions = body.questions.map((question) => validateQuestion(question, { allowLegacyChoices: true }));
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
    return { ...matching, category: question.category, chapter: question.chapter, topic: question.topic, ...question };
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
    scope: state.scope?.kind === 'exam' && !questions.some((question) => matchesQuestionScope(question, state.scope))
      ? defaultQuestionScope : state.scope,
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

function resetRoom(state, randomHex, keepRoomCode = false) {
  if (typeof keepRoomCode !== 'boolean') {
    throw new ApiError(400, '참여 링크 유지 여부를 확인해 주세요.');
  }
  let roomCode = state.roomCode;
  if (!keepRoomCode) {
    do {
      roomCode = createRoomCode(randomHex);
    } while (roomCode === state.roomCode);
  }
  return {
    roomCode,
    questions: state.questions,
    questionBankVersion: state.questionBankVersion,
    scope: state.scope?.kind === 'exam' ? state.scope : defaultQuestionScope,
    stage: 'waiting',
    activeQuestionId: null,
    closesAt: null,
    lecturePageIndex: 0,
    lectureDeckVersion,
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
    case 'extend-choices':
      return extendQuestionChoices(state, body);
    case 'replace-questions':
      return replaceQuestions(state, body, { now, randomUUID: context.randomUUID });
    case 'essay-grade':
      return gradeEssay(state, body);
    case 'scope':
      return selectQuestionScope(state, body);
    case 'lecture':
      return showLecturePage(state, body);
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
      return accepted(resetRoom(state, context.randomHex, body.keepRoomCode));
    case 'join':
      return joinRoom(state, body, context);
    case 'answer':
      return submitAnswer(state, body, { ...context, now });
    default:
      throw new ApiError(404, '요청한 기능을 찾을 수 없습니다.');
  }
}
