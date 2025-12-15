/**
 * Index Generator - Fractal Cascade Architecture
 * 
 * Scans workspace and generates .index.codex.yaml with full project hierarchy
 * 
 * NEW: Per-folder indexes
 * - Each folder can have its own .index.codex.yaml
 * - Per-folder indexes define order for immediate children
 * - Parent indexes merge child indexes (cascade up)
 * - Top-level index is complete workspace tree
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import YAML from 'yaml';
import { minimatch } from 'minimatch';

export interface GenerateIndexOptions {
  workspaceRoot: string;
  indexFilePath?: string;
  progressReporter?: vscode.Progress<{ message?: string; increment?: number }>;
}

export interface IndexPatterns {
  include: string[];
  exclude: string[];
}

/**
 * Generate complete index from workspace scan
 */
export async function generateIndex(
  options: GenerateIndexOptions
): Promise<string> {
  const { workspaceRoot, indexFilePath, progressReporter } = options;

  // Step 1: Load index.codex.yaml if exists
  let indexDef: any = null;
  if (indexFilePath && fs.existsSync(indexFilePath)) {
    const content = fs.readFileSync(indexFilePath, 'utf-8');
    indexDef = YAML.parse(content);
  }

  progressReporter?.report({ message: 'Loading patterns...', increment: 10 });

  // Step 2: Get patterns
  const patterns = indexDef?.patterns || getDefaultPatterns();

  // Step 3: Scan workspace
  progressReporter?.report({ message: 'Scanning workspace...', increment: 20 });
  const files = await scanWorkspace(workspaceRoot, patterns);

  progressReporter?.report({
    message: `Found ${files.length} files...`,
    increment: 30,
  });

  // Step 4: Build hierarchy
  progressReporter?.report({ message: 'Building hierarchy...', increment: 20 });
  const children = await buildHierarchy(files, workspaceRoot);

  // Step 5: Apply type styles
  if (indexDef?.typeStyles) {
    applyTypeStyles(children, indexDef.typeStyles);
  }

  progressReporter?.report({ message: 'Writing index file...', increment: 15 });

  // Step 6: Build complete index
  const indexData = {
      metadata: {
        formatVersion: '1.1',
        documentVersion: '1.0.0',
        created: new Date().toISOString(),
        generated: true,
      },
    id: indexDef?.id || 'index-root',
      type: 'index',
    name: indexDef?.name || path.basename(workspaceRoot),
    title: indexDef?.title,
    summary: indexDef?.summary,
    attributes: indexDef?.attributes,
      patterns,
    typeStyles: indexDef?.typeStyles,
    status: indexDef?.status || 'private',
      children,
    };

  // Step 7: Write .index.codex.yaml
  const outputPath = path.join(workspaceRoot, '.index.codex.yaml');
  fs.writeFileSync(outputPath, YAML.stringify(indexData), 'utf-8');

  progressReporter?.report({ message: 'Complete!', increment: 5 });

  return outputPath;
  }

  /**
 * Scan workspace for files matching patterns
   */
async function scanWorkspace(
  root: string,
    patterns: IndexPatterns
  ): Promise<string[]> {
    const files: string[] = [];
    
  function walkDir(dir: string): void {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

        for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = path.relative(root, fullPath);

      // Check exclude patterns first
      if (shouldExclude(relativePath, patterns.exclude)) {
            continue;
          }

          if (entry.isDirectory()) {
        walkDir(fullPath);
          } else if (entry.isFile()) {
        // Check include patterns
        if (shouldInclude(entry.name, patterns.include)) {
              files.push(fullPath);
            }
          }
        }
  }

  try {
    walkDir(root);
      } catch (error) {
    console.error('Error scanning workspace:', error);
      }

  return files;
  }

  /**
 * Check if file should be excluded
   */
function shouldExclude(relativePath: string, excludePatterns: string[]): boolean {
  return excludePatterns.some((pattern) => minimatch(relativePath, pattern));
}

/**
 * Check if file should be included
 */
function shouldInclude(fileName: string, includePatterns: string[]): boolean {
  return includePatterns.some((pattern) => minimatch(fileName, pattern));
  }

  /**
 * Build hierarchical children structure from file list
 * NEW: Supports per-folder .index.codex.yaml merging
 */
