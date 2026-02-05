/**
 * BM25 Scoring - Relevance ranking for search results
 */

import { SearchIndex, PostingEntry } from './searchIndex';

// BM25 parameters (empirically tuned defaults)
const K1 = 1.2;  // Term frequency saturation
const B = 0.75;  // Document length normalization

/**
 * Calculate BM25 score for a single term in a document
 */
export function calculateBM25(
  termFreq: number,
  docLength: number,
  avgDocLength: number,
  docFreq: number,
  totalDocs: number
): number {
  // Handle edge cases
  if (totalDocs === 0 || docFreq === 0) {
    return 0;
  }

  // IDF component: log((N - df + 0.5) / (df + 0.5) + 1)
  const idf = Math.log(
    (totalDocs - docFreq + 0.5) / (docFreq + 0.5) + 1
  );

  // TF component with length normalization
  const avgLen = avgDocLength || 100;
  const tfNorm = (termFreq * (K1 + 1)) / (
    termFreq + K1 * (1 - B + B * (docLength / avgLen))
  );

  return idf * tfNorm;
}

/**
 * Score a document against multiple query terms
 */
export function scoreDocument(
  docId: string,
  queryTerms: string[],
  index: SearchIndex,
  docLength: number
): number {
  let score = 0;

  for (const term of queryTerms) {
    const posting = index.termIndex[term];
    if (!posting) continue;

    const docPosting = posting.docs.find(d => d.id === docId);
    if (!docPosting) continue;

    score += calculateBM25(
      docPosting.positions.length,
      docLength,
      index.avgDocLength,
      posting.docs.length,
      index.totalDocs
    );
  }

  return score;
}

/**
 * Boost factors for different match types
 */
export const BOOST_FACTORS = {
  titleMatch: 3.0,
  rootNode: 1.5,
  nestedShallow: 1.0,  // depth 1-2
  nestedDeep: 0.8,     // depth 3+
  tagMatch: 1.3,
  exactPhrase: 2.0,
  summaryField: 1.2,
  bodyField: 1.0,
  recentFile: 1.1
} as const;

/**
 * Calculate boost based on node depth
 */
export function getDepthBoost(nodePath?: string[]): number {
  if (!nodePath || nodePath.length === 0) {
    return BOOST_FACTORS.rootNode;
  }
  if (nodePath.length <= 2) {
    return BOOST_FACTORS.nestedShallow;
  }
  return BOOST_FACTORS.nestedDeep;
}

/**
 * Calculate boost based on field type
 */
export function getFieldBoost(field: string): number {
  if (field === 'summary') {
    return BOOST_FACTORS.summaryField;
  }
  return BOOST_FACTORS.bodyField;
}
