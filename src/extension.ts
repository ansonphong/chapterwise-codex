/**
 * ChapterWise Codex Extension
 * Transform .codex.yaml and .codex.json editing into a Scrivener-like writing experience
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { CodexTreeProvider, CodexTreeItem, CodexFieldTreeItem, IndexNodeTreeItem, CodexTreeItemType, createCodexTreeView } from './treeProvider';
import { WriterViewManager } from './writerView';
import { initializeValidation } from './validation';
import { isCodexFile } from './codexModel';
import { runAutoFixer, disposeAutoFixer } from './autoFixer';
import { runExplodeCodex, disposeExplodeCodex } from './explodeCodex';
import { runImplodeCodex, disposeImplodeCodex } from './implodeCodex';
import { runUpdateWordCount, disposeWordCount } from './wordCount';
import { runGenerateTags, disposeTagGenerator } from './tagGenerator';
import { runGenerateIndex, runRegenerateIndex, generateFolderHierarchy } from './indexGenerator';
import { runCreateIndexFile } from './indexBoilerplate';
import { runConvertToMarkdown, runConvertToCodex, disposeConvertFormat } from './convertFormat';
import { countFilesInIndex as countIndexFiles } from './indexParser';
import { CodexDragAndDropController } from './dragDropController';

let treeProvider: CodexTreeProvider;
let treeView: vscode.TreeView<CodexTreeItemType>;
let writerViewManager: WriterViewManager;
let statusBarItem: vscode.StatusBarItem;

/**
 * Extension activation
 */
export function activate(context: vscode.ExtensionContext): void {
  console.log('ChapterWise Codex extension activating...');
  
  try {
    // Initialize tree view
    const { treeProvider: tp, treeView: tv } = createCodexTreeView(context);
    treeProvider = tp;
    treeView = tv;
    console.log('ChapterWise Codex: Tree view created');
    
    // Initialize drag & drop controller
    const dragController = new CodexDragAndDropController(treeProvider);
    (treeView as any).dragAndDropController = dragController;
    console.log('ChapterWise Codex: Drag & drop controller registered');
    
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
    
    // Auto-discover index.codex.yaml in top-level folders
    autoDiscoverIndexFiles();
    
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
          
          // Update tree to show the opened file
          treeProvider.setActiveDocument(doc);
        } catch (error) {
          vscode.window.showErrorMessage(
            `Failed to open file: ${path.basename(filePath)}`
          );
          console.error('Failed to open index file:', error);
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
            vscode.window.showInformationMessage(`Added child node: ${name}`);
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
          vscode.window.showInformationMessage(`Added sibling node: ${name}`);
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
          vscode.window.showInformationMessage(`Removed: ${treeItem.codexNode.name}`);
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
          vscode.window.showInformationMessage(`Deleted: ${treeItem.codexNode.name}`);
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
      async (treeItem?: CodexTreeItem) => {
        if (!treeItem) return;
        vscode.window.showInformationMessage(`Move up functionality coming soon!`);
      }
    )
  );
  
  // Move node down command
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'chapterwiseCodex.moveNodeDown',
      async (treeItem?: CodexTreeItem) => {
        if (!treeItem) return;
        vscode.window.showInformationMessage(`Move down functionality coming soon!`);
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
  
  // Switch to FILES mode command
  context.subscriptions.push(
    vscode.commands.registerCommand('chapterwiseCodex.switchToFilesMode', async () => {
      treeProvider.setNavigationMode('files');
      
      // Set context for button highlighting
      await vscode.commands.executeCommand('setContext', 'codexNavigatorMode', 'files');
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
      
      await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: `Autofixing folder: ${item.indexNode.name}...`,
        cancellable: false,
      }, async () => {
        const { getStructureEditor } = await import('./structureEditor');
        const editor = getStructureEditor();
        
        // 1. Renormalize order values in per-folder .index.codex.yaml
        const result = await editor.autofixFolderOrder(workspaceRoot, folderPath);
        
        if (!result.success) {
          vscode.window.showErrorMessage(`Autofix failed: ${result.message}`);
          return;
        }
        
        // 2. Run autofix on all .codex.yaml files in folder (optional)
        // This would be a more comprehensive autofix that fixes IDs, UUIDs, etc.
        // For now, we just normalize order values
        
        // 3. Refresh tree
        treeProvider.refresh();
      });
      
      vscode.window.showInformationMessage(`✅ Autofix complete for folder: ${item.indexNode.name}`);
    })
  );
  
  // Set Context Folder command (scope navigator to a specific folder)
  context.subscriptions.push(
    vscode.commands.registerCommand('chapterwiseCodex.setContextFolder', async (uri: vscode.Uri) => {
      if (!uri) {
        vscode.window.showErrorMessage('No folder selected');
        return;
      }
      
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders || workspaceFolders.length === 0) {
        vscode.window.showErrorMessage('No workspace folder found');
        return;
      }
      
      const workspaceRoot = workspaceFolders[0].uri.fsPath;
      const folderPath = path.relative(workspaceRoot, uri.fsPath);
      
      await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: `Setting context to: ${path.basename(uri.fsPath)}...`,
        cancellable: false,
      }, async () => {
        // Check if index exists
        const indexPath = path.join(uri.fsPath, '.index.codex.yaml');
        
        if (!fs.existsSync(indexPath)) {
          // Generate index hierarchy recursively
          console.log(`[ChapterWise Codex] Generating index hierarchy for: ${folderPath}`);
          await generateFolderHierarchy(workspaceRoot, folderPath);
          vscode.window.showInformationMessage(`✅ Generated index hierarchy for: ${path.basename(uri.fsPath)}`);
        }
        
        // Set context folder in tree provider
        await treeProvider.setContextFolder(folderPath, workspaceRoot);
        
        // Update tree view title
        treeView.title = `📋 ${path.basename(uri.fsPath)}`;
        
        // Switch to INDEX mode
        treeProvider.setNavigationMode('index');
        await vscode.commands.executeCommand('setContext', 'codexNavigatorMode', 'index');
      });
      
      vscode.window.showInformationMessage(`📋 Viewing: ${path.basename(uri.fsPath)}`);
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
  console.log('ChapterWise Codex extension deactivated');
}
