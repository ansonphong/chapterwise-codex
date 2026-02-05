/**
 * Index Manager - Build, cache, and maintain the search index
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import {
  SearchIndex,
  TitleEntry,
  MetadataEntry,
  ContentEntry,
  createEmptyIndex
} from './searchIndex';
import { tokenize } from './tokenizer';
import { getDepthBoost } from './scoring';
import { parseCodex, isCodexFile, isMarkdownFile, parseMarkdownAsCodex } from '../codexModel';

/**
 * Manages search index lifecycle
 */
export class SearchIndexManager {
  private index: SearchIndex | null = null;
  private indexPath: string | null = null;
  private buildProgress: number = 0;
  private isBuilding: boolean = false;
  private fileWatcher: vscode.FileSystemWatcher | null = null;
  private pendingUpdates: Set<string> = new Set();
  private updateDebounceTimer: NodeJS.Timeout | null = null;
  private buildMutex: Promise<void> = Promise.resolve();
  private workspaceRoot: string | null = null;
  private contextFolder: string | null = null;

  private _onIndexReady = new vscode.EventEmitter<SearchIndex>();
  private _onBuildProgress = new vscode.EventEmitter<number>();
  readonly onIndexReady = this._onIndexReady.event;
  readonly onBuildProgress = this._onBuildProgress.event;

  /**
   * Initialize index for a context folder
   */
  async initializeForContext(
    contextFolder: string,
    workspaceRoot: string
  ): Promise<void> {
    this.contextFolder = contextFolder;
    this.workspaceRoot = workspaceRoot;

    const cacheFile = path.join(workspaceRoot, contextFolder, '.index-search.json');
    this.indexPath = cacheFile;

    // Try loading from cache
    const cached = await this.loadFromCache(cacheFile);

    if (cached && await this.validateCache(cached, workspaceRoot)) {
      this.index = cached;
      this._onIndexReady.fire(this.index);
      // Background refresh for stale entries
      this.refreshStaleEntries();
    } else {
      await this.buildIndexAsync();
    }

    this.setupFileWatcher();
  }

  /**
   * Get current index
   */
  getIndex(): SearchIndex | null {
    return this.index;
  }

  /**
   * Check if index is ready
   */
  isReady(): boolean {
    return this.index !== null && !this.isBuilding;
  }

  /**
   * Get build progress (0-100)
   */
  getBuildProgress(): number {
    return this.buildProgress;
  }

  /**
   * Force rebuild
   */
  async forceRebuild(): Promise<void> {
    if (this.indexPath && fs.existsSync(this.indexPath)) {
      await fs.promises.unlink(this.indexPath);
    }
    await this.buildIndexAsync();
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    this.fileWatcher?.dispose();
    if (this.updateDebounceTimer) {
      clearTimeout(this.updateDebounceTimer);
    }
    this._onIndexReady.dispose();
    this._onBuildProgress.dispose();
  }

  /**
   * Load index from cache
   */
  private async loadFromCache(cachePath: string): Promise<SearchIndex | null> {
    try {
      if (!fs.existsSync(cachePath)) return null;

      const content = await fs.promises.readFile(cachePath, 'utf-8');
      const cached = JSON.parse(content) as SearchIndex;

      if (cached.version !== '1.0') return null;

      // Age check (7 days)
      const age = Date.now() - cached.created;
      if (age > 7 * 24 * 60 * 60 * 1000) return null;

      return cached;
    } catch {
      return null;
    }
  }

