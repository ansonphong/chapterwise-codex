/**
 * Search Engine - Execute searches across the index
 */

import {
  SearchIndex,
  SearchResult,
  TitleEntry
} from './searchIndex';
import { ParsedQuery } from './queryParser';
import { fuzzyMatch } from './tokenizer';
import { scoreDocument, BOOST_FACTORS, getFieldBoost } from './scoring';

/**
 * Search options
 */
export interface SearchOptions {
  limit: number;
  timeout: number;
}

/**
 * Execute search across all tiers
 */
export async function executeSearch(
  query: ParsedQuery,
  index: SearchIndex,
  options: SearchOptions = { limit: 50, timeout: 2000 }
): Promise<SearchResult[]> {
  const results: SearchResult[] = [];
  const seen = new Set<string>();
  const startTime = Date.now();

  // Build title lookup map for O(1) access
  const titleMap = new Map<string, TitleEntry>();
  for (const t of index.titles) {
    titleMap.set(t.id, t);
  }

  // TIER 1: Titles (instant)
  const titleResults = searchTitles(query, index);
  for (const r of titleResults) {
    if (!seen.has(r.id)) {
      seen.add(r.id);
      results.push(r);
    }
  }

  // Early return for simple queries with enough results
  if (results.length >= options.limit && query.terms.length <= 2 && query.phrases.length === 0) {
    return rankResults(results).slice(0, options.limit);
  }

  // TIER 2: Metadata
  const metaResults = searchMetadata(query, index, titleMap);
  for (const r of metaResults) {
    if (!seen.has(r.id)) {
      seen.add(r.id);
      results.push(r);
    }
  }

  // Check timeout
  if (Date.now() - startTime > options.timeout) {
    return rankResults(results).slice(0, options.limit);
  }

  // TIER 3: Content
  {
    const contentResults = searchContent(query, index, titleMap);
    for (const r of contentResults) {
      const key = `${r.id}:${r.field || ''}`;
      if (!seen.has(key)) {
        seen.add(key);
        results.push(r);
      }
    }
  }

  return rankResults(results).slice(0, options.limit);
}

/**
 * Search titles (Tier 1)
 */
function searchTitles(query: ParsedQuery, index: SearchIndex): SearchResult[] {
  const results: SearchResult[] = [];

  for (const entry of index.titles) {
    // Check type filter
    if (query.filters.types.length > 0) {
      if (!query.filters.types.includes(entry.type.toLowerCase())) {
        continue;
      }
    }

    // Check type exclusion
    if (query.filters.exclude.types.includes(entry.type.toLowerCase())) {
      continue;
    }

    // Check term matches
    let matches = false;
    let score = 0;

    for (const term of query.terms) {
      if (fuzzyMatch(term, entry.name) || fuzzyMatch(term, entry.id)) {
        matches = true;
        score += BOOST_FACTORS.titleMatch;
      }
    }

    // Check phrase matches
    for (const phrase of query.phrases) {
      if (entry.name.toLowerCase().includes(phrase)) {
        matches = true;
        score += BOOST_FACTORS.titleMatch * BOOST_FACTORS.exactPhrase;
      }
    }

    // If no search terms, match all (filtered results)
    if (query.terms.length === 0 && query.phrases.length === 0) {
      matches = query.filters.types.length > 0;
      score = 1;
    }

    if (matches) {
      score *= entry.boost;
      results.push({
        id: entry.id,
        name: entry.name,
        type: entry.type,
        path: entry.path,
        nodePath: entry.nodePath,
        score,
        tier: 1,
        matchType: 'title'
      });
    }
  }

  return results;
}

/**
 * Search metadata (Tier 2)
 */
