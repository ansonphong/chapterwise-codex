/**
 * ChapterWise Codex Extension
 * Transform .codex.yaml and .codex.json editing into a Scrivener-like writing experience
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as YAML from 'yaml';
import { CodexTreeProvider, CodexTreeItem, CodexFieldTreeItem, IndexNodeTreeItem, CodexTreeItemType, createCodexTreeView } from './treeProvider';
import { WriterViewManager } from './writerView';
import { initializeValidation } from './validation';
import { isCodexFile, parseMarkdownAsCodex, parseCodex, CodexNode } from './codexModel';
import { runAutoFixer, disposeAutoFixer } from './autoFixer';
import { runExplodeCodex, disposeExplodeCodex } from './explodeCodex';
import { runImplodeCodex, disposeImplodeCodex } from './implodeCodex';
import { runUpdateWordCount, disposeWordCount } from './wordCount';
import { runGenerateTags, disposeTagGenerator } from './tagGenerator';
import { runGenerateIndex, runRegenerateIndex, generateFolderHierarchy, IndexGenerationProgress } from './indexGenerator';
import { runCreateIndexFile } from './indexBoilerplate';
import { runConvertToMarkdown, runConvertToCodex, disposeConvertFormat } from './convertFormat';
import { countFilesInIndex as countIndexFiles } from './indexParser';
import { CodexDragAndDropController } from './dragDropController';
import { initializeGitRepository, ensureGitIgnore, setupGitLFS, disposeGitSetup } from './gitSetup';
import { runGitSetupWizard } from './gitSetup/wizard';
import { registerScrivenerImport, disposeScrivenerImport } from './scrivenerImport';
import { MultiIndexManager } from './multiIndexManager';
import { SubIndexTreeProvider } from './subIndexTreeProvider';
import { MasterIndexTreeProvider } from './masterIndexTreeProvider';

/**
 * Notification Helper - Show transient messages that auto-dismiss
 * Use this for success confirmations, context switches, and progress updates
 * @param message - The message to display
 * @param duration - Duration in milliseconds (default: 3000)
 */
function showTransientMessage(message: string, duration: number = 3000): void {
  vscode.window.setStatusBarMessage(message, duration);
}

let treeProvider: CodexTreeProvider;
let treeView: vscode.TreeView<CodexTreeItemType>;
let writerViewManager: WriterViewManager;
let statusBarItem: vscode.StatusBarItem;
let outputChannel: vscode.OutputChannel;

// Multi-index support
let multiIndexManager: MultiIndexManager | undefined;
let masterTreeProvider: MasterIndexTreeProvider | undefined;
const subIndexProviders: SubIndexTreeProvider[] = [];
const subIndexViews: vscode.TreeView<CodexTreeItemType>[] = [];

/**
 * Get the output channel for logging
 */
export function getOutputChannel(): vscode.OutputChannel | undefined {
  return outputChannel;
}

/**
 * Restore the last saved Codex context on startup
 */
async function restoreLastContext(context: vscode.ExtensionContext): Promise<void> {
  try {
    const savedContextPath = context.workspaceState.get<string>('chapterwiseCodex.lastContextPath');
    const savedContextType = context.workspaceState.get<string>('chapterwiseCodex.lastContextType');

    if (!savedContextPath || !savedContextType) {
      return; // No saved context
    }

    outputChannel.appendLine(`[restoreLastContext] Attempting to restore context: ${savedContextPath}`);

    // Verify the path still exists
    if (!fs.existsSync(savedContextPath)) {
      outputChannel.appendLine(`[restoreLastContext] Saved context path no longer exists: ${savedContextPath}`);
      // Clear the invalid context
      await context.workspaceState.update('chapterwiseCodex.lastContextPath', undefined);
      await context.workspaceState.update('chapterwiseCodex.lastContextType', undefined);
      return;
    }

    // Verify it's in a workspace
    const uri = vscode.Uri.file(savedContextPath);
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
    if (!workspaceFolder) {
      outputChannel.appendLine(`[restoreLastContext] Saved context is not in a workspace`);
      return;
    }

    // Restore the context by calling the appropriate command
    if (savedContextType === 'folder') {
      outputChannel.appendLine(`[restoreLastContext] Restoring folder context: ${savedContextPath}`);
      await vscode.commands.executeCommand('chapterwiseCodex.setContextFolder', uri);
    } else if (savedContextType === 'file') {
      outputChannel.appendLine(`[restoreLastContext] Restoring file context: ${savedContextPath}`);
      await vscode.commands.executeCommand('chapterwiseCodex.setContextFile', uri);
    }
  } catch (error) {
    outputChannel.appendLine(`[restoreLastContext] Error restoring context: ${error}`);
    // Silently fail - don't break the extension
  }
}

// Phase 5: Tree State Management - Debounce state for expansion updates
const expandedUpdateQueue = new Map<string, { indexPath: string; nodeId: string; expanded: boolean }>();
let expandedUpdateTimeout: NodeJS.Timeout | null = null;

/**
 * Extension activation
 */
export function activate(context: vscode.ExtensionContext): void {
  // Create output channel for logs
  outputChannel = vscode.window.createOutputChannel('ChapterWise Codex');
  context.subscriptions.push(outputChannel);

  outputChannel.appendLine('ChapterWise Codex extension activating...');

  try {
    // Create tree provider first
    const { CodexTreeProvider } = require('./treeProvider');
    const tp = new CodexTreeProvider();
    treeProvider = tp;
    outputChannel.appendLine('Tree provider created');

    // Initialize drag & drop controller (needs tree provider)
    const dragController = new CodexDragAndDropController(treeProvider);
    outputChannel.appendLine('Drag & drop controller created');

    // Initialize tree view with both tree provider and drag controller
    const { treeView: tv } = createCodexTreeView(context, treeProvider, dragController);
    treeView = tv;
    outputChannel.appendLine('Tree view created with drag & drop support');

    // Phase 5: Register expansion state handlers
    treeView.onDidCollapseElement(async (event) => {
      if (event.element instanceof IndexNodeTreeItem) {
        await updateNodeExpandedState(event.element, false);
      }
    });

    treeView.onDidExpandElement(async (event) => {
      if (event.element instanceof IndexNodeTreeItem) {
        await updateNodeExpandedState(event.element, true);
      }
    });
    outputChannel.appendLine('Tree expansion state handlers registered');

    // Create multi-index manager
    multiIndexManager = new MultiIndexManager(context);

    // Create master index tree provider
    masterTreeProvider = new MasterIndexTreeProvider();
    const masterView = vscode.window.createTreeView('chapterwiseCodexMaster', {
      treeDataProvider: masterTreeProvider,
      showCollapseAll: true
    });
    context.subscriptions.push(masterView);

    // Create sub-index tree providers (8 slots)
    for (let i = 0; i < 8; i++) {
      const provider = new SubIndexTreeProvider(`chapterwiseCodexIndex${i}`);
      subIndexProviders.push(provider);

      const view = vscode.window.createTreeView(`chapterwiseCodexIndex${i}`, {
        treeDataProvider: provider,
        showCollapseAll: true
      });
      subIndexViews.push(view);
      context.subscriptions.push(view);
    }
    outputChannel.appendLine('Multi-index tree views created');

    // Initialize Writer View manager
    writerViewManager = new WriterViewManager(context);
    outputChannel.appendLine('Writer view manager created');

    // Set tree provider reference for author lookup
    writerViewManager.setTreeProvider(treeProvider);
    outputChannel.appendLine('Writer view manager linked to tree provider');

    // Initialize validation system
    initializeValidation(context);
    outputChannel.appendLine('Validation initialized');

    // Create status bar item
    statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100
    );
    statusBarItem.command = 'chapterwiseCodex.openNavigator';
    context.subscriptions.push(statusBarItem);

    // Register commands
    registerCommands(context);
    outputChannel.appendLine('Commands registered');

    // Register Scrivener import command
    registerScrivenerImport(context);
    outputChannel.appendLine('Scrivener import command registered');

    // Update status bar based on active editor
    updateStatusBar();
    context.subscriptions.push(
      vscode.window.onDidChangeActiveTextEditor(() => {
        updateStatusBar();
        // Don't auto-switch context - user must explicitly set context
      })
    );

    // Don't auto-set context on activation - user must explicitly choose context

    // Auto-discover index.codex.yaml in top-level folders
    autoDiscoverIndexFiles();

    // Restore last context if it was saved
    restoreLastContext(context);

    console.log('ChapterWise Codex extension activated successfully!');
  } catch (error) {
    console.error('ChapterWise Codex activation failed:', error);
    vscode.window.showErrorMessage(`ChapterWise Codex failed to activate: ${error}`);
  }
}

