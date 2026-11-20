function element(tag, className, text) {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function renderLectureSlide(container, page, pageIndex, totalPages) {
  const article = element('article', 'lecture-slide');
  const header = element('header', 'lecture-slide-header');
  const heading = element('div', 'lecture-slide-heading');
  const title = element('h2', 'lecture-title', page.title);
  title.id = `${container.id || 'lecture-slide'}-title`;
  article.setAttribute('aria-labelledby', title.id);
  heading.append(element('p', 'lecture-chapter', page.chapter), title);

  const progress = element('p', 'lecture-progress', `${pageIndex + 1} / ${totalPages}쪽`);
  header.append(heading, progress);

  const content = element('div', 'lecture-slide-content');
  const points = element('ul', 'lecture-points');
  points.dataset.count = String(page.points.length);
  for (const { title: pointTitle, detail } of page.points) {
    const point = element('li', 'lecture-point');
    point.append(element('h3', 'lecture-point-title', pointTitle), element('p', 'lecture-point-detail', detail));
    points.append(point);
  }
  content.append(element('p', 'lecture-lead', page.lead), points);
  article.append(header, content);

  if (page.takeaway) {
    const takeaway = element('footer', 'lecture-takeaway');
    takeaway.append(element('strong', 'lecture-takeaway-label', '핵심 정리'), element('p', 'lecture-takeaway-text', page.takeaway));
    article.append(takeaway);
  }

  container.replaceChildren(article);
}
