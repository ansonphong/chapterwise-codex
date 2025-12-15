/**
 * Index Parser
 * 
 * Parses and validates index.codex.yaml files
 */

import * as path from 'path';
import YAML from 'yaml';

/**
 * Index child node structure (matches backend format)
 */
export interface IndexChildNode {
  id: string;
  type: string;
  name: string; // Display name (read from file content or derived)
  title?: string; // Optional alternative title
  order?: number; // Sort order
  expanded?: boolean; // Default expansion state
  emoji?: string; // Custom emoji (overrides typeStyles)
  color?: string; // Custom color (overrides typeStyles)
  attributes?: Array<{ key: string; value: string }>;
  children?: IndexChildNode[]; // Nested children (folders only)

  // Auto-computed fields (added by generator/parser)
  _filename?: string; // Actual filename on disk (REQUIRED for files)
  _computed_path?: string; // Full path from repo root (REQUIRED, computed during parsing)
  _format?: string; // File format: 'yaml' | 'json' | 'markdown'
  _type_emoji?: string; // Emoji from typeStyles (auto-applied)
  _type_color?: string; // Color from typeStyles (auto-applied)
  _default_status?: string; // Default status if not explicitly set

  // For tree navigation (runtime only)
  parent?: IndexChildNode; // Parent node reference (not serialized)
}

/**
 * Type style definition
 */
export interface TypeStyle {
  type: string;
  emoji?: string;
  color?: string;
}

/**
 * Index document structure (V2.1)
 */
export interface IndexDocument {
  metadata: {
    formatVersion: string;
    documentVersion?: string;
    created?: string;
    generated?: boolean;
    author?: string | string[];
  };
  id: string;
  type: 'index';
  name: string;
  title?: string;
  summary?: string;
  attributes?: Array<{ key: string; value: string }>;
  patterns?: {
    include?: string[];
    exclude?: string[];
  };
  typeStyles?: TypeStyle[];
  status?: 'published' | 'private' | 'draft';
  children: IndexChildNode[];
}

/**
 * Parse index.codex.yaml file
 */
export function parseIndexFile(content: string): IndexDocument | null {
  try {
    const data = YAML.parse(content);

    // Validate basic structure
    if (!data || typeof data !== 'object') {
      return null;
    }

    if (data.type !== 'index') {
      return null;
    }

    // Apply type styles to children
    if (data.typeStyles && data.children) {
      applyTypeStyles(data.children, data.typeStyles);
    }

    // Trust that generator already set correct _computed_path values
    // No need to compute paths - generator does this correctly

    // Apply default status
    if (data.children) {
      applyDefaultStatus(data.children);
    }

    return data as IndexDocument;
  } catch (error) {
    console.error('[IndexParser] Failed to parse index file:', error);
    return null;
  }
}

/**
 * Apply type styles to children recursively
 */
function applyTypeStyles(children: IndexChildNode[], typeStyles: TypeStyle[]): void {
  // Build lookup map
  const styleMap = new Map<string, TypeStyle>();
  for (const style of typeStyles) {
    styleMap.set(style.type, style);
  }

  function apply(nodes: IndexChildNode[]): void {
    for (const node of nodes) {
      const style = styleMap.get(node.type);
      if (style) {
        if (!node.emoji && style.emoji) {
          node._type_emoji = style.emoji;
        }
        if (!node.color && style.color) {
          node._type_color = style.color;
        }
      }

      if (node.children) {
        apply(node.children);
      }
    }
  }

  apply(children);
}

/**
 * Apply default status to children without explicit status
 */
function applyDefaultStatus(children: IndexChildNode[]): void {
  for (const child of children) {
    if (!child._default_status) {
      child._default_status = 'private';
    }

    if (child.children) {
      applyDefaultStatus(child.children);
    }
  }
}

/**
 * Check if file is an index file
 */
export function isIndexFile(fileName: string): boolean {
  const base = path.basename(fileName);
  return (
    base === 'index.codex.yaml' ||
    base === '.index.codex.yaml' ||
    base === 'index.codex.json' ||
    base === '.index.codex.json'
  );
}

/**
 * Get effective emoji for a node (explicit or from type style)
 */
export function getEffectiveEmoji(node: IndexChildNode): string | undefined {
  // Check explicit attributes first
  if (node.attributes) {
    const emojiAttr = node.attributes.find((a) => a.key === 'emoji');
    if (emojiAttr) {
      return emojiAttr.value;
    }
  }

  // Then check direct emoji field
  if (node.emoji) {
    return node.emoji;
  }

  // Finally check type style emoji
  return node._type_emoji;
}

/**
 * Get effective color for a node (explicit or from type style)
 */
export function getEffectiveColor(node: IndexChildNode): string | undefined {
  // Check explicit attributes first
  if (node.attributes) {
    const colorAttr = node.attributes.find((a) => a.key === 'color');
    if (colorAttr) {
      return colorAttr.value;
    }
  }

  // Then check direct color field
  if (node.color) {
    return node.color;
  }

  // Finally check type style color
  return node._type_color;
}

/**
 * Count files in children tree
 */
export function countFilesInIndex(children: IndexChildNode[]): number {
  let count = 0;
  for (const child of children) {
    if (child.type !== 'folder') {
      count++;
    }
    if (child.children) {
      count += countFilesInIndex(child.children);
    }
  }
  return count;
}