function searchMetadata(query: ParsedQuery, index: SearchIndex, titleMap: Map<string, TitleEntry>): SearchResult[] {
  const results: SearchResult[] = [];

  for (const entry of index.metadata) {
    // Check type filter
    if (query.filters.types.length > 0) {
      if (!query.filters.types.includes(entry.type.toLowerCase())) {
        continue;
      }
    }

    // Check type exclusion
    if (query.filters.exclude.types.includes(entry.type.toLowerCase())) {
      continue;
    }

    let matches = false;
    let score = 0;
    let matchType: 'tag' | 'attribute' = 'tag';

    // Search tags
    for (const term of query.terms) {
      for (const tag of entry.tags) {
        if (fuzzyMatch(term, tag)) {
          matches = true;
          score += BOOST_FACTORS.tagMatch;
          matchType = 'tag';
        }
      }
    }

    // Search attributes
    for (const term of query.terms) {
      for (const [key, value] of Object.entries(entry.attributes)) {
        if (fuzzyMatch(term, key) || fuzzyMatch(term, String(value))) {
          matches = true;
          score += 1.0;
          matchType = 'attribute';
        }
      }
    }

    if (matches) {
      // Get title entry for display name
      const titleEntry = titleMap.get(entry.id);
      results.push({
        id: entry.id,
        name: titleEntry?.name || entry.id,
        type: entry.type,
        path: entry.path,
        nodePath: entry.nodePath,
        score,
        tier: 2,
        matchType
      });
    }
  }

  return results;
}

/**
 * Search content (Tier 3)
 */
function searchContent(query: ParsedQuery, index: SearchIndex, titleMap: Map<string, TitleEntry>): SearchResult[] {
  const results: SearchResult[] = [];

  // Check if we have field-specific filters
  const fieldFilters = query.filters.fields;
  const hasFieldFilters = fieldFilters.length > 0;

  for (const entry of index.content) {
    // Check field filter
    if (hasFieldFilters) {
      const matchesField = fieldFilters.some(f => f.field === entry.field);
      if (!matchesField) continue;
    }

    let matches = false;
    let score = 0;

    // Check terms in tokens
    for (const term of query.terms) {
      // Check exclusions first
      if (query.filters.exclude.terms.includes(term)) {
        continue;
      }

      for (const token of entry.tokens) {
        if (fuzzyMatch(term, token)) {
          matches = true;
          score += scoreDocument(entry.id, [term], index, entry.length);
          break; // Break inner loop to avoid counting same term multiple times
        }
      }
    }

    // Check field filter values
    for (const filter of fieldFilters) {
      if (filter.field === entry.field) {
        if (entry.text.toLowerCase().includes(filter.value.toLowerCase())) {
          matches = true;
          score += 2.0;
        }
      }
    }

    // Check phrases
    for (const phrase of query.phrases) {
      if (entry.text.toLowerCase().includes(phrase)) {
        matches = true;
        score += BOOST_FACTORS.exactPhrase;
      }
    }

    if (matches) {
      score *= getFieldBoost(entry.field);

      // Get title entry for display name
      const titleEntry = titleMap.get(entry.id);

      // Create snippet
      const snippet = createSnippet(entry.text, query.terms, query.phrases);

      results.push({
        id: entry.id,
        name: titleEntry?.name || entry.id,
        type: titleEntry?.type || 'unknown',
        path: entry.path,
        nodePath: entry.nodePath,
        field: entry.field,
        snippet,
        score,
        tier: 3,
        matchType: 'content'
      });
    }
  }

  return results;
}

/**
 * Create a snippet showing context around matched terms
 */
function createSnippet(text: string, terms: string[], phrases: string[]): string {
  const maxLength = 100;
  const textLower = text.toLowerCase();

  // Find first match position
  let matchPos = -1;
  for (const term of terms) {
    const pos = textLower.indexOf(term);
    if (pos !== -1 && (matchPos === -1 || pos < matchPos)) {
      matchPos = pos;
    }
  }
  for (const phrase of phrases) {
    const pos = textLower.indexOf(phrase);
    if (pos !== -1 && (matchPos === -1 || pos < matchPos)) {
      matchPos = pos;
    }
  }

  if (matchPos === -1) {
    return text.slice(0, maxLength) + (text.length > maxLength ? '...' : '');
  }

  // Extract context around match
  const start = Math.max(0, matchPos - 20);
  const end = Math.min(text.length, matchPos + maxLength - 20);

  let snippet = text.slice(start, end);
  if (start > 0) snippet = '...' + snippet;
  if (end < text.length) snippet = snippet + '...';

  return snippet.replace(/\n/g, ' ').trim();
}

/**
 * Rank results by score descending, then tier ascending
 */
function rankResults(results: SearchResult[]): SearchResult[] {
  return results.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.tier - b.tier;
  });
}
