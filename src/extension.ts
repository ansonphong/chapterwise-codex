/**
 * ChapterWise Codex Extension
 * Transform .codex.yaml and .codex.json editing into a Scrivener-like writing experience
 */

import * as vscode from 'vscode';
import { CodexTreeProvider, CodexTreeItem, CodexFieldTreeItem, createCodexTreeView } from './treeProvider';
import { WriterViewManager } from './writerView';
import { initializeValidation } from './validation';
import { isCodexFile } from './codexModel';
import { runAutoFixer, disposeAutoFixer } from './autoFixer';
import { runExplodeCodex, disposeExplodeCodex } from './explodeCodex';
import { runImplodeCodex, disposeImplodeCodex } from './implodeCodex';
import { runUpdateWordCount, disposeWordCount } from './wordCount';
import { runGenerateTags, disposeTagGenerator } from './tagGenerator';

let treeProvider: CodexTreeProvider;
let writerViewManager: WriterViewManager;
let statusBarItem: vscode.StatusBarItem;

/**
 * Extension activation
 */
export function activate(context: vscode.ExtensionContext): void {
  console.log('ChapterWise Codex extension activating...');
  
  try {
    // Initialize tree view
    const { treeProvider: tp, treeView } = createCodexTreeView(context);
    treeProvider = tp;
    console.log('ChapterWise Codex: Tree view created');
    
    // Initialize Writer View manager
    writerViewManager = new WriterViewManager(context);
    console.log('ChapterWise Codex: Writer view manager created');
    
    // Initialize validation system
    initializeValidation(context);
    console.log('ChapterWise Codex: Validation initialized');
    
    // Create status bar item
    statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100
    );
    statusBarItem.command = 'chapterwiseCodex.openNavigator';
    context.subscriptions.push(statusBarItem);
    
    // Register commands
    registerCommands(context);
    console.log('ChapterWise Codex: Commands registered');
    
    // Update status bar based on active editor
    updateStatusBar();
    context.subscriptions.push(
      vscode.window.onDidChangeActiveTextEditor(() => {
        updateStatusBar();
        // Also update tree when active editor changes to a codex file
        const editor = vscode.window.activeTextEditor;
        if (editor && isCodexFile(editor.document.fileName)) {
          treeProvider.setActiveDocument(editor.document);
        }
      })
    );
    
    // Set initial document if one is open
    const activeEditor = vscode.window.activeTextEditor;
    if (activeEditor && isCodexFile(activeEditor.document.fileName)) {
      console.log('ChapterWise Codex: Setting active document from editor:', activeEditor.document.fileName);
      treeProvider.setActiveDocument(activeEditor.document);
    }
    
    // Also check all open documents in case active editor detection failed
    for (const doc of vscode.workspace.textDocuments) {
      if (isCodexFile(doc.fileName)) {
        console.log('ChapterWise Codex: Found open codex document:', doc.fileName);
        treeProvider.setActiveDocument(doc);
        break;
      }
    }
    
    console.log('ChapterWise Codex extension activated successfully!');
  } catch (error) {
    console.error('ChapterWise Codex activation failed:', error);
    vscode.window.showErrorMessage(`ChapterWise Codex failed to activate: ${error}`);
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
      const editor = vscode.window.activeTextEditor;
      if (editor && isCodexFile(editor.document.fileName)) {
        treeProvider.setActiveDocument(editor.document);
      }
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
}

/**
 * Update status bar based on current editor
 */
function updateStatusBar(): void {
  const editor = vscode.window.activeTextEditor;
  
  if (editor && isCodexFile(editor.document.fileName)) {
    const codexDoc = treeProvider?.getCodexDocument();
    const nodeCount = codexDoc?.allNodes.length ?? 0;
    const typeCount = codexDoc?.types.size ?? 0;
    
    statusBarItem.text = `$(book) Codex: ${nodeCount} nodes`;
    statusBarItem.tooltip = `ChapterWise Codex\n${nodeCount} nodes, ${typeCount} types\nClick to open Navigator`;
    statusBarItem.show();
  } else {
    statusBarItem?.hide();
  }
}

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
  console.log('ChapterWise Codex extension deactivated');
}