async function buildHierarchy(
    files: string[],
  root: string
): Promise<any[]> {
  const tree = new Map<string, any>();

  for (const file of files) {
    const relative = path.relative(root, file);
    const parts = relative.split(path.sep);

    // Build folder structure
    let currentPath = '';
    for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
      const folderPath = currentPath ? `${currentPath}/${part}` : part;

      if (!tree.has(folderPath)) {
        tree.set(folderPath, {
          id: `folder-${folderPath.replace(/\//g, '-')}`,
          type: 'folder',
            name: part,
          _computed_path: folderPath,
          children: [],
        });
      }

      currentPath = folderPath;
          }

    // Add file
    const fileName = parts[parts.length - 1];
    const fileNode = await createFileNode(file, fileName, root);

    if (currentPath) {
      const folder = tree.get(currentPath);
      if (folder) {
        folder.children.push(fileNode);
      }
    } else {
      // Root level file
      if (!tree.has('__root__')) {
        tree.set('__root__', []);
      }
      (tree.get('__root__') as any[]).push(fileNode);
    }
  }

  // Build hierarchical structure
  const result: any[] = [];
  const rootFiles = tree.get('__root__') || [];
  result.push(...rootFiles);

  // Add folders
  const sortedFolders = Array.from(tree.entries())
    .filter(([key]) => key !== '__root__')
    .sort((a, b) => a[0].localeCompare(b[0]));

  for (const [folderPath, folder] of sortedFolders) {
    if (folderPath.includes('/')) {
      // Nested folder - add to parent
      const parentPath = path.dirname(folderPath).replace(/\\/g, '/');
      const parent = tree.get(parentPath);
      if (parent) {
        parent.children.push(folder);
      }
    } else {
      // Root level folder
      result.push(folder);
    }
  }

  // NEW: Merge per-folder indexes (cascade up)
  await mergePerFolderIndexes(result, root, tree);

  // Sort children by order then name (after merging)
  sortChildrenRecursive(result);

  return result;
}

/**
 * Merge per-folder .index.codex.yaml files into the hierarchy
 * Processes from deepest folders UP to preserve order values
 */
async function mergePerFolderIndexes(
  rootChildren: any[],
  workspaceRoot: string,
  tree: Map<string, any>
): Promise<void> {
  // Get all folder paths, sorted by depth (deepest first)
  const folderPaths = Array.from(tree.keys())
    .filter(key => key !== '__root__')
    .sort((a, b) => {
      const depthA = a.split('/').length;
      const depthB = b.split('/').length;
      return depthB - depthA; // Deepest first
    });

  // Process each folder from deepest to shallowest
  for (const folderPath of folderPaths) {
    const folder = tree.get(folderPath);
    if (!folder) continue;

    // Check if this folder has a per-folder .index.codex.yaml
    const perFolderIndexPath = path.join(workspaceRoot, folderPath, '.index.codex.yaml');
    
    if (fs.existsSync(perFolderIndexPath)) {
      try {
        const indexContent = fs.readFileSync(perFolderIndexPath, 'utf-8');
        const indexData = YAML.parse(indexContent);
        
        if (indexData.children && Array.isArray(indexData.children)) {
          // Merge order values from per-folder index
          applyPerFolderOrders(folder.children, indexData.children);
        }
      } catch (error) {
        console.warn(`Failed to read per-folder index at ${folderPath}:`, error);
      }
    }
  }

  // Also check for root-level .index.codex.yaml (not hidden)
  const rootIndexPath = path.join(workspaceRoot, 'index.codex.yaml');
  if (fs.existsSync(rootIndexPath)) {
    try {
      const indexContent = fs.readFileSync(rootIndexPath, 'utf-8');
      const indexData = YAML.parse(indexContent);

      if (indexData.children && Array.isArray(indexData.children)) {
        applyPerFolderOrders(rootChildren, indexData.children);
      }
    } catch (error) {
      console.warn('Failed to read root index.codex.yaml:', error);
    }
  }
}

/**
 * Apply order values from per-folder index to generated children
 */
