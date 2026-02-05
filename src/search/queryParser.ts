/**
 * Query Parser - Parse search input into structured query
 */

/**
 * Parsed query structure
 */
export interface ParsedQuery {
  terms: string[];
  phrases: string[];
  filters: {
    types: string[];
    fields: FieldFilter[];
    exclude: {
      types: string[];
      terms: string[];
    };
  };
  scope: 'titles' | 'metadata' | 'all';
}

/**
 * Field-specific filter
 */
export interface FieldFilter {
  field: string;
  value: string;
}

/**
 * Parse user search input into structured query
 *
 * Syntax:
 * - Basic: aragorn sword (fuzzy AND)
 * - Exact: "king of gondor"
 * - Type: type:character
 * - Field: body:dragon
 * - Exclude: -type:location -unwanted
 */
export function parseQuery(input: string): ParsedQuery {
  const result: ParsedQuery = {
    terms: [],
    phrases: [],
    filters: {
      types: [],
      fields: [],
      exclude: { types: [], terms: [] }
    },
    scope: 'all'
  };

  if (!input || typeof input !== 'string') {
    return result;
  }

  // 1. Extract quoted phrases: "exact phrase"
  const phraseRegex = /"([^"]+)"/g;
  let match;
  while ((match = phraseRegex.exec(input)) !== null) {
    const phrase = match[1].trim().toLowerCase();
    if (phrase) {
      result.phrases.push(phrase);
    }
  }
  const withoutPhrases = input.replace(phraseRegex, ' ');

  // 2. Tokenize remaining input
  const tokens = withoutPhrases.split(/\s+/).filter(Boolean);

  // 3. Classify each token
  for (const token of tokens) {
    const lower = token.toLowerCase();

    if (lower.startsWith('type:')) {
      const value = lower.slice(5);
      if (value) {
        result.filters.types.push(value);
      }
    } else if (lower.startsWith('-type:')) {
      const value = lower.slice(6);
      if (value) {
        result.filters.exclude.types.push(value);
      }
    } else if (lower.match(/^(body|summary|description|attributes|tags):/)) {
      const colonIdx = lower.indexOf(':');
      const field = lower.slice(0, colonIdx);
      const value = lower.slice(colonIdx + 1);
      if (value) {
        result.filters.fields.push({ field, value });
      }
    } else if (lower.startsWith('-') && lower.length > 1) {
      result.filters.exclude.terms.push(lower.slice(1));
    } else if (lower.length >= 2) {
      result.terms.push(lower);
    }
  }

  return result;
}

/**
 * Check if a query is empty (no search terms)
 */
export function isEmptyQuery(query: ParsedQuery): boolean {
  return (
    query.terms.length === 0 &&
    query.phrases.length === 0 &&
    query.filters.types.length === 0 &&
    query.filters.fields.length === 0
  );
}
