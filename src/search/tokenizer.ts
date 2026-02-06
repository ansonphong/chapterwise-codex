/**
 * Tokenizer - Text processing for search indexing
 */

/**
 * Tokenize text into searchable terms
 */
export function tokenize(text: string): string[] {
  if (!text || typeof text !== 'string') {
    return [];
  }

  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(token => token.length >= 2);
}

/**
 * Calculate Levenshtein edit distance between two strings
 */
export function levenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Check if search term fuzzy-matches a target string
 * Uses length-based edit distance thresholds
 */
export function fuzzyMatch(term: string, target: string): boolean {
  const termLower = term.toLowerCase();
  const targetLower = target.toLowerCase();

  // Exact substring match always passes
  if (targetLower.includes(termLower)) {
    return true;
  }

  // Determine max edit distance based on term length
  let maxDistance: number;
  if (term.length <= 3) {
    maxDistance = 0; // Exact only for short terms
  } else if (term.length <= 6) {
    maxDistance = 1; // 1 typo for medium terms
  } else {
    maxDistance = 2; // 2 typos for long terms
  }

  if (maxDistance === 0) {
    return false;
  }

  // Check each word in target
  const targetWords = targetLower.split(/\s+/);
  for (const word of targetWords) {
    if (levenshteinDistance(termLower, word) <= maxDistance) {
      return true;
    }
  }

  return false;
}

/**
 * Escape special regex characters in a string
 */
export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
