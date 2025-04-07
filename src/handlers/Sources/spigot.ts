import SpigetAPI from "spiget-api";
import { Resource } from "spiget-api/dist/class/Resource";

export interface ExtendedResource extends Resource {
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
 * Search for plugins on Spigot
 * @param query - Search term
 * @param limit - Maximum number of results to return
 * @returns Array of search results or null if failed
 */
export async function SpigotAPI(
  query: string,
  limit?: number
): Promise<ExtendedResource[] | null> {
  const maxResults = limit ? limit : 10;
  const cacheKey = `search:${query}:${maxResults}`;

  try {
    return await withCache(cacheKey, async () => {
      try {
        const spiget = new SpigetAPI("shulkers");

        const results = (await spiget.search("resource", {
          query: query,
          field: "name",
          size: maxResults,
          sort: { must: "most", field: "downloads" },
        })) as ExtendedResource[] | null;

        if (!results) return null;

        // 各リソースの著者情報を検証
        results.forEach((resource) => {
          if (resource.author && typeof resource.author === "object") {
            // authorオブジェクトの構造を検証し、必要に応じて修正
            if (!resource.author.name) resource.author.name = "Unknown";
            if (!resource.author.id) resource.author.id = 0;
          }
        });

        // Fetch version information in parallel
        await Promise.all(
          results.map(async (resource) => {
            const versionCacheKey = `version:${resource.id}`;

            try {
              const version = await withCache(versionCacheKey, () =>
                resource.getVersion("latest")
              );

              if (version) {
                const versionName = version.name;
                if (versionName && /^\d+$/.test(versionName)) {
                  resource.version_raw = `${versionName}.0`;
                } else {
                  resource.version_raw = versionName;
                }
              }
            } catch (error) {
              // Silently handle version fetch errors, no need to crash the entire request
              resource.version_raw = "Unknown";
            }
          })
        );

        return results;
      } catch (innerError) {
        console.error(
          `Error in search operation for "${query}": ${
            innerError instanceof Error
              ? innerError.message
              : String(innerError)
          }`
        );
        return null;
      }
    });
  } catch (error) {
    console.error(
      `Error searching Spigot: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    return null;
  }
}

/**
 * Get a resource by its ID
 * @param id - Resource ID
 * @returns Resource or null if not found
 */
export async function Spigot_IDtoResource(
  id: number
): Promise<ExtendedResource | null> {
  const cacheKey = `resource:${id}`;

  try {
    return await withCache(cacheKey, async () => {
      try {
        const spiget = new SpigetAPI("shulkers");
        const resource = (await spiget.getResource(
          id
        )) as ExtendedResource | null;

        if (!resource) return null;

        // 著者情報の安全性を確保
        if (resource.author && typeof resource.author === "object") {
          // authorオブジェクトの構造を検証し、必要に応じて修正
          if (!resource.author.name) resource.author.name = "Unknown";
          if (!resource.author.id) resource.author.id = 0;
        }

        const versionCacheKey = `version:${id}`;
        try {
          const version = await withCache(versionCacheKey, () =>
            resource.getVersion("latest")
          );

          if (version) {
            const versionName = version.name;
            if (versionName && /^\d+$/.test(versionName)) {
              resource.version_raw = `${versionName}.0`;
            } else {
              resource.version_raw = versionName;
            }
          }
        } catch (error) {
          resource.version_raw = "Unknown";
        }

        return resource;
      } catch (innerError) {
        console.error(
          `Error in resource fetching operation for ${id}: ${
            innerError instanceof Error
              ? innerError.message
              : String(innerError)
          }`
        );
        return null;
      }
    });
  } catch (error) {
    console.error(
      `\nError fetching Spigot resource ${id}: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    return null;
  }
}