/**
 * Auto-discover index.codex.yaml files in top-level folders
 * This checks the top-level directories for index files and auto-loads them
 */
async function autoDiscoverIndexFiles(): Promise<void> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    return;
  }

  const workspaceRoot = workspaceFolders[0].uri.fsPath;

  try {
    // Scan top-level directories only
    const entries = fs.readdirSync(workspaceRoot, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        const folderPath = path.join(workspaceRoot, entry.name);
        const indexPath = path.join(folderPath, 'index.codex.yaml');

        // Check for index.codex.yaml (without dot prefix)
        if (fs.existsSync(indexPath)) {
          console.log(`[ChapterWise Codex] Found index at top level: ${entry.name}/index.codex.yaml`);
          // Just log it for now - user can manually set context
          // Could optionally auto-load the first one found
        }
      }
    }

    // Also check for workspace root index
    const rootIndexPath = path.join(workspaceRoot, '.index.codex.yaml');
    if (fs.existsSync(rootIndexPath)) {
      console.log(`[ChapterWise Codex] Found workspace root index: .index.codex.yaml`);
      // This will be loaded automatically by INDEX mode
    }
  } catch (error) {
    console.error('[ChapterWise Codex] Error during auto-discovery:', error);
  }
}

/**
 * Register all commands
 */
