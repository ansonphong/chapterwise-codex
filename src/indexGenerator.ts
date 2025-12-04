/**
 * Index Generator - Auto-generate index.codex.yaml files
 * 
 * Scans workspace folders and generates V2.1 format index files
 * with gitignore-like pattern matching, typeStyles, and status support.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as YAML from 'yaml';
import { minimatch } from 'minimatch';
import { generateUuid } from './codexModel';

/**
 * Default include patterns for index generation
 */
const DEFAULT_INCLUDE_PATTERNS = [
  '*.codex.yaml',
  '*.codex.json',
  '*.md',
];

/**
 * Default exclude patterns for index generation
 */
const DEFAULT_EXCLUDE_PATTERNS = [
  '**/node_modules/**',
  '**/.git/**',
  '**/__pycache__/**',
  '**/venv/**',
  '**/.venv/**',
  '**/dist/**',
  '**/build/**',
  '**/.DS_Store',
  '**/._*',
  '**/.*',           // Hidden files
  '**/*.jpg',        // Images excluded by default
  '**/*.jpeg',
  '**/*.png',
  '**/*.gif',
  '**/*.webp',
  '**/*.svg',
  '**/*.ico',
  '**/index.codex.yaml',      // Don't include the index itself
  '**/.index.codex.yaml',
];

/**
 * Default type styles for common entity types
 */
const DEFAULT_TYPE_STYLES: TypeStyle[] = [
  { type: 'character', emoji: '👤', color: '#8B5CF6' },
  { type: 'location', emoji: '🌍', color: '#10B981' },
  { type: 'chapter', emoji: '📖', color: '#3B82F6' },
  { type: 'scene', emoji: '🎬', color: '#F59E0B' },
  { type: 'act', emoji: '🎭', color: '#EC4899' },
  { type: 'folder', emoji: '📁', color: '#6B7280' },
  { type: 'codex', emoji: '📚', color: '#10B981' },
  { type: 'markdown', emoji: '📝', color: '#6B7280' },
  { type: 'index', emoji: '📋', color: '#4F46E5' },
];

/**
 * File type detection mapping
 */
const FILE_TYPE_MAP: Record<string, string> = {
  '.codex.yaml': 'codex',
  '.codex.json': 'codex',
  '.codex': 'codex',
  '.md': 'markdown',
  '.txt': 'text',
  '.json': 'json',
  '.yaml': 'yaml',
  '.yml': 'yaml',
};

/**
 * Type style definition
 */
interface TypeStyle {
  type: string;
  emoji: string;
  color?: string;
}

/**
 * Gallery image definition
 */
interface GalleryImage {
  path?: string;
  url?: string;
  caption?: string;
}

/**
 * Index patterns configuration
 */
interface IndexPatterns {
  include: string[];
  exclude: string[];
}

/**
 * Gallery configuration
 */
interface IndexGallery {
  coverImage?: string;
  images?: GalleryImage[];
}

/**
 * Index child node
 */
interface IndexChild {
  id: string;
  type: string;
  name: string;
  title?: string;
  order: number;
  expanded?: boolean;
  emoji?: string;
  thumbnail?: string;
  status?: 'published' | 'private' | 'draft';
  featured?: boolean;
  featuredOrder?: number;
  children?: IndexChild[];
  // Internal tracking
  _isManual?: boolean;
}

/**
 * Complete index structure
 */
interface IndexData {
  metadata: {
    formatVersion: string;
    documentVersion: string;
    created: string;
    updated?: string;
    author?: string;
    generated?: boolean;
  };
  id: string;
  type: string;
  name: string;
  title?: string;
  summary?: string;
  attributes: Array<{ key: string; value: unknown }>;
  patterns: IndexPatterns;
  typeStyles: TypeStyle[];
  gallery?: IndexGallery;
  status: 'published' | 'private' | 'draft';
  children: IndexChild[];
}

/**
 * Options for index generation
 */
export interface GenerateIndexOptions {
  projectName?: string;
  patterns?: Partial<IndexPatterns>;
  typeStyles?: TypeStyle[];
  status?: 'published' | 'private' | 'draft';
  preserveManualEdits?: boolean;
}

/**
 * Index Generator class
 */
