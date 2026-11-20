function element(tag, className, text) {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function renderLectureSlide(container, page, pageIndex, totalPages) {
  const layout = page.layout || 'concepts';
  const article = element('article', 'lecture-slide');
  const header = element('header', 'lecture-slide-header');
  const heading = element('div', 'lecture-slide-heading');
  const title = element('h2', 'lecture-title', page.title);
  title.id = `${container.id || 'lecture-slide'}-title`;
  article.setAttribute('aria-labelledby', title.id);
  const location = element('p', 'lecture-chapter', page.chapter);
  if (page.label) location.append(element('span', 'lecture-topic-label', page.label));
  heading.append(location, title);

  const progress = element('p', 'lecture-progress', `${pageIndex + 1} / ${totalPages}쪽`);
  header.append(heading, progress);

  const content = element('div', 'lecture-slide-content');
  const points = element(layout === 'flow' ? 'ol' : 'ul', 'lecture-points');
  points.setAttribute('role', 'list');
  points.dataset.count = String(page.points.length);
  points.dataset.layout = layout;
  for (const [index, { title: pointTitle, detail }] of page.points.entries()) {
    const point = element('li', 'lecture-point');
    const pointHeading = element('h3', 'lecture-point-title');
    if (layout === 'flow') {
      const step = element('span', 'lecture-step', String(index + 1));
      step.setAttribute('aria-hidden', 'true');
      pointHeading.append(step);
    }
    pointHeading.append(document.createTextNode(pointTitle));
    point.append(pointHeading, element('p', 'lecture-point-detail', detail));
    points.append(point);
  }
  content.append(element('p', 'lecture-lead', page.lead), points);
  article.append(header, content);

  if (page.takeaway || page.reference) {
    const footer = element('footer', 'lecture-slide-footer');
    if (page.takeaway) {
      const takeaway = element('div', 'lecture-takeaway');
      takeaway.append(element('strong', 'lecture-takeaway-label', '핵심 정리'), element('p', 'lecture-takeaway-text', page.takeaway));
      footer.append(takeaway);
    }
    if (page.reference) footer.append(element('p', 'lecture-reference', page.reference));
    article.append(footer);
  }

  container.replaceChildren(article);
}
