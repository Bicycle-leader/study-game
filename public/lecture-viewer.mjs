import { lecturePages } from './lecture-content.mjs';
import { renderLectureSlide } from './lecture-renderer.mjs';

const connection = document.getElementById('lecture-connection');
const notice = document.getElementById('lecture-notice');
const noticeText = document.getElementById('lecture-notice-text');
const retryButton = document.getElementById('lecture-retry');
const slide = document.getElementById('lecture-viewer-slide');
const announcement = document.getElementById('lecture-announcement');
const code = new URLSearchParams(window.location.search).get('code')?.trim().toUpperCase();
const pollInterval = 1500;
let shownPage = -1;
let timer;
let syncing = false;
let expired = false;

function setConnection(status, label) {
  connection.dataset.status = status;
  if (connection.textContent !== label) connection.textContent = label;
}

function showNotice(message, retry = false) {
  noticeText.textContent = message;
  retryButton.hidden = !retry;
  notice.hidden = false;
}

async function syncLecture() {
  if (expired || syncing || document.hidden) return;
  clearTimeout(timer);
  syncing = true;
  retryButton.disabled = true;
  const controller = new AbortController();
  const requestTimeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(`/api/lecture?${new URLSearchParams({ code })}`, {
      cache: 'no-store',
      signal: controller.signal,
    });
    if (response.status === 404) {
      expired = true;
      slide.hidden = true;
      setConnection('offline', '링크 만료');
      showNotice('강의 링크를 사용할 수 없습니다. 강사가 공유한 새 링크를 열어 주세요.');
      return;
    }
    if (!response.ok) throw new Error('Unable to read lecture state');
    const { pageIndex, roomCode } = await response.json();
    if (roomCode !== code || !Number.isInteger(pageIndex) || !lecturePages[pageIndex]) {
      throw new Error('Invalid lecture state');
    }
    if (shownPage !== pageIndex) {
      const page = lecturePages[pageIndex];
      renderLectureSlide(slide, page, pageIndex, lecturePages.length);
      slide.hidden = false;
      if (shownPage >= 0) window.scrollTo(0, 0);
      shownPage = pageIndex;
      announcement.textContent = `${pageIndex + 1}쪽, ${page.title}`;
    }
    notice.hidden = true;
    setConnection('connected', '강의 연결됨');
  } catch {
    setConnection('offline', '다시 연결 중');
    showNotice('강의 연결을 다시 시도하고 있습니다.', true);
  } finally {
    clearTimeout(requestTimeout);
    syncing = false;
    retryButton.disabled = false;
    if (!expired && !document.hidden) timer = setTimeout(syncLecture, pollInterval);
  }
}

if (code) {
  retryButton.addEventListener('click', syncLecture);
  document.addEventListener('visibilitychange', syncLecture);
  window.addEventListener('pageshow', syncLecture);
  window.addEventListener('online', syncLecture);
  syncLecture();
} else {
  setConnection('offline', '링크 확인');
  showNotice('강사가 공유한 강의 보기 링크를 열어 주세요.');
}