function registerCommands(context: vscode.ExtensionContext): void {
  // Open Navigator command
  context.subscriptions.push(
    vscode.commands.registerCommand('chapterwiseCodex.openNavigator', () => {
      const editor = vscode.window.activeTextEditor;
      if (editor && isCodexFile(editor.document.fileName)) {
        treeProvider.setActiveDocument(editor.document);
        vscode.commands.executeCommand('chapterwiseCodexNavigator.focus');
      } else {
        vscode.window.showInformationMessage(
          'Open a .codex.yaml or .codex.json file to use the Codex Navigator'
        );
      }
    })
  );

  // Refresh tree command
  context.subscriptions.push(
    vscode.commands.registerCommand('chapterwiseCodex.refresh', () => {
      // Just refresh the tree, don't change context
      treeProvider.refresh();
    })
  );

  // Filter by type command
  context.subscriptions.push(
    vscode.commands.registerCommand('chapterwiseCodex.filterByType', async () => {
      const types = treeProvider.getTypes();

      if (types.length === 0) {
        vscode.window.showInformationMessage('No node types found in the current document');
        return;
      }

      const currentFilter = treeProvider.getFilter();
      const items = [
        {
          label: '$(list-flat) Show All',
          description: currentFilter === null ? '(current)' : '',
          value: null as string | null,
        },
        ...types.map((type) => ({
          label: `$(symbol-misc) ${type}`,
          description: currentFilter === type ? '(current)' : '',
          value: type,
        })),
      ];

      const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'Filter nodes by type',
        title: 'Codex Node Filter',
      });

      if (selected !== undefined) {
        treeProvider.setFilter(selected.value);

        if (selected.value) {
          vscode.window.setStatusBarMessage(`Filtering: ${selected.value}`, 2000);
        } else {
          vscode.window.setStatusBarMessage('Showing all nodes', 2000);
        }
      }
    })
  );

  // Open Writer View command
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'chapterwiseCodex.openWriterView',
      async (treeItem?: CodexTreeItem) => {
        if (treeItem) {
          await writerViewManager.openWriterView(treeItem);
        } else {
          vscode.window.showInformationMessage(
            'Select a node in the Codex Navigator to open Writer View'
          );
        }
      }
    )
  );

  // Go to YAML command
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'chapterwiseCodex.goToYaml',
      async (treeItem?: CodexTreeItem) => {
        if (!treeItem) {
          return;
        }

        const document = treeProvider.getActiveTextDocument();
        if (!document) {
          return;
        }

        // Navigate to the node's line in the source file
        const lineNumber = treeItem.codexNode.lineNumber;
        if (lineNumber !== undefined) {
          const editor = await vscode.window.showTextDocument(document);
          const position = new vscode.Position(lineNumber - 1, 0);
          editor.selection = new vscode.Selection(position, position);
          editor.revealRange(
            new vscode.Range(position, position),
            vscode.TextEditorRevealType.InCenter
          );
        } else {
          // Fallback: just open the document
          await vscode.window.showTextDocument(document);
        }
      }
    )
  );

  // Copy ID command
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'chapterwiseCodex.copyId',
      async (treeItem?: CodexTreeItem) => {
        if (!treeItem || !treeItem.codexNode.id) {
          vscode.window.showInformationMessage('No ID to copy');
          return;
        }

        await vscode.env.clipboard.writeText(treeItem.codexNode.id);
        vscode.window.setStatusBarMessage(
          `Copied: ${treeItem.codexNode.id}`,
          2000
        );
      }
    )
  );

  // Toggle field display command
  context.subscriptions.push(
    vscode.commands.registerCommand('chapterwiseCodex.toggleFields', async () => {
      await treeProvider.toggleShowFields();
      const showFields = treeProvider.getShowFields();
      vscode.window.setStatusBarMessage(
        showFields ? '$(list-tree) Fields shown in tree' : '$(list-flat) Fields hidden in tree',
        2000
      );
    })
  );

  // Open Writer View for a specific field
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'chapterwiseCodex.openWriterViewForField',
      async (fieldItem?: CodexFieldTreeItem) => {
        if (!fieldItem) {
          return;
        }

        // Determine which field to open
        let targetField: string;
        if (fieldItem.fieldType === 'attributes') {
          targetField = '__attributes__';
        } else if (fieldItem.fieldType === 'content') {
          targetField = '__content__';
        } else {
          // Extract field name (remove any count suffix like "body" from "body (123 words)")
          targetField = fieldItem.fieldName.split(' ')[0].toLowerCase();
        }

        await writerViewManager.openWriterViewForField(fieldItem.parentNode, fieldItem.documentUri, targetField);
      }
    )
  );

  // Auto-Fix command
  context.subscriptions.push(
    vscode.commands.registerCommand('chapterwiseCodex.autoFix', async () => {
      await runAutoFixer(false);
      // Refresh the tree after fixing
      treeProvider.refresh();
    })
  );

  // Auto-Fix with ID regeneration command
  context.subscriptions.push(
    vscode.commands.registerCommand('chapterwiseCodex.autoFixRegenIds', async () => {
      await runAutoFixer(true);
      // Refresh the tree after fixing
      treeProvider.refresh();
    })
  );

  // Explode Codex command
  context.subscriptions.push(
    vscode.commands.registerCommand('chapterwiseCodex.explodeCodex', async () => {
      await runExplodeCodex();
      // Refresh the tree after exploding
      treeProvider.refresh();
    })
  );

  // Implode Codex command
  context.subscriptions.push(
    vscode.commands.registerCommand('chapterwiseCodex.implodeCodex', async () => {
      await runImplodeCodex();
      // Refresh the tree after imploding
      treeProvider.refresh();
    })
  );

  // Update Word Count command
  context.subscriptions.push(
    vscode.commands.registerCommand('chapterwiseCodex.updateWordCount', async () => {
      await runUpdateWordCount();
      // Refresh the tree after updating word counts
      treeProvider.refresh();
    })
  );

  // Generate Tags command
  context.subscriptions.push(
    vscode.commands.registerCommand('chapterwiseCodex.generateTags', async () => {
      await runGenerateTags();
      // Refresh the tree after generating tags
      treeProvider.refresh();
    })
  );

  // Generate Index command
  context.subscriptions.push(
    vscode.commands.registerCommand('chapterwiseCodex.generateIndex', async () => {
      await runGenerateIndex();
    })
  );

  // Regenerate Index command
  context.subscriptions.push(
    vscode.commands.registerCommand('chapterwiseCodex.regenerateIndex', async () => {
      await runRegenerateIndex();
    })
  );

  // Create Index File command
  context.subscriptions.push(
    vscode.commands.registerCommand('chapterwiseCodex.createIndexFile', async () => {
      await runCreateIndexFile();
    })
  );

  // Open Index File command
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'chapterwiseCodex.openIndexFile',
      async (treeItem?: IndexNodeTreeItem) => {
        if (!treeItem) {
          return;
        }

        const filePath = treeItem.getFilePath();

        // Check if file exists
        try {
          const uri = vscode.Uri.file(filePath);
          const doc = await vscode.workspace.openTextDocument(uri);
          await vscode.window.showTextDocument(doc);

          // Don't change context - let user keep their current context
        } catch (error) {
          vscode.window.showErrorMessage(
            `Failed to open file: ${path.basename(filePath)}`
          );
          console.error('Failed to open index file:', error);
        }
      }
    )
  );

  // Open Index File in Writer View command (for .md Codex Lite files)
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'chapterwiseCodex.openIndexFileInWriterView',
      async (treeItem?: IndexNodeTreeItem) => {
        if (!treeItem) {
          outputChannel.appendLine('openIndexFileInWriterView: No treeItem provided');
          return;
        }

        outputChannel.appendLine('='.repeat(80));
        outputChannel.appendLine(`openIndexFileInWriterView called for: ${treeItem.indexNode.name}`);
        outputChannel.appendLine(`Call stack: ${new Error().stack}`);
        outputChannel.appendLine(`TreeItem workspaceRoot: ${treeItem.workspaceRoot}`);
        outputChannel.appendLine(`TreeItem _computed_path: ${treeItem.indexNode._computed_path}`);
        outputChannel.appendLine(`TreeItem _filename: ${treeItem.indexNode._filename}`);

        const filePath = treeItem.getFilePath();
        outputChannel.appendLine(`File path: ${filePath}`);

        try {
          // Check if file exists first
          if (!fs.existsSync(filePath)) {
            const errorMsg = `File not found: ${filePath}`;
            outputChannel.appendLine(`ERROR: ${errorMsg}`);
            vscode.window.showErrorMessage(errorMsg);
            return;
          }

          outputChannel.appendLine(`File exists, reading file...`);
          // Read file directly - DON'T open in VS Code text editor
          // We only want to open it in the writer view
          const uri = vscode.Uri.file(filePath);
          const text = fs.readFileSync(filePath, 'utf-8');
          outputChannel.appendLine(`File read successfully, length: ${text.length}`);

          // Determine file type and parse accordingly
          const fileName = path.basename(filePath);
          const isMarkdown = fileName.endsWith('.md');
          const isCodexYaml = fileName.endsWith('.codex.yaml');

          let codexDoc;
          if (isMarkdown) {
            outputChannel.appendLine(`Parsing as Codex Lite (markdown), text length: ${text.length}`);
            codexDoc = parseMarkdownAsCodex(text, filePath);
          } else if (isCodexYaml) {
            outputChannel.appendLine(`Parsing as Codex YAML, text length: ${text.length}`);
            codexDoc = parseCodex(text);
          } else {
            outputChannel.appendLine(`ERROR: Unsupported file type: ${fileName}`);
            vscode.window.showErrorMessage(`Unsupported file type: ${fileName}`);
            return;
          }

          if (!codexDoc || !codexDoc.rootNode) {
            outputChannel.appendLine(`Failed to parse as Codex, falling back to text editor`);
            // Fallback to regular text editor if parsing fails
            const doc = await vscode.workspace.openTextDocument(uri);
            await vscode.window.showTextDocument(doc);
            // Don't change context - user must explicitly set it
            return;
          }

          outputChannel.appendLine(`Parsed successfully, root node:`);
          outputChannel.appendLine(`  name: ${codexDoc.rootNode.name}`);
          outputChannel.appendLine(`  type: ${codexDoc.rootNode.type}`);
          outputChannel.appendLine(`  proseField: ${codexDoc.rootNode.proseField}`);
          outputChannel.appendLine(`  proseValue length: ${codexDoc.rootNode.proseValue?.length || 0}`);
          outputChannel.appendLine(`  proseValue preview: ${codexDoc.rootNode.proseValue?.substring(0, 100) || 'EMPTY'}`);
          outputChannel.appendLine(`  availableFields: ${codexDoc.rootNode.availableFields.join(', ')}`);

          // Create a temporary CodexTreeItem for the root node
          const hasChildren = codexDoc.rootNode.children && codexDoc.rootNode.children.length > 0;
          const tempTreeItem = new CodexTreeItem(
            codexDoc.rootNode,
            uri,
            hasChildren, // .codex.yaml files can have children, .md files typically don't
            false, // Don't expand
            true   // Show fields (body, etc.)
          );

          outputChannel.appendLine(`Created temp tree item, opening writer view...`);

          // Open in writer view
          await writerViewManager.openWriterView(tempTreeItem);

          outputChannel.appendLine(`Writer view opened successfully`);

          // Don't change context - let user keep their current index context
        } catch (error) {
          const errorMsg = `Failed to open file in Codex Editor: ${path.basename(filePath)}`;
          outputChannel.appendLine(`ERROR: ${errorMsg}`);
          outputChannel.appendLine(`Error details: ${error}`);
          outputChannel.appendLine(`Error stack: ${error instanceof Error ? error.stack : 'No stack trace'}`);
          vscode.window.showErrorMessage(errorMsg);
        }
      }
    )
  );

  // Phase 3: Navigate to Node command (opens Writer View)
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'chapterwiseCodex.navigateToEntity',
      async (treeItem?: IndexNodeTreeItem) => {
        if (!treeItem) {
          vscode.window.showErrorMessage('No node selected');
          return;
        }

        const node = treeItem.indexNode as any;
        const parentFile = node._parent_file;
        const entityId = node.id;

        if (!parentFile || !entityId) {
          vscode.window.showErrorMessage('Cannot navigate: missing file or node ID');
          return;
        }

        const workspaceRoot = treeProvider.getWorkspaceRoot();
        if (!workspaceRoot) {
          vscode.window.showErrorMessage('No workspace root found');
          return;
        }

        // Resolve file path
        const filePath = path.join(workspaceRoot, parentFile);

        if (!fs.existsSync(filePath)) {
          vscode.window.showErrorMessage(`File not found: ${parentFile}`);
          return;
        }

        // Parse file to create CodexNode
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        const codexDoc = parseCodex(fileContent);

        if (!codexDoc || !codexDoc.rootNode) {
          vscode.window.showErrorMessage('Failed to parse codex file');
          return;
        }

        // Find the node in the parsed document
        const entityNode = findNodeById(codexDoc.rootNode, entityId);

        if (!entityNode) {
          vscode.window.showErrorMessage(`Node ${entityId} not found in file`);
          return;
        }

        // Determine initial field based on node structure
        let initialField = '__overview__';  // default to overview

        // Count available fields
        const hasSummary = entityNode.availableFields.includes('summary');
        const hasBody = entityNode.availableFields.includes('body');
        const hasChildren = entityNode.children && entityNode.children.length > 0;
        const hasContentSections = entityNode.contentSections && entityNode.contentSections.length > 0;
        const hasAttributes = entityNode.attributes && entityNode.attributes.length > 0;

        // Count total fields
        const fieldCount = [hasSummary, hasBody, hasContentSections, hasAttributes, hasChildren].filter(Boolean).length;

        // Only show single field if there's literally just one field
        if (fieldCount === 1) {
          if (hasSummary) initialField = 'summary';
          else if (hasBody) initialField = 'body';
          // Otherwise stay in overview mode for single structured field
        }

        // Create document URI
        const documentUri = vscode.Uri.file(filePath);

        // Open Writer View with determined field
        await writerViewManager.openWriterViewForField(entityNode, documentUri, initialField);
      }
    )
  );

  // Phase 3: Navigate to Field command (opens Writer View)
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'chapterwiseCodex.navigateToField',
      async (treeItem?: IndexNodeTreeItem) => {
        if (!treeItem) {
          vscode.window.showErrorMessage('No field selected');
          return;
        }

        const node = treeItem.indexNode as any;
        const parentFile = node._parent_file;
        const parentEntity = node._parent_entity;
        const fieldName = node._field_name;

        if (!parentFile || !fieldName) {
          vscode.window.showErrorMessage('Cannot navigate: missing file or field name');
          return;
        }

        const workspaceRoot = treeProvider.getWorkspaceRoot();
        if (!workspaceRoot) {
          vscode.window.showErrorMessage('No workspace root found');
          return;
        }

        // Resolve file path
        const filePath = path.join(workspaceRoot, parentFile);

        if (!fs.existsSync(filePath)) {
          vscode.window.showErrorMessage(`File not found: ${parentFile}`);
          return;
        }

        // Parse file to create CodexNode
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        const codexDoc = parseCodex(fileContent);

        if (!codexDoc || !codexDoc.rootNode) {
          vscode.window.showErrorMessage('Failed to parse codex file');
          return;
        }

        // Find the parent node if specified
        let targetNode: CodexNode | null = null;

        if (parentEntity) {
          targetNode = findNodeById(codexDoc.rootNode, parentEntity);
          if (!targetNode) {
            vscode.window.showErrorMessage(`Parent node ${parentEntity} not found in file`);
            return;
          }
        } else {
          // If no parent node, use root node
          targetNode = codexDoc.rootNode;
        }

        // Create document URI
        const documentUri = vscode.Uri.file(filePath);

        // Map field names to Writer View's special field identifiers
        let writerViewFieldName = fieldName;
        if (fieldName === 'attributes') {
          writerViewFieldName = '__attributes__';
        } else if (fieldName === 'content') {
          writerViewFieldName = '__content__';
        }

        // Open Writer View with specific field selected
        await writerViewManager.openWriterViewForField(targetNode, documentUri, writerViewFieldName);
      }
    )
  );

  // Navigate to Node in Code View (alternative to Writer View)
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'chapterwiseCodex.navigateToEntityInCodeView',
      async (treeItem?: IndexNodeTreeItem) => {
        if (!treeItem) {
          vscode.window.showErrorMessage('No node selected');
          return;
        }

        const node = treeItem.indexNode as any;
        const parentFile = node._parent_file;
        const entityId = node.id;

        if (!parentFile || !entityId) {
          vscode.window.showErrorMessage('Cannot navigate: missing file or node ID');
          return;
        }

        const workspaceRoot = treeProvider.getWorkspaceRoot();
        if (!workspaceRoot) {
          vscode.window.showErrorMessage('No workspace root found');
          return;
        }

        // Resolve file path
        const filePath = path.join(workspaceRoot, parentFile);

        if (!fs.existsSync(filePath)) {
          vscode.window.showErrorMessage(`File not found: ${parentFile}`);
          return;
        }

        // Open file in text editor
        const doc = await vscode.workspace.openTextDocument(filePath);
        const editor = await vscode.window.showTextDocument(doc);

        // Find node in file by ID
        const text = doc.getText();
        const lines = text.split('\n');
        let entityLineStart = -1;

        // Helper function to escape special regex characters
        const escapeRegExp = (str: string): string => {
          return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        };

        // Try multiple patterns to find the node ID
        const idPatterns = [
          new RegExp(`^\\s*id:\\s*${escapeRegExp(entityId)}\\s*$`, 'i'),           // YAML: id: value
          new RegExp(`^\\s*id:\\s*["']${escapeRegExp(entityId)}["']\\s*$`, 'i'),  // YAML: id: "value" or id: 'value'
          new RegExp(`^\\s*["']id["']:\\s*["']${escapeRegExp(entityId)}["']`, 'i'), // JSON: "id": "value"
        ];

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (idPatterns.some(pattern => pattern.test(line))) {
            entityLineStart = i;
            break;
          }
        }

        if (entityLineStart >= 0) {
          // Scroll to node
          const position = new vscode.Position(entityLineStart, 0);
          editor.selection = new vscode.Selection(position, position);
          editor.revealRange(
            new vscode.Range(position, position),
            vscode.TextEditorRevealType.InCenter
          );
        } else {
          vscode.window.showWarningMessage(`Node ${entityId} not found in file`);
        }
      }
    )
  );

  // Navigate to Field in Code View (alternative to Writer View)
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'chapterwiseCodex.navigateToFieldInCodeView',
      async (treeItem?: IndexNodeTreeItem) => {
        if (!treeItem) {
          vscode.window.showErrorMessage('No field selected');
          return;
        }

        const node = treeItem.indexNode as any;
        const parentFile = node._parent_file;
        const parentEntity = node._parent_entity;
        const fieldName = node._field_name;

        if (!parentFile || !fieldName) {
          vscode.window.showErrorMessage('Cannot navigate: missing file or field name');
          return;
        }

        const workspaceRoot = treeProvider.getWorkspaceRoot();
        if (!workspaceRoot) {
          vscode.window.showErrorMessage('No workspace root found');
          return;
        }

        // Resolve file path
        const filePath = path.join(workspaceRoot, parentFile);

        if (!fs.existsSync(filePath)) {
          vscode.window.showErrorMessage(`File not found: ${parentFile}`);
          return;
        }

        // Open file in text editor
        const doc = await vscode.workspace.openTextDocument(filePath);
        const editor = await vscode.window.showTextDocument(doc);

        // Find node first (if specified), then field within it
        const text = doc.getText();
        const lines = text.split('\n');
        let fieldLineStart = -1;
        let entityLineStart = -1;

        // Helper function to escape special regex characters
        const escapeRegExp = (str: string): string => {
          return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        };

        // If parent node specified, find it first
        if (parentEntity) {
          const idPatterns = [
            new RegExp(`^\\s*id:\\s*${escapeRegExp(parentEntity)}\\s*$`, 'i'),
            new RegExp(`^\\s*id:\\s*["']${escapeRegExp(parentEntity)}["']\\s*$`, 'i'),
            new RegExp(`^\\s*["']id["']:\\s*["']${escapeRegExp(parentEntity)}["']`, 'i'),
          ];

          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (idPatterns.some(pattern => pattern.test(line))) {
              entityLineStart = i;
              break;
            }
          }
        }

        // Find field within node or file
        const fieldPatterns = [
          new RegExp(`^\\s*${escapeRegExp(fieldName)}:\\s*`, 'i'),           // YAML: field:
          new RegExp(`^\\s*["']${escapeRegExp(fieldName)}["']:\\s*`, 'i'),  // JSON: "field":
        ];

        const searchStart = entityLineStart >= 0 ? entityLineStart : 0;
        for (let i = searchStart; i < lines.length; i++) {
          const line = lines[i];
          if (fieldPatterns.some(pattern => pattern.test(line))) {
            fieldLineStart = i;
            break;
          }
        }

        if (fieldLineStart >= 0) {
          // Scroll to field
          const position = new vscode.Position(fieldLineStart, 0);
          editor.selection = new vscode.Selection(position, position);
          editor.revealRange(
            new vscode.Range(position, position),
            vscode.TextEditorRevealType.InCenter
          );
        } else {
          vscode.window.showWarningMessage(`Field ${fieldName} not found in file`);
        }
      }
    )
  );

  // Phase 3: Show Error command (for missing/error nodes)
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'chapterwiseCodex.showError',
      async (treeItem?: IndexNodeTreeItem) => {
        if (!treeItem) {
          return;
        }

        const node = treeItem.indexNode as any;
        const nodeKind = node._node_kind;

        if (nodeKind === 'error') {
          const errorMsg = node._error_message || 'Unknown error';
          const originalInclude = node._original_include;
          vscode.window.showErrorMessage(
            `Error: ${errorMsg}${originalInclude ? `\nInclude: ${originalInclude}` : ''}`,
            'OK'
          );
        } else if (nodeKind === 'missing') {
          const originalInclude = node._original_include || node._computed_path;
          vscode.window.showWarningMessage(
            `Missing File: ${originalInclude}\n\nThe included file could not be found.`,
            'OK'
          );
        }
      }
    )
  );

  // Convert to Markdown command
  context.subscriptions.push(
    vscode.commands.registerCommand('chapterwiseCodex.convertToMarkdown', async () => {
      await runConvertToMarkdown();
    })
  );

  // Convert Markdown to Codex command
  context.subscriptions.push(
    vscode.commands.registerCommand('chapterwiseCodex.convertToCodex', async () => {
      await runConvertToCodex();
    })
  );

  // === GIT SETUP COMMANDS ===

  // Git Setup Wizard command
  context.subscriptions.push(
    vscode.commands.registerCommand('chapterwiseCodex.git.setupWizard', async () => {
      await runGitSetupWizard();
    })
  );

  // Initialize Git Repository command
  context.subscriptions.push(
    vscode.commands.registerCommand('chapterwiseCodex.git.initRepository', async () => {
      await initializeGitRepository();
    })
  );

  // Ensure Git Ignore command
  context.subscriptions.push(
    vscode.commands.registerCommand('chapterwiseCodex.git.ensureGitIgnore', async () => {
      await ensureGitIgnore();
    })
  );

  // Setup Git LFS command
  context.subscriptions.push(
    vscode.commands.registerCommand('chapterwiseCodex.git.setupLFS', async () => {
      await setupGitLFS();
    })
  );

  // === NEW NAVIGATOR COMMANDS ===

  // Add child node command
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'chapterwiseCodex.addChildNode',
      async (treeItem?: CodexTreeItem) => {
        if (!treeItem) {
          vscode.window.showInformationMessage('Select a node to add a child to');
          return;
        }

        const document = treeProvider.getActiveTextDocument();
        if (!document) {
          vscode.window.showErrorMessage('No active document');
          return;
        }

        // Import modules
        const { getStructureEditor } = await import('./structureEditor');
        const { getSettingsManager } = await import('./settingsManager');
        const { getFileOrganizer } = await import('./fileOrganizer');

        const editor = getStructureEditor();
        const settings = await getSettingsManager().getSettings(document.uri);

        // Prompt for node data
        const name = await vscode.window.showInputBox({
          prompt: 'Enter node name',
          placeHolder: 'e.g., Scene 1, Chapter 2'
        });

        if (!name) return;

        const type = await vscode.window.showInputBox({
          prompt: 'Enter node type',
          placeHolder: 'e.g., scene, chapter, character'
        });

        if (!type) return;

        // Ask for mode if configured
        let mode = settings.defaultChildMode;
        if (mode === 'ask') {
          const choice = await vscode.window.showQuickPick(
            [
              { label: 'Inline', value: 'inline' as const },
              { label: 'Separate File', value: 'separate-file' as const }
            ],
            { placeHolder: 'How should the child be created?' }
          );
          mode = choice?.value || 'inline';
        }

        if (mode === 'separate-file') {
          // Create as separate file in INDEX mode
          const organizer = getFileOrganizer();
          const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
          if (!workspaceFolder) return;

          // Determine parent path from tree item
          // For now, create in workspace root
          const result = await organizer.createNodeFile(
            workspaceFolder.uri.fsPath,
            '', // parent path
            { name, type, proseField: 'body', proseValue: '' },
            settings
          );

          if (result.success && result.fileUri) {
            // Regenerate index
            const { generateIndex } = await import('./indexGenerator');
            await generateIndex({ workspaceRoot: workspaceFolder.uri.fsPath });

            // Open new file
            await vscode.window.showTextDocument(result.fileUri);

            // Refresh tree
            treeProvider.refresh();
          }
        } else {
          // Create inline in FILES mode
          const success = await editor.addNodeInDocument(
            document,
            treeItem.codexNode,
            'child',
            { name, type, proseField: 'body', proseValue: '' },
            settings
          );

          if (success) {
            // Refresh tree
            treeProvider.setActiveDocument(document);
            showTransientMessage(`✓ Added child: ${name}`, 3000);
          }
        }
      }
    )
  );

  // Add sibling node command
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'chapterwiseCodex.addSiblingNode',
      async (treeItem?: CodexTreeItem) => {
        if (!treeItem) {
          vscode.window.showInformationMessage('Select a node to add a sibling to');
          return;
        }

        const document = treeProvider.getActiveTextDocument();
        if (!document) {
          vscode.window.showErrorMessage('No active document');
          return;
        }

        const { getStructureEditor } = await import('./structureEditor');
        const { getSettingsManager } = await import('./settingsManager');

        const editor = getStructureEditor();
        const settings = await getSettingsManager().getSettings(document.uri);

        // Prompt for node data
        const name = await vscode.window.showInputBox({
          prompt: 'Enter node name',
          placeHolder: 'e.g., Scene 2, Chapter 3'
        });

        if (!name) return;

        const type = await vscode.window.showInputBox({
          prompt: 'Enter node type',
          value: treeItem.codexNode.type, // Default to same type as sibling
          placeHolder: 'e.g., scene, chapter'
        });

        if (!type) return;

        // Add as sibling after
        const success = await editor.addNodeInDocument(
          document,
          treeItem.codexNode,
          'sibling-after',
          { name, type, proseField: 'body', proseValue: '' },
          settings
        );

        if (success) {
          treeProvider.setActiveDocument(document);
          showTransientMessage(`✓ Added sibling: ${name}`, 3000);
        }
      }
    )
  );

  // Remove node command
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'chapterwiseCodex.removeNode',
      async (treeItem?: CodexTreeItem) => {
        if (!treeItem) return;

        const document = treeProvider.getActiveTextDocument();
        if (!document) return;

        const { getStructureEditor } = await import('./structureEditor');
        const { getSettingsManager } = await import('./settingsManager');

        const editor = getStructureEditor();
        const settings = await getSettingsManager().getSettings(document.uri);

        const success = await editor.removeNodeFromDocument(
          document,
          treeItem.codexNode,
          false,
          settings
        );

        if (success) {
          treeProvider.setActiveDocument(document);
          showTransientMessage(`✓ Removed: ${treeItem.codexNode.name}`, 3000);
        }
      }
    )
  );

  // Delete node permanently command
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'chapterwiseCodex.deleteNodePermanently',
      async (treeItem?: CodexTreeItem) => {
        if (!treeItem) return;

        const document = treeProvider.getActiveTextDocument();
        if (!document) return;

        const { getStructureEditor } = await import('./structureEditor');
        const { getSettingsManager } = await import('./settingsManager');

        const editor = getStructureEditor();
        const settings = await getSettingsManager().getSettings(document.uri);

        const success = await editor.removeNodeFromDocument(
          document,
          treeItem.codexNode,
          true,
          settings
        );

        if (success) {
          treeProvider.setActiveDocument(document);
          showTransientMessage(`✓ Deleted: ${treeItem.codexNode.name}`, 3000);
        }
      }
    )
  );

  // Rename node command
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'chapterwiseCodex.renameNode',
      async (treeItem?: CodexTreeItem) => {
        if (!treeItem) return;

        const newName = await vscode.window.showInputBox({
          prompt: 'Enter new name',
          value: treeItem.codexNode.name,
          placeHolder: 'New node name'
        });

        if (!newName) return;

        // TODO: Implement rename in structureEditor
        vscode.window.showInformationMessage(`Rename functionality coming soon!`);
      }
    )
  );

  // Move node up command
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'chapterwiseCodex.moveNodeUp',
      async (treeItem?: CodexTreeItem | IndexNodeTreeItem) => {
        if (!treeItem) return;

        // Only works in INDEX mode with IndexNodeTreeItem
        if (!(treeItem instanceof IndexNodeTreeItem)) {
          vscode.window.showInformationMessage('Move up/down only works in Index mode');
          return;
        }

        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
          vscode.window.showErrorMessage('No workspace folder found');
          return;
        }

        const workspaceRoot = workspaceFolder.uri.fsPath;
        const filePath = treeItem.getFilePath();
        const relativePath = path.relative(workspaceRoot, filePath);

        const { getStructureEditor } = await import('./structureEditor');
        const editor = getStructureEditor();

        const result = await editor.moveFileUp(workspaceRoot, relativePath);

        if (result.success) {
          showTransientMessage(result.message || '✓ Moved up', 3000);
          treeProvider.refresh();
        } else {
          vscode.window.showWarningMessage(result.message || 'Failed to move up');
        }
      }
    )
  );

  // Move node down command
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'chapterwiseCodex.moveNodeDown',
      async (treeItem?: CodexTreeItem | IndexNodeTreeItem) => {
        if (!treeItem) return;

        // Only works in INDEX mode with IndexNodeTreeItem
        if (!(treeItem instanceof IndexNodeTreeItem)) {
          vscode.window.showInformationMessage('Move up/down only works in Index mode');
          return;
        }

        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
          vscode.window.showErrorMessage('No workspace folder found');
          return;
        }

        const workspaceRoot = workspaceFolder.uri.fsPath;
        const filePath = treeItem.getFilePath();
        const relativePath = path.relative(workspaceRoot, filePath);

        const { getStructureEditor } = await import('./structureEditor');
        const editor = getStructureEditor();

        const result = await editor.moveFileDown(workspaceRoot, relativePath);

        if (result.success) {
          showTransientMessage(result.message || '✓ Moved down', 3000);
          treeProvider.refresh();
        } else {
          vscode.window.showWarningMessage(result.message || 'Failed to move down');
        }
      }
    )
  );

  // Change color command
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'chapterwiseCodex.changeColor',
      async (treeItem?: CodexTreeItem) => {
        if (!treeItem) return;

        const document = treeProvider.getActiveTextDocument();
        if (!document) return;

        const { getColorManager } = await import('./colorManager');
        const colorManager = getColorManager();

        const success = await colorManager.changeColor(treeItem.codexNode, document);

        if (success) {
          treeProvider.setActiveDocument(document);
        }
      }
    )
  );

  // Switch to INDEX mode command
  context.subscriptions.push(
    vscode.commands.registerCommand('chapterwiseCodex.switchToIndexMode', async () => {
      treeProvider.setNavigationMode('index');

      // Set context for button highlighting
      await vscode.commands.executeCommand('setContext', 'codexNavigatorMode', 'index');

      // Auto-open .index.codex.yaml if it exists
      const workspaceRoot = vscode.workspace.workspaceFolders?.[0];
      if (workspaceRoot) {
        const indexPath = path.join(workspaceRoot.uri.fsPath, '.index.codex.yaml');
        if (fs.existsSync(indexPath)) {
          const doc = await vscode.workspace.openTextDocument(indexPath);
          treeProvider.setActiveDocument(doc);
        }
      }
    })
  );


  // Autofix Folder command (renormalize order values)
  context.subscriptions.push(
    vscode.commands.registerCommand('chapterwiseCodex.autofixFolder', async (item: any) => {
      if (!item || !item.indexNode) {
        vscode.window.showErrorMessage('No folder selected');
        return;
      }

      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders || workspaceFolders.length === 0) {
        vscode.window.showErrorMessage('No workspace folder found');
        return;
      }

      const workspaceRoot = workspaceFolders[0].uri.fsPath;
      const folderPath = item.indexNode._computed_path || item.indexNode.name;

      outputChannel.appendLine('='.repeat(80));
      outputChannel.appendLine(`[autofixFolder] Starting autofix for folder`);
      outputChannel.appendLine(`  Workspace root: ${workspaceRoot}`);
      outputChannel.appendLine(`  Folder path: ${folderPath}`);
      outputChannel.appendLine(`  Index node name: ${item.indexNode.name}`);
      outputChannel.appendLine(`  Index node type: ${item.indexNode.type}`);
      outputChannel.appendLine(`  _computed_path: ${item.indexNode._computed_path}`);
      outputChannel.appendLine(`  _filename: ${item.indexNode._filename}`);

      await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: `Autofixing folder: ${item.indexNode.name}...`,
        cancellable: false,
      }, async (progress) => {
        const { getStructureEditor } = await import('./structureEditor');
        const { CodexAutoFixer } = await import('./autoFixer');
        const editor = getStructureEditor();

        // 1. Renormalize order values in the index
        progress.report({ message: 'Renormalizing order values...', increment: 10 });
        outputChannel.appendLine(`[autofixFolder] Step 1: Renormalizing order values...`);

        const result = await editor.autofixFolderOrder(workspaceRoot, folderPath);

        outputChannel.appendLine(`[autofixFolder] Result: ${JSON.stringify(result, null, 2)}`);

        if (!result.success) {
          outputChannel.appendLine(`[autofixFolder] FAILED: ${result.message}`);
          vscode.window.showErrorMessage(`Autofix failed: ${result.message}`);
          return;
        }

        outputChannel.appendLine(`[autofixFolder] SUCCESS: ${result.message}`);

        // 2. Run autofix on all .codex.yaml files in folder
        progress.report({ message: 'Finding Codex files...', increment: 10 });
        outputChannel.appendLine(`[autofixFolder] Step 2: Running autofix on all .codex.yaml files...`);

        const folderFullPath = path.join(workspaceRoot, folderPath);
        outputChannel.appendLine(`[autofixFolder] Scanning folder: ${folderFullPath}`);

        if (!fs.existsSync(folderFullPath)) {
          outputChannel.appendLine(`[autofixFolder] WARNING: Folder does not exist: ${folderFullPath}`);
          vscode.window.showWarningMessage(`Folder not found: ${folderPath}`);
          return;
        }

        // Find all .codex.yaml files in the folder (not recursive)
        const files = fs.readdirSync(folderFullPath)
          .filter(file => file.endsWith('.codex.yaml'))
          .map(file => path.join(folderFullPath, file));

        outputChannel.appendLine(`[autofixFolder] Found ${files.length} .codex.yaml files`);

        if (files.length === 0) {
          outputChannel.appendLine(`[autofixFolder] No .codex.yaml files found in folder`);
          treeProvider.refresh();
          showTransientMessage(`✅ Autofix complete: ${result.message} (no files to fix)`, 4000);
          return;
        }

        // Auto-fix each file
        const fixer = new CodexAutoFixer();
        let fixedCount = 0;
        let totalFixes = 0;

        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const fileName = path.basename(file);

          progress.report({
            message: `Fixing ${fileName} (${i + 1}/${files.length})...`,
            increment: 70 / files.length
          });

          outputChannel.appendLine(`[autofixFolder] Processing: ${fileName}`);

          try {
            // Read file
            const content = fs.readFileSync(file, 'utf-8');

            // Run autofix
            const fixResult = fixer.autoFixCodex(content, false);

            if (fixResult.success && fixResult.fixesApplied.length > 0) {
              // Write fixed content back
              fs.writeFileSync(file, fixResult.fixedText, 'utf-8');

              outputChannel.appendLine(`[autofixFolder]   ✓ ${fileName}: Applied ${fixResult.fixesApplied.length} fixes`);
              fixResult.fixesApplied.forEach(fix => {
                outputChannel.appendLine(`[autofixFolder]     - ${fix}`);
              });

              fixedCount++;
              totalFixes += fixResult.fixesApplied.length;
            } else if (fixResult.success) {
              outputChannel.appendLine(`[autofixFolder]   ✓ ${fileName}: No fixes needed`);
            } else {
              outputChannel.appendLine(`[autofixFolder]   ✗ ${fileName}: Error - ${fixResult.error}`);
            }
          } catch (error) {
            outputChannel.appendLine(`[autofixFolder]   ✗ ${fileName}: Exception - ${error}`);
          }
        }

        progress.report({ message: 'Refreshing tree...', increment: 10 });

        // 3. Refresh tree
        treeProvider.refresh();

        // Show success message with summary
        const summary = `✅ Autofix complete for "${item.indexNode.name}":\n` +
                       `• ${result.message}\n` +
                       `• Fixed ${fixedCount}/${files.length} files (${totalFixes} total fixes)`;

        outputChannel.appendLine(`[autofixFolder] Complete: ${fixedCount}/${files.length} files fixed, ${totalFixes} total fixes`);

        vscode.window.showInformationMessage(summary);
      });

      outputChannel.appendLine(`[autofixFolder] Complete`);
      outputChannel.appendLine('='.repeat(80));
    })
  );

  // Set Context Folder command (scope navigator to a specific folder)
  context.subscriptions.push(
    vscode.commands.registerCommand('chapterwiseCodex.setContextFolder', async (uri: vscode.Uri) => {
      if (!uri) {
        vscode.window.showErrorMessage('No folder selected');
        return;
      }

      // Find the workspace folder that contains this URI
      const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
      if (!workspaceFolder) {
        vscode.window.showErrorMessage('Could not determine workspace folder for selected path');
        return;
      }

      const workspaceRoot = workspaceFolder.uri.fsPath;
      const folderPath = path.relative(workspaceRoot, uri.fsPath);

      outputChannel.appendLine(`[setContextFolder] Called for folder: ${folderPath}`);
      outputChannel.appendLine(`[setContextFolder] Workspace root: ${workspaceRoot}`);

      // Generate index if needed (always regenerate)
      const indexPath = path.join(uri.fsPath, '.index.codex.yaml');

      await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: `Setting context to: ${path.basename(uri.fsPath)}...`,
        cancellable: true,  // ← Change to true
      }, async (progress, token) => {  // ← Add token parameter
        outputChannel.appendLine(`[setContextFolder] Regenerating index hierarchy for: ${folderPath}`);

        // Create progress reporter with cancellation
        const progressReporter: IndexGenerationProgress = {
          report: (message: string, increment?: number) => {
            progress.report({ message, increment });
          },
          token
        };

        try {
          // Always regenerate index hierarchy recursively
          await generateFolderHierarchy(workspaceRoot, folderPath, progressReporter);
        } catch (error: any) {
          if (error.message?.includes('cancelled')) {
            outputChannel.appendLine('[setContextFolder] Cancelled by user');
            vscode.window.showInformationMessage('Index generation cancelled');
            return;  // Exit early
          }
          throw error;  // Re-throw other errors
        }

        // EXPLICITLY set context in tree provider
        outputChannel.appendLine(`[setContextFolder] Calling treeProvider.setContextFolder()`);
        progress.report({ message: 'Loading index into tree view...', increment: 5 });

        await treeProvider.setContextFolder(folderPath, workspaceRoot);

        outputChannel.appendLine(`[setContextFolder] Tree view loaded`);

        // Update tree view title
        treeView.title = `📋 ${path.basename(uri.fsPath)}`;

        // Save context for next session
        await context.workspaceState.update('chapterwiseCodex.lastContextPath', uri.fsPath);
        await context.workspaceState.update('chapterwiseCodex.lastContextType', 'folder');
        outputChannel.appendLine(`[setContextFolder] Context saved to workspace state`);

        // After setting context folder, discover indexes for multi-index mode
        if (multiIndexManager && workspaceRoot) {
          const config = vscode.workspace.getConfiguration('chapterwiseCodex');
          const displayMode = config.get<string>('indexDisplayMode', 'stacked');

          if (displayMode === 'stacked') {
            outputChannel.appendLine(`[setContextFolder] Discovering indexes for stacked mode...`);
            const indexes = await multiIndexManager.discoverIndexes(workspaceRoot);
            outputChannel.appendLine(`[setContextFolder] Found ${indexes.length} indexes`);

            // Update master tree provider
            if (masterTreeProvider) {
              masterTreeProvider.setManager(multiIndexManager, workspaceRoot);
            }

            // Assign sub-indexes to view slots
            const subIndexes = multiIndexManager.getSubIndexes();
            subIndexes.forEach((index, i) => {
              if (i < subIndexProviders.length) {
                subIndexProviders[i].setIndex(index);
                // Update view title
                subIndexViews[i].title = index.displayName;
              }
            });

            // Clear unused slots
            for (let i = subIndexes.length; i < subIndexProviders.length; i++) {
              subIndexProviders[i].setIndex(null);
            }

            outputChannel.appendLine(`[setContextFolder] Multi-index views configured`);
          }
        }
      });

      outputChannel.appendLine(`[setContextFolder] Complete - Viewing: ${path.basename(uri.fsPath)}`);
      showTransientMessage(`📋 Viewing: ${path.basename(uri.fsPath)}`, 3000);
    })
  );

  // Set Context File command (for individual .codex.yaml files)
  context.subscriptions.push(
    vscode.commands.registerCommand('chapterwiseCodex.setContextFile', async (uri?: vscode.Uri) => {
      if (!uri) {
        vscode.window.showErrorMessage('No file selected');
        return;
      }

      outputChannel.appendLine(`[setContextFile] Called for file: ${uri.fsPath}`);

      // Find workspace root
      const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
      if (!workspaceFolder) {
        vscode.window.showErrorMessage('Could not determine workspace folder');
        return;
      }

      try {
        // Open the file
        const doc = await vscode.workspace.openTextDocument(uri.fsPath);
        await vscode.window.showTextDocument(doc);

        // EXPLICITLY set context - this is an explicit user action
        outputChannel.appendLine(`[setContextFile] Calling treeProvider.setActiveDocument(explicit=true)`);
        treeProvider.setActiveDocument(doc, true);

        // Update tree view title
        treeView.title = `📄 ${path.basename(uri.fsPath, '.codex.yaml')}`;

        // Save context for next session
        await context.workspaceState.update('chapterwiseCodex.lastContextPath', uri.fsPath);
        await context.workspaceState.update('chapterwiseCodex.lastContextType', 'file');
        outputChannel.appendLine(`[setContextFile] Context saved to workspace state`);

        outputChannel.appendLine(`[setContextFile] Complete - Viewing: ${path.basename(uri.fsPath)}`);
        showTransientMessage(`📄 Viewing: ${path.basename(uri.fsPath)}`, 3000);
      } catch (error) {
        outputChannel.appendLine(`[setContextFile] ERROR: ${error}`);
        vscode.window.showErrorMessage(`Failed to open file: ${error}`);
      }
    })
  );

  // Reset Context command (return to workspace root)
  context.subscriptions.push(
    vscode.commands.registerCommand('chapterwiseCodex.resetContext', async () => {
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders || workspaceFolders.length === 0) {
        vscode.window.showErrorMessage('No workspace folder found');
        return;
      }

      const workspaceRoot = workspaceFolders[0].uri.fsPath;

      // Clear context folder
      await treeProvider.setContextFolder(null, workspaceRoot);

      // Reset tree view title
      treeView.title = 'ChapterWise Codex';

      // Clear saved context state
      await context.workspaceState.update('chapterwiseCodex.lastContextPath', undefined);
      await context.workspaceState.update('chapterwiseCodex.lastContextType', undefined);
      outputChannel.appendLine(`[resetContext] Context cleared from workspace state`);

      // Stay in INDEX mode but show workspace root
      treeProvider.refresh();

      vscode.window.showInformationMessage('📋 Reset to workspace root');
    })
  );
}

