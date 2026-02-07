import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ColorManager } from './colorManager';
import type { CodexNode } from './codexModel';

function makeNode(overrides: Partial<CodexNode> = {}): CodexNode {
  return {
    id: 'test-1', type: 'chapter', name: 'Test', proseField: 'body',
    proseValue: '', availableFields: ['body'], path: ['children', 0],
    children: [], hasAttributes: false, hasContentSections: false, hasImages: false,
    ...overrides,
  };
}

describe('getNodeColor', () => {
  let cm: ColorManager;
  beforeEach(() => { cm = new ColorManager(); });

  it('returns valid hex color string', () => {
    const node = makeNode({ attributes: [{ key: 'color', value: '#EF4444' }], hasAttributes: true });
    expect(cm.getNodeColor(node)).toBe('#EF4444');
  });

  it('returns null for non-string value (number)', () => {
    const node = makeNode({ attributes: [{ key: 'color', value: 42 }], hasAttributes: true });
    expect(cm.getNodeColor(node)).toBeNull();
  });

  it('returns null for non-string value (boolean)', () => {
    const node = makeNode({ attributes: [{ key: 'color', value: true }], hasAttributes: true });
    expect(cm.getNodeColor(node)).toBeNull();
  });

  it('returns null for invalid hex (missing hash)', () => {
    const node = makeNode({ attributes: [{ key: 'color', value: 'EF4444' }], hasAttributes: true });
    expect(cm.getNodeColor(node)).toBeNull();
  });

  it('returns null for invalid hex (named color)', () => {
    const node = makeNode({ attributes: [{ key: 'color', value: 'red' }], hasAttributes: true });
    expect(cm.getNodeColor(node)).toBeNull();
  });

  it('returns null when no attributes', () => {
    expect(cm.getNodeColor(makeNode())).toBeNull();
  });

  it('returns null when no color attribute', () => {
    const node = makeNode({ attributes: [{ key: 'genre', value: 'Fantasy' }], hasAttributes: true });
    expect(cm.getNodeColor(node)).toBeNull();
  });
});
