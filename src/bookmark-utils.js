function sortBookmarks(bookmarks) {
  return [...bookmarks].sort((a, b) => a.time - b.time);
}

function findBookmarkIndex(bookmarks, time) {
  const idx = bookmarks.findIndex((bm) => bm.time === time);
  return idx >= 0 ? idx : -1;
}

function findRelativeBookmarkIndex(bookmarks, currentTime, direction) {
  if (!Array.isArray(bookmarks) || bookmarks.length === 0) return -1;

  const safeBookmarks = sortBookmarks(bookmarks);
  const current = Number.isFinite(currentTime) ? currentTime : 0;
  const dir = direction === 'prev' ? 'prev' : 'next';

  if (dir === 'next') {
    const nextIndex = safeBookmarks.findIndex((bm) => bm.time > current);
    return nextIndex === -1 ? safeBookmarks.length - 1 : nextIndex;
  }

  const prevIndex = safeBookmarks.slice().reverse().findIndex((bm) => bm.time < current);
  return prevIndex === -1 ? 0 : safeBookmarks.length - 1 - prevIndex;
}

module.exports = {
  sortBookmarks,
  findBookmarkIndex,
  findRelativeBookmarkIndex,
};
