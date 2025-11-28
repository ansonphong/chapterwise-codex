/**
 * Codex Model - Parsing and manipulation of YAML/JSON codex files
 * Supports ChapterWise Codex Format V1.0 and V1.1
 */

import * as YAML from 'yaml';

/**
 * Represents a path segment to navigate to a node in the document
 */
export type PathSegment = string | number;

/**
 * Represents a single node in the Codex hierarchy
 */
export interface CodexNode {
  id: string;
  type: string;
  name: string;
  proseField: string;           // Which field contains prose: 'body', 'summary', etc.
  proseValue: string;           // The actual prose content
  path: PathSegment[];          // Path to this node in the document
  lineNumber?: number;          // Line number in source file (for navigation)
  children: CodexNode[];        // Child nodes
  attributes?: CodexAttribute[];
  relations?: CodexRelation[];
  tags?: string[];
  image?: string;
}

/**
 * Represents an attribute on a node
 */
export interface CodexAttribute {
  key: string;
  name?: string;
  value: unknown;
  dataType?: string;
}

/**
 * Represents a relation between nodes
 */
export interface CodexRelation {
  type: string;
  target: string;
  description?: string;
}

/**
 * Represents a parsed Codex document
 */
export interface CodexDocument {
  metadata: CodexMetadata;
  rootNode: CodexNode | null;
  allNodes: CodexNode[];        // Flattened list of all nodes
  types: Set<string>;           // All unique node types
  rawDoc: YAML.Document.Parsed | null;
  isJson: boolean;
  rawText: string;
}

/**
 * Codex metadata object
 */
export interface CodexMetadata {
  formatVersion: string;
  documentVersion?: string;
  created?: string;
  updated?: string;
  author?: string;
  license?: string;
}

/**
 * Validation error/warning
 */
export interface CodexValidationIssue {
  message: string;
  severity: 'error' | 'warning' | 'info';
  line?: number;
  column?: number;
  path?: PathSegment[];
}

/**
 * Determines if a file is a Codex file based on extension
 */
export function isCodexFile(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return lower.endsWith('.codex.yaml') || 
         lower.endsWith('.codex.json') || 
         lower.endsWith('.codex');
}

/**
 * Determines if the content is JSON
 */
function isJsonContent(text: string): boolean {
  const trimmed = text.trim();
  return trimmed.startsWith('{') || trimmed.startsWith('[');
}

/**
 * Gets the primary prose field from a node object
 */
function getProseField(nodeObj: Record<string, unknown>): { field: string; value: string } {
  // Priority order for prose fields
  const proseFields = ['body', 'summary', 'description', 'content', 'text'];
  
  for (const field of proseFields) {
    if (field in nodeObj && typeof nodeObj[field] === 'string') {
      return { field, value: nodeObj[field] as string };
    }
  }
  
  return { field: 'body', value: '' };
}

/**
 * Walk the YAML document to find line numbers for paths
 */
function findLineNumber(doc: YAML.Document.Parsed, path: PathSegment[]): number | undefined {
  try {
    let current: unknown = doc.contents;
    
    for (const segment of path) {
      if (current === null || current === undefined) {
        return undefined;
      }
      
      if (YAML.isMap(current)) {
        const pair = current.items.find(item => {
          const key = YAML.isScalar(item.key) ? item.key.value : item.key;
          return key === segment;
        });
        if (pair) {
          current = pair.value;
        } else {
          return undefined;
        }
      } else if (YAML.isSeq(current)) {
        const idx = typeof segment === 'number' ? segment : parseInt(segment as string, 10);
        current = current.items[idx];
      } else {
        return undefined;
      }
    }
    
    if (current && typeof current === 'object' && 'range' in current) {
      const range = (current as { range?: [number, number, number] }).range;
      if (range && doc.contents) {
        // Convert character offset to line number
        const text = doc.toString();
        const offset = range[0];
        const beforeOffset = text.substring(0, offset);
        return beforeOffset.split('\n').length;
      }
    }
  } catch {
    return undefined;
  }
  
  return undefined;
}

/**
 * Parse a single node object into a CodexNode
 */