/**
 * Update status bar based on current editor
 */
function updateStatusBar(): void {
  const editor = vscode.window.activeTextEditor;

  if (editor && isCodexFile(editor.document.fileName)) {
    if (treeProvider?.isInIndexMode()) {
      const indexDoc = treeProvider.getIndexDocument();
      const fileCount = indexDoc ? countIndexFiles(indexDoc.children) : 0;

      statusBarItem.text = `$(list-tree) Index: ${fileCount} files`;
      statusBarItem.tooltip = `ChapterWise Index\n${fileCount} files in project\nClick to open Navigator`;
    } else {
    const codexDoc = treeProvider?.getCodexDocument();
    const nodeCount = codexDoc?.allNodes.length ?? 0;
    const typeCount = codexDoc?.types.size ?? 0;

    statusBarItem.text = `$(book) Codex: ${nodeCount} nodes`;
    statusBarItem.tooltip = `ChapterWise Codex\n${nodeCount} nodes, ${typeCount} types\nClick to open Navigator`;
    }
    statusBarItem.show();
  } else {
    statusBarItem?.hide();
  }
}

// ============================================================================
// Navigation Helper Functions
// ============================================================================

/**
 * Recursively find a node by ID in the codex tree
 */
function findNodeById(node: CodexNode, targetId: string): CodexNode | null {
  if (node.id === targetId) {
    return node;
  }

  if (node.children) {
    for (const child of node.children) {
      const found = findNodeById(child, targetId);
      if (found) return found;
    }
  }

  return null;
}