export class IndexGenerator {
  private typeCache: Map<string, string> = new Map();

  /**
   * Generate a new index.codex.yaml file
   */
  async generateIndex(
    basePath: string,
    options: GenerateIndexOptions = {}
  ): Promise<IndexData> {
    const projectName = options.projectName || path.basename(basePath);
    
    // Merge patterns with defaults
    const patterns: IndexPatterns = {
      include: options.patterns?.include || DEFAULT_INCLUDE_PATTERNS,
      exclude: options.patterns?.exclude || DEFAULT_EXCLUDE_PATTERNS,
    };

    // Merge type styles with defaults
    const typeStyles = options.typeStyles || DEFAULT_TYPE_STYLES;

    // Scan directory for files
    const files = await this.scanDirectory(basePath, patterns);

    // Build children tree
    const children = this.buildChildrenTree(files, basePath, typeStyles);

    // Detect emoji and color for project
    const projectEmoji = this.detectEmoji(projectName);
    const projectColor = '#10B981'; // Default emerald

    // Detect main file
    const mainFile = this.detectMainFile(basePath, files);

    // Build index structure
    const indexData: IndexData = {
      metadata: {
        formatVersion: '2.1',
        documentVersion: '1.0.0',
        created: new Date().toISOString(),
        generated: true,
      },
      id: 'index-root',
      type: 'index',
      name: projectName,
      summary: `Index for ${projectName}`,
      attributes: [
        { key: 'emoji', value: projectEmoji },
        { key: 'color', value: projectColor },
      ],
      patterns,
      typeStyles,
      status: options.status || 'private',
      children,
    };

    // Add mainFile attribute if found
    if (mainFile) {
      indexData.attributes.push({ key: 'mainFile', value: mainFile });
    }

    return indexData;
  }

  /**
   * Regenerate index while preserving manual edits
   */
  async regenerateIndex(
    basePath: string,
    existingIndex: IndexData
  ): Promise<IndexData> {
    // Extract patterns from existing index
    const patterns = existingIndex.patterns || {
      include: DEFAULT_INCLUDE_PATTERNS,
      exclude: DEFAULT_EXCLUDE_PATTERNS,
    };

    // Scan for current files
    const files = await this.scanDirectory(basePath, patterns);
    const typeStyles = existingIndex.typeStyles || DEFAULT_TYPE_STYLES;

    // Build new children tree
    const newChildren = this.buildChildrenTree(files, basePath, typeStyles);

    // Merge with existing, preserving manual edits
    const mergedChildren = this.mergeChildren(
      existingIndex.children || [],
      newChildren
    );

    // Update the index
    const updatedIndex: IndexData = {
      ...existingIndex,
      metadata: {
        ...existingIndex.metadata,
        updated: new Date().toISOString(),
      },
      children: mergedChildren,
    };

    return updatedIndex;
  }

  /**
   * Scan directory for files matching patterns
   */
  private async scanDirectory(
    basePath: string,
    patterns: IndexPatterns
  ): Promise<string[]> {
    const files: string[] = [];
    
    const scanRecursive = (dirPath: string) => {
      try {
        const entries = fs.readdirSync(dirPath, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dirPath, entry.name);
          const relativePath = path.relative(basePath, fullPath);

          // Check exclusions first
          if (this.matchesAnyPattern(relativePath, patterns.exclude)) {
            continue;
          }

          if (entry.isDirectory()) {
            scanRecursive(fullPath);
          } else if (entry.isFile()) {
            // Check if file matches include patterns
            if (this.matchesAnyPattern(relativePath, patterns.include)) {
              files.push(fullPath);
            }
          }
        }
      } catch (error) {
        console.error(`Error scanning ${dirPath}:`, error);
      }
    };

