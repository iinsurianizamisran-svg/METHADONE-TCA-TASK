import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldStartEntered } from './entrySession';

test('shouldStartEntered defaults to false when no autostart and no stored session', () => {
  assert.equal(shouldStartEntered('', null), false);
  assert.equal(shouldStartEntered('?tab=dashboard', 'false'), false);
});

test('shouldStartEntered returns true when autostart=1 query param is present', () => {
  assert.equal(shouldStartEntered('?autostart=1', null), true);
  assert.equal(shouldStartEntered('?foo=bar&autostart=1', 'false'), true);
});

test('shouldStartEntered returns true when session flag is stored as true', () => {
  assert.equal(shouldStartEntered('', 'true'), true);
});
