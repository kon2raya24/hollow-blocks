// Every module parses: the browser-only ones (the 3D view, the page) aren't imported by other tests,
// and a syntax error there would quietly drop the game to its 2D fallback.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

test('every source module parses', () => {
  const dir = new URL('../src/', import.meta.url);
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.mjs'))) {
    try { execFileSync(process.execPath, ['--check', new URL(f, dir).pathname], { stdio: 'pipe' }); } catch (e) { assert.fail(`${f}: ${String(e.stderr).split('\n').slice(0, 5).join(' ')}`); }
  }
});
