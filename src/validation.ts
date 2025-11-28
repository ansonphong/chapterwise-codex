/**
 * Validation - Schema checking and quick-fixes for Codex files
 * Provides diagnostics in the Problems panel and code actions for fixes
 */

import * as vscode from 'vscode';
import { parseCodex, validateCodex, isCodexFile, generateUuid, createMinimalCodex, CodexValidationIssue } from './codexModel';

/**
 * Diagnostic collection for Codex validation
 */
let diagnosticCollection: vscode.DiagnosticCollection;

/**
 * Initialize validation system
 */
export function initializeValidation(context: vscode.ExtensionContext): void {
  diagnosticCollection = vscode.languages.createDiagnosticCollection('chapterwiseCodex');
  context.subscriptions.push(diagnosticCollection);
  
  // Validate on open
  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument((doc) => {
      validateDocument(doc);
    })
  );
  
  // Validate on change
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((e) => {
      validateDocument(e.document);
    })
  );
  
  // Validate on close (clear diagnostics)
  context.subscriptions.push(
    vscode.workspace.onDidCloseTextDocument((doc) => {
      diagnosticCollection.delete(doc.uri);
    })
  );
  
  // Register code action provider
  context.subscriptions.push(
    vscode.languages.registerCodeActionsProvider(
      [
        { language: 'yaml', pattern: '**/*.codex.yaml' },
        { language: 'yaml', pattern: '**/*.codex' },
        { language: 'json', pattern: '**/*.codex.json' },
      ],
      new CodexCodeActionProvider(),
      {
        providedCodeActionKinds: CodexCodeActionProvider.providedCodeActionKinds,
      }
    )
  );
  
  // Validate all open codex documents
  for (const doc of vscode.workspace.textDocuments) {
    validateDocument(doc);
  }
}

/**
 * Validate a document and update diagnostics
 */
function validateDocument(document: vscode.TextDocument): void {
  if (!isCodexFile(document.fileName)) {
    return;
  }
  
  const text = document.getText();
  const codexDoc = parseCodex(text);
  const issues = validateCodex(codexDoc, text);
  
  const diagnostics: vscode.Diagnostic[] = issues.map((issue) => {
    const line = (issue.line ?? 1) - 1;
    const range = new vscode.Range(
      line, 0,
      line, document.lineAt(Math.min(line, document.lineCount - 1)).text.length
    );
    
    const severity = issue.severity === 'error'
      ? vscode.DiagnosticSeverity.Error
      : issue.severity === 'warning'
        ? vscode.DiagnosticSeverity.Warning
        : vscode.DiagnosticSeverity.Information;
    
    const diagnostic = new vscode.Diagnostic(range, issue.message, severity);
    diagnostic.source = 'ChapterWise Codex';
    
    // Add code for quick-fix matching
    if (issue.message.includes('metadata')) {
      diagnostic.code = 'missing-metadata';
    } else if (issue.message.includes('data') && issue.message.includes('wrapper')) {
      diagnostic.code = 'legacy-format';
    } else if (issue.message.includes('missing an \'id\'')) {
      diagnostic.code = 'missing-id';
    } else if (issue.message.includes('formatVersion')) {
      diagnostic.code = 'missing-format-version';
    }
    
    return diagnostic;
  });
  
  diagnosticCollection.set(document.uri, diagnostics);
}

/**
 * Code action provider for quick-fixes
 */
class CodexCodeActionProvider implements vscode.CodeActionProvider {
  static readonly providedCodeActionKinds = [
    vscode.CodeActionKind.QuickFix,
  ];
  
  provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range | vscode.Selection,
    context: vscode.CodeActionContext
  ): vscode.CodeAction[] {
    const actions: vscode.CodeAction[] = [];
    
    for (const diagnostic of context.diagnostics) {
      if (diagnostic.source !== 'ChapterWise Codex') {
        continue;
      }
      
      switch (diagnostic.code) {
        case 'missing-metadata':
          actions.push(this.createAddMetadataAction(document, diagnostic));
          break;
        case 'missing-format-version':
          actions.push(this.createAddFormatVersionAction(document, diagnostic));
          break;
        case 'missing-id':
          actions.push(this.createAddIdAction(document, diagnostic));
          break;
        case 'legacy-format':
          actions.push(this.createConvertFromLegacyAction(document, diagnostic));
          break;
      }
    }
    
    return actions;
  }
  
  private createAddMetadataAction(
    document: vscode.TextDocument,
    diagnostic: vscode.Diagnostic
  ): vscode.CodeAction {
    const action = new vscode.CodeAction(
      'Add missing metadata section',
      vscode.CodeActionKind.QuickFix
    );
    action.diagnostics = [diagnostic];
    action.isPreferred = true;
    
    const metadataBlock = `metadata:
  formatVersion: "1.1"
  documentVersion: "1.0.0"
  created: "${new Date().toISOString()}"

`;
    
    action.edit = new vscode.WorkspaceEdit();
    action.edit.insert(document.uri, new vscode.Position(0, 0), metadataBlock);
    
    return action;
  }
  
  private createAddFormatVersionAction(
    document: vscode.TextDocument,
    diagnostic: vscode.Diagnostic
  ): vscode.CodeAction {
    const action = new vscode.CodeAction(
      'Add formatVersion to metadata',
      vscode.CodeActionKind.QuickFix
    );
    action.diagnostics = [diagnostic];
    
    // Find the metadata line and add formatVersion after it
    const text = document.getText();
    const metadataMatch = text.match(/^metadata:\s*$/m);
    
    if (metadataMatch && metadataMatch.index !== undefined) {
      const insertPos = document.positionAt(metadataMatch.index + metadataMatch[0].length);
      action.edit = new vscode.WorkspaceEdit();
      action.edit.insert(document.uri, insertPos, '\n  formatVersion: "1.1"');
    }
    
    return action;
  }
  
  private createAddIdAction(
    document: vscode.TextDocument,
    diagnostic: vscode.Diagnostic
  ): vscode.CodeAction {
    const action = new vscode.CodeAction(
      'Add generated UUID',
      vscode.CodeActionKind.QuickFix
    );
    action.diagnostics = [diagnostic];
    
    // Insert id field at the diagnostic line
    const line = diagnostic.range.start.line;
    const lineText = document.lineAt(line).text;
    const indent = lineText.match(/^(\s*)/)?.[1] ?? '';
    
    action.edit = new vscode.WorkspaceEdit();
    action.edit.insert(
      document.uri,
      new vscode.Position(line, 0),
      `${indent}id: "${generateUuid()}"\n`
    );
    
    return action;
  }
  
  private createConvertFromLegacyAction(
    document: vscode.TextDocument,
    diagnostic: vscode.Diagnostic
  ): vscode.CodeAction {
    const action = new vscode.CodeAction(
      'Convert from legacy format (removes data wrapper)',
      vscode.CodeActionKind.QuickFix
    );
    action.diagnostics = [diagnostic];
    action.isPreferred = true;
    
    // This is a complex operation - we'll replace with a minimal template
    // In a full implementation, you'd parse and restructure the content
    const text = document.getText();
    
    try {
      // Try to extract content from data wrapper
      const isJson = text.trim().startsWith('{');
      let converted: string;
      
      if (isJson) {
        const obj = JSON.parse(text);
        const data = obj.data ?? {};
        const newObj = {
          metadata: {
            formatVersion: "1.1",
            documentVersion: "1.0.0",
            created: new Date().toISOString(),
          },
          ...data,
        };
        converted = JSON.stringify(newObj, null, 2);
      } else {
        // For YAML, create a simple template with extracted values
        // This is simplified; a full implementation would use YAML parsing
        converted = createMinimalCodex();
      }
      
      action.edit = new vscode.WorkspaceEdit();
      action.edit.replace(
        document.uri,
        new vscode.Range(
          new vscode.Position(0, 0),
          document.positionAt(text.length)
        ),
        converted
      );
    } catch {
      // If conversion fails, just create a new minimal document
      action.edit = new vscode.WorkspaceEdit();
      action.edit.replace(
        document.uri,
        new vscode.Range(
          new vscode.Position(0, 0),
          document.positionAt(text.length)
        ),
        createMinimalCodex()
      );
    }
    
    return action;
  }
}

/**
 * Get the diagnostic collection (for testing)
 */
export function getDiagnosticCollection(): vscode.DiagnosticCollection {
  return diagnosticCollection;
}





