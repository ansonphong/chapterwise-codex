/**
 * Git Setup Utilities for ChapterWise Codex
 * Provides Git initialization, .gitignore management, and Git LFS setup
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import { GITIGNORE_TEMPLATE, GITATTRIBUTES_TEMPLATE, getGitIgnoreDescription, getGitAttributesDescription } from './gitSetup/templates';

const execAsync = promisify(exec);

/**
 * Result of a Git command execution
 */
export interface GitCommandResult {
  success: boolean;
  output: string;
  error?: string;
}

/**
 * Check if Git is installed and available in PATH
 */
export async function checkGitInstalled(): Promise<boolean> {
  try {
    const result = await runGitCommand('--version', process.cwd());
    return result.success && result.output.includes('git version');
  } catch (error) {
    return false;
  }
}

/**
 * Check if Git LFS is installed and available
 */
export async function checkGitLFSInstalled(): Promise<boolean> {
  try {
    const result = await runGitCommand('lfs version', process.cwd());
    return result.success && result.output.toLowerCase().includes('git-lfs');
  } catch (error) {
    return false;
  }
}

/**
 * Run a Git command in the specified directory
 */
export async function runGitCommand(command: string, cwd: string): Promise<GitCommandResult> {
  try {
    const { stdout, stderr } = await execAsync(`git ${command}`, { cwd });
    return {
      success: true,
      output: stdout.trim(),
      error: stderr.trim() || undefined
    };
  } catch (error: any) {
    return {
      success: false,
      output: '',
      error: error.message || 'Unknown error'
    };
  }
}

/**
 * Check if a directory is already a Git repository
 */
export function isGitRepository(workspaceRoot: string): boolean {
  const gitDir = path.join(workspaceRoot, '.git');
  return fs.existsSync(gitDir);
}

/**
 * Initialize a new Git repository
 */
export async function initializeGitRepository(): Promise<void> {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    vscode.window.showErrorMessage('No workspace folder found. Please open a folder first.');
    return;
  }

  const workspaceRoot = workspaceFolder.uri.fsPath;

  // Check if Git is installed
  if (!await checkGitInstalled()) {
    const choice = await vscode.window.showErrorMessage(
      'Git is not installed or not found in PATH.',
      'Learn How to Install',
      'Cancel'
    );
    if (choice === 'Learn How to Install') {
      vscode.env.openExternal(vscode.Uri.parse('https://git-scm.com/downloads'));
    }
    return;
  }

  // Check if already a Git repo
  if (isGitRepository(workspaceRoot)) {
    const choice = await vscode.window.showInformationMessage(
      'This folder is already a Git repository.',
      'OK'
    );
    return;
  }

  // Confirm initialization
  const confirm = await vscode.window.showInformationMessage(
    `Initialize Git repository in:\n${workspaceRoot}`,
    'Initialize',
    'Cancel'
  );

  if (confirm !== 'Initialize') {
    return;
  }

  // Initialize the repository
  await vscode.window.withProgress({
    location: vscode.ProgressLocation.Notification,
    title: 'Initializing Git repository...',
    cancellable: false
  }, async (progress) => {
    const result = await runGitCommand('init', workspaceRoot);
    
    if (result.success) {
      vscode.window.showInformationMessage(
        `✅ Git repository initialized successfully in ${path.basename(workspaceRoot)}`
      );
    } else {
      vscode.window.showErrorMessage(
        `Failed to initialize Git repository: ${result.error || 'Unknown error'}`
      );
    }
  });
}

/**
 * Read file content or return empty string if file doesn't exist
 */
function readFileOrEmpty(filePath: string): string {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch (error) {
    return '';
  }
}

/**
 * Append unique lines to content (only add if they don't already exist)
 */
function appendUniqueLines(existingContent: string, newLines: string): string {
  const existing = existingContent.split('\n');
  const toAdd = newLines.split('\n');
  
  const result = [...existing];
  
  for (const line of toAdd) {
    const trimmed = line.trim();
    // Skip empty lines and comments when checking for duplicates
    if (trimmed === '' || trimmed.startsWith('#')) {
      result.push(line);
      continue;
    }
    
    // Check if this pattern already exists
    const alreadyExists = existing.some(existingLine => 
      existingLine.trim() === trimmed
    );
    
    if (!alreadyExists) {
      result.push(line);
    }
  }
  
  return result.join('\n');
}

