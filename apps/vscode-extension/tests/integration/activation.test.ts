import * as assert from 'node:assert/strict';
import * as vscode from 'vscode';

suite('IconCollection activation', () => {
  test('activates on demand', async () => {
    const ext = vscode.extensions.getExtension('kage1020.icon-collection');
    assert.ok(ext, 'extension present');
    await ext.activate();
    assert.ok(ext.isActive, 'extension active');
  });
});