// ============================================================================
// Phase 5: Tree State Management Helper Functions
// ============================================================================

/**
 * Update the expansion state of a node (debounced)
 */
async function updateNodeExpandedState(
  item: IndexNodeTreeItem,
  expanded: boolean
): Promise<void> {
  const workspaceRoot = treeProvider.getWorkspaceRoot();
  if (!workspaceRoot) return;

  // Determine which index file contains this node
  const indexPath = determineIndexFileForNode(item, workspaceRoot);
  if (!fs.existsSync(indexPath)) return;

  const nodeId = item.indexNode.id;
  if (!nodeId) return;

  // Queue the update
  const updateKey = `${indexPath}::${nodeId}`;
  expandedUpdateQueue.set(updateKey, { indexPath, nodeId, expanded });

  // Debounce: wait 500ms for more updates before writing
  if (expandedUpdateTimeout) {
    clearTimeout(expandedUpdateTimeout);
  }

  expandedUpdateTimeout = setTimeout(async () => {
    await flushExpandedUpdates();
    expandedUpdateQueue.clear();
    expandedUpdateTimeout = null;
  }, 500);
}

/**
 * Flush all queued expansion state updates to disk (batched by file)
 */
async function flushExpandedUpdates(): Promise<void> {
  // Group updates by index file
  const fileUpdates = new Map<string, Array<{ nodeId: string; expanded: boolean }>>();

  for (const [key, update] of expandedUpdateQueue) {
    if (!fileUpdates.has(update.indexPath)) {
      fileUpdates.set(update.indexPath, []);
    }
    fileUpdates.get(update.indexPath)!.push({
      nodeId: update.nodeId,
      expanded: update.expanded
    });
  }

  // Apply updates to each index file
  for (const [indexPath, updates] of fileUpdates) {
    try {
      await updateIndexFileExpansionState(indexPath, updates);
      outputChannel.appendLine(`[TreeState] Updated ${updates.length} nodes in ${path.basename(indexPath)}`);
    } catch (error) {
      outputChannel.appendLine(`[TreeState] Failed to update ${indexPath}: ${error}`);
    }
  }
}

