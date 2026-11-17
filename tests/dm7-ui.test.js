import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const html = readFileSync(new URL('../src/index.html', import.meta.url), 'utf8');
const app = readFileSync(new URL('../src/ui/app.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/ui/dm7.css', import.meta.url), 'utf8');
test('o aplicativo carrega o tema de console DM7-inspired', () => {
  assert.match(html, /ui\/dm7\.css/);
  assert.match(css, /\.dm7-selected-overview/);
  assert.match(css, /\.dm7-overview-grid/);
});
test('Selected Channel e Overview possuem ações reais no simulador', () => {
  assert.match(app, /case 'mixer-view'/);
  assert.match(app, /case 'select-inline'/);
  assert.match(app, /data-action="mixer-view"/);
  assert.match(app, /data-action="select-inline"/);
});
test('medidores sintéticos funcionam na ponte e no overview', () => {
  assert.match(app, /data-meter-id/);
  assert.match(app, /closest\('\.overview-meter'\)/);
});
test('interface continua explicitamente simulada e segura', () => {
  assert.match(app, /NO HARDWARE CONNECTION/);
  assert.match(app, /HARDWARE DISCONNECTED/);
  assert.doesNotMatch(app, /new WebSocket\(/);
});
