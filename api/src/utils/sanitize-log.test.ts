import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeForLog } from './sanitize-log';

test('redacts top-level sensitive keys', () => {
  const out = sanitizeForLog({ username: 'u', password: 'secret' }) as Record<string, unknown>;
  assert.equal(out.password, '[REDACTED]');
  assert.equal(out.username, 'u');
});

test('matches sensitive keys case-insensitively and by substring', () => {
  const out = sanitizeForLog({
    Password: 'x',
    refresh_token: 'y',
    accessToken: 'z',
    Authorization: 'Bearer abc',
  }) as Record<string, unknown>;
  assert.equal(out.Password, '[REDACTED]');
  assert.equal(out.refresh_token, '[REDACTED]');
  assert.equal(out.accessToken, '[REDACTED]');
  assert.equal(out.Authorization, '[REDACTED]');
});

test('recurses into nested objects and arrays', () => {
  const out = sanitizeForLog({
    body: { user: { password: 'p', name: 'n' } },
    list: [{ token: 't' }],
  }) as Record<string, unknown>;
  const body = out.body as { user: Record<string, unknown> };
  assert.equal(body.user.password, '[REDACTED]');
  assert.equal(body.user.name, 'n');
  const list = out.list as Array<Record<string, unknown>>;
  assert.equal(list[0].token, '[REDACTED]');
});

test('leaves non-sensitive data untouched', () => {
  const out = sanitizeForLog({ count: 3, ok: true, items: ['a', 'b'] }) as Record<string, unknown>;
  assert.equal(out.count, 3);
  assert.equal(out.ok, true);
  assert.deepEqual(out.items, ['a', 'b']);
});

test('handles primitives, null and undefined without throwing', () => {
  assert.equal(sanitizeForLog(null), null);
  assert.equal(sanitizeForLog(undefined), undefined);
  assert.equal(sanitizeForLog('plain'), 'plain');
  assert.equal(sanitizeForLog(42), 42);
});

test('does not mutate the original object', () => {
  const input = { password: 'secret' };
  sanitizeForLog(input);
  assert.equal(input.password, 'secret');
});