  /**
   * Validate cache by checking file hashes
   */
  private async validateCache(
    cached: SearchIndex,
    workspaceRoot: string
  ): Promise<boolean> {
    try {
      const sampleSize = Math.min(10, Object.keys(cached.fileHashes).length);
      const files = Object.keys(cached.fileHashes).slice(0, sampleSize);

      for (const file of files) {
        const fullPath = path.join(workspaceRoot, file);
        if (!fs.existsSync(fullPath)) return false;

        const content = await fs.promises.readFile(fullPath, 'utf-8');
        const hash = this.hashContent(content);
        if (hash !== cached.fileHashes[file]) return false;
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Save index to cache
   */
  private async saveToCache(): Promise<void> {
    if (!this.index || !this.indexPath) return;

    try {
      const dir = path.dirname(this.indexPath);
      if (!fs.existsSync(dir)) {
        await fs.promises.mkdir(dir, { recursive: true });
      }
      const content = JSON.stringify(this.index, null, 2);
      await fs.promises.writeFile(this.indexPath, content, 'utf-8');
    } catch (error) {
      console.error('[Search] Failed to save cache:', error);
    }
  }

  /**
   * Hash content for change detection
   */
  private hashContent(content: string): string {
    return crypto.createHash('md5').update(content).digest('hex');
  }

  /**
   * Yield to UI
   */
  private async yieldToUI(): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, 0));
  }

  /**
   * Build index asynchronously
   */
  private async buildIndexAsync(): Promise<void> {
    this.buildMutex = this.buildMutex.then(async () => {
      if (!this.workspaceRoot || !this.contextFolder) return;

      this.isBuilding = true;
      this.buildProgress = 0;

      this.index = createEmptyIndex(this.contextFolder);
      this._onIndexReady.fire(this.index);

      try {
        // Phase 1: Scan files (0-10%)
        const files = await this.scanCodexFiles();
        this.buildProgress = 10;
        this._onBuildProgress.fire(this.buildProgress);

        if (files.length === 0) {
          this.buildProgress = 100;
          this._onBuildProgress.fire(100);
          return;
        }

        // Phase 2: Index files (10-90%)
        for (let i = 0; i < files.length; i++) {
          await this.indexFile(files[i]);
          this.buildProgress = 10 + Math.floor((i / files.length) * 80);

          if (i % 10 === 0) {
            this._onBuildProgress.fire(this.buildProgress);
            await this.yieldToUI();
          }
        }

        // Phase 3: Build inverted index (90-95%)
        this._onBuildProgress.fire(90);
        this.buildInvertedIndex();

        // Phase 4: Compute stats (95-100%)
        this.computeCorpusStats();
        this.buildProgress = 100;
        this._onBuildProgress.fire(100);

        // Save cache
        await this.saveToCache();

      } catch (error) {
        console.error('[Search] Index build error:', error);
      } finally {
        this.isBuilding = false;
        if (this.index) {
          this._onIndexReady.fire(this.index);
        }
      }
    });

    return this.buildMutex;
  }

  /**
   * Scan for codex files
   */
  private async scanCodexFiles(): Promise<string[]> {
    if (!this.workspaceRoot || !this.contextFolder) return [];

    const folderPath = path.join(this.workspaceRoot, this.contextFolder);
    const files: string[] = [];

    const glob = new vscode.RelativePattern(
      folderPath,
      '**/*.{codex.yaml,codex.json,md}'
    );
    const uris = await vscode.workspace.findFiles(glob, '**/node_modules/**');

    for (const uri of uris) {
      if (!uri.fsPath.includes('.index.')) {
        files.push(uri.fsPath);
      }
    }

    return files;
  }

  /**
   * Index a single file
   */
  private async indexFile(filePath: string): Promise<void> {
    if (!this.index || !this.workspaceRoot) return;

    try {
      const content = await fs.promises.readFile(filePath, 'utf-8');
      const relativePath = path.relative(this.workspaceRoot, filePath);

      // Store hash
      this.index.fileHashes[relativePath] = this.hashContent(content);

      // Parse file
      let doc;
      if (isMarkdownFile(filePath)) {
        doc = parseMarkdownAsCodex(content, filePath);
      } else if (isCodexFile(filePath)) {
        doc = parseCodex(content);
      } else {
        return;
      }

      if (!doc || !doc.rootNode) return;

      // Index all nodes recursively
      this.indexNode(doc.rootNode, relativePath, []);

    } catch (error) {
      console.error(`[Search] Error indexing ${filePath}:`, error);
    }
  }