    scanRecursive(basePath);
    return files.sort();
  }

  /**
   * Check if path matches any of the patterns
   */
  private matchesAnyPattern(filePath: string, patterns: string[]): boolean {
    // Normalize path separators for cross-platform
    const normalizedPath = filePath.replace(/\\/g, '/');
    
    for (const pattern of patterns) {
      // Handle simple extension patterns like "*.md"
      if (pattern.startsWith('*.')) {
        const ext = pattern.slice(1); // Get ".md" from "*.md"
        if (normalizedPath.endsWith(ext)) {
          return true;
        }
        // Also check compound extensions like ".codex.yaml"
        if (ext.includes('.') && normalizedPath.endsWith(ext)) {
          return true;
        }
      }
      
      // Handle glob patterns
      if (minimatch(normalizedPath, pattern, { dot: true, matchBase: true })) {
        return true;
      }
    }
    return false;
  }

  /**
   * Build hierarchical children tree from flat file list
   */
  private buildChildrenTree(
    files: string[],
    basePath: string,
    typeStyles: TypeStyle[]
  ): IndexChild[] {
    // Organize files by directory
    const tree: Record<string, unknown> = {};

    for (const filePath of files) {
      const relativePath = path.relative(basePath, filePath);
      const parts = relativePath.split(path.sep);

      let current = tree;
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        
        if (i === parts.length - 1) {
          // It's a file
          if (!current._files) {
            current._files = [];
          }
          (current._files as Array<{ name: string; fullPath: string }>).push({
            name: part,
            fullPath: filePath,
          });
        } else {
          // It's a folder
          if (!current[part]) {
            current[part] = {};
          }
          current = current[part] as Record<string, unknown>;
        }
      }
    }

    return this.treeToChildren(tree, typeStyles);
  }

  /**
   * Convert tree structure to children array
   */
  private treeToChildren(
    tree: Record<string, unknown>,
    typeStyles: TypeStyle[],
    orderStart: number = 1
  ): IndexChild[] {
    const children: IndexChild[] = [];
    let order = orderStart;

    // Get type style helper
    const getTypeStyle = (type: string): TypeStyle | undefined => {
      return typeStyles.find(ts => ts.type === type);
    };

    // Process folders first (alphabetically)
    const folders = Object.keys(tree)
      .filter(k => k !== '_files')
      .sort();

    for (const folderName of folders) {
      const folderId = generateUuid();
      const folderStyle = getTypeStyle('folder');
      const folderChildren = this.treeToChildren(
        tree[folderName] as Record<string, unknown>,
        typeStyles,
        1
      );

      const folderNode: IndexChild = {
        id: folderId,
        type: 'folder',
        name: folderName,
        order: order,
        expanded: order <= 3, // Expand first 3 folders
        children: folderChildren,
      };

      // Apply type style emoji if defined
      if (folderStyle?.emoji) {
        folderNode.emoji = folderStyle.emoji;
      }

      children.push(folderNode);
      order++;
    }

    // Process files (alphabetically)
    const filesArray = (tree._files as Array<{ name: string; fullPath: string }>) || [];
    const sortedFiles = filesArray.sort((a, b) => a.name.localeCompare(b.name));

    for (const fileInfo of sortedFiles) {
      const fileId = generateUuid();
      const fileType = this.detectFileType(fileInfo.fullPath);
      const typeStyle = getTypeStyle(fileType);

      const fileNode: IndexChild = {
        id: fileId,
        type: fileType,
        name: fileInfo.name,
        order: order,
      };

      // Generate display title from filename
      const titleFromName = this.generateTitle(fileInfo.name);
      if (titleFromName !== fileInfo.name) {
        fileNode.title = titleFromName;
      }

      // Apply type style emoji if defined
      if (typeStyle?.emoji) {
        fileNode.emoji = typeStyle.emoji;
      }

      children.push(fileNode);
      order++;
    }

    return children;
  }

  /**
   * Merge new children with existing, preserving manual edits
   */
  private mergeChildren(
    existing: IndexChild[],
    newChildren: IndexChild[]
  ): IndexChild[] {
    const result: IndexChild[] = [];
    const existingByName = new Map<string, IndexChild>();

    // Index existing children by name
    for (const child of existing) {
      existingByName.set(child.name, child);
    }

    // Track which existing items were matched
    const matched = new Set<string>();

    // Process new children
    for (const newChild of newChildren) {
      const existingChild = existingByName.get(newChild.name);

      if (existingChild) {
        matched.add(newChild.name);

        // Merge: keep manual overrides from existing
        const merged: IndexChild = {
          ...newChild,
          id: existingChild.id, // Preserve ID
          // Preserve manual overrides if they exist
          ...(existingChild.title && { title: existingChild.title }),
          ...(existingChild.emoji && { emoji: existingChild.emoji }),
          ...(existingChild.thumbnail && { thumbnail: existingChild.thumbnail }),
          ...(existingChild.status && { status: existingChild.status }),
          ...(existingChild.featured !== undefined && { featured: existingChild.featured }),
          ...(existingChild.featuredOrder !== undefined && { featuredOrder: existingChild.featuredOrder }),
        };

        // Recursively merge children for folders
        if (newChild.children && existingChild.children) {
          merged.children = this.mergeChildren(existingChild.children, newChild.children);
        } else if (existingChild.children) {
          merged.children = existingChild.children;
        }

        result.push(merged);
      } else {
        // New file/folder - add it
        result.push(newChild);
      }
    }

    // Add manually added items that weren't matched (preserve them)
    for (const child of existing) {
      if (!matched.has(child.name) && child._isManual) {
        result.push(child);
      }
    }

    return result;
  }

  /**
   * Detect file type from path
   */
  private detectFileType(filePath: string): string {
    const fileName = path.basename(filePath).toLowerCase();

    // Check compound extensions first
    for (const [ext, type] of Object.entries(FILE_TYPE_MAP)) {
      if (fileName.endsWith(ext)) {
        // For codex files, try to read actual type from content
        if (type === 'codex') {
          const actualType = this.readActualType(filePath);
          if (actualType) {
            return actualType;
          }
        }
        return type;
      }
    }

    return 'unknown';
  }

  /**
   * Read actual type field from codex file
   */
  private readActualType(filePath: string): string | null {
    // Check cache
    if (this.typeCache.has(filePath)) {
      return this.typeCache.get(filePath) || null;
    }

    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      // Only parse first part for performance
      const lines = content.split('\n').slice(0, 50).join('\n');
      const data = YAML.parse(lines);

      if (data && typeof data === 'object' && typeof data.type === 'string') {
        this.typeCache.set(filePath, data.type);
        return data.type;
      }
    } catch {
      // Ignore parsing errors
    }

    this.typeCache.set(filePath, '');
    return null;
  }

  /**
   * Generate display title from filename
   */
  private generateTitle(filename: string): string {
    // Remove extensions
    let title = filename
      .replace(/\.codex\.(yaml|json)$/i, '')
      .replace(/\.codex$/i, '')
      .replace(/\.(md|txt|yaml|yml|json)$/i, '');

    // Replace hyphens/underscores with spaces
    title = title.replace(/[-_]/g, ' ');

    // Title case
    title = title
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');

    return title;
  }

  /**
   * Detect emoji based on project name
   */
  private detectEmoji(projectName: string): string {
    const nameLower = projectName.toLowerCase();

    const emojiPatterns: Record<string, string> = {
      codex: '📚',
      book: '📖',
      story: '📝',
      novel: '✍️',
      character: '👤',
      world: '🌍',
      universe: '🌌',
      magic: '✨',
      fantasy: '🐉',
      'sci-fi': '🚀',
      science: '🔬',
      tech: '💻',
      code: '💻',
      api: '⚙️',
      doc: '📄',
      guide: '📋',
      wiki: '📚',
      note: '📝',
      journal: '📔',
      chakra: '🧘',
      game: '🎮',
      music: '🎵',
      art: '🎨',
      film: '🎬',
      movie: '🎬',
    };

    for (const [pattern, emoji] of Object.entries(emojiPatterns)) {
      if (nameLower.includes(pattern)) {
        return emoji;
      }
    }

    return '📚';
  }

  /**
   * Detect main file (README, index, etc.)
   */
  private detectMainFile(basePath: string, files: string[]): string | null {
    const mainFileNames = [
      'README.md',
      'readme.md',
      'INDEX.md',
      'index.md',
      'INTRO.md',
      'intro.md',
    ];

    for (const file of files) {
      const fileName = path.basename(file);
      const dirPath = path.dirname(file);

      // Only consider root-level files
      if (dirPath === basePath && mainFileNames.includes(fileName)) {
        return fileName;
      }
    }

    return null;
  }

  /**
   * Save index to file
   */
  saveIndex(indexData: IndexData, outputPath: string): string {
    const filePath = path.join(outputPath, 'index.codex.yaml');

    // Convert to YAML with nice formatting
    const doc = new YAML.Document(indexData);

    // Set block style for long strings
    const setBlockStyle = (node: unknown): void => {
      if (YAML.isMap(node)) {
        for (const pair of node.items) {
          if (YAML.isScalar(pair.value) && typeof pair.value.value === 'string') {
            const str = pair.value.value;
            if (str.includes('\n') || str.length > 80) {
              pair.value.type = YAML.Scalar.BLOCK_LITERAL;
            }
          } else {
            setBlockStyle(pair.value);
          }
        }
      } else if (YAML.isSeq(node)) {
        for (const item of node.items) {
          setBlockStyle(item);
        }
      }
    };

    setBlockStyle(doc.contents);

    const yamlString = doc.toString({ lineWidth: 120 });
    fs.writeFileSync(filePath, yamlString, 'utf-8');

    return filePath;
  }

  /**
   * Load existing index file
   */
  loadIndex(indexPath: string): IndexData | null {
    try {
      const content = fs.readFileSync(indexPath, 'utf-8');
      return YAML.parse(content) as IndexData;
    } catch {
      return null;
    }
  }
}

