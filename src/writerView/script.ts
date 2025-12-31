/**
 * JavaScript code for Writer View webview
 */

import { CodexNode, CodexAttribute, CodexContentSection } from '../codexModel';

export function getWriterViewScript(node: CodexNode, initialField: string): string {
  // Serialize the data for the script
  const attributesJson = JSON.stringify(node.attributes || []);
  const contentSectionsJson = JSON.stringify(node.contentSections || []);
  
  return /* javascript */ `
$(cat /tmp/script_extract.txt)
  `;
}
