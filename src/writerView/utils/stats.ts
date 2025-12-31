/**
 * Statistics calculation for Writer View
 */

/**
 * Interface for Writer View panel statistics
 */
export interface WriterPanelStats {
  wordCount: number;
  charCount: number;
  nodeName: string;
  field?: string;
}

/**
 * Calculate statistics from text
 */
export function calculateStats(text: string, nodeName: string, field?: string): WriterPanelStats {
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
  const charCount = text.length;
  
  return {
    wordCount,
    charCount,
    nodeName,
    field
  };
}