// ============================================================================
// VS Code Command Handlers
// ============================================================================

let outputChannel: vscode.OutputChannel | undefined;

function getOutputChannel(): vscode.OutputChannel {
  if (!outputChannel) {
    outputChannel = vscode.window.createOutputChannel('ChapterWise Index Generator');
  }
  return outputChannel;
}

/**
 * Run the Generate Index command
 */
export async function runGenerateIndex(): Promise<void> {
  // Get workspace folder
  const workspaceFolders = vscode.workspace.workspaceFolders;

  if (!workspaceFolders || workspaceFolders.length === 0) {
    vscode.window.showErrorMessage('No workspace folder open. Open a folder first.');
    return;
  }

  // If multiple folders, let user pick
  let targetFolder: vscode.WorkspaceFolder;

  if (workspaceFolders.length === 1) {
    targetFolder = workspaceFolders[0];
  } else {
    const picked = await vscode.window.showQuickPick(
      workspaceFolders.map(f => ({
        label: f.name,
        description: f.uri.fsPath,
        folder: f,
      })),
      {
        title: 'Select Workspace Folder',
        placeHolder: 'Which folder should the index be generated for?',
      }
    );

    if (!picked) {
      return;
    }
    targetFolder = picked.folder;
  }

  const basePath = targetFolder.uri.fsPath;
  const indexPath = path.join(basePath, 'index.codex.yaml');

  // Check if index already exists
  if (fs.existsSync(indexPath)) {
    const action = await vscode.window.showWarningMessage(
      'index.codex.yaml already exists. What would you like to do?',
      { modal: true },
      'Regenerate (Preserve Edits)',
      'Overwrite (Fresh Start)',
      'Cancel'
    );

    if (!action || action === 'Cancel') {
      return;
    }

    if (action === 'Regenerate (Preserve Edits)') {
      await runRegenerateIndex(basePath);
      return;
    }
    // Otherwise continue with fresh generation
  }

  // Get project name
  const projectName = await vscode.window.showInputBox({
    title: 'Project Name',
    prompt: 'Enter the project name (used in index title)',
    value: targetFolder.name,
    validateInput: (value) => {
      if (!value.trim()) {
        return 'Project name cannot be empty';
      }
      return null;
    },
  });

  if (!projectName) {
    return;
  }

  // Default status (private by default - must explicitly publish)
  const statusChoice = await vscode.window.showQuickPick(
    [
      { label: '$(lock) Private', description: 'Only visible to owner (default)', value: 'private' as const },
      { label: '$(edit) Draft', description: 'Work in progress, owner only', value: 'draft' as const },
      { label: '$(globe) Published', description: 'Visible to everyone', value: 'published' as const },
    ],
    {
      title: 'Default Status',
      placeHolder: 'Set default status for all items (recommended: Private)',
    }
  );

  const status = statusChoice?.value || 'private';

  // Generate index
  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'Generating Index...',
      cancellable: false,
    },
    async (progress) => {
      progress.report({ message: 'Scanning files...' });

      const generator = new IndexGenerator();
      const indexData = await generator.generateIndex(basePath, {
        projectName,
        status,
      });

      progress.report({ message: 'Writing index file...' });

      const outputFile = generator.saveIndex(indexData, basePath);

      // Log results
      const channel = getOutputChannel();
      channel.appendLine(`\n${'='.repeat(60)}`);
      channel.appendLine(`Index Generated - ${new Date().toLocaleString()}`);
      channel.appendLine(`Project: ${projectName}`);
      channel.appendLine(`Output: ${outputFile}`);
      channel.appendLine(`Files indexed: ${countChildren(indexData.children)}`);
      channel.appendLine(`${'='.repeat(60)}\n`);

      // Show success
      const action = await vscode.window.showInformationMessage(
        `✅ Generated index.codex.yaml with ${countChildren(indexData.children)} items`,
        'Open Index',
        'Show Details'
      );

      if (action === 'Open Index') {
        const doc = await vscode.workspace.openTextDocument(outputFile);
        await vscode.window.showTextDocument(doc);
      } else if (action === 'Show Details') {
        channel.show();
      }
    }
  );
}

