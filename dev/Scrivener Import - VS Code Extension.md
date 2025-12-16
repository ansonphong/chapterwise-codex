# Scrivener Import Feature - VS Code Extension Implementation Plan

**Version:** 3.0  
**Date:** December 14, 2025  
**Status:** Updated for Index Integration  
**Target:** ChapterWise Codex VS Code Extension

> **Update Notice**: This plan integrates with the [Index Navigation System](./Index%20Navigation%20-%20VS%20Code%20Extension.md) to provide seamless Scrivener import → Index generation → Navigation workflow. Scrivener projects import to your choice of format (.codex.yaml, .codex.json, or Codex Lite Markdown), then automatically generate navigable index files.

> **Related Documents**:
> - [Index Navigation - VS Code Extension](./Index%20Navigation%20-%20VS%20Code%20Extension.md) - Index generation and navigation
> - [Scrivener Format - Deep Research](./Scrivener%20Format%20-%20Deep%20Research.md) - Scrivener file structure analysis

---

## Table of Contents

1. [Overview](#overview)
2. [Why VS Code Extension?](#why-vs-code-extension)
3. [User Flow](#user-flow)
4. [Architecture](#architecture)
5. [Implementation Details](#implementation-details)
6. [File Structure](#file-structure)
7. [Dependencies](#dependencies)
8. [Configuration](#configuration)
9. [Testing Strategy](#testing-strategy)
10. [Documentation](#documentation)

---

## Overview

Implement Scrivener (.scriv) import as a **local, client-side VS Code extension command** that allows users to:
- Import Scrivener projects directly from their local filesystem
- No ZIP upload required - works with .scriv folders/packages directly
- No server hosting of Scrivener files - all processing happens locally
- **Choose output format**: Codex YAML, Codex JSON, or **Codex Lite Markdown**
- **Auto-generate index files** for project navigation
- **Preserve folder hierarchy** from Scrivener binder
- Process entirely in TypeScript/Node.js

### Key Features

- **Local Processing**: All conversion happens on user's machine
- **No Upload Required**: Direct filesystem access to .scriv folders
- **Command Palette Integration**: `ChapterWise Codex: Import Scrivener Project`
- **Interactive Options**: QuickPick UI for user preferences
- **Three Output Formats**:
  - **Codex YAML** (.codex.yaml) - Full codex format
  - **Codex JSON** (.codex.json) - Full codex format in JSON
  - **Codex Lite Markdown** (.md) - Standard Markdown with YAML frontmatter (Recommended)
- **Progress Notifications**: VS Code progress bars during conversion
- **Cross-Platform**: Works on macOS (packages) and Windows (folders)
- **Index Integration**: Uses [Index Navigation System](./Index%20Navigation%20-%20VS%20Code%20Extension.md) for post-import navigation
- **Free & Fast**: No server round-trip, instant processing

---

## Why VS Code Extension?

### Advantages Over Web App Approach

| Feature | Web App (Python) | VS Code Extension (TypeScript) |
|---------|------------------|--------------------------------|
| **File Upload** | ❌ Must ZIP and upload | ✅ Direct filesystem access |
| **Processing** | ❌ Server-side (costs money) | ✅ Local (free) |
| **Speed** | ❌ Upload time + queue | ✅ Instant processing |
| **Privacy** | ❌ Files on server temporarily | ✅ Never leaves user's machine |
| **File Size** | ❌ Limited by upload size | ✅ Unlimited (local) |
| **Availability** | ❌ Requires internet | ✅ Works offline |
| **Cost** | ❌ Server resources | ✅ Free for everyone |
| **Integration** | ❌ Separate workflow | ✅ Built into editor |

### Benefits for Users

1. **Privacy**: Scrivener projects never leave their computer
2. **Speed**: No upload/download time
3. **Simplicity**: No ZIP creation required
4. **Free**: No server costs means free for all users
5. **Offline**: Works without internet connection
6. **Native**: Feels like built-in VS Code functionality

### Benefits for ChapterWise

1. **No Hosting**: Don't need to store .scriv files temporarily
2. **No Processing**: No server CPU/memory for conversion
3. **No Liability**: No risk of data leaks or storage issues
4. **Scalability**: Unlimited users without infrastructure costs
5. **Simplicity**: One less feature in the web app

---

## User Flow

### 1. Initiate Import

```
User opens VS Code in a workspace/folder
    ↓
Opens Command Palette (Cmd+Shift+P / Ctrl+Shift+P)
    ↓
Types: "Import Scrivener"
    ↓
Selects: "ChapterWise Codex: Import Scrivener Project"
```

### 2. Select Scrivener Project

```
VS Code shows folder picker dialog
    ↓
User navigates to their .scriv folder
    ↓
[macOS] Shows as single file → User selects it
[Windows] Shows as folder → User selects folder
    ↓
Extension validates it's a Scrivener project
    ↓
QuickPick shows: "MyNovel.scriv - Scrivener 3.0"
    ↓
User confirms selection
```

### 3. Configure Import Options

```
QuickPick: "Output Location"
    ↓
Options:
  - Current Workspace Root (./MyNovel/)
  - Select Custom Folder
  - Create New Workspace Folder
    ↓
User selects: "Current Workspace Root"
    ↓
QuickPick: "Output Format"
    ↓
Options:
  - 📝 Codex Lite (Markdown with frontmatter) [Recommended]
    "Human-readable, Git-friendly, works everywhere"
  - 📄 Codex YAML (.codex.yaml)
    "Full codex format with hierarchical children"
  - 📋 Codex JSON (.codex.json)
    "Full codex format in JSON"
    ↓
User selects: "Codex Lite (Markdown)"
    ↓
QuickPick: "Content Conversion"
    ↓
Options:
  - Convert RTF to Markdown [Recommended]
  - Convert RTF to HTML
  - Keep RTF as-is
    ↓
User selects: "Convert RTF to Markdown"
    ↓
QuickPick: "Generate Index?"
    ↓
Options:
  - Yes, generate index.codex.yaml and .index.codex.yaml
  - No, just import files
    ↓
User selects: "Yes, generate index"
```

### 4. Import Process with Progress

```
VS Code shows progress notification:
    ↓
[===>              ] "Parsing Scrivener project..."
    ↓
[======>           ] "Reading .scrivx structure..."
    ↓
[==========>       ] "Converting RTF content... (23/45)"
    ↓
[==============>   ] "Writing files..."
    ↓
[=================>] "Creating index.codex.yaml..."
    ↓
[==================] "Generating .index.codex.yaml..."
    ↓
✅ Success notification:
   "Scrivener project imported: MyNovel
    Generated 87 Markdown files in ./MyNovel/
    Created index files for navigation"
    ↓
[Open Index] [Generate Index Now] [Show in Explorer]
```

### 5. View Results

```
User clicks "Open Index"
    ↓
VS Code opens MyNovel/.index.codex.yaml
    ↓
ChapterWise Codex Navigator switches to Index Mode:
  📚 My Novel
    📁 Manuscript
      📁 Part 01: The Beginning
        📄 Chapter 1: The Awakening (Chapter-1.md)
        📄 Chapter 2: The Journey Begins (Chapter-2.md)
    📁 Research
      📁 Characters
        👤 Aya (Aya.md)
        👤 Maya (Maya.md)
    📝 Notes (Notes.md)
    ↓
User clicks "Chapter 1" → Opens Chapter-1.md
    ↓
Sees Codex Lite Markdown:
---
type: chapter
name: "Chapter 1: The Awakening"
scrivener_label: "Chapter"
scrivener_status: "First Draft"
---

# Chapter 1: The Awakening

Content here...
    ↓
Navigator stays in Index Mode
    ↓
User can click any other file to open
```

---

## Architecture

### Component Diagram

```
┌─────────────────────────────────────────────┐
│  VS Code Extension (extension.ts)           │
│  - Register command                         │
│  - Handle UI interactions                   │
└─────────────┬───────────────────────────────┘
              │
              ↓
┌─────────────────────────────────────────────┐
│  ScrivenerImporter (scrivenerImport.ts)     │
│  - Orchestrate import process               │
│  - Show QuickPick dialogs                   │
│  - Display progress notifications           │
└─────────────┬───────────────────────────────┘
              │
              ↓
┌─────────────────────────────────────────────┐
│  ScrivenerParser (scrivenerParser.ts)       │
│  - Detect .scriv structure                  │
│  - Parse .scrivx XML                        │
│  - Build BinderItem tree                    │
│  - Extract project metadata                 │
└─────────────┬───────────────────────────────┘
              │
              ↓
┌─────────────────────────────────────────────┐
│  RTFConverter (rtfConverter.ts)             │
│  - Convert RTF to Markdown                  │
│  - Use rtf.js or rtf-to-html npm package    │
│  - Clean and normalize output               │
└─────────────┬───────────────────────────────┘
              │
              ↓
┌─────────────────────────────────────────────┐
│  CodexBuilder (scrivenerToCodex.ts)         │
│  - Build hierarchical structure             │
│  - Create leaf codex files (chapters)       │
│  - Create folder codex files (parts)        │
│  - Create section codex files (manuscript)  │
│  - Create .index.codex.yaml                 │
│  - Generate include directives              │
└─────────────┬───────────────────────────────┘
              │
              ↓
┌─────────────────────────────────────────────┐
│  FileWriter (fileWriter.ts)                 │
│  - Write YAML/JSON files                    │
│  - Create directory structure               │
│  - Handle file conflicts                    │
└─────────────────────────────────────────────┘
```

### Data Flow

```
.scriv folder (user's filesystem)
    ↓
ScrivenerParser
    ↓ (extracts)
Project metadata + BinderItem tree
    ↓
RTFConverter (for each Text node)
    ↓ (converts RTF → Markdown)
Converted content strings
    ↓
CodexBuilder (hierarchical)
    ↓ (builds bottom-up)
Codex data structures (in memory)
    ↓
FileWriter
    ↓ (writes)
Workspace folder
    ├── .index.codex.yaml
    ├── Manuscript/
    │   ├── Manuscript.codex.yaml
    │   ├── Part-01/
    │   │   ├── Part-01.codex.yaml
    │   │   ├── Chapter-01.codex.yaml
    │   │   └── Chapter-02.codex.yaml
    └── Research/...
```

---

## Implementation Details

### 1. ScrivenerImporter (Main Orchestrator)

**File:** `src/scrivenerImport.ts`

```typescript
/**
 * Scrivener Import - Main Orchestrator
 * 
 * Handles the entire import process from command invocation to completion.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { ScrivenerParser, ScrivenerProject } from './scrivenerParser';
import { RTFConverter } from './rtfConverter';
import { CodexBuilder } from './scrivenerToCodex';
import { FileWriter } from './fileWriter';

/**
 * Import options collected from user
 */
export interface ScrivenerImportOptions {
  scrivPath: string;
  outputDir: string;
  outputFormat: 'yaml' | 'json' | 'markdown';  // 'markdown' = Codex Lite
  contentConversion: 'markdown' | 'html' | 'none';
  generateIndex: boolean;  // NEW: Auto-generate index files
}

/**
 * Import result summary
 */
export interface ScrivenerImportResult {
  success: boolean;
  indexFilePath?: string;
  cacheIndexFilePath?: string;  // NEW: Path to .index.codex.yaml
  filesGenerated: number;
  error?: string;
}

/**
 * Main Scrivener Importer class
 */
export class ScrivenerImporter {
  
  /**
   * Run the import process
   */
  async import(): Promise<ScrivenerImportResult> {
    try {
      // Step 1: Select .scriv project
      const scrivPath = await this.selectScrivenerProject();
      if (!scrivPath) {
        return { success: false, filesGenerated: 0, error: 'No project selected' };
      }
      
      // Step 2: Get import options
      const options = await this.getImportOptions(scrivPath);
      if (!options) {
        return { success: false, filesGenerated: 0, error: 'Import cancelled' };
      }
      
      // Step 3: Run import with progress
      return await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'Importing Scrivener Project',
          cancellable: false
        },
        async (progress) => {
          return await this.runImport(options, progress);
        }
      );
      
    } catch (error) {
      vscode.window.showErrorMessage(
        `Scrivener import failed: ${error instanceof Error ? error.message : String(error)}`
      );
      return { 
        success: false, 
        filesGenerated: 0, 
        error: error instanceof Error ? error.message : String(error) 
      };
    }
  }
  
  /**
   * Step 1: Select Scrivener project from filesystem
   */
  private async selectScrivenerProject(): Promise<string | undefined> {
    const options: vscode.OpenDialogOptions = {
      canSelectFiles: true,
      canSelectFolders: true,
      canSelectMany: false,
      title: 'Select Scrivener Project (.scriv)',
      filters: {
        'Scrivener Projects': ['scriv']
      }
    };
    
    const result = await vscode.window.showOpenDialog(options);
    if (!result || result.length === 0) {
      return undefined;
    }
    
    const scrivPath = result[0].fsPath;
    
    // Validate it's a Scrivener project
    if (!this.validateScrivenerProject(scrivPath)) {
      vscode.window.showErrorMessage(
        'Selected folder is not a valid Scrivener project. Missing project.scrivx file.'
      );
      return undefined;
    }
    
    return scrivPath;
  }
  
  /**
   * Validate .scriv structure
   */
  private validateScrivenerProject(scrivPath: string): boolean {
    // Check if directory exists
    if (!fs.existsSync(scrivPath) || !fs.lstatSync(scrivPath).isDirectory()) {
      return false;
    }
    
    // Look for .scrivx file
    const files = fs.readdirSync(scrivPath);
    const scrivxFile = files.find(f => f.toLowerCase().endsWith('.scrivx'));
    
    if (!scrivxFile) {
      return false;
    }
    
    // Check for required directories
    const filesDir = path.join(scrivPath, 'Files');
    const dataDir = path.join(filesDir, 'Data');
    
    return fs.existsSync(filesDir) && fs.existsSync(dataDir);
  }
  
  /**
   * Step 2: Collect import options from user
   */
  private async getImportOptions(scrivPath: string): Promise<ScrivenerImportOptions | undefined> {
    const projectName = path.basename(scrivPath, '.scriv');
    
    // Option 1: Output location
    const outputDir = await this.selectOutputLocation(projectName);
    if (!outputDir) {
      return undefined;
    }
    
    // Option 2: Output format (THREE OPTIONS NOW!)
    const outputFormat = await vscode.window.showQuickPick(
      [
        { 
          label: '$(markdown) Codex Lite (Markdown)', 
          description: 'Recommended - Standard Markdown with YAML frontmatter', 
          detail: 'Human-readable, Git-friendly, works in any editor',
          value: 'markdown' 
        },
        { 
          label: '$(symbol-file) Codex YAML', 
          description: 'Full codex format with hierarchical children', 
          detail: 'Best for complex nested structures',
          value: 'yaml' 
        },
        { 
          label: '$(json) Codex JSON', 
          description: 'Full codex format in JSON', 
          detail: 'Machine-readable format',
          value: 'json' 
        }
      ],
      {
        title: 'Output Format',
        placeHolder: 'How should Scrivener content be saved?'
      }
    );
    
    if (!outputFormat) {
      return undefined;
    }
    
    // Option 3: Content conversion
    const contentConversion = await vscode.window.showQuickPick(
      [
        { label: '$(markdown) Markdown', description: 'Recommended - Convert RTF to Markdown', value: 'markdown' },
        { label: '$(code) HTML', description: 'Convert RTF to HTML', value: 'html' },
        { label: '$(file-text) Keep RTF', description: 'Keep RTF as-is (no conversion)', value: 'none' }
      ],
      {
        title: 'Content Conversion',
        placeHolder: 'How should RTF content be converted?'
      }
    );
    
    if (!contentConversion) {
      return undefined;
    }
    
    // Option 4: Generate index (NEW!)
    const generateIndexChoice = await vscode.window.showQuickPick(
      [
        { 
          label: '$(check) Yes, generate index files', 
          description: 'Creates index.codex.yaml and .index.codex.yaml for navigation',
          detail: 'Recommended - Enables project navigation in ChapterWise Codex Navigator',
          value: true 
        },
        { 
          label: '$(x) No, just import files', 
          description: 'Import files only, no index generation',
          detail: 'You can generate index later with "Generate Index" command',
          value: false 
        }
      ],
      {
        title: 'Generate Index?',
        placeHolder: 'Create index files for project navigation?'
      }
    );
    
    if (!generateIndexChoice) {
      return undefined;
    }
    
    return {
      scrivPath,
      outputDir,
      outputFormat: outputFormat.value as 'yaml' | 'json' | 'markdown',
      contentConversion: contentConversion.value as 'markdown' | 'html' | 'none',
      generateIndex: generateIndexChoice.value
    };
  }
  
  /**
   * Select output location
   */
  private async selectOutputLocation(projectName: string): Promise<string | undefined> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    
    if (!workspaceFolders || workspaceFolders.length === 0) {
      // No workspace - ask user to select folder
      const result = await vscode.window.showOpenDialog({
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: false,
        title: 'Select Output Folder',
        openLabel: 'Select Folder'
      });
      
      if (!result || result.length === 0) {
        return undefined;
      }
      
      return path.join(result[0].fsPath, projectName);
    }
    
    // Workspace exists - offer options
    const choice = await vscode.window.showQuickPick(
      [
        { 
          label: '$(folder) Current Workspace Root', 
          description: `Create ${projectName}/ folder here`,
          value: 'workspace' 
        },
        { 
          label: '$(folder-opened) Select Custom Folder', 
          description: 'Choose a different location',
          value: 'custom' 
        }
      ],
      {
        title: 'Output Location',
        placeHolder: 'Where should the imported project be saved?'
      }
    );
    
    if (!choice) {
      return undefined;
    }
    
    if (choice.value === 'workspace') {
      return path.join(workspaceFolders[0].uri.fsPath, projectName);
    } else {
      const result = await vscode.window.showOpenDialog({
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: false,
        title: 'Select Output Folder',
        openLabel: 'Select Folder'
      });
      
      if (!result || result.length === 0) {
        return undefined;
      }
      
      return path.join(result[0].fsPath, projectName);
    }
  }
  
  /**
   * Step 3: Run the actual import process
   */
  private async runImport(
    options: ScrivenerImportOptions,
    progress: vscode.Progress<{ message?: string; increment?: number }>
  ): Promise<ScrivenerImportResult> {
    
    // Phase 1: Parse Scrivener project
    progress.report({ message: 'Parsing Scrivener project...', increment: 0 });
    const parser = new ScrivenerParser(options.scrivPath);
    const project = await parser.parse();
    
    if (!project) {
      throw new Error('Failed to parse Scrivener project');
    }
    
    // Resolve metadata (convert IDs to names)
    parser.resolveMetadata(project);
    
    progress.report({ increment: 15 });
    
    // Phase 2: Convert RTF content
    progress.report({ message: 'Converting RTF content...', increment: 0 });
    const rtfConverter = new RTFConverter();
    
    // Count leaf documents for progress
    const leafCount = this.countLeafDocuments(project.binderItems);
    let convertedCount = 0;
    
    // Convert RTF for all leaf documents
    await this.convertRTFContent(
      project.binderItems, 
      rtfConverter, 
      options.contentConversion,
      (current, total) => {
        convertedCount = current;
        const percentage = Math.floor((current / total) * 40);
        progress.report({ 
          message: `Converting RTF content... (${current}/${total})`,
          increment: percentage - (progress as any).lastReported || 0
        });
        (progress as any).lastReported = percentage;
      }
    );
    
    progress.report({ increment: 40 });
    
    // Phase 3: Build file structure (not hierarchical codex, just files)
    progress.report({ message: 'Writing files...', increment: 0 });
    const writer = new FileWriter(options.outputDir);
    const filesGenerated = await writer.writeScrivenerFiles(
      project, 
      options.outputFormat,
      options.contentConversion
    );
    
    progress.report({ increment: 20 });
    
    let indexFilePath: string | undefined;
    let cacheIndexFilePath: string | undefined;
    
    // Phase 4: Generate index files (NEW!)
    if (options.generateIndex) {
      progress.report({ message: 'Creating index.codex.yaml...', increment: 0 });
      
      // Create boilerplate index.codex.yaml
      const { createBoilerplateIndex } = await import('./indexBoilerplate');
      indexFilePath = await createBoilerplateIndex(options.outputDir);
      
      progress.report({ increment: 10 });
      
      // Generate .index.codex.yaml from filesystem
      progress.report({ message: 'Generating .index.codex.yaml...', increment: 0 });
      const { generateIndex } = await import('./indexGenerator');
      cacheIndexFilePath = await generateIndex({
        workspaceRoot: options.outputDir,
        indexFilePath,
        progressReporter: progress
      });
      
      progress.report({ increment: 10 });
    }
    
    progress.report({ message: 'Complete!', increment: 5 });
    
    return {
      success: true,
      indexFilePath,
      cacheIndexFilePath,
      filesGenerated
    };
  }
  
  /**
   * Count leaf documents (for progress tracking)
   */
  private countLeafDocuments(items: any[]): number {
    let count = 0;
    for (const item of items) {
      if (item.children && item.children.length > 0) {
        count += this.countLeafDocuments(item.children);
      } else if (item.itemType === 'Text') {
        count++;
      }
    }
    return count;
  }
  
  /**
   * Convert RTF content for all leaf documents
   */
  private async convertRTFContent(
    items: any[],
    converter: RTFConverter,
    conversionType: 'markdown' | 'html' | 'none',
    progressCallback: (current: number, total: number) => void
  ): Promise<void> {
    // Implementation details...
  }
}

/**
 * Register command in extension.ts
 */
export function registerScrivenerImport(context: vscode.ExtensionContext): void {
  const command = vscode.commands.registerCommand(
    'chapterwiseCodex.importScrivener',
    async () => {
      const importer = new ScrivenerImporter();
      const result = await importer.import();
      
      if (result.success && result.indexFilePath) {
        const choice = await vscode.window.showInformationMessage(
          `✅ Scrivener project imported successfully!\n\nGenerated ${result.filesGenerated} files`,
          'Open Index',
          'Show in Explorer'
        );
        
        if (choice === 'Open Index') {
          const doc = await vscode.workspace.openTextDocument(result.indexFilePath);
          await vscode.window.showTextDocument(doc);
        } else if (choice === 'Show in Explorer') {
          const uri = vscode.Uri.file(path.dirname(result.indexFilePath));
          await vscode.commands.executeCommand('revealFileInOS', uri);
        }
      }
    }
  );
  
  context.subscriptions.push(command);
}

/**
 * Dispose function
 */
export function disposeScrivenerImport(): void {
  // Cleanup if needed
}
```

### 2. ScrivenerParser (XML Parsing & Structure)

**File:** `src/scrivenerParser.ts`

```typescript
/**
 * Scrivener Parser
 * 
 * Parses .scrivx XML files and builds BinderItem tree structure.
 * Uses Node.js xml2js library for XML parsing.
 */

import * as fs from 'fs';
import * as path from 'path';
import { parseString } from 'xml2js';  // npm: xml2js

/**
 * Scrivener project data
 */
export interface ScrivenerProject {
  identifier: string;      // Project UUID
  version: string;         // Format version (e.g., "2.0" for Scrivener 3)
  creator: string;         // Scrivener version (e.g., "SCRMAC-3.4-16639")
  device: string;          // Device/computer name
  author: string;          // Project author
  title: string;           // Project title (from folder name)
  created: string;         // Creation timestamp
  modified: string;        // Last modified timestamp
  modID: string;           // Modification event ID
  binderItems: BinderItem[];
  
  // Global metadata definitions
  labelSettings?: LabelSettings;
  statusSettings?: StatusSettings;
  keywords?: KeywordDefinition[];
}

/**
 * Label settings (global definitions)
 */
export interface LabelSettings {
  title: string;           // Default: "Label"
  defaultLabelID: number;  // Default: -1 (No Label)
  labels: LabelDefinition[];
}

export interface LabelDefinition {
  id: number;
  name: string;
  color?: string;          // RGB color string
}

/**
 * Status settings (global definitions)
 */
export interface StatusSettings {
  title: string;           // Default: "Status"
  defaultStatusID: number; // Default: -1 (No Status)
  statuses: StatusDefinition[];
}

export interface StatusDefinition {
  id: number;
  name: string;
}

/**
 * Keyword definition (can be hierarchical)
 */
export interface KeywordDefinition {
  id: number;
  title: string;
  color?: string;
  children?: KeywordDefinition[];
}

/**
 * Binder item (document or folder)
 */
export interface BinderItem {
  uuid: string;              // Unique identifier (e.g., "2A4EC3C7-DAAC-4B52-B774-94028C9C2300")
  itemType: string;          // 'DraftFolder', 'Folder', 'Text', 'Trash'
  title: string;             // Display title
  created: string;           // ISO timestamp
  modified: string;          // ISO timestamp
  
  // Metadata (stored as IDs that reference global definitions)
  labelID?: number;          // References LabelSettings.labels[id]
  statusID?: number;         // References StatusSettings.statuses[id]
  keywordIDs?: number[];     // References Keywords global list
  
  // Resolved metadata (populated after lookup)
  label?: string;            // Resolved label name
  status?: string;           // Resolved status name
  keywords?: string[];       // Resolved keyword names
  
  // Additional metadata
  synopsis?: string;         // Document synopsis
  includeInCompile?: boolean; // Whether to include in compile
  iconFileName?: string;     // Icon identifier (e.g., "Information", "Notes (Blue Notepad)")
  
  // Content reference
  contentPath?: string;      // Path to content file: Files/Data/{UUID}/content.rtf
  
  // Hierarchy
  children: BinderItem[];
  parent?: BinderItem;
}

/**
 * Scrivener XML Parser
 */
export class ScrivenerParser {
  private scrivPath: string;
  private scrivxPath: string;
  
  constructor(scrivPath: string) {
    this.scrivPath = scrivPath;
    
    // Find .scrivx file
    const files = fs.readdirSync(scrivPath);
    const scrivxFile = files.find(f => f.toLowerCase().endsWith('.scrivx'));
    
    if (!scrivxFile) {
      throw new Error('No .scrivx file found in Scrivener project');
    }
    
    this.scrivxPath = path.join(scrivPath, scrivxFile);
  }
  
  /**
   * Parse Scrivener project
   */
  async parse(): Promise<ScrivenerProject> {
    const xmlContent = fs.readFileSync(this.scrivxPath, 'utf-8');
    
    return new Promise((resolve, reject) => {
      parseString(xmlContent, { explicitArray: false }, (err, result) => {
        if (err) {
          reject(err);
          return;
        }
        
        try {
          const project = this.parseProject(result);
          resolve(project);
        } catch (error) {
          reject(error);
        }
      });
    });
  }
  
  /**
   * Parse project root
   */
  private parseProject(xml: any): ScrivenerProject {
    const root = xml.ScrivenerProject;
    
    return {
      identifier: root.$.Identifier || 'unknown',
      version: root.$.Version || '2.0',
      creator: root.$.Creator || 'unknown',
      device: root.$.Device || 'unknown',
      author: root.$.Author || 'unknown',
      title: this.extractTitle(root),
      created: root.$.Created || '',
      modified: root.$.Modified || '',
      modID: root.$.ModID || '',
      binderItems: this.parseBinderItems(root.Binder),
      
      // Parse global metadata definitions
      labelSettings: this.parseLabelSettings(root.LabelSettings),
      statusSettings: this.parseStatusSettings(root.StatusSettings),
      keywords: this.parseKeywords(root.Keywords)
    };
  }
  
  /**
   * Parse label settings
   */
  private parseLabelSettings(xml: any): LabelSettings | undefined {
    if (!xml) return undefined;
    
    const labels: LabelDefinition[] = [];
    if (xml.Labels?.Label) {
      const labelArray = Array.isArray(xml.Labels.Label) ? xml.Labels.Label : [xml.Labels.Label];
      for (const label of labelArray) {
        labels.push({
          id: parseInt(label.$.ID || '-1'),
          name: label._ || label,
          color: label.$.Color
        });
      }
    }
    
    return {
      title: xml.Title || 'Label',
      defaultLabelID: parseInt(xml.DefaultLabelID || '-1'),
      labels
    };
  }
  
  /**
   * Parse status settings
   */
  private parseStatusSettings(xml: any): StatusSettings | undefined {
    if (!xml) return undefined;
    
    const statuses: StatusDefinition[] = [];
    if (xml.StatusItems?.Status) {
      const statusArray = Array.isArray(xml.StatusItems.Status) 
        ? xml.StatusItems.Status 
        : [xml.StatusItems.Status];
      for (const status of statusArray) {
        statuses.push({
          id: parseInt(status.$.ID || '-1'),
          name: status._ || status
        });
      }
    }
    
    return {
      title: xml.Title || 'Status',
      defaultStatusID: parseInt(xml.DefaultStatusID || '-1'),
      statuses
    };
  }
  
  /**
   * Parse keywords (can be hierarchical)
   */
  private parseKeywordsRecursive(xml: any): KeywordDefinition[] {
    const keywords: KeywordDefinition[] = [];
    
    const keywordArray = Array.isArray(xml) ? xml : [xml];
    for (const kw of keywordArray) {
      if (!kw || !kw.$) continue;
      
      const keyword: KeywordDefinition = {
        id: parseInt(kw.$.ID || '0'),
        title: kw.Title || '',
        color: kw.Color
      };
      
      // Parse children recursively
      if (kw.Children?.Keyword) {
        keyword.children = this.parseKeywordsRecursive(kw.Children.Keyword);
      }
      
      keywords.push(keyword);
    }
    
    return keywords;
  }
  
  private parseKeywords(xml: any): KeywordDefinition[] | undefined {
    if (!xml?.Keyword) return undefined;
    return this.parseKeywordsRecursive(xml.Keyword);
  }
  
  /**
   * Extract project title
   */
  private extractTitle(root: any): string {
    // Try to get from metadata or use .scriv folder name
    return path.basename(this.scrivPath, '.scriv');
  }
  
  /**
   * Parse binder items recursively
   */
  private parseBinderItems(binder: any, parent?: BinderItem): BinderItem[] {
    if (!binder || !binder.BinderItem) {
      return [];
    }
    
    const items = Array.isArray(binder.BinderItem) ? binder.BinderItem : [binder.BinderItem];
    
    return items.map(item => {
      const binderItem: BinderItem = {
        uuid: item.$.UUID,
        itemType: item.$.Type,
        title: item.Title || 'Untitled',
        created: item.$.Created || '',
        modified: item.$.Modified || '',
        
        // Parse metadata IDs (these reference global definitions)
        labelID: this.parseMetadataID(item.MetaData?.LabelID),
        statusID: this.parseMetadataID(item.MetaData?.StatusID),
        keywordIDs: this.parseKeywordIDs(item.MetaData),
        
        // Other metadata
        synopsis: item.MetaData?.Synopsis,
        includeInCompile: item.MetaData?.IncludeInCompile === 'Yes',
        iconFileName: item.MetaData?.IconFileName,
        
        // Content path (CRITICAL FIX: content.rtf is INSIDE UUID folder)
        contentPath: this.getContentPath(item.$.UUID),
        
        children: [],
        parent
      };
      
      // Parse children recursively
      if (item.Children) {
        binderItem.children = this.parseBinderItems(item.Children, binderItem);
      }
      
      return binderItem;
    });
  }
  
  /**
   * Parse metadata ID (can be string or number)
   */
  private parseMetadataID(value: any): number | undefined {
    if (value === undefined || value === null) return undefined;
    const id = parseInt(value);
    return isNaN(id) ? undefined : id;
  }
  
  /**
   * Parse keyword IDs from metadata
   * Keywords can be stored in various formats depending on version
   */
  private parseKeywordIDs(metadata: any): number[] | undefined {
    if (!metadata) return undefined;
    
    // Try different possible formats
    if (metadata.Keywords) {
      // Could be comma-separated IDs or a structured format
      if (typeof metadata.Keywords === 'string') {
        return metadata.Keywords.split(',')
          .map(k => parseInt(k.trim()))
          .filter(id => !isNaN(id));
      }
    }
    
    return undefined;
  }
  
  /**
   * Get content file path for a binder item UUID
   * CRITICAL: Content is stored as Files/Data/{UUID}/content.rtf
   * NOT as Files/Data/{UUID}.rtf
   */
  private getContentPath(uuid: string): string | undefined {
    // Correct path structure (verified from actual Scrivener projects)
    const contentPath = path.join(
      this.scrivPath, 
      'Files', 
      'Data', 
      uuid,              // UUID is a FOLDER name
      'content.rtf'      // Content file is always named this
    );
    
    if (fs.existsSync(contentPath)) {
      return contentPath;
    }
    
    // Try case-insensitive search for case-sensitive filesystems
    try {
      const dataDir = path.join(this.scrivPath, 'Files', 'Data');
      const folders = fs.readdirSync(dataDir);
      const matchingFolder = folders.find(f => f.toLowerCase() === uuid.toLowerCase());
      
      if (matchingFolder) {
        const altPath = path.join(dataDir, matchingFolder, 'content.rtf');
        if (fs.existsSync(altPath)) {
          return altPath;
        }
      }
    } catch (error) {
      // Folder might not exist for containers/folders
    }
    
    return undefined;
  }
  
  /**
   * Resolve label names after parsing
   */
  resolveMetadata(project: ScrivenerProject): void {
    this.resolveBinderMetadata(project.binderItems, project);
  }
  
  private resolveBinderMetadata(items: BinderItem[], project: ScrivenerProject): void {
    for (const item of items) {
      // Resolve label
      if (item.labelID !== undefined && project.labelSettings) {
        const label = project.labelSettings.labels.find(l => l.id === item.labelID);
        if (label) {
          item.label = label.name;
        }
      }
      
      // Resolve status
      if (item.statusID !== undefined && project.statusSettings) {
        const status = project.statusSettings.statuses.find(s => s.id === item.statusID);
        if (status) {
          item.status = status.name;
        }
      }
      
      // Resolve keywords
      if (item.keywordIDs && project.keywords) {
        item.keywords = [];
        for (const kwId of item.keywordIDs) {
          const keyword = this.findKeywordByID(project.keywords, kwId);
          if (keyword) {
            item.keywords.push(keyword.title);
          }
        }
      }
      
      // Recurse into children
      if (item.children) {
        this.resolveBinderMetadata(item.children, project);
      }
    }
  }
  
  private findKeywordByID(keywords: KeywordDefinition[], id: number): KeywordDefinition | undefined {
    for (const kw of keywords) {
      if (kw.id === id) return kw;
      if (kw.children) {
        const found = this.findKeywordByID(kw.children, id);
        if (found) return found;
      }
    }
    return undefined;
  }
}
```

### 3. RTFConverter (RTF to Markdown/HTML)

**File:** `src/rtfConverter.ts`

```typescript
/**
 * RTF Converter
 * 
 * Converts RTF files to Markdown or HTML.
 * Uses rtf.js or rtf-to-html npm package.
 */

import * as fs from 'fs';
import { RTFJS } from 'rtf.js';  // npm: rtf.js
// Alternative: import rtfToHTML from '@iarna/rtf-to-html';  // npm: @iarna/rtf-to-html

/**
 * RTF to Markdown/HTML Converter
 */
export class RTFConverter {
  
  /**
   * Convert RTF file to Markdown
   */
  async convertToMarkdown(rtfPath: string): Promise<string> {
    try {
      // Read RTF file
      const rtfBuffer = fs.readFileSync(rtfPath);
      
      // Parse RTF
      const doc = await RTFJS.parseBuffer(rtfBuffer);
      
      // Convert to HTML first
      const html = await doc.render();
      
      // Convert HTML to Markdown (simplified)
      const markdown = this.htmlToMarkdown(html);
      
      return markdown;
      
    } catch (error) {
      console.error(`Failed to convert RTF: ${rtfPath}`, error);
      return `[Error converting RTF content: ${error instanceof Error ? error.message : String(error)}]`;
    }
  }
  
  /**
   * Convert RTF file to HTML
   */
  async convertToHTML(rtfPath: string): Promise<string> {
    try {
      const rtfBuffer = fs.readFileSync(rtfPath);
      const doc = await RTFJS.parseBuffer(rtfBuffer);
      return await doc.render();
      
    } catch (error) {
      console.error(`Failed to convert RTF: ${rtfPath}`, error);
      return `<p>[Error converting RTF content]</p>`;
    }
  }
  
  /**
   * Get raw RTF content (no conversion)
   */
  getRawRTF(rtfPath: string): string {
    return fs.readFileSync(rtfPath, 'utf-8');
  }
  
  /**
   * Simplified HTML to Markdown converter
   * (For production, consider using turndown or similar library)
   */
  private htmlToMarkdown(html: string): string {
    let markdown = html;
    
    // Remove wrapping tags
    markdown = markdown.replace(/<html[^>]*>/gi, '');
    markdown = markdown.replace(/<\/html>/gi, '');
    markdown = markdown.replace(/<body[^>]*>/gi, '');
    markdown = markdown.replace(/<\/body>/gi, '');
    
    // Headers
    markdown = markdown.replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n\n');
    markdown = markdown.replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n');
    markdown = markdown.replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n\n');
    
    // Paragraphs
    markdown = markdown.replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n');
    
    // Bold/Italic
    markdown = markdown.replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**');
    markdown = markdown.replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**');
    markdown = markdown.replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*');
    markdown = markdown.replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*');
    
    // Line breaks
    markdown = markdown.replace(/<br\s*\/?>/gi, '\n');
    
    // Lists
    markdown = markdown.replace(/<ul[^>]*>/gi, '\n');
    markdown = markdown.replace(/<\/ul>/gi, '\n');
    markdown = markdown.replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n');
    
    // Clean up HTML entities
    markdown = markdown.replace(/&nbsp;/g, ' ');
    markdown = markdown.replace(/&quot;/g, '"');
    markdown = markdown.replace(/&apos;/g, "'");
    markdown = markdown.replace(/&amp;/g, '&');
    markdown = markdown.replace(/&lt;/g, '<');
    markdown = markdown.replace(/&gt;/g, '>');
    
    // Remove remaining HTML tags
    markdown = markdown.replace(/<[^>]+>/g, '');
    
    // Clean up whitespace
    markdown = markdown.replace(/\n{3,}/g, '\n\n');
    markdown = markdown.trim();
    
    return markdown;
  }
}
```

### 4. CodexBuilder (Hierarchical Structure)

**File:** `src/scrivenerToCodex.ts`

```typescript
/**
 * Scrivener to Codex Builder
 * 
 * Builds hierarchical Codex structure with include directives.
 * Same concept as Python version but in TypeScript.
 */

import * as path from 'path';
import { ScrivenerProject, BinderItem } from './scrivenerParser';

/**
 * Codex structure result
 */
export interface CodexStructure {
  indexFile: CodexNode;
  sections: CodexNode[];
  totalFiles: number;
}

/**
 * Codex node (file to be written)
 */
export interface CodexNode {
  filePath: string;        // Relative path in output directory
  data: Record<string, any>;  // Codex data structure
  children?: CodexNode[];  // Child nodes (for hierarchy tracking)
}

/**
 * Hierarchical Codex Builder
 */
export class CodexBuilder {
  private outputDir: string;
  private outputFormat: 'yaml' | 'json' | 'markdown';
  private fileCount: number = 0;
  private pathMapping: Map<string, string> = new Map();  // UUID -> relative path
  
  constructor(outputDir: string, outputFormat: 'yaml' | 'json' | 'markdown') {
    this.outputDir = outputDir;
    this.outputFormat = outputFormat;
  }
  
  /**
   * Build hierarchical Codex structure
   */
  buildHierarchy(project: ScrivenerProject): CodexStructure {
    // Reset state
    this.fileCount = 0;
    this.pathMapping.clear();
    
    // Phase 1: Build leaf nodes (chapters with content)
    const sections: CodexNode[] = [];
    
    for (const topItem of project.binderItems) {
      const sectionNode = this.buildSectionHierarchy(topItem);
      if (sectionNode) {
        sections.push(sectionNode);
      }
    }
    
    // Phase 2: Build index file
    const indexFile = this.buildIndexFile(project, sections);
    
    return {
      indexFile,
      sections,
      totalFiles: this.fileCount
    };
  }
  
  /**
   * Build section hierarchy recursively (bottom-up)
   * 
   * IMPORTANT: Text items can have children! They are NOT always leaves.
   * Example: A document with sub-documents is Type="Text" with <Children>.
   */
  private buildSectionHierarchy(item: BinderItem, parentPath: string = ''): CodexNode | null {
    const sectionName = this.slugify(item.title);
    const currentPath = parentPath ? `${parentPath}/${sectionName}` : sectionName;
    
    // Handle Text items (can have content AND children!)
    if (item.itemType === 'Text') {
      const textNode = this.buildLeafCodex(item, currentPath);
      this.fileCount++;
      
      // Check if this Text item has children
      if (item.children && item.children.length > 0) {
        const childNodes: CodexNode[] = [];
        
        for (const child of item.children) {
          const childNode = this.buildSectionHierarchy(child, currentPath);
          if (childNode) {
            childNodes.push(childNode);
          }
        }
        
        // Add children as includes to this text document
        if (childNodes.length > 0) {
          textNode.data.children = childNodes.map(child => ({
            include: this.makeRelativeInclude(textNode.filePath, child.filePath)
          }));
          textNode.children = childNodes;
        }
      }
      
      return textNode;
    }
    
    // Handle Folders and other container types
    if (item.children && item.children.length > 0) {
      const childNodes: CodexNode[] = [];
      
      for (const child of item.children) {
        const childNode = this.buildSectionHierarchy(child, currentPath);
        if (childNode) {
          childNodes.push(childNode);
        }
      }
      
      // Create folder codex with includes
      const folderFile = this.buildFolderCodex(item, currentPath, childNodes);
      this.fileCount++;
      
      return folderFile;
    }
    
    return null;
  }
  
  /**
   * Build leaf codex file (chapter with actual content)
   */
  private buildLeafCodex(item: BinderItem, parentPath: string): CodexNode {
    const fileName = `${this.slugify(item.title)}.codex.${this.outputFormat === 'markdown' ? 'md' : this.outputFormat}`;
    const filePath = `${parentPath}/${fileName}`;
    
    const codexData: Record<string, any> = {
      metadata: {
        formatVersion: '1.2',
        created: new Date().toISOString()
      },
      id: item.uuid,
      type: this.mapType(item),
      name: item.title,
      scrivenerType: item.itemType
    };
    
    // Add attributes
    const attributes = this.buildAttributes(item);
    if (attributes.length > 0) {
      codexData.attributes = attributes;
    }
    
    // Add body (RTF content - will be converted by RTFConverter)
    // Note: Actual content conversion happens in ScrivenerImporter
    if (item.contentPath) {
      codexData.body = `[RTF content from: ${item.contentPath}]`;
      codexData._contentPath = item.contentPath;  // Store for later conversion
    }
    
    // Track path
    this.pathMapping.set(item.uuid, filePath);
    
    return {
      filePath,
      data: codexData
    };
  }
  
  /**
   * Build folder codex file (aggregator with includes)
   */
  private buildFolderCodex(item: BinderItem, parentPath: string, childNodes: CodexNode[]): CodexNode {
    const folderName = this.slugify(item.title);
    const fileName = `${folderName}.codex.${this.outputFormat === 'markdown' ? 'md' : this.outputFormat}`;
    const filePath = `${parentPath}/${fileName}`;
    
    const codexData: Record<string, any> = {
      metadata: {
        formatVersion: '1.2',
        created: new Date().toISOString()
      },
      id: item.uuid,
      type: this.mapType(item),
      name: item.title,
      scrivenerType: item.itemType
    };
    
    // Add attributes
    const attributes = this.buildAttributes(item);
    if (attributes.length > 0) {
      codexData.attributes = attributes;
    }
    
    // Add include directives for children
    if (childNodes.length > 0) {
      codexData.children = childNodes.map(child => ({
        include: this.makeRelativeInclude(filePath, child.filePath)
      }));
    }
    
    // Track path
    this.pathMapping.set(item.uuid, filePath);
    
    return {
      filePath,
      data: codexData,
      children: childNodes
    };
  }
  
  /**
   * Build index file (.index.codex.yaml)
   */
  private buildIndexFile(project: ScrivenerProject, sections: CodexNode[]): CodexNode {
    const filePath = `.index.codex.${this.outputFormat === 'markdown' ? 'md' : this.outputFormat}`;
    
    const codexData: Record<string, any> = {
      metadata: {
        formatVersion: '1.2',
        created: new Date().toISOString(),
        tags: ['scrivener-import']
      },
      id: 'root',
      type: 'project',
      name: project.title,
      summary: `Imported from Scrivener project: ${project.title}`
    };
    
    // Add project metadata as attributes
    codexData.attributes = [
      { key: 'source', value: 'scrivener' },
      { key: 'scrivener_identifier', value: project.identifier },
      { key: 'scrivener_version', value: project.version },
      { key: 'scrivener_creator', value: project.creator },
      { key: 'scrivener_device', value: project.device },
      { key: 'original_author', value: project.author }
    ];
    
    // Add include directives for all sections
    if (sections.length > 0) {
      codexData.children = sections.map(section => ({
        include: section.filePath
      }));
    }
    
    this.fileCount++;
    
    return {
      filePath,
      data: codexData,
      children: sections
    };
  }
  
  /**
   * Map Scrivener type to Codex type
   */
  private mapType(item: BinderItem): string {
    const typeMap: Record<string, string> = {
      'DraftFolder': 'folder',
      'Folder': 'folder',
      'Text': this.guessTextType(item)
    };
    return typeMap[item.itemType] || 'document';
  }
  
  /**
   * Guess text type from label/context
   */
  private guessTextType(item: BinderItem): string {
    if (item.label?.toLowerCase().includes('chapter')) {
      return 'chapter';
    }
    if (item.label?.toLowerCase().includes('scene')) {
      return 'scene';
    }
    if (item.parent?.itemType === 'DraftFolder') {
      return 'chapter';
    }
    return 'document';
  }
  
  /**
   * Build attributes from Scrivener metadata
   */
  private buildAttributes(item: BinderItem): Array<{ key: string; value: string }> {
    const attributes: Array<{ key: string; value: string }> = [];
    
    if (item.label) {
      attributes.push({ key: 'label', value: item.label });
    }
    if (item.status) {
      attributes.push({ key: 'status', value: item.status });
    }
    if (item.keywords && item.keywords.length > 0) {
      attributes.push({ key: 'keywords', value: item.keywords.join(', ') });
    }
    if (item.synopsis) {
      attributes.push({ key: 'synopsis', value: item.synopsis });
    }
    
    return attributes;
  }
  
  /**
   * Make relative include path
   */
  private makeRelativeInclude(parentPath: string, childPath: string): string {
    const parentDir = path.dirname(parentPath);
    if (parentDir && parentDir !== '.') {
      return path.relative(parentDir, childPath);
    }
    return childPath;
  }
  
  /**
   * Slugify text for file names
   */
  private slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || 'untitled';
  }
}
```

### 5. FileWriter (Write Files to Disk)

**File:** `src/fileWriter.ts`

```typescript
/**
 * File Writer
 * 
 * Writes Scrivener content to disk in chosen format:
 * - Codex YAML (.codex.yaml)
 * - Codex JSON (.codex.json)
 * - Codex Lite (.md with YAML frontmatter)
 */

import * as fs from 'fs';
import * as path from 'path';
import * as YAML from 'yaml';
import { ScrivenerProject, BinderItem } from './scrivenerParser';

/**
 * File Writer for Scrivener imports
 */
export class FileWriter {
  private outputDir: string;
  
  constructor(outputDir: string) {
    this.outputDir = outputDir;
  }
  
  /**
   * Write Scrivener files to disk (flat structure, not hierarchical codex)
   * Returns number of files written
   */
  async writeScrivenerFiles(
    project: ScrivenerProject,
    format: 'yaml' | 'json' | 'markdown',
    contentFormat: string
  ): Promise<number> {
    // Create output directory
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
    
    let filesWritten = 0;
    
    // Write all binder items recursively
    filesWritten += await this.writeBinderItems(
      project.binderItems,
      '',  // Start at root
      format,
      contentFormat
    );
    
    return filesWritten;
  }
  
  /**
   * Recursively write binder items
   */
  private async writeBinderItems(
    items: BinderItem[],
    parentPath: string,
    format: 'yaml' | 'json' | 'markdown',
    contentFormat: string
  ): Promise<number> {
    let filesWritten = 0;
    
    for (const item of items) {
      // Handle folders
      if (item.itemType === 'Folder' || item.itemType === 'DraftFolder') {
        const folderPath = path.join(this.outputDir, parentPath, this.slugify(item.title));
        
        if (!fs.existsSync(folderPath)) {
          fs.mkdirSync(folderPath, { recursive: true });
        }
        
        // Recurse into children
        if (item.children && item.children.length > 0) {
          filesWritten += await this.writeBinderItems(
            item.children,
            path.join(parentPath, this.slugify(item.title)),
            format,
            contentFormat
          );
        }
      }
      
      // Handle text items (documents)
      else if (item.itemType === 'Text' && item.contentPath) {
        // Read RTF content (already converted to Markdown/HTML in memory)
        const content = item._convertedContent || '';  // Set by RTFConverter
        
        // Write based on format
        if (format === 'markdown') {
          // Codex Lite format
          filesWritten += await this.writeCodexLite(item, parentPath, content);
        } else {
          // Full Codex format (YAML or JSON)
          filesWritten += await this.writeFullCodex(item, parentPath, content, format);
        }
        
        // Handle nested Text items with children
        if (item.children && item.children.length > 0) {
          filesWritten += await this.writeBinderItems(
            item.children,
            parentPath,
            format,
            contentFormat
          );
        }
      }
    }
    
    return filesWritten;
  }
  
  /**
   * Write Codex Lite (Markdown with YAML frontmatter)
   */
  private async writeCodexLite(
    item: BinderItem,
    parentPath: string,
    content: string
  ): Promise<number> {
    const fileName = `${this.slugify(item.title)}.md`;
    const filePath = path.join(this.outputDir, parentPath, fileName);
    
    // Build YAML frontmatter
    const frontmatter: any = {
      type: this.mapScrivenerTypeToCodex(item),
      name: item.title
    };
    
    // Add Scrivener metadata
    if (item.label) {
      frontmatter.scrivener_label = item.label;
    }
    if (item.status) {
      frontmatter.scrivener_status = item.status;
    }
    if (item.keywords && item.keywords.length > 0) {
      frontmatter.tags = item.keywords.join(', ');
    }
    if (item.synopsis) {
      frontmatter.summary = item.synopsis;
    }
    if (item.includeInCompile !== undefined) {
      frontmatter.scrivener_include_in_compile = item.includeInCompile;
    }
    
    // Build file content
    const yamlFrontmatter = YAML.stringify(frontmatter).trim();
    const fileContent = `---\n${yamlFrontmatter}\n---\n\n# ${item.title}\n\n${content}`;
    
    // Write file
    fs.writeFileSync(filePath, fileContent, 'utf-8');
    
    return 1;
  }
  
  /**
   * Write Full Codex format (YAML or JSON)
   */
  private async writeFullCodex(
    item: BinderItem,
    parentPath: string,
    content: string,
    format: 'yaml' | 'json'
  ): Promise<number> {
    const extension = format === 'yaml' ? '.codex.yaml' : '.codex.json';
    const fileName = `${this.slugify(item.title)}${extension}`;
    const filePath = path.join(this.outputDir, parentPath, fileName);
    
    // Build codex data
    const codexData: any = {
      metadata: {
        formatVersion: '1.2',
        created: new Date().toISOString()
      },
      id: item.uuid,
      type: this.mapScrivenerTypeToCodex(item),
      name: item.title
    };
    
    // Add attributes
    const attributes: any[] = [];
    if (item.label) {
      attributes.push({ key: 'scrivener_label', value: item.label });
    }
    if (item.status) {
      attributes.push({ key: 'scrivener_status', value: item.status });
    }
    if (item.keywords && item.keywords.length > 0) {
      attributes.push({ key: 'keywords', value: item.keywords.join(', ') });
    }
    if (item.includeInCompile !== undefined) {
      attributes.push({ key: 'scrivener_include_in_compile', value: item.includeInCompile.toString() });
    }
    
    if (attributes.length > 0) {
      codexData.attributes = attributes;
    }
    
    // Add synopsis
    if (item.synopsis) {
      codexData.summary = item.synopsis;
    }
    
    // Add body content
    if (content) {
      codexData.body = content;
    }
    
    // Write file
    if (format === 'yaml') {
      const yamlContent = YAML.stringify(codexData);
      fs.writeFileSync(filePath, yamlContent, 'utf-8');
    } else {
      const jsonContent = JSON.stringify(codexData, null, 2);
      fs.writeFileSync(filePath, jsonContent, 'utf-8');
    }
    
    return 1;
  }
  
  /**
   * Map Scrivener item type to Codex type
   */
  private mapScrivenerTypeToCodex(item: BinderItem): string {
    // Check label first
    if (item.label) {
      const labelLower = item.label.toLowerCase();
      if (labelLower.includes('chapter')) return 'chapter';
      if (labelLower.includes('scene')) return 'scene';
      if (labelLower.includes('character')) return 'character';
      if (labelLower.includes('location')) return 'location';
    }
    
    // Check title patterns
    const titleLower = item.title.toLowerCase();
    if (titleLower.startsWith('chapter')) return 'chapter';
    if (titleLower.startsWith('scene')) return 'scene';
    if (titleLower.includes('character')) return 'character';
    if (titleLower.includes('location')) return 'location';
    
    // Default based on Scrivener type
    if (item.itemType === 'Text') return 'document';
    if (item.itemType === 'Folder') return 'folder';
    
    return 'document';
  }
  
  /**
   * Slugify text for file names
   */
  private slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')  // Remove special chars
      .replace(/\s+/g, '-')       // Spaces to hyphens
      .replace(/-+/g, '-')        // Multiple hyphens to one
      .replace(/^-|-$/g, '')      // Trim hyphens
      || 'untitled';
  }
}
```

---

## File Structure

### New Files in chapterwise-codex Extension

```
chapterwise-codex/
├── src/
│   ├── scrivenerImport.ts       # Main orchestrator
│   ├── scrivenerParser.ts       # XML parsing & structure
│   ├── rtfConverter.ts          # RTF → Markdown/HTML
│   ├── scrivenerToCodex.ts      # Hierarchical builder
│   ├── fileWriter.ts            # File writing utilities
│   └── extension.ts             # Register command (update)
├── package.json                 # Add command + dependencies (update)
└── README.md                    # Document new feature (update)
```

---

## Dependencies

### NPM Packages to Add

```json
{
  "dependencies": {
    "xml2js": "^0.6.2",           // XML parsing for .scrivx
    "rtf.js": "^3.0.8",            // RTF parsing and conversion
    "@types/xml2js": "^0.4.14",   // TypeScript types for xml2js
    "yaml": "^2.3.4",              // YAML parsing (for index integration)
    "glob": "^10.3.10",            // File pattern matching (for index integration)
    "ignore": "^5.3.0"             // Gitignore-style filtering (for index integration)
  }
}
```

### Alternative RTF Libraries

- **rtf.js**: Mature, well-documented (Recommended)
- **@iarna/rtf-to-html**: Simpler, HTML output only
- **rtf-parser**: Lower-level RTF parsing

---

## Output Format Comparison

### Format 1: Codex Lite (Markdown) - Recommended

**File:** `Chapter-01.md`

```markdown
---
type: chapter
name: "Chapter 1: The Awakening"
summary: "Aya discovers her powers"
tags: manuscript, part-one
status: draft
scrivener_label: "Chapter"
scrivener_status: "First Draft"
scrivener_include_in_compile: true
---

# Chapter 1: The Awakening

Aya's eyes opened to a world she had never seen before. The colors were more vibrant, the sounds more crisp. She sat up, disoriented.

"Where am I?" she whispered.

## Scene 2

The old man approached slowly...
```

**Benefits:**
- ✅ Human-readable
- ✅ Works in any Markdown editor (Obsidian, Typora, GitHub)
- ✅ Git-friendly (clean diffs)
- ✅ No lock-in (portable format)
- ✅ Index generator can read frontmatter
- ✅ Best for collaboration

**Use when:**
- Importing Scrivener projects
- Want Git version control
- Need human-readable files
- Collaborating with others

---

### Format 2: Codex YAML

**File:** `Chapter-01.codex.yaml`

```yaml
metadata:
  formatVersion: "1.2"
  created: "2025-12-14T10:30:00Z"

id: "2A4EC3C7-DAAC-4B52-B774-94028C9C2300"
type: "chapter"
name: "Chapter 1: The Awakening"
scrivenerType: "Text"

attributes:
  - key: "scrivener_label"
    value: "Chapter"
  - key: "scrivener_status"
    value: "First Draft"
  - key: "scrivener_include_in_compile"
    value: "true"
  - key: "keywords"
    value: "manuscript, part-one"

summary: "Aya discovers her powers"

body: |
  Aya's eyes opened to a world she had never seen before. The colors were more vibrant, the sounds more crisp. She sat up, disoriented.
  
  "Where am I?" she whispered.
  
  ## Scene 2
  
  The old man approached slowly...
```

**Benefits:**
- ✅ Full codex format
- ✅ Can have nested `children` arrays
- ✅ Structured metadata
- ✅ Index generator can read type/name
- ✅ Best for complex hierarchies

**Use when:**
- Need hierarchical children within documents
- Want structured metadata
- Building complex nested structures

---

### Format 3: Codex JSON

**File:** `Chapter-01.codex.json`

```json
{
  "metadata": {
    "formatVersion": "1.2",
    "created": "2025-12-14T10:30:00Z"
  },
  "id": "2A4EC3C7-DAAC-4B52-B774-94028C9C2300",
  "type": "chapter",
  "name": "Chapter 1: The Awakening",
  "scrivenerType": "Text",
  "attributes": [
    {"key": "scrivener_label", "value": "Chapter"},
    {"key": "scrivener_status", "value": "First Draft"},
    {"key": "scrivener_include_in_compile", "value": "true"},
    {"key": "keywords", "value": "manuscript, part-one"}
  ],
  "summary": "Aya discovers her powers",
  "body": "Aya's eyes opened to a world she had never seen before. The colors were more vibrant, the sounds more crisp. She sat up, disoriented.\n\n\"Where am I?\" she whispered.\n\n## Scene 2\n\nThe old man approached slowly..."
}
```

**Benefits:**
- ✅ Machine-readable
- ✅ API-friendly
- ✅ Can have nested children
- ✅ Index generator can read type/name
- ✅ Best for programmatic access

**Use when:**
- Building APIs
- Want machine-readable format
- Programmatic processing

---

## Format Recommendation Matrix

| Use Case | Recommended Format | Why |
|----------|-------------------|-----|
| **Scrivener Import** | Codex Lite (Markdown) | Human-readable, Git-friendly, portable |
| **Collaboration** | Codex Lite (Markdown) | Works in any editor, clean diffs |
| **Complex Hierarchies** | Codex YAML | Nested children support |
| **API Integration** | Codex JSON | Machine-readable |
| **Quick Prototyping** | Codex Lite (Markdown) | Fastest to write/edit |
| **Large Projects** | Codex Lite (Markdown) | Best Git performance |

**Default recommendation:** **Codex Lite (Markdown)** for 90% of use cases



---

## Configuration

### package.json Updates

```json
{
  "contributes": {
    "commands": [
      {
        "command": "chapterwiseCodex.importScrivener",
        "title": "ChapterWise Codex: Import Scrivener Project",
        "icon": "$(file-add)"
      }
    ],
    "menus": {
      "commandPalette": [
        {
          "command": "chapterwiseCodex.importScrivener",
          "when": "true"
        }
      ]
    },
    "configuration": {
      "title": "ChapterWise Codex",
      "properties": {
        "chapterwiseCodex.scrivenerImport.defaultOutputFormat": {
          "type": "string",
          "enum": ["yaml", "json", "markdown"],
          "default": "yaml",
          "description": "Default output format for Scrivener imports"
        },
        "chapterwiseCodex.scrivenerImport.defaultContentConversion": {
          "type": "string",
          "enum": ["markdown", "html", "none"],
          "default": "markdown",
          "description": "Default RTF content conversion method"
        },
        "chapterwiseCodex.scrivenerImport.createBackup": {
          "type": "boolean",
          "default": false,
          "description": "Create backup of Scrivener project before import"
        }
      }
    }
  }
}
```

---

## Testing Strategy

### Unit Tests

```typescript
// test/scrivenerParser.test.ts
describe('ScrivenerParser', () => {
  it('should parse .scrivx XML correctly', async () => {
    // Test XML parsing
  });
  
  it('should build binder hierarchy', async () => {
    // Test hierarchy building
  });
  
  it('should map RTF paths correctly', async () => {
    // Test RTF path resolution
  });
});

// test/rtfConverter.test.ts
describe('RTFConverter', () => {
  it('should convert RTF to Markdown', async () => {
    // Test RTF conversion
  });
  
  it('should handle RTF errors gracefully', async () => {
    // Test error handling
  });
});

// test/codexBuilder.test.ts
describe('CodexBuilder', () => {
  it('should build hierarchical structure', () => {
    // Test hierarchy building
  });
  
  it('should generate correct include directives', () => {
    // Test include generation
  });
  
  it('should create valid .index.codex.yaml', () => {
    // Test index file
  });
});
```

### Integration Tests

1. **Sample Projects**: Create small test .scriv projects
2. **End-to-End**: Test full import workflow
3. **Cross-Platform**: Test on macOS and Windows
4. **Error Cases**: Test with corrupted/incomplete projects

---

## Documentation

### README.md Updates

```markdown
## Scrivener Import

Import Scrivener projects directly into VS Code as hierarchical Codex structures.

### Features

- ✅ Local processing - no server upload required
- ✅ Works with .scriv folders from macOS and Windows
- ✅ Generates hierarchical Codex files with include directives
- ✅ Converts RTF content to Markdown or HTML
- ✅ Creates zoomable navigation structure

### Usage

1. Open Command Palette (`Cmd+Shift+P` or `Ctrl+Shift+P`)
2. Type "Import Scrivener" and select **ChapterWise Codex: Import Scrivener Project**
3. Select your `.scriv` folder
4. Choose output location and preferences
5. Wait for conversion to complete
6. Open the generated `.index.codex.yaml` file

### What Gets Created

```
YourProject/
├── .index.codex.yaml              # Master index
├── Manuscript/
│   ├── Manuscript.codex.yaml      # Full manuscript
│   ├── Part-01/
│   │   ├── Part-01.codex.yaml    # Part aggregator
│   │   ├── Chapter-01.codex.yaml # Individual chapters
│   │   └── Chapter-02.codex.yaml
│   └── Part-02/...
├── Research/
│   └── Research.codex.yaml
└── Notes/
    └── Notes.codex.yaml
```

### Configuration

Settings available in VS Code settings:

- `chapterwiseCodex.scrivenerImport.defaultOutputFormat`: YAML, JSON, or Markdown
- `chapterwiseCodex.scrivenerImport.defaultContentConversion`: Markdown, HTML, or none
- `chapterwiseCodex.scrivenerImport.createBackup`: Create backup before import

### Troubleshooting

**"No .scrivx file found"**: Make sure you selected a valid Scrivener project folder.

**"RTF conversion failed"**: Some complex RTF formatting may not convert perfectly. Try "Keep RTF" option.

**"File already exists"**: The output folder already contains files. Choose a different location or delete existing files.
```

---

## Implementation Checklist

### Phase 1: Core Functionality

- [ ] Create `scrivenerParser.ts` - XML parsing and structure extraction
- [ ] Create `rtfConverter.ts` - RTF to Markdown/HTML conversion
- [ ] Create `scrivenerToCodex.ts` - Hierarchical Codex builder
- [ ] Create `fileWriter.ts` - File writing utilities
- [ ] Create `scrivenerImport.ts` - Main orchestrator

### Phase 2: Integration

- [ ] Update `extension.ts` to register command
- [ ] Update `package.json` with command definition
- [ ] Update `package.json` with new dependencies
- [ ] Install npm packages (`xml2js`, `rtf.js`)

### Phase 3: Testing

- [ ] Create sample .scriv test projects (Mac & Windows)
- [ ] Write unit tests for each module
- [ ] Write integration tests for full workflow
- [ ] Test cross-platform (macOS & Windows)
- [ ] Test error handling

### Phase 4: Documentation

- [ ] Update README.md with Scrivener import instructions
- [ ] Add inline code documentation
- [ ] Create user guide in extension docs
- [ ] Add troubleshooting section
- [ ] Create demo video/GIF

### Phase 5: Polish

- [ ] Add progress indicators for long operations
- [ ] Implement cancel operation
- [ ] Add preview before import
- [ ] Add undo/rollback functionality
- [ ] Optimize performance for large projects

---

## Success Metrics

### Functional Requirements

✓ Import .scriv projects from local filesystem  
✓ Parse .scrivx XML and build binder hierarchy  
✓ Convert RTF content to Markdown/HTML  
✓ Generate hierarchical Codex files with includes  
✓ Create .index.codex.yaml master file  
✓ Work on both macOS and Windows  
✓ Handle projects up to 500 documents  
✓ Complete import in < 30 seconds for typical project

### Quality Requirements

✓ No server upload or storage required  
✓ All processing happens locally  
✓ Graceful error handling  
✓ Clear progress indication  
✓ Valid Codex output files  
✓ Preserve 95%+ of content and metadata

### User Experience

✓ Simple Command Palette integration  
✓ Intuitive QuickPick dialogs  
✓ Clear progress notifications  
✓ Helpful error messages  
✓ One-click to open results  
✓ Comprehensive documentation

---

## Comparison: Web App vs. VS Code Extension

### User Journey Comparison

| Step | Web App (Python) | VS Code Extension (TypeScript) |
|------|------------------|--------------------------------|
| **1. Prepare** | Create ZIP of .scriv | Open .scriv folder in Finder/Explorer |
| **2. Upload** | Upload ZIP (slow) | Select folder (instant) |
| **3. Process** | Wait for server | Watch progress bar (local) |
| **4. Download** | Download results | Already in workspace |
| **5. Open** | Extract & open | Open directly |

**VS Code is 5x faster and 100% more private.**

### Technical Comparison

| Aspect | Web App | VS Code Extension |
|--------|---------|-------------------|
| **Language** | Python | TypeScript/Node.js |
| **Environment** | Flask server | VS Code extension host |
| **File Access** | Uploaded ZIP | Direct filesystem |
| **Processing** | Server-side | Client-side |
| **Progress** | WebSocket/polling | VS Code API |
| **Output** | Project model in DB | Files in workspace |
| **Cost** | Server resources | $0 (user's CPU) |

---

## Conclusion

The **VS Code Extension approach** is superior for Scrivener import because:

1. **Better UX**: No ZIP, no upload, instant results
2. **More Private**: Files never leave user's computer
3. **Faster**: No network latency
4. **Free**: No server costs
5. **Integrated**: Native VS Code workflow
6. **Offline**: Works without internet

The same hierarchical output structure (zoomable Codex with includes) is maintained, but the implementation is 100% local and free.

---

**Status: READY FOR IMPLEMENTATION** ✅

---

## Integration with Index Navigation System

This Scrivener Import feature integrates seamlessly with the [Index Navigation System](./Index%20Navigation%20-%20VS%20Code%20Extension.md). Here's how they work together:

### Complete Workflow

```
1. Import Scrivener
   ↓
2. Files written to disk (Codex Lite Markdown)
   ↓
3. index.codex.yaml created (boilerplate)
   ↓
4. .index.codex.yaml generated (full scan)
   ↓
5. Open .index.codex.yaml
   ↓
6. Navigator shows full project tree
   ↓
7. Click files to open/edit
```

### Shared Functions

The Scrivener importer **uses functions from the Index Navigation system**:

**From `indexBoilerplate.ts`:**
- `createBoilerplateIndex()` - Creates index.codex.yaml after import

**From `indexGenerator.ts`:**
- `generateIndex()` - Scans imported files and creates .index.codex.yaml
- `scanWorkspace()` - Finds all .md files
- `buildHierarchy()` - Builds tree from file paths
- `parseFrontmatter()` - Reads type/name from Codex Lite files

### Example Output Structure

**After Scrivener import with Codex Lite format:**

```
MyNovel/
├── index.codex.yaml              # Boilerplate (manual editing)
├── .index.codex.yaml             # Auto-generated (full scan)
├── Manuscript/
│   ├── Part-01/
│   │   ├── Chapter-01.md         # Codex Lite
│   │   └── Chapter-02.md         # Codex Lite
│   └── Part-02/
│       ├── Chapter-03.md
│       └── Chapter-04.md
├── Characters/
│   ├── Aya.md                    # Codex Lite
│   ├── Maya.md                   # Codex Lite
│   └── Xena.md                   # Codex Lite
└── Research/
    └── Notes.md                  # Codex Lite
```

**Each .md file has frontmatter from Scrivener:**

```markdown
---
type: chapter
name: "Chapter 1: The Awakening"
scrivener_label: "Chapter"
scrivener_status: "First Draft"
scrivener_include_in_compile: true
tags: manuscript, part-one
summary: "Aya discovers her time-traveling powers"
---

# Chapter 1: The Awakening

Aya's eyes opened to a world...
```

**The `.index.codex.yaml` includes all files:**

```yaml
metadata:
  formatVersion: "2.1"
  generated: true

id: "index-root"
type: "index"
name: "MyNovel"

children:
  - id: "folder-manuscript"
    type: "folder"
    name: "Manuscript"
    children:
      - id: "folder-part-01"
        type: "folder"
        name: "Part-01"
        children:
          - id: "file-chapter-01"
            type: "chapter"              # From frontmatter
            name: "Chapter 1: The Awakening"  # From frontmatter
            _filename: "Chapter-01.md"
            _computed_path: "Manuscript/Part-01/Chapter-01.md"
```

### No Redundancy

**Scrivener Import handles:**
- ✅ Parsing .scriv XML
- ✅ Converting RTF to Markdown
- ✅ Writing files with frontmatter
- ✅ Preserving Scrivener metadata

**Index Navigation handles:**
- ✅ Creating boilerplate index
- ✅ Scanning filesystem
- ✅ Building hierarchical tree
- ✅ Navigator UI and file opening

**No overlap** - Each system has a clear, distinct responsibility!

### User Commands

```
ChapterWise Codex: Import Scrivener Project
→ Parses .scriv, writes files, optionally generates index

ChapterWise Codex: Generate Index
→ Scans workspace, creates .index.codex.yaml

ChapterWise Codex: Create Index File
→ Creates boilerplate index.codex.yaml
```

All three commands work together but can be used independently.

---

## Summary of Changes

### Format Options (NEW!)

Users can now choose between **three output formats**:

1. **Codex Lite (Markdown)** - Recommended for Scrivener imports
   - Standard Markdown with YAML frontmatter
   - Human-readable, Git-friendly
   - Works in any editor (Obsidian, Typora, GitHub)
   - Best for collaboration

2. **Codex YAML** (.codex.yaml)
   - Full codex format
   - Supports complex nested structures
   - Best for advanced hierarchies

3. **Codex JSON** (.codex.json)
   - Full codex format in JSON
   - Machine-readable
   - API-friendly

### Index Generation (NEW!)

After import, users can optionally:
- Generate `index.codex.yaml` (boilerplate for customization)
- Generate `.index.codex.yaml` (full auto-generated index)
- Navigate entire project in ChapterWise Codex Navigator

### Integration Benefits

✅ **Seamless workflow** - Import → Generate → Navigate  
✅ **Shared codebase** - Reuses index generation functions  
✅ **No redundancy** - Clear separation of concerns  
✅ **User choice** - Can skip index generation if desired  
✅ **Format flexibility** - Choose best format for your needs