function parseNode(
  nodeObj: Record<string, unknown>,
  path: PathSegment[],
  doc: YAML.Document.Parsed | null
): CodexNode {
  const id = (nodeObj.id as string) ?? '';
  const type = (nodeObj.type as string) ?? 'unknown';
  const name = (nodeObj.name as string) ?? (nodeObj.title as string) ?? id ?? '(untitled)';
  
  const { field: proseField, value: proseValue } = getProseField(nodeObj);
  
  const node: CodexNode = {
    id,
    type,
    name,
    proseField,
    proseValue,
    path: [...path],
    lineNumber: doc ? findLineNumber(doc, path) : undefined,
    children: [],
  };
  
  // Parse attributes
  if (Array.isArray(nodeObj.attributes)) {
    node.attributes = nodeObj.attributes.map((attr: unknown) => {
      const a = attr as Record<string, unknown>;
      return {
        key: (a.key as string) ?? '',
        name: a.name as string | undefined,
        value: a.value,
        dataType: a.dataType as string | undefined,
      };
    });
  }
  
  // Parse relations
  if (Array.isArray(nodeObj.relations)) {
    node.relations = nodeObj.relations.map((rel: unknown) => {
      const r = rel as Record<string, unknown>;
      return {
        type: (r.type as string) ?? '',
        target: (r.target as string) ?? '',
        description: r.description as string | undefined,
      };
    });
  }
  
  // Parse tags
  if (Array.isArray(nodeObj.tags)) {
    node.tags = nodeObj.tags.filter((t): t is string => typeof t === 'string');
  }
  
  // Parse image
  if (typeof nodeObj.image === 'string') {
    node.image = nodeObj.image;
  }
  
  // Recursively parse children
  if (Array.isArray(nodeObj.children)) {
    nodeObj.children.forEach((child: unknown, idx: number) => {
      if (child && typeof child === 'object') {
        const childPath = [...path, 'children', idx];
        const childNode = parseNode(child as Record<string, unknown>, childPath, doc);
        node.children.push(childNode);
      }
    });
  }
  
  return node;
}

/**
 * Flatten the node tree into a list
 */
function flattenNodes(node: CodexNode): CodexNode[] {
  const result: CodexNode[] = [node];
  for (const child of node.children) {
    result.push(...flattenNodes(child));
  }
  return result;
}

/**
 * Parse a Codex document from text (YAML or JSON)
 */
export function parseCodex(text: string): CodexDocument | null {
  try {
    const isJson = isJsonContent(text);
    let rawDoc: YAML.Document.Parsed | null = null;
    let root: Record<string, unknown>;
    
    if (isJson) {
      root = JSON.parse(text);
    } else {
      rawDoc = YAML.parseDocument(text);
      root = rawDoc.toJS() as Record<string, unknown>;
    }
    
    if (!root || typeof root !== 'object') {
      return null;
    }
    
    // Check for legacy format with 'data' wrapper (should be rejected)
    if ('data' in root && !('metadata' in root)) {
      return null;
    }
    
    // Parse metadata
    const metadataObj = root.metadata as Record<string, unknown> | undefined;
    const metadata: CodexMetadata = {
      formatVersion: (metadataObj?.formatVersion as string) ?? '',
      documentVersion: metadataObj?.documentVersion as string | undefined,
      created: metadataObj?.created as string | undefined,
      updated: metadataObj?.updated as string | undefined,
      author: metadataObj?.author as string | undefined,
      license: metadataObj?.license as string | undefined,
    };
    
    // Parse the root node (the document itself is the root node in V1.0+)
    const rootNode = parseNode(root, [], rawDoc);
    
    // Collect all nodes and types
    const allNodes = flattenNodes(rootNode);
    const types = new Set<string>();
    for (const node of allNodes) {
      if (node.type && node.type !== 'unknown') {
        types.add(node.type);
      }
    }
    
    return {
      metadata,
      rootNode,
      allNodes,
      types,
      rawDoc,
      isJson,
      rawText: text,
    };
  } catch {
    return null;
  }
}

/**
 * Get the prose value for a specific node from the document
 */
export function getNodeProse(codexDoc: CodexDocument, node: CodexNode): string {
  try {
    let current: unknown;
    
    if (codexDoc.isJson) {
      current = JSON.parse(codexDoc.rawText);
    } else if (codexDoc.rawDoc) {
      current = codexDoc.rawDoc.toJS();
    } else {
      return '';
    }
    
    // Navigate to the node
    for (const segment of node.path) {
      if (current === null || current === undefined) {
        return '';
      }
      current = (current as Record<string, unknown>)[segment as string];
    }
    
    if (!current || typeof current !== 'object') {
      return '';
    }
    
    const value = (current as Record<string, unknown>)[node.proseField];
    return typeof value === 'string' ? value : '';
  } catch {
    return '';
  }
}

/**
 * Update the prose value for a specific node and return the new document text
 * Preserves YAML formatting (block style, comments, etc.) when possible
 */
