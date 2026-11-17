import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CURSOR_INT,
  CURSOR_TIMESTAMP,
  CURSOR_UUID,
  MAX_PAGE_SIZE,
  decodeCursor,
  encodeCursor,
  keysetPage,
  parsePageNumber,
  parsePageSize,
} from './keyset';

const TS = '2026-11-16T18:38:05.123456+00:00';
const ID = '7807c97f-72a6-4bf5-86ac-71052c8b4d10';
const BET = [CURSOR_TIMESTAMP, CURSOR_INT, CURSOR_UUID];
// AppError fija su propio prototipo: se valida por statusCode, no por instanceof.
const INVALID = { statusCode: 400, message: 'Cursor inválido' };

test('round-trips the parts, keeping microseconds in the timestamp', () => {
  const cursor = encodeCursor([TS, 3, ID]);
  assert.deepEqual(decodeCursor(cursor, BET), [TS, '3', ID]);
});

test('the cursor is opaque and URL-safe', () => {
  const cursor = encodeCursor([TS, 3, ID]);
  assert.match(cursor, /^[A-Za-z0-9_-]+$/);
});

test('accepts the timestamp formats PostgREST returns', () => {
  for (const ts of [
    '2026-11-16T18:38:05+00:00',
    '2026-11-16T18:38:05.1+00:00',
    '2026-11-16T18:38:05Z',
  ]) {
    assert.deepEqual(decodeCursor(encodeCursor([ts, ID]), [CURSOR_TIMESTAMP, CURSOR_UUID]), [
      ts,
      ID,
    ]);
  }
});

test('rejects a cursor with the wrong number of parts', () => {
  assert.throws(() => decodeCursor(encodeCursor([TS, ID]), BET), INVALID);
  assert.throws(() => decodeCursor(encodeCursor([TS, 3, ID, 'x']), BET), INVALID);
});

test('rejects parts that could inject PostgREST filter syntax', () => {
  for (const evil of [
    [`${TS},deleted_at.not.is.null`, 3, ID],
    [TS, '3)', ID],
    [TS, 3, `${ID},or(winner.eq.true)`],
    [TS, -1, ID],
  ]) {
    assert.throws(() => decodeCursor(encodeCursor(evil), BET), INVALID);
  }
});

test('keysetPage drops the extra row and points the cursor at the last returned row', () => {
  const rows = [1, 2, 3].map((n) => ({ ts: TS, order: n, id: ID }));
  const page = keysetPage(rows, 2, (r) => [r.ts, r.order, r.id]);
  assert.equal(page.hasMore, true);
  assert.deepEqual(
    page.data.map((r) => r.order),
    [1, 2]
  );
  assert.deepEqual(decodeCursor(page.next_cursor!, BET), [TS, '2', ID]);
});

test('keysetPage without the extra row is the last page', () => {
  const rows = [1, 2].map((n) => ({ ts: TS, order: n, id: ID }));
  assert.deepEqual(
    keysetPage(rows, 2, (r) => [r.ts, r.order, r.id]),
    {
      data: rows,
      hasMore: false,
      next_cursor: null,
    }
  );
  assert.deepEqual(
    keysetPage([], 2, () => []),
    { data: [], hasMore: false, next_cursor: null }
  );
});

test('parsePageSize clamps to MAX_PAGE_SIZE and falls back on invalid input', () => {
  assert.equal(parsePageSize('50', 100), 50);
  assert.equal(parsePageSize('100000', 100), MAX_PAGE_SIZE);
  assert.equal(parsePageSize('0', 100), 100);
  assert.equal(parsePageSize('abc', 100), 100);
  assert.equal(parsePageSize(undefined, 100), 100);
  assert.equal(parsePageSize(['5'], 100), 100);
});

test('parsePageNumber guards NaN and non-positive pages', () => {
  assert.equal(parsePageNumber('3'), 3);
  assert.equal(parsePageNumber('abc'), 1);
  assert.equal(parsePageNumber('-2'), 1);
  assert.equal(parsePageNumber(undefined), 1);
});

test('rejects garbage that is not base64url of a valid cursor', () => {
  assert.throws(() => decodeCursor('not-a-cursor', BET), INVALID);
  assert.throws(() => decodeCursor('', BET), INVALID);
});