  /**
   * Index a single node and its children
   */
  private indexNode(
    node: any,
    filePath: string,
    parentPath: string[]
  ): void {
    if (!this.index) return;

    const nodePath = node.id ? [...parentPath, node.id] : parentPath;
    const boost = getDepthBoost(nodePath);

    // Title entry
    this.index.titles.push({
      id: node.id || `${filePath}:${nodePath.join('/')}`,
      name: node.name || node.id || 'Untitled',
      type: node.type || 'unknown',
      path: filePath,
      nodePath: nodePath.length > 0 ? nodePath : undefined,
      boost
    });

    // Metadata entry
    const tags: string[] = node.tags || [];
    const attributes: Record<string, string> = {};
    if (node.attributes) {
      for (const attr of node.attributes) {
        if (attr.key && attr.value !== undefined) {
          attributes[attr.key] = String(attr.value);
        }
      }
    }

    this.index.metadata.push({
      id: node.id || `${filePath}:${nodePath.join('/')}`,
      tags,
      attributes,
      type: node.type || 'unknown',
      path: filePath,
      nodePath: nodePath.length > 0 ? nodePath : undefined
    });

    // Content entries for prose fields
    const proseFields = ['body', 'summary', 'description', 'proseValue'];
    for (const field of proseFields) {
      const text = node[field];
      if (text && typeof text === 'string' && text.trim()) {
        const tokens = tokenize(text);
        this.index.content.push({
          id: node.id || `${filePath}:${nodePath.join('/')}`,
          field: field === 'proseValue' ? (node.proseField || 'body') : field,
          text,
          tokens,
          length: tokens.length,
          path: filePath,
          nodePath: nodePath.length > 0 ? nodePath : undefined
        });
      }
    }

    // Index children
    if (node.children && Array.isArray(node.children)) {
      for (const child of node.children) {
        this.indexNode(child, filePath, nodePath);
      }
    }
  }

  /**
   * Build inverted index from indexed content
   */
  private buildInvertedIndex(): void {
    if (!this.index) return;

    this.index.termIndex = {};

    // Index titles
    for (const entry of this.index.titles) {
      const tokens = tokenize(entry.name);
      for (let pos = 0; pos < tokens.length; pos++) {
        this.addToPostingList(tokens[pos], entry.id, 1, pos, entry.boost);
      }
    }

    // Index metadata
    for (const entry of this.index.metadata) {
      for (const tag of entry.tags) {
        const tokens = tokenize(tag);
        for (let pos = 0; pos < tokens.length; pos++) {
          this.addToPostingList(tokens[pos], entry.id, 2, pos, 1.3);
        }
      }
      for (const [key, value] of Object.entries(entry.attributes)) {
        const tokens = tokenize(`${key} ${value}`);
        for (let pos = 0; pos < tokens.length; pos++) {
          this.addToPostingList(tokens[pos], entry.id, 2, pos, 1.0);
        }
      }
    }

    // Index content
    for (const entry of this.index.content) {
      const boost = entry.field === 'summary' ? 1.2 : 1.0;
      for (let pos = 0; pos < entry.tokens.length; pos++) {
        this.addToPostingList(entry.tokens[pos], entry.id, 3, pos, boost);
      }
    }
  }

  /**
   * Add term to posting list
   */
  private addToPostingList(
    term: string,
    docId: string,
    tier: 1 | 2 | 3,
    position: number,
    boost: number
  ): void {
    if (!this.index) return;

    if (!this.index.termIndex[term]) {
      this.index.termIndex[term] = { term, docs: [] };
    }

    const posting = this.index.termIndex[term];
    let docEntry = posting.docs.find(d => d.id === docId && d.tier === tier);

    if (!docEntry) {
      docEntry = { id: docId, tier, positions: [], score: boost };
      posting.docs.push(docEntry);
    }

    docEntry.positions.push(position);
  }

  /**
   * Compute corpus statistics
   */
  private computeCorpusStats(): void {
    if (!this.index) return;

    const lengths = this.index.content.map(c => c.length);
    this.index.totalDocs = this.index.titles.length || 1;
    this.index.avgDocLength = lengths.length > 0
      ? lengths.reduce((a, b) => a + b, 0) / lengths.length
      : 100;
  }

  private setupFileWatcher(): void {
    // Placeholder - implemented in Task 10
  }

  private async refreshStaleEntries(): Promise<void> {
    // Placeholder - implemented in Task 10
  }
}