function applyPerFolderOrders(
  generatedChildren: any[],
  indexChildren: any[]
): void {
  // Build lookup map by _filename or name
  const indexMap = new Map<string, any>();
  
  for (const child of indexChildren) {
    const key = child._filename || child.name;
    if (key) {
      indexMap.set(key, child);
    }
  }

  // Apply order values to matching children
  for (const child of generatedChildren) {
    const key = child._filename || child.name;
    const indexEntry = indexMap.get(key);
    
    if (indexEntry && indexEntry.order !== undefined) {
      child.order = indexEntry.order;
    } else if (child.order === undefined) {
      // Assign default order if not set
      child.order = indexChildren.length || 999;
      }
    }
  }

  /**
 * Create file node with type detection
   */
async function createFileNode(
  filePath: string,
  fileName: string,
  root: string
): Promise<any> {
  const relative = path.relative(root, filePath);
  const ext = path.extname(fileName).toLowerCase();

  let type = 'document';
  let name = fileName;
  let format = 'unknown';

  // Detect format
  if (fileName.endsWith('.codex.yaml')) {
    format = 'yaml';
    type = 'codex';
    name = fileName.replace('.codex.yaml', '');
  } else if (fileName.endsWith('.codex.json')) {
    format = 'json';
    type = 'codex';
    name = fileName.replace('.codex.json', '');
  } else if (ext === '.md') {
    format = 'markdown';
    type = 'markdown';
    name = fileName.replace('.md', '');
  }

  // Read actual type and name from file
    try {
      const content = fs.readFileSync(filePath, 'utf-8');

    if (format === 'yaml' || format === 'json') {
      const data = YAML.parse(content);
      if (data.type) {type = data.type;}
      if (data.name) {name = data.name;}
    } else if (format === 'markdown') {
      // Parse frontmatter
      const { type: fmType, name: fmName } = parseFrontmatter(content);
      if (fmType) {type = fmType;}
      if (fmName) {
        name = fmName;
      } else {
        // Extract from first H1
        const h1Match = content.match(/^#\s+(.+)$/m);
        if (h1Match) {name = h1Match[1].trim();}
      }
    }
  } catch (error) {
    // Use defaults if parsing fails
  }

  return {
    id: `file-${relative.replace(/[\\/\.]/g, '-')}`,
    type,
    name, // Display name (extension stripped)
    _filename: fileName, // Actual filename (with extension)
    _computed_path: relative, // Will be recomputed by parser
    _format: format,
    _default_status: 'private',
    order: 1, // Will be adjusted during sorting
  };
}

/**
 * Parse YAML frontmatter from markdown
 */
function parseFrontmatter(content: string): { type?: string; name?: string } {
  const match = content.match(/^---\n([\s\S]+?)\n---/);
  if (!match) {return {};}

  try {
    const fm = YAML.parse(match[1]);
    return {
      type: fm.type,
      name: fm.name || fm.title,
    };
  } catch {
    return {};
  }
  }

  /**
 * Apply type styles to children recursively
   */
function applyTypeStyles(children: any[], typeStyles: any[]): void {
  const styleMap = new Map(typeStyles.map((s) => [s.type, s]));

  function apply(nodes: any[]): void {
    for (const node of nodes) {
      const style = styleMap.get(node.type);
      if (style) {
        if (!node.emoji && style.emoji) {node._type_emoji = style.emoji;}
        if (!node.color && style.color) {node._type_color = style.color;}
      }
      if (node.children) {apply(node.children);}
    }
  }

  apply(children);
          }

/**
 * Sort children recursively by order then name
 */
function sortChildrenRecursive(children: any[]): void {
  children.sort((a, b) => {
    if (a.order !== undefined && b.order !== undefined) {
      return a.order - b.order;
        }
    return a.name.localeCompare(b.name);
  });

  for (const child of children) {
    if (child.children) {
      sortChildrenRecursive(child.children);
    }
  }
  }

  /**
 * Get default patterns
 */
function getDefaultPatterns(): IndexPatterns {
  return {
    include: ['*.codex.yaml', '*.codex.json', '*.md'],
    exclude: [
      '**/node_modules/**',
      '**/.git/**',
      '**/__pycache__/**',
      '**/venv/**',
      '**/dist/**',
      '**/.DS_Store',
      '**/.*',
      '**/*.jpg',
      '**/*.png',
    ],
  };
}

/**
 * Count files in children tree
 */
function countFiles(children: any[]): number {
  let count = 0;
  for (const child of children) {
    if (child.type !== 'folder') {count++;}
    if (child.children) {count += countFiles(child.children);}
  }
  return count;
}

/**
 * Command handler: Generate Index
 */
export async function runGenerateIndex(): Promise<void> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    vscode.window.showErrorMessage('No workspace folder open');
    return;
  }

  const workspaceRoot = workspaceFolders[0].uri.fsPath;
  const indexPath = path.join(workspaceRoot, 'index.codex.yaml');

  // Generate with progress
  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'Generating Index',
      cancellable: false,
    },
    async (progress) => {
      try {
        const outputPath = await generateIndex({
          workspaceRoot,
          indexFilePath: fs.existsSync(indexPath) ? indexPath : undefined,
          progressReporter: progress,
        });

        // Count files
        const content = fs.readFileSync(outputPath, 'utf-8');
        const data = YAML.parse(content);
        const fileCount = countFiles(data.children);

      const action = await vscode.window.showInformationMessage(
          `✅ Generated .index.codex.yaml\nFound ${fileCount} files`,
        'Open Index',
          'Show in Explorer'
      );

      if (action === 'Open Index') {
          const doc = await vscode.workspace.openTextDocument(outputPath);
        await vscode.window.showTextDocument(doc);
        } else if (action === 'Show in Explorer') {
          vscode.commands.executeCommand(
            'revealFileInOS',
            vscode.Uri.file(outputPath)
          );
        }
      } catch (error) {
        vscode.window.showErrorMessage(
          `Failed to generate index: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  );
}

/**
 * Command handler: Regenerate Index
 */
export async function runRegenerateIndex(basePath?: string): Promise<void> {
  return runGenerateIndex();
}

/**
 * Generate per-folder .index.codex.yaml for a specific folder
 * This creates a complete index for just the immediate children
 */
export async function generatePerFolderIndex(
  workspaceRoot: string,
  folderPath: string
): Promise<string> {
  const fullFolderPath = path.join(workspaceRoot, folderPath);

  if (!fs.existsSync(fullFolderPath)) {
    throw new Error(`Folder not found: ${folderPath}`);
  }

  // Scan immediate children only (no recursion)
  const entries = fs.readdirSync(fullFolderPath, { withFileTypes: true });
  const children: any[] = [];

  for (const entry of entries) {
    if (entry.name === '.index.codex.yaml' || entry.name.startsWith('.')) {
      continue; // Skip hidden files and the index itself
    }

    const childPath = path.join(fullFolderPath, entry.name);

    if (entry.isFile()) {
      // Check if it's a codex file
      if (entry.name.endsWith('.codex.yaml') || 
          entry.name.endsWith('.codex.json') || 
          entry.name.endsWith('.md')) {
        const fileNode = await createFileNode(childPath, entry.name, workspaceRoot);
        // Fix _computed_path to be relative to workspace root, not folder
        fileNode._computed_path = folderPath ? path.join(folderPath, entry.name) : entry.name;
        children.push(fileNode);
      }
    } else if (entry.isDirectory()) {
      // Create folder node
      const folderNode: any = {
        id: `folder-${entry.name}`,
        type: 'folder',
        name: entry.name,
        _computed_path: folderPath ? path.join(folderPath, entry.name) : entry.name,
        order: 999,
        children: [] // Initialize empty children array
      };
      
      // Check if folder has a per-folder .index.codex.yaml
      const subIndexPath = path.join(childPath, '.index.codex.yaml');
      if (fs.existsSync(subIndexPath)) {
        try {
          const subIndexContent = fs.readFileSync(subIndexPath, 'utf-8');
          const subIndexData = YAML.parse(subIndexContent);
          
          if (subIndexData.children && Array.isArray(subIndexData.children)) {
            // Merge children from per-folder index
            folderNode.children = subIndexData.children;
          }
        } catch (error) {
          console.warn(`Failed to merge per-folder index for ${entry.name}:`, error);
        }
      }
      
      children.push(folderNode);
    }
  }

  // Sort by order then name
  children.sort((a, b) => {
    const orderA = a.order ?? 999;
    const orderB = b.order ?? 999;
    if (orderA !== orderB) return orderA - orderB;
    return a.name.localeCompare(b.name);
  });

  // Assign sequential orders if not set
  children.forEach((child, index) => {
    if (child.order === undefined || child.order === 999) {
      child.order = index;
    }
  });

  // Build index data
  const indexData = {
    metadata: {
      formatVersion: '2.1',
      documentVersion: '1.0.0',
      created: new Date().toISOString(),
      generated: true,
      type: 'index', // Complete index (not fragment)
    },
    id: `index-${folderPath.replace(/[\\/]/g, '-')}`,
    type: 'index',
    name: path.basename(folderPath),
    children,
  };

  // Write per-folder .index.codex.yaml
  const outputPath = path.join(fullFolderPath, '.index.codex.yaml');
  fs.writeFileSync(outputPath, YAML.stringify(indexData), 'utf-8');

  return outputPath;
      }

/**
 * Cascade regenerate: update folder index and all parent indexes up to root
 * This is called after reordering files in a folder
 */
export async function cascadeRegenerateIndexes(
  workspaceRoot: string,
  changedFolderPath: string
): Promise<void> {
  // 1. Regenerate the immediate folder index
  await generatePerFolderIndex(workspaceRoot, changedFolderPath);

  // 2. Regenerate all parent folder indexes up to root
  let currentPath = changedFolderPath;
  
  while (currentPath) {
    const parentPath = path.dirname(currentPath);
    
    if (parentPath === '.' || parentPath === currentPath) {
      // Reached root
      break;
    }

    // Regenerate parent folder index
    await generatePerFolderIndex(workspaceRoot, parentPath);
    currentPath = parentPath;
  }

  // 3. Finally, regenerate top-level .index.codex.yaml
  await generateIndex({ workspaceRoot });
}

/**
 * Recursively generate per-folder indexes for a folder and all its subfolders
 * This implements the fractal cascade architecture by processing from deepest to shallowest
 * 
 * @param workspaceRoot - Workspace root path
 * @param startFolder - Starting folder path (relative to workspace root)
 */
export async function generateFolderHierarchy(
  workspaceRoot: string,
  startFolder: string
): Promise<void> {
  console.log(`[IndexGenerator] Generating folder hierarchy for: ${startFolder}`);
  
  const fullStartPath = path.join(workspaceRoot, startFolder);
  
  if (!fs.existsSync(fullStartPath)) {
    throw new Error(`Folder not found: ${startFolder}`);
  }
  
  // 1. Recursively collect all subfolders (depth-first)
  const allFolders: string[] = [];
  
  function collectSubfolders(folderPath: string) {
    const relativePath = path.relative(workspaceRoot, folderPath);
    allFolders.push(relativePath || '.');
    
    try {
      const entries = fs.readdirSync(folderPath, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isDirectory() && !entry.name.startsWith('.')) {
          const subfolder = path.join(folderPath, entry.name);
          collectSubfolders(subfolder);
      }
    }
    } catch (error) {
      console.error(`[IndexGenerator] Error reading folder ${folderPath}:`, error);
    }
  }
  
  collectSubfolders(fullStartPath);
  
  console.log(`[IndexGenerator] Found ${allFolders.length} folders to process`);
  
  // 2. Sort by depth (deepest first)
  allFolders.sort((a, b) => {
    const depthA = a === '.' ? 0 : a.split(path.sep).length;
    const depthB = b === '.' ? 0 : b.split(path.sep).length;
    return depthB - depthA; // Deepest first
  });
  
  // 3. Generate per-folder index for each (deepest first)
  for (const folderPath of allFolders) {
    try {
      console.log(`[IndexGenerator] Generating index for: ${folderPath}`);
      await generatePerFolderIndex(workspaceRoot, folderPath === '.' ? '' : folderPath);
    } catch (error) {
      console.error(`[IndexGenerator] Error generating index for ${folderPath}:`, error);
      // Continue with other folders even if one fails
    }
  }
  
  // 4. Finally, regenerate top-level .index.codex.yaml to merge everything
  console.log(`[IndexGenerator] Regenerating top-level index`);
  await generateIndex({ workspaceRoot });
  
  console.log(`[IndexGenerator] Folder hierarchy generation complete`);
}
