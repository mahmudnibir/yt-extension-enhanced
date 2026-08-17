const assert = require('node:assert/strict');
const { findRelativeBookmarkIndex, sortBookmarks } = require('../src/bookmark-utils.js');

const bookmarks = sortBookmarks([
  { time: 10, label: 'start' },
  { time: 45, label: 'mid' },
  { time: 90, label: 'end' }
]);

assert.equal(findRelativeBookmarkIndex(bookmarks, 30, 'next'), 1, 'next should move to the first bookmark after the current time');
assert.equal(findRelativeBookmarkIndex(bookmarks, 30, 'prev'), 0, 'prev should move to the last bookmark before the current time');
assert.equal(findRelativeBookmarkIndex(bookmarks, 90, 'next'), 2, 'next should stay on the final bookmark when already at the end');
assert.equal(findRelativeBookmarkIndex(bookmarks, 10, 'prev'), 0, 'prev should stay on the first bookmark when there is no earlier mark');
assert.equal(findRelativeBookmarkIndex(bookmarks, 45, 'next'), 2, 'next should skip forward from the current bookmark');

console.log('bookmark-utils regression tests passed');
