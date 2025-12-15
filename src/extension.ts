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
import { isCodexFile, parseMarkdownAsCodex, parseCodex } from './codexModel';
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
let outputChannel: vscode.OutputChannel;

/**
 * Get the output channel for logging
 */
export function getOutputChannel(): vscode.OutputChannel | undefined {
  return outputChannel;
}

/**
 * Extension activation
 */
export function activate(context: vscode.ExtensionContext): void {
  // Create output channel for logs
  outputChannel = vscode.window.createOutputChannel('ChapterWise Codex');
  context.subscriptions.push(outputChannel);
  
  outputChannel.appendLine('ChapterWise Codex extension activating...');
  
  try {
    // Initialize tree view
    const { treeProvider: tp, treeView: tv } = createCodexTreeView(context);
    treeProvider = tp;
    treeView = tv;
    outputChannel.appendLine('Tree view created');
    
    // Initialize drag & drop controller
    const dragController = new CodexDragAndDropController(treeProvider);
    (treeView as any).dragAndDropController = dragController;
    outputChannel.appendLine('Drag & drop controller registered');
    
    // Initialize Writer View manager
    writerViewManager = new WriterViewManager(context);
    outputChannel.appendLine('Writer view manager created');
    
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
        cancellable: false,
      }, async () => {
        // Always regenerate index hierarchy recursively
        outputChannel.appendLine(`[setContextFolder] Regenerating index hierarchy for: ${folderPath}`);
        await generateFolderHierarchy(workspaceRoot, folderPath);
        
        // EXPLICITLY set context in tree provider
        outputChannel.appendLine(`[setContextFolder] Calling treeProvider.setContextFolder()`);
        await treeProvider.setContextFolder(folderPath, workspaceRoot);
        
        // Open the index file so user can see it
        const doc = await vscode.workspace.openTextDocument(indexPath);
        await vscode.window.showTextDocument(doc);
        
        // Update tree view title
        treeView.title = `📋 ${path.basename(uri.fsPath)}`;
      });
      
      outputChannel.appendLine(`[setContextFolder] Complete - Viewing: ${path.basename(uri.fsPath)}`);
      vscode.window.showInformationMessage(`📋 Viewing: ${path.basename(uri.fsPath)}`);
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
        
        outputChannel.appendLine(`[setContextFile] Complete - Viewing: ${path.basename(uri.fsPath)}`);
        vscode.window.showInformationMessage(`📄 Viewing: ${path.basename(uri.fsPath)}`);
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
  outputChannel?.appendLine('ChapterWise Codex extension deactivated');
  outputChannel?.dispose();
}

// Export for use by other modules
export function log(message: string): void {
  outputChannel?.appendLine(message);
}
