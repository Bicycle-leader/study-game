(function () {
  'use strict';

  function node(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined && text !== null) element.textContent = text;
    return element;
  }

  function section(title, body) {
    const section = node('section', 'guide-section');
    section.append(node('h4', '', title), body);
    return section;
  }

  function questionLabel(entry) {
    const type = { multiple: '객관식', short: '단답형', essay: '서술형' }[entry.type] || '문항';
    return Number.isInteger(entry.examNumber) ? `시험 ${entry.examNumber}번` : type;
  }

  function answerSummary(entry) {
    const answers = node('dl', 'guide-answers');
    function row(label, value) {
      if (value === undefined || value === null || value === '') return;
      const line = node('div');
      line.append(node('dt', '', label), node('dd', '', value));
      answers.append(line);
    }
    const index = entry.correctIndex;
    if (entry.type === 'multiple' && Number.isInteger(index) && entry.options?.[index]) {
      row('정답', `${index + 1}번 · ${entry.options[index]}`);
    } else {
      row(entry.type === 'essay' ? '참고 답안' : '정답', entry.answerText || entry.acceptedAnswers?.join(' 또는 '));
    }
    return answers;
  }

  function choices(entry) {
    const details = node('details', 'guide-disclosure');
    const list = node('ol');
    for (const choice of entry.options) list.append(node('li', '', choice));
    details.append(node('summary', '', '문제 보기 다시 읽기'), list);
    return details;
  }

  function generalWritingAdvice() {
    const details = node('details', 'guide-disclosure guide-writing-notes');
    const examples = node('ul');
    for (const [label, guidance] of [
      ['개념·비교형', '첫 문장에 용어의 뜻을 적으세요. 두 제도를 비교할 때는 목적, 대상, 효과처럼 같은 기준을 적용하세요.'],
      ['사례·절차형', '사례에서 판단할 사실을 골라 쓴 뒤, 적용할 기준과 그 기준에 따른 처리 순서를 설명하세요.'],
      ['계산형', '주어진 값과 단위를 먼저 적으세요. 식에 값을 대입하는 과정을 보이고 결과값이 뜻하는 바를 한 문장으로 마무리하세요.'],
    ]) {
      const item = node('li');
      item.append(node('strong', '', label), document.createTextNode(' ' + guidance));
      examples.append(item);
    }
    const source = node('a', '', '큐넷 지적기술사 시험 안내');
    source.href = 'https://www.q-net.or.kr/crf005.do?id=crf00503&jmCd=0690';
    source.target = '_blank';
    source.rel = 'noopener noreferrer';
    const format = node('p', '', '지적기술사 필기는 단답형과 주관식 논술형으로 진행됩니다. ');
    format.append(source);
    details.append(node('summary', '', '문제 유형에 맞게 답안 쓰기'), format, examples);
    return details;
  }

  function renderEntry(entry) {
    const article = node('article', 'guide-article');
    article.append(node('h3', 'guide-question', entry.title));
    const answers = answerSummary(entry);
    if (answers.childElementCount) article.append(answers);
    if (entry.type === 'multiple' && entry.options?.length) article.append(choices(entry));

    const guide = entry.guide || {};
    const reasoning = guide.reasoning || entry.explanation;
    if (reasoning) article.append(section(entry.type === 'essay' ? '문제 이해하기' : '정답을 고르는 근거', node('p', '', reasoning)));
    if (guide.pitfall) article.append(section('헷갈리기 쉬운 점', node('p', '', guide.pitfall)));
    if (guide.outline?.length) {
      const list = node('ol', 'guide-outline');
      for (const [heading, body] of guide.outline) {
        const item = node('li');
        item.append(node('strong', '', heading), node('p', '', body));
        list.append(item);
      }
      article.append(section('기술사 답안 구성', list));
    }
    if (guide.model) article.append(section('연습용 서술형 답안 예시', node('p', 'guide-model', guide.model)));
    if (guide.sources?.length) {
      const sources = node('details', 'guide-disclosure');
      const list = node('ul');
      for (const [label, url] of guide.sources) {
        if (!url.startsWith('https://')) continue;
        const link = node('a', '', label);
        link.href = url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        const item = node('li');
        item.append(link);
        list.append(item);
      }
      sources.append(node('summary', '', '근거 자료'), list);
      if (list.childElementCount) article.append(sources);
    }
    article.append(generalWritingAdvice());
    return article;
  }

  window.createAnswerGuide = function ({ dialog, loadEntries }) {
    let entries = [];
    let selectedId = '';
    let generation = 0;
    const header = node('div', 'guide-header');
    const heading = node('h2', '', '지적학 문제 해설서');
    heading.id = dialog.id + '-title';
    dialog.classList.add('answer-guide');
    dialog.setAttribute('aria-labelledby', heading.id);
    const closeButton = node('button', 'guide-close', '닫기');
    closeButton.type = 'button';
    closeButton.autofocus = true;
    header.append(heading, closeButton);

    const navigation = node('div', 'guide-navigation');
    const select = node('select');
    select.id = dialog.id + '-select';
    const label = node('label', '', '문항 선택');
    label.htmlFor = select.id;
    navigation.append(label, select);
    const status = node('p', 'guide-status');
    status.setAttribute('role', 'status');
    const retry = node('button', 'guide-retry', '다시 불러오기');
    retry.type = 'button';
    const reading = node('div', 'guide-reading');
    dialog.replaceChildren(header, navigation, status, retry, reading);

    function selectEntry(entry) {
      selectedId = entry?.id || '';
      select.value = selectedId;
      reading.replaceChildren(...(entry ? [renderEntry(entry)] : []));
      reading.scrollTop = 0;
    }

    function setEntries(nextEntries, preferredId) {
      const previous = entries.find(entry => entry.id === selectedId);
      const optionsChanged = nextEntries.length !== entries.length || nextEntries.some((entry, index) => {
        const prior = entries[index];
        return entry.id !== prior.id || entry.title !== prior.title || questionLabel(entry) !== questionLabel(prior);
      });
      entries = nextEntries;
      if (optionsChanged) {
        select.replaceChildren(...entries.map(entry => {
          const option = node('option', '', `${questionLabel(entry)} · ${entry.title}`);
          option.value = entry.id;
          return option;
        }));
      }
      const next = entries.find(entry => entry.id === preferredId) || entries[0];
      if (next && previous && JSON.stringify(next) === JSON.stringify(previous)) {
        select.value = next.id;
      } else {
        selectEntry(next);
      }
      navigation.hidden = !entries.length;
    }

    async function reload(preferredId, opening) {
      const revision = ++generation;
      status.textContent = opening || !entries.length ? '해설서를 불러오는 중입니다.' : '';
      retry.hidden = true;
      try {
        const result = await loadEntries();
        if (revision !== generation || !dialog.open) return;
        if (!Array.isArray(result?.entries)) throw new Error('해설서를 읽을 수 없습니다.');
        setEntries(result.entries, opening ? preferredId : selectedId);
        status.textContent = entries.length ? '' : '열람할 수 있는 해설이 아직 없습니다.';
      } catch (error) {
        if (revision !== generation || !dialog.open) return;
        if (error.status === 401 || error.status === 403 || error.status === 404) {
          setEntries([], '');
        }
        status.textContent = '해설서를 불러오지 못했습니다. 연결 상태를 확인하고 다시 시도해 주세요.';
        retry.hidden = false;
      }
    }

    function close() {
      if (dialog.open) dialog.close();
      generation += 1;
      setEntries([], '');
      retry.hidden = true;
      status.textContent = '';
    }

    select.addEventListener('change', () => selectEntry(entries.find(entry => entry.id === select.value)));
    closeButton.addEventListener('click', close);
    dialog.addEventListener('close', () => {
      if (!dialog.open) close();
    });
    retry.addEventListener('click', () => reload(selectedId, false));
    close();

    return {
      open(questionId) {
        if (!dialog.open) dialog.showModal();
        return reload(questionId, true);
      },
      close,
      refresh(excludedId) {
        if (!dialog.open) return;
        if (excludedId && entries.some(entry => entry.id === excludedId)) {
          setEntries(entries.filter(entry => entry.id !== excludedId), selectedId);
        }
        return reload(selectedId, false);
      },
    };
  };
})();