/**
 * Create or update .gitignore file with writing-specific patterns
 */
export async function ensureGitIgnore(): Promise<void> {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    vscode.window.showErrorMessage('No workspace folder found. Please open a folder first.');
    return;
  }

  const workspaceRoot = workspaceFolder.uri.fsPath;
  const gitignorePath = path.join(workspaceRoot, '.gitignore');
  const exists = fs.existsSync(gitignorePath);

  // Show preview of what will be added
  const action = exists ? 'update' : 'create';
  const description = getGitIgnoreDescription();
  
  const confirm = await vscode.window.showInformationMessage(
    exists
      ? `Update .gitignore with writing project patterns?\n\n${description}\n\nExisting patterns will be preserved.`
      : `Create .gitignore for your writing project?\n\n${description}`,
    'Show Preview',
    action === 'create' ? 'Create' : 'Update',
    'Cancel'
  );

  if (confirm === 'Cancel' || !confirm) {
    return;
  }

  if (confirm === 'Show Preview') {
    // Show preview in a new document
    const doc = await vscode.workspace.openTextDocument({
      content: GITIGNORE_TEMPLATE,
      language: 'gitignore'
    });
    await vscode.window.showTextDocument(doc, { preview: true });
    
    // Ask again after preview
    const confirmAfterPreview = await vscode.window.showInformationMessage(
      `${action === 'create' ? 'Create' : 'Update'} .gitignore with these patterns?`,
      action === 'create' ? 'Create' : 'Update',
      'Cancel'
    );
    
    if (confirmAfterPreview !== (action === 'create' ? 'Create' : 'Update')) {
      return;
    }
  }

  // Create or update the file
  await vscode.window.withProgress({
    location: vscode.ProgressLocation.Notification,
    title: `${action === 'create' ? 'Creating' : 'Updating'} .gitignore...`,
    cancellable: false
  }, async (progress) => {
    try {
      let content: string;
      
      if (exists) {
        // Update existing file
        const existingContent = readFileOrEmpty(gitignorePath);
        content = appendUniqueLines(existingContent, '\n' + GITIGNORE_TEMPLATE);
      } else {
        // Create new file
        content = GITIGNORE_TEMPLATE;
      }
      
      fs.writeFileSync(gitignorePath, content, 'utf-8');
      
      vscode.window.showInformationMessage(
        `✅ .gitignore ${action === 'create' ? 'created' : 'updated'} successfully with ${description}`
      );
      
      // Open the file
      const doc = await vscode.workspace.openTextDocument(gitignorePath);
      await vscode.window.showTextDocument(doc);
      
    } catch (error: any) {
      vscode.window.showErrorMessage(
        `Failed to ${action} .gitignore: ${error.message || 'Unknown error'}`
      );
    }
  });
}

/**
 * Setup Git LFS and create/update .gitattributes
 */