/**
 * Run the Regenerate Index command
 */
export async function runRegenerateIndex(basePath?: string): Promise<void> {
  // Get base path if not provided
  if (!basePath) {
    const workspaceFolders = vscode.workspace.workspaceFolders;

    if (!workspaceFolders || workspaceFolders.length === 0) {
      vscode.window.showErrorMessage('No workspace folder open.');
      return;
    }

    if (workspaceFolders.length === 1) {
      basePath = workspaceFolders[0].uri.fsPath;
    } else {
      const picked = await vscode.window.showQuickPick(
        workspaceFolders.map(f => ({
          label: f.name,
          description: f.uri.fsPath,
          folder: f,
        })),
        {
          title: 'Select Workspace Folder',
          placeHolder: 'Which folder should be regenerated?',
        }
      );

      if (!picked) {
        return;
      }
      basePath = picked.folder.uri.fsPath;
    }
  }

  const indexPath = path.join(basePath, 'index.codex.yaml');

  // Check if index exists
  if (!fs.existsSync(indexPath)) {
    vscode.window.showErrorMessage(
      'No index.codex.yaml found. Use "Generate Index" to create one first.'
    );
    return;
  }

  // Regenerate
  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'Regenerating Index...',
      cancellable: false,
    },
    async (progress) => {
      progress.report({ message: 'Loading existing index...' });

      const generator = new IndexGenerator();
      const existingIndex = generator.loadIndex(indexPath);

      if (!existingIndex) {
        vscode.window.showErrorMessage('Failed to parse existing index file.');
        return;
      }

      progress.report({ message: 'Scanning for changes...' });

      const updatedIndex = await generator.regenerateIndex(basePath!, existingIndex);

      progress.report({ message: 'Saving updated index...' });

      generator.saveIndex(updatedIndex, basePath!);

      // Log results
      const channel = getOutputChannel();
      channel.appendLine(`\n${'='.repeat(60)}`);
      channel.appendLine(`Index Regenerated - ${new Date().toLocaleString()}`);
      channel.appendLine(`Path: ${indexPath}`);
      channel.appendLine(`Items: ${countChildren(updatedIndex.children)}`);
      channel.appendLine(`Manual edits preserved: Yes`);
      channel.appendLine(`${'='.repeat(60)}\n`);

      // Show success
      const action = await vscode.window.showInformationMessage(
        `✅ Regenerated index with ${countChildren(updatedIndex.children)} items (manual edits preserved)`,
        'Open Index',
        'Show Details'
      );

      if (action === 'Open Index') {
        const doc = await vscode.workspace.openTextDocument(indexPath);
        await vscode.window.showTextDocument(doc);
      } else if (action === 'Show Details') {
        channel.show();
      }
    }
  );
}

/**
 * Count total children recursively
 */
function countChildren(children: IndexChild[]): number {
  let count = 0;
  for (const child of children) {
    count++;
    if (child.children) {
      count += countChildren(child.children);
    }
  }
  return count;
}

/**
 * Dispose resources
 */
export function disposeIndexGenerator(): void {
  outputChannel?.dispose();
}

