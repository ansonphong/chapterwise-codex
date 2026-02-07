/**
 * File Organizer - Creates files according to organization strategies
 * 
 * Supports three strategies:
 * 1. organized - Hierarchical folders matching logical structure
 * 2. data-folder - Scrivener-style UUID storage in Files/Data/
 * 3. flat - All files in same directory
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as YAML from 'yaml';
import * as crypto from 'crypto';
import { CodexNode } from './codexModel';
import { NavigatorSettings } from './settingsManager';

const fsPromises = fs.promises;

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fsPromises.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function isPathWithinRoot(resolvedPath: string, rootPath: string): boolean {
  const normalizedResolved = path.resolve(resolvedPath);
  const normalizedRoot = path.resolve(rootPath);
  return normalizedResolved.startsWith(normalizedRoot + path.sep) || normalizedResolved === normalizedRoot;
}

/**
 * Result of file creation
 */
export interface FileCreationResult {
  success: boolean;
  filePath?: string;  // Relative to workspace root
  fileUri?: vscode.Uri;
  message?: string;
}

/**
 * File Organizer - Handles file creation based on settings
 */
export class FileOrganizer {
  /**
   * Create a new file for a node based on settings
   * 
   * @param workspaceRoot - Root of the workspace
   * @param parentPath - Path to parent directory (for organized strategy)
   * @param nodeData - Data for the new node
   * @param settings - Navigator settings
   * @returns Result with file path
   */
  async createNodeFile(
    workspaceRoot: string,
    parentPath: string,
    nodeData: Partial<CodexNode>,
    settings: NavigatorSettings
  ): Promise<FileCreationResult> {
    try {
      // Generate file path based on strategy
      const filePath = this.generateFilePath(
        workspaceRoot,
        parentPath,
        nodeData,
        settings
      );

      const fullPath = path.normalize(path.join(workspaceRoot, filePath));

      // Security check: ensure generated path stays within workspace
      const relative = path.relative(workspaceRoot, fullPath);
      if (relative.startsWith('..') || path.isAbsolute(relative)) {
        return {
          success: false,
          message: `Generated path escapes workspace: ${filePath}`
        };
      }

      // Check if file already exists
      if (fs.existsSync(fullPath)) {
        return {
          success: false,
          message: `File already exists: ${path.basename(filePath)}`
        };
      }

      // Symlink check: verify parent directory isn't a symlink
      const dir = path.dirname(fullPath);
      if (fs.existsSync(dir)) {
        try {
          const dirStat = fs.lstatSync(dir);
          if (dirStat.isSymbolicLink()) {
            return {
              success: false,
              message: `Parent directory is a symlink: ${path.basename(dir)}`
            };
          }
        } catch {
          // lstat failed - proceed with caution
        }
      }

      // Create directory if needed
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Create file with initial content
      const content = this.generateInitialContent(nodeData, settings);
      fs.writeFileSync(fullPath, content, 'utf-8');

      return {
        success: true,
        filePath: filePath,
        fileUri: vscode.Uri.file(fullPath),
        message: `Created ${path.basename(filePath)}`
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to create file: ${error}`
      };
    }
  }
  
  /**
   * Generate file path based on strategy
   */
  private generateFilePath(
    workspaceRoot: string,
    parentPath: string,
    nodeData: Partial<CodexNode>,
    settings: NavigatorSettings
  ): string {
    const strategy = settings.fileOrganization.strategy;
    
    switch (strategy) {
      case 'organized':
        return this.generateOrganizedPath(parentPath, nodeData, settings);
      
      case 'data-folder':
        return this.generateDataFolderPath(nodeData, settings);
      
      case 'flat':
        return this.generateFlatPath(parentPath, nodeData, settings);
      
      default:
        throw new Error(`Unknown strategy: ${strategy}`);
    }
  }
  
  /**
   * Generate hierarchical path (e.g., Part-01/Chapter-01/Scene-01.codex.yaml)
   */
  private generateOrganizedPath(
    parentPath: string,
    nodeData: Partial<CodexNode>,
    settings: NavigatorSettings
  ): string {
    // Generate filename
    const filename = this.generateFilename(nodeData, settings);
    
    // Create subdirectory based on node name
    const nodeDirName = this.slugifyName(nodeData.name || 'untitled', settings.naming);
    
    // Combine: parentPath / nodeDirName / filename
    return path.join(parentPath, nodeDirName, filename);
  }
  
  /**
   * Generate data folder path (e.g., Files/Data/UUID.codex.yaml)
   */
  private generateDataFolderPath(
    nodeData: Partial<CodexNode>,
    settings: NavigatorSettings
  ): string {
    const dataFolder = settings.fileOrganization.dataFolderPath;
    
    let filename: string;
    if (settings.fileOrganization.useUuidFilenames) {
      // UUID-based: 921B4A08-54C0-4B69-94FD-428F56FDAB89.codex.yaml
      const id = nodeData.id || this.generateUuid();
      filename = `${id}.codex.yaml`;
    } else {
      // Name-based with UUID suffix: chapter-01-UUID.codex.yaml
      const slug = this.slugifyName(nodeData.name || 'untitled', settings.naming);
      const shortId = (nodeData.id || this.generateUuid()).substring(0, 8);
      filename = `${slug}-${shortId}.codex.yaml`;
    }
    
    return path.join(dataFolder, filename);
  }
  
  /**
   * Generate flat path (e.g., Scene-01.codex.yaml)
   */
  private generateFlatPath(
    parentPath: string,
    nodeData: Partial<CodexNode>,
    settings: NavigatorSettings
  ): string {
    const filename = this.generateFilename(nodeData, settings);
    
    // Just use the parent directory, no subdirectories
    return path.join(parentPath, filename);
  }
  
  /**
   * Generate filename based on naming settings
   */
  private generateFilename(
    nodeData: Partial<CodexNode>,
    settings: NavigatorSettings
  ): string {
    let name = nodeData.name || 'untitled';
    
    // Slugify if configured
    if (settings.naming.slugify) {
      name = this.slugifyName(name, settings.naming);
    }
    
    // Include type prefix if configured
    if (settings.naming.includeType && nodeData.type) {
      name = `${nodeData.type}-${name}`;
    }
    
    // Determine extension based on content
    const ext = this.determineExtension(nodeData);
    
    return `${name}${ext}`;
  }
  
  /**
   * Determine file extension (.md for markdown, .codex.yaml for codex)
   */
  private determineExtension(nodeData: Partial<CodexNode>): string {
    // Default to .codex.yaml for now
    // Could be extended to support .md (Codex Lite) based on settings
    return '.codex.yaml';
  }
  
  /**
   * Generate initial file content
   */
  private generateInitialContent(
    nodeData: Partial<CodexNode>,
    settings: NavigatorSettings
  ): string {
    // Create basic codex structure
    const codex: any = {
      metadata: {
        formatVersion: '1.2',
        created: new Date().toISOString(),
        updated: new Date().toISOString()
      }
    };
    
    // Add node data
    if (nodeData.id || settings.automation.autoGenerateIds) {
      codex.id = nodeData.id || this.generateUuid();
    }
    
    if (nodeData.type) {
      codex.type = nodeData.type;
    }
    
    if (nodeData.name) {
      codex.name = nodeData.name;
    }
    
    // Add empty prose field
    const proseField = nodeData.proseField || 'body';
    codex[proseField] = nodeData.proseValue || '';
    
    // Add empty children array
    codex.children = [];
    
    // Convert to YAML
    return YAML.stringify(codex);
  }
  
  /**
   * Slugify name based on naming settings
   */
  private slugifyName(name: string, namingSettings: NavigatorSettings['naming']): string {
    let slug = name;
    
    // Convert to lowercase unless preserving case
    if (!namingSettings.preserveCase) {
      slug = slug.toLowerCase();
    }
    
    // Replace spaces and underscores with separator
    slug = slug.replace(/[\s_]+/g, namingSettings.separator);
    
    // Remove special characters (keep alphanumeric and hyphens)
    slug = slug.replace(/[^a-zA-Z0-9-]/g, '');

    // Strip path traversal sequences
    slug = slug.replace(/\.\./g, '');
    
    // Escape separator for safe regex construction
    const escapedSep = namingSettings.separator.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Remove leading/trailing separators
    const separatorPattern = new RegExp(`^${escapedSep}+|${escapedSep}+$`, 'g');
    slug = slug.replace(separatorPattern, '');

    // Collapse multiple separators
    const multiSeparatorPattern = new RegExp(`${escapedSep}+`, 'g');
    slug = slug.replace(multiSeparatorPattern, namingSettings.separator);
    
    return slug || 'untitled';
  }
  
  /**
   * Generate a UUID
   */
  private generateUuid(): string {
    return crypto.randomUUID();
  }
  
  /**
   * Create include directive string
   */
  createIncludeDirective(
    filePath: string,
    currentFilePath: string,
    settings: NavigatorSettings
  ): any {
    // Determine path (relative or absolute)
    let includePath: string;
    
    if (settings.includes.preferRelative) {
      // Calculate relative path from current file to target file
      const currentDir = path.dirname(currentFilePath);
      includePath = path.relative(currentDir, filePath);
      
      // Normalize to forward slashes (YAML standard)
      includePath = includePath.replace(/\\/g, '/');
    } else {
      // Use absolute path from workspace root
      includePath = '/' + filePath.replace(/\\/g, '/');
    }
    
    // Format based on settings
    if (settings.includes.format === 'object') {
      return {
        include: {
          file: includePath
        }
      };
    } else {
      // String format (default)
      return {
        include: includePath
      };
    }
  }
  
  /**
   * Get next available number for auto-numbering
   * (e.g., if Chapter-01, Chapter-02 exist, returns 3)
   */
  async getNextAvailableNumber(
    directoryPath: string,
    prefix: string
  ): Promise<number> {
    try {
      if (!await fileExists(directoryPath)) {
        return 1;
      }

      const files = await fsPromises.readdir(directoryPath);
      const numbers: number[] = [];

      // Escape prefix for safe regex construction
      const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pattern = new RegExp(`^${escapedPrefix}-(\\d+)`, 'i');
      for (const file of files) {
        const match = file.match(pattern);
        if (match) {
          numbers.push(parseInt(match[1], 10));
        }
      }

      if (numbers.length === 0) {
        return 1;
      }

      return Math.max(...numbers) + 1;
    } catch (error) {
      return 1;
    }
  }
  
  /**
   * Format number with padding (e.g., 1 -> "01", 15 -> "15")
   */
  formatNumber(num: number, padding: number = 2): string {
    return num.toString().padStart(padding, '0');
  }
}

/**
 * Singleton instance
 */
let organizerInstance: FileOrganizer | null = null;

/**
 * Get the file organizer instance
 */
export function getFileOrganizer(): FileOrganizer {
  if (!organizerInstance) {
    organizerInstance = new FileOrganizer();
  }
  return organizerInstance;
}

/**
 * Dispose the file organizer
 */
export function disposeFileOrganizer(): void {
  organizerInstance = null;
}
