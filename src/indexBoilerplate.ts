/**
 * Index Boilerplate Generator
 * 
 * Creates default index.codex.yaml files with sensible defaults
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import YAML from 'yaml';

export interface BoilerplateOptions {
  projectName: string;
  emoji: string;
  author?: string;
  patterns?: { include: string[]; exclude: string[] };
  typeStyles?: Array<{ type: string; emoji: string; color: string }>;
}

/**
 * Create a boilerplate index.codex.yaml file
 */
export async function createBoilerplateIndex(
  workspaceRoot: string,
  options?: Partial<BoilerplateOptions>
): Promise<string> {
  // Detect project details
  const projectName = options?.projectName || path.basename(workspaceRoot);
  const emoji = options?.emoji || detectProjectEmoji(projectName);
  const author = options?.author || await detectAuthor(workspaceRoot);

  // Build boilerplate data
  const boilerplate = buildBoilerplate({
    projectName,
    emoji,
    author: author || undefined,
    patterns: options?.patterns,
    typeStyles: options?.typeStyles,
  });

  // Write index.codex.yaml
  const indexPath = path.join(workspaceRoot, 'index.codex.yaml');
  fs.writeFileSync(indexPath, YAML.stringify(boilerplate), 'utf-8');

  return indexPath;
}

/**
 * Build boilerplate index data structure
 */
function buildBoilerplate(options: BoilerplateOptions): any {
  return {
    metadata: {
      formatVersion: '2.1',
      documentVersion: '1.0.0',
      created: new Date().toISOString(),
      author: options.author || '',
    },
    id: 'index-root',
    type: 'index',
    name: options.projectName,
    title: '',
    summary: '',
    attributes: [
      { key: 'emoji', value: options.emoji },
      { key: 'color', value: '#10B981' },
    ],
    patterns: options.patterns || getDefaultPatterns(),
    typeStyles: options.typeStyles || getDefaultTypeStyles(),
    status: 'private',
    children: [],
  };
}

/**
 * Detect appropriate emoji based on project name
 */
function detectProjectEmoji(projectName: string): string {
  const nameLower = projectName.toLowerCase();
  const keywords: Array<[string, string]> = [
    ['character', '👤'],
    ['book', '📖'],
    ['story', '📝'],
    ['novel', '✍️'],
    ['codex', '📚'],
    ['world', '🌍'],
    ['magic', '✨'],
    ['fantasy', '🐉'],
    ['sci-fi', '🚀'],
    ['script', '🎬'],
    ['guide', '📋'],
  ];

  for (const [keyword, emoji] of keywords) {
    if (nameLower.includes(keyword)) {
      return emoji;
    }
  }

  return '📚';
}

/**
 * Try to detect author from git config
 */
async function detectAuthor(workspaceRoot: string): Promise<string | null> {
  try {
    const { execSync } = require('child_process');
    const authorName = execSync('git config user.name', {
      cwd: workspaceRoot,
      encoding: 'utf-8',
    }).trim();
    return authorName;
  } catch {
    return null;
  }
}

/**
 * Get default include/exclude patterns
 */
function getDefaultPatterns() {
  return {
    include: ['*.codex.yaml', '*.codex.json', '*.md'],
    exclude: [
      '**/node_modules/**',
      '**/.git/**',
      '**/__pycache__/**',
      '**/venv/**',
      '**/.venv/**',
      '**/dist/**',
      '**/build/**',
      '**/.DS_Store',
      '**/._*',
      '**/.*',
      '**/*.jpg',
      '**/*.jpeg',
      '**/*.png',
      '**/*.gif',
      '**/*.webp',
      '**/*.svg',
      '**/index.codex.yaml',
      '**/.index.codex.json',
    ],
  };
}

/**
 * Get default type styles
 */
function getDefaultTypeStyles() {
  return [
    { type: 'character', emoji: '👤', color: '#8B5CF6' },
    { type: 'location', emoji: '🌍', color: '#10B981' },
    { type: 'chapter', emoji: '📖', color: '#3B82F6' },
    { type: 'scene', emoji: '🎬', color: '#F59E0B' },
    { type: 'act', emoji: '🎭', color: '#EC4899' },
    { type: 'folder', emoji: '📁', color: '#6B7280' },
    { type: 'codex', emoji: '📚', color: '#10B981' },
    { type: 'markdown', emoji: '📝', color: '#6B7280' },
    { type: 'index', emoji: '📋', color: '#4F46E5' },
    { type: 'faction', emoji: '🏛️', color: '#6366F1' },
    { type: 'item', emoji: '📦', color: '#F97316' },
    { type: 'event', emoji: '📅', color: '#EF4444' },
    { type: 'concept', emoji: '💡', color: '#FBBF24' },
  ];
}

/**
 * Command handler: Create Index File
 */
export async function runCreateIndexFile(): Promise<void> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    vscode.window.showErrorMessage('No workspace folder open');
    return;
  }

  const workspaceRoot = workspaceFolders[0].uri.fsPath;
  const indexPath = path.join(workspaceRoot, 'index.codex.yaml');

  // Check if index already exists
  if (fs.existsSync(indexPath)) {
    const overwrite = await vscode.window.showWarningMessage(
      'index.codex.yaml already exists. Overwrite?',
      'Overwrite',
      'Cancel'
    );

    if (overwrite !== 'Overwrite') {
      return;
    }
  }

  // Create boilerplate
  try {
    await createBoilerplateIndex(workspaceRoot);

    // Open the file
    const doc = await vscode.workspace.openTextDocument(indexPath);
    await vscode.window.showTextDocument(doc);

    vscode.window.showInformationMessage(
      '✅ Created index.codex.yaml with sensible defaults. Customize and run "Generate Index" to scan your project.'
    );
  } catch (error) {
    vscode.window.showErrorMessage(
      `Failed to create index file: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
