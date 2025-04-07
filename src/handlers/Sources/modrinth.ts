import {
  Modrinth,
  SearchIndex,
  FacetGroup,
  FacetType,
  FacetOperation,
  SearchFacets,
  Facet,
} from "typerinth";
import type { Project, SearchHit } from "typerinth/dist/interfaces/project";
import type { Range0to100 } from "typerinth/dist/types/Range";

export interface ModrinthSearchHit extends SearchHit {
  version_raw?: string;
}

// Simple cache implementation to reduce API calls
interface CacheEntry {
  timestamp: number;
  data: any;
}

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds
const cache: Record<string, CacheEntry> = {};

/**
 * Retrieves or stores data in cache
 * @param key - Cache key
 * @param fetchData - Function to fetch data if not in cache
 * @returns Retrieved or fetched data
 */
async function withCache<T>(
  key: string,
  fetchData: () => Promise<T>
): Promise<T> {
  const now = Date.now();

  // Return cached data if valid
  if (cache[key] && now - cache[key].timestamp < CACHE_TTL) {
    return cache[key].data as T;
  }

  // Fetch new data
  const data = await fetchData();

  // Store in cache
  cache[key] = {
    timestamp: now,
    data,
  };

  return data;
}

/**
 * Ensures that the provided number is a valid ModrinthLimit
 * @param value The number to check
 * @returns A valid ModrinthLimit value
 */
function ensureValidLimit(value: number): Range0to100 {
  // Clamp to 1-100 range
  const clampedValue = Math.max(1, Math.min(100, value));
  return clampedValue as Range0to100;
}

/**
 * Search for plugins on Modrinth
 * @param query - Search term
 * @param limit - Maximum number of results to return
 * @param fetchVersions - Whether to fetch version information (default: true)
 * @returns Array of search results
 */
export async function ModrinthAPI(
  query: string,
  limit?: number,
  fetchVersions: boolean = true
): Promise<ModrinthSearchHit[]> {
  const modrinth = new Modrinth();
  const maxResults = limit ? limit : 10;
  const validLimit = ensureValidLimit(maxResults);

  const cacheKey = `search:${query}:${validLimit}`;

  try {
    // Use cache for search results
    const results = await withCache(cacheKey, () =>
      modrinth.search(query, {
        limit: validLimit,
        index: SearchIndex.Downloads,
        facets: new SearchFacets(
          new FacetGroup(
            new Facet(FacetType.Categories, FacetOperation.Equals, "paper"),
            new Facet(FacetType.Categories, FacetOperation.Equals, "spigot")
          )
        ),
      })
    );

    // Process search results
    const hits = results.hits as ModrinthSearchHit[];

    // Set default version_raw from latest_version
    hits.forEach((hit) => {
      if (!hit.version_raw && hit.latest_version) {
        hit.version_raw = hit.latest_version;
      }
    });

    if (fetchVersions) {
      // Start version fetch in background but don't wait for it
      fetchVersionsInBackground(hits, modrinth);
    }

    return hits;
  } catch (error) {
    console.error(
      `Error searching Modrinth: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    return [];
  }
}

/**
 * Fetch version information for search results in the background
 * This runs asynchronously and updates the hits objects in-place
 * @param hits - Search results to update with version information
 * @param modrinth - Modrinth client instance
 */
async function fetchVersionsInBackground(
  hits: ModrinthSearchHit[],
  modrinth: Modrinth
): Promise<void> {
  try {
    await Promise.all(
      hits.map(async (hit) => {
        if (!hit.latest_version) return;

        const versionCacheKey = `version:${hit.latest_version}`;
        try {
          const versionInfo = await withCache(versionCacheKey, () =>
            modrinth.getVersion(hit.latest_version || "")
          );

          if (versionInfo) {
            hit.version_raw = versionInfo.version_number;
          }
        } catch (error) {
          // Fallback to latest_version if version fetch fails
          if (!hit.version_raw) {
            hit.version_raw = hit.latest_version;
          }
        }
      })
    );
  } catch (error) {
    // Just log errors, don't fail the whole operation
    console.error(`Error fetching version details: ${error}`);
  }
}

/**
 * Get a project by its ID
 * @param id - Project ID
 * @returns Project or null if not found
 */
export async function modrinth_IDtoResource(
  id: string
): Promise<Project | null> {
  const cacheKey = `project:${id}`;

  try {
    return await withCache(cacheKey, async () => {
      const modrinth = new Modrinth();
      const resource = await modrinth.getProject(id);
      return resource || null;
    });
  } catch (error) {
    console.error(
      `Error fetching Modrinth project ${id}: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    return null;
  }
}
