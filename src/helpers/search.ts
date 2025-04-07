import Fuse from "fuse.js";

/**
 * Interface for fuzzy search result
 */
interface FuzzySearchResult {
  results: any[]; // Filtered results that match the criteria
  bestMatch: any | null; // Best match if available (or null)
  hasGoodMatch: boolean; // Whether a good match was found
  allResults: any[]; // All results (unfiltered)
}

/**
 * Configuration options for fuzzy search
 */
interface FuzzySearchOptions {
  threshold?: number; // Score threshold for filtering results (default: 0.2)
  includeAllOnNoMatch?: boolean; // Whether to return all results when no good matches are found
}

/**
 * Perform a fuzzy search on plugin data using Fuse.js
 *
 * @param query The search query string
 * @param items The array of items to search through
 * @param options Configuration options
 * @returns FuzzySearchResult object containing filtered results and metadata
 */
export function fuzzySearch(
  query: string,
  items: any[],
  options: FuzzySearchOptions = {}
): FuzzySearchResult {
  // Default options
  const threshold = options.threshold || 0.2;
  const includeAllOnNoMatch = options.includeAllOnNoMatch !== false;

  // Configure Fuse.js with appropriate options
  const fuseOptions = {
    includeScore: true,
    keys: [
      { name: "name", weight: 3 }, // For Spigot
      { name: "title", weight: 3 }, // For Modrinth
      { name: "author", weight: 1 },
      { name: "description", weight: 0.5 },
    ],
    isCaseSensitive: false,
    shouldSort: true,
    findAllMatches: true,
    threshold: 0.3, // This is just the search threshold, we filter later
    distance: 100,
    location: 0,
    minMatchCharLength: 2,
    ignoreLocation: true,
  };

  // Check for exact match first
  const exactMatch = items.find((item) => {
    const name = item.source === "Modrinth" ? item.title : item.name;
    return name && name.toLowerCase() === query.toLowerCase();
  });

  if (exactMatch) {
    return {
      results: [exactMatch],
      bestMatch: exactMatch,
      hasGoodMatch: true,
      allResults: items,
    };
  }

  // If only one result, it's the best match
  if (items.length === 1) {
    return {
      results: items,
      bestMatch: items[0],
      hasGoodMatch: true,
      allResults: items,
    };
  }

  // Use Fuse.js for fuzzy search
  const fuse = new Fuse(items, fuseOptions);
  const fuseResults = fuse.search(query);

  // Filter results by score threshold
  const filteredResults = fuseResults
    .filter((result) => result.score !== undefined && result.score < threshold)
    .map((result) => result.item);

  // Sort results by source: Spigot first, then Modrinth
  const sortedResults = [...filteredResults].sort((a, b) => {
    if (a.source === "Spigot" && b.source === "Modrinth") return -1;
    if (a.source === "Modrinth" && b.source === "Spigot") return 1;
    return 0; // Keep original order for items with the same source
  });

  // Get best match if available
  const bestMatch =
    fuseResults.length > 0 &&
    fuseResults[0].score !== undefined &&
    fuseResults[0].score < threshold
      ? fuseResults[0].item
      : null;

  // Determine if we have any good matches
  const hasGoodMatch = sortedResults.length > 0;

  // Return filtered results or all results if specified
  return {
    results: hasGoodMatch ? sortedResults : includeAllOnNoMatch ? items : [],
    bestMatch,
    hasGoodMatch,
    allResults: items,
  };
}
