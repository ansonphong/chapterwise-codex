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

  // Build methods will be added in Task 9
  private async buildIndexAsync(): Promise<void> {
    // Placeholder - implemented in Task 9
    this.index = createEmptyIndex(this.contextFolder || '');
    this._onIndexReady.fire(this.index);
  }

  private setupFileWatcher(): void {
    // Placeholder - implemented in Task 10
  }

  private async refreshStaleEntries(): Promise<void> {
    // Placeholder - implemented in Task 10
  }
}
