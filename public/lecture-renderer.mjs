function element(tag, className, text) {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function renderLectureSlide(container, page, pageIndex, totalPages) {
  const layout = page.layout || 'concepts';
  const article = element('article', page.image ? 'lecture-slide lecture-image-slide' : 'lecture-slide');
  const header = element('header', 'lecture-slide-header');
  const heading = element('div', 'lecture-slide-heading');
  const title = element('h2', 'lecture-title', page.title);
  title.id = `${container.id || 'lecture-slide'}-title`;
  article.setAttribute('aria-labelledby', title.id);
  const location = element('p', 'lecture-chapter', page.chapter);
  if (page.label) location.append(element('span', 'lecture-topic-label', page.label));
  heading.append(location, title);

  const progress = element('p', 'lecture-progress');
  progress.append(element('strong', 'lecture-current-page', String(pageIndex + 1)), ` / ${totalPages}쪽`);
  header.append(heading, progress);
  article.append(header);

  if (page.image) {
    const { src, webpSrc, alt, width, height } = page.image;
    const figure = element('figure', 'lecture-image-frame');
    const picture = element('picture', 'lecture-image-picture');
    const image = element('img', 'lecture-image');
    image.alt = alt || page.title;
    if (width && height) {
      image.width = width;
      image.height = height;
    }
    if (webpSrc) {
      const source = document.createElement('source');
      source.type = 'image/webp';
      source.srcset = webpSrc;
      picture.append(source);
      image.addEventListener('error', () => source.remove(), { once: true });
    }
    picture.append(image);
    image.src = src;
    const enlarge = element('a', 'lecture-image-enlarge', '이미지 크게 보기');
    enlarge.href = src;
    enlarge.target = '_blank';
    enlarge.rel = 'noopener noreferrer';
    figure.append(picture, enlarge);
    article.append(figure);
    container.replaceChildren(article);
    return;
  }

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
  article.append(content);

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