export async function setupGitLFS(): Promise<void> {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    vscode.window.showErrorMessage('No workspace folder found. Please open a folder first.');
    return;
  }

  const workspaceRoot = workspaceFolder.uri.fsPath;

  // Check if Git LFS is installed
  if (!await checkGitLFSInstalled()) {
    const choice = await vscode.window.showErrorMessage(
      'Git LFS is not installed. Git LFS is required to track large binary files.',
      'Learn How to Install',
      'Cancel'
    );
    if (choice === 'Learn How to Install') {
      vscode.env.openExternal(vscode.Uri.parse('https://git-lfs.github.com/'));
    }
    return;
  }

  const gitattributesPath = path.join(workspaceRoot, '.gitattributes');
  const exists = fs.existsSync(gitattributesPath);

  // Show what LFS will track
  const description = getGitAttributesDescription();
  
  const confirm = await vscode.window.showInformationMessage(
    exists
      ? `Setup Git LFS for large files?\n\n${description}\n\nExisting attributes will be preserved.`
      : `Setup Git LFS to track large binary files?\n\n${description}\n\nThis will enable efficient storage for images, documents, audio, and video.`,
    'Show Preview',
    'Setup LFS',
    'Cancel'
  );

  if (confirm === 'Cancel' || !confirm) {
    return;
  }

  if (confirm === 'Show Preview') {
    // Show preview
    const doc = await vscode.workspace.openTextDocument({
      content: GITATTRIBUTES_TEMPLATE,
      language: 'gitattributes'
    });
    await vscode.window.showTextDocument(doc, { preview: true });
    
    // Ask again
    const confirmAfterPreview = await vscode.window.showInformationMessage(
      'Setup Git LFS with these file types?',
      'Setup LFS',
      'Cancel'
    );
    
    if (confirmAfterPreview !== 'Setup LFS') {
      return;
    }
  }

  // Setup Git LFS
  await vscode.window.withProgress({
    location: vscode.ProgressLocation.Notification,
    title: 'Setting up Git LFS...',
    cancellable: false
  }, async (progress) => {
    try {
      // Install Git LFS for the user
      progress.report({ message: 'Installing Git LFS hooks...', increment: 25 });
      const installResult = await runGitCommand('lfs install', workspaceRoot);
      
      if (!installResult.success) {
        throw new Error(installResult.error || 'Failed to install Git LFS');
      }

      // Create or update .gitattributes
      progress.report({ message: 'Configuring file tracking...', increment: 50 });
      
      let content: string;
      if (exists) {
        const existingContent = readFileOrEmpty(gitattributesPath);
        content = appendUniqueLines(existingContent, '\n' + GITATTRIBUTES_TEMPLATE);
      } else {
        content = GITATTRIBUTES_TEMPLATE;
      }
      
      fs.writeFileSync(gitattributesPath, content, 'utf-8');
      
      progress.report({ message: 'Complete!', increment: 25 });
      
      vscode.window.showInformationMessage(
        `✅ Git LFS setup complete!\n\nNow tracking ${description}`
      );
      
      // Open the file
      const doc = await vscode.workspace.openTextDocument(gitattributesPath);
      await vscode.window.showTextDocument(doc);
      
    } catch (error: any) {
      vscode.window.showErrorMessage(
        `Failed to setup Git LFS: ${error.message || 'Unknown error'}`
      );
    }
  });
}

/**
 * Create initial commit with .gitignore and .gitattributes
 */
export async function createInitialCommit(): Promise<void> {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    vscode.window.showErrorMessage('No workspace folder found.');
    return;
  }

  const workspaceRoot = workspaceFolder.uri.fsPath;

  if (!isGitRepository(workspaceRoot)) {
    vscode.window.showErrorMessage('Not a Git repository. Initialize Git first.');
    return;
  }

  const confirm = await vscode.window.showInformationMessage(
    'Create initial commit with your project files?',
    'Create Commit',
    'Cancel'
  );

  if (confirm !== 'Create Commit') {
    return;
  }

  await vscode.window.withProgress({
    location: vscode.ProgressLocation.Notification,
    title: 'Creating initial commit...',
    cancellable: false
  }, async (progress) => {
    try {
      // Stage all files
      progress.report({ message: 'Staging files...', increment: 33 });
      const addResult = await runGitCommand('add .', workspaceRoot);
      
      if (!addResult.success) {
        throw new Error(addResult.error || 'Failed to stage files');
      }

      // Create commit
      progress.report({ message: 'Creating commit...', increment: 34 });
      const commitResult = await runGitCommand(
        'commit -m "Initial commit - ChapterWise project setup"',
        workspaceRoot
      );
      
      if (!commitResult.success) {
        // Check if there's nothing to commit
        if (commitResult.error?.includes('nothing to commit')) {
          vscode.window.showInformationMessage('No changes to commit.');
          return;
        }
        throw new Error(commitResult.error || 'Failed to create commit');
      }

      progress.report({ message: 'Complete!', increment: 33 });
      
      vscode.window.showInformationMessage(
        '✅ Initial commit created successfully!\n\nYour project is now version-controlled.'
      );
      
    } catch (error: any) {
      vscode.window.showErrorMessage(
        `Failed to create commit: ${error.message || 'Unknown error'}`
      );
    }
  });
}

/**
 * Dispose of any resources
 */
export function disposeGitSetup(): void {
  // No resources to clean up currently
}

