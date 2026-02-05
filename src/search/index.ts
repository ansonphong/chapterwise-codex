/**
 * Search Module - Main exports
 */

// Types
export {
  SearchIndex,
  TitleEntry,
  MetadataEntry,
  ContentEntry,
  PostingList,
  PostingEntry,
  SearchResult,
  createEmptyIndex
} from './searchIndex';

// Tokenizer
export {
  tokenize,
  levenshteinDistance,
  fuzzyMatch,
  escapeRegex
} from './tokenizer';

// Query Parser
export {
  ParsedQuery,
  FieldFilter,
  parseQuery,
  isEmptyQuery
} from './queryParser';