/**
 * Update the expansion state in an index file
 */
async function updateIndexFileExpansionState(
  indexPath: string,
  updates: Array<{ nodeId: string; expanded: boolean }>
): Promise<void> {
  // Read index file
  const content = fs.readFileSync(indexPath, 'utf-8');
  const indexData = YAML.parse(content);

  if (!indexData || !indexData.children) {
    return;
  }

  // Apply all updates
  let changesApplied = 0;
  for (const update of updates) {
    if (updateExpandedInTree(indexData.children, update.nodeId, update.expanded)) {
      changesApplied++;
    }
  }

  if (changesApplied > 0) {
    // Write back to file
    fs.writeFileSync(indexPath, YAML.stringify(indexData), 'utf-8');
  }
}

/**
 * Recursively search tree and update expanded property
 */
function updateExpandedInTree(
  children: any[],
  targetId: string,
  expanded: boolean
): boolean {
  for (const child of children) {
    if (child.id === targetId) {
      child.expanded = expanded;
      return true;
    }
    if (child.children && Array.isArray(child.children)) {
      if (updateExpandedInTree(child.children, targetId, expanded)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Determine which index file contains a given node
 */
function determineIndexFileForNode(
  item: IndexNodeTreeItem,
  workspaceRoot: string
): string {
  const node = item.indexNode as any;

  // If node has _parent_file, it's a node/field - use parent file's folder
  if (node._parent_file) {
    const parentFilePath = node._parent_file;
    const folderPath = path.dirname(parentFilePath);
    const perFolderIndex = path.join(workspaceRoot, folderPath, '.index.codex.yaml');

    if (fs.existsSync(perFolderIndex)) {
      return perFolderIndex;
    }
  }

  // If node has _computed_path, use its directory
  if (node._computed_path) {
    const folderPath = path.dirname(node._computed_path);
    const perFolderIndex = path.join(workspaceRoot, folderPath, '.index.codex.yaml');

    if (fs.existsSync(perFolderIndex)) {
      return perFolderIndex;
    }
  }

  // Fall back to workspace root index
  return path.join(workspaceRoot, '.index.codex.yaml');
}

// ============================================================================
// Extension Deactivation
// ============================================================================

/**
 * Extension deactivation
 */
export function deactivate(): void {
  writerViewManager?.dispose();
  disposeAutoFixer();
  disposeExplodeCodex();
  disposeImplodeCodex();
  disposeWordCount();
  disposeTagGenerator();
  disposeConvertFormat();
  disposeGitSetup();
  disposeScrivenerImport();
  outputChannel?.appendLine('ChapterWise Codex extension deactivated');
  outputChannel?.dispose();
}

// Export for use by other modules
export function log(message: string): void {
  outputChannel?.appendLine(message);
}