export function setNodeProse(
  codexDoc: CodexDocument,
  node: CodexNode,
  newValue: string
): string {
  try {
    if (codexDoc.isJson) {
      // For JSON, we parse, modify, and re-stringify
      const obj = JSON.parse(codexDoc.rawText);
      let current = obj;
      
      // Navigate to the parent of the target field
      for (const segment of node.path) {
        current = current[segment];
      }
      
      if (current && typeof current === 'object') {
        current[node.proseField] = newValue;
      }
      
      return JSON.stringify(obj, null, 2);
    } else {
      // For YAML, use the library's AST manipulation to preserve formatting
      const doc = YAML.parseDocument(codexDoc.rawText);
      
      // Build the full path including the prose field
      const fullPath = [...node.path, node.proseField];
      
      // Get or create the scalar node
      const pathKeys = fullPath.map(p => typeof p === 'number' ? p : String(p));
      
      // Check if the value should be block style (multiline)
      const shouldBeBlock = newValue.includes('\n') || newValue.length > 80;
      
      if (shouldBeBlock) {
        // Create a block scalar
        const scalar = new YAML.Scalar(newValue);
        scalar.type = YAML.Scalar.BLOCK_LITERAL;
        doc.setIn(pathKeys, scalar);
      } else {
        doc.setIn(pathKeys, newValue);
      }
      
      return doc.toString();
    }
  } catch {
    // If something goes wrong, return original text
    return codexDoc.rawText;
  }
}

/**
 * Validate a Codex document and return any issues
 */
export function validateCodex(codexDoc: CodexDocument | null, text: string): CodexValidationIssue[] {
  const issues: CodexValidationIssue[] = [];
  
  // Check if document could be parsed at all
  if (!codexDoc) {
    // Try to determine if it's a legacy format
    try {
      const isJson = isJsonContent(text);
      const obj = isJson ? JSON.parse(text) : YAML.parse(text);
      
      if (obj && typeof obj === 'object') {
        if ('data' in obj && !('metadata' in obj)) {
          issues.push({
            message: "Legacy format detected: Files with 'data' wrapper are not supported. Please migrate using scripts/migrate_codex_to_v1.py",
            severity: 'error',
            line: 1,
          });
          return issues;
        }
        
        if (!('metadata' in obj)) {
          issues.push({
            message: "Invalid format: V1.0+ codex files must have a 'metadata' section.",
            severity: 'error',
            line: 1,
          });
          return issues;
        }
      }
    } catch {
      issues.push({
        message: 'Invalid YAML/JSON syntax',
        severity: 'error',
        line: 1,
      });
      return issues;
    }
    
    issues.push({
      message: 'Unable to parse Codex document',
      severity: 'error',
      line: 1,
    });
    return issues;
  }
  
  // Check metadata exists and has formatVersion
  if (!codexDoc.metadata.formatVersion) {
    issues.push({
      message: "Missing required field: metadata.formatVersion",
      severity: 'error',
      line: 1,
    });
  } else if (codexDoc.metadata.formatVersion !== '1.0' && codexDoc.metadata.formatVersion !== '1.1') {
    issues.push({
      message: `Unsupported format version: ${codexDoc.metadata.formatVersion}. Only V1.0 and V1.1 are supported.`,
      severity: 'error',
      line: 1,
    });
  }
  
  // Check for nodes without IDs
  const seenIds = new Set<string>();
  for (const node of codexDoc.allNodes) {
    if (!node.id && node.type !== 'unknown') {
      issues.push({
        message: `Node of type '${node.type}' is missing an 'id' field`,
        severity: 'warning',
        line: node.lineNumber,
        path: node.path,
      });
    }
    
    // Check for duplicate IDs
    if (node.id) {
      if (seenIds.has(node.id)) {
        issues.push({
          message: `Duplicate ID found: '${node.id}'`,
          severity: 'warning',
          line: node.lineNumber,
          path: node.path,
        });
      }
      seenIds.add(node.id);
    }
    
    // Check for nodes without type
    if (node.type === 'unknown' && node.path.length > 0) {
      issues.push({
        message: `Node '${node.name}' is missing a 'type' field`,
        severity: 'info',
        line: node.lineNumber,
        path: node.path,
      });
    }
  }
  
  // Warn if document has no meaningful content
  if (codexDoc.allNodes.length <= 1 && !codexDoc.rootNode?.id) {
    issues.push({
      message: 'Codex appears to be empty or missing content nodes',
      severity: 'info',
      line: 1,
    });
  }
  
  return issues;
}

/**
 * Generate a UUID v4
 */
export function generateUuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Create a minimal valid Codex document
 */
export function createMinimalCodex(type: string = 'book', name: string = 'Untitled'): string {
  return `metadata:
  formatVersion: "1.1"
  documentVersion: "1.0.0"
  created: "${new Date().toISOString()}"

id: "${generateUuid()}"
type: ${type}
name: "${name}"
summary: |
  Add your summary here.

children: []
`;
}







