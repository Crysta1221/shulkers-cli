import { Command } from "commander";
import pc from "picocolors";
import {
  configureCommandHelp,
  configureCommandOutput,
} from "@/helpers/cliConfig";
import ora from "ora";
import cliSpinners from "cli-spinners";
import { SpigotAPI, Spigot_IDtoResource } from "@/handlers/Sources/spigot";
import {
  ModrinthAPI,
  modrinth_IDtoResource,
} from "@/handlers/Sources/modrinth";
import { displaySearchResults } from "@/handlers/Views/table";
import { createTimer } from "@/handlers/Views/timer";
import { fuzzySearch } from "@/helpers/search";

const packJson = await import("../../package.json", {
  assert: { type: "json" },
});

const command = new Command("info")
  .description("Get information about a plugin")
  .argument("[name]", "Plugin name")
  .usage("[name] [options]")
  .option("--id <id>", "Plugin ID (requires --source option)")
  .option("-s, --source <source>", "Plugin Sources (spigot, modrinth)", "all")
  .action(async (query, options) => {
    // Validate input parameters
    if (!validateInputParameters(query, options)) {
      return;
    }

    // Create and start timer
    const timer = createTimer();

    // Process plugin info request
    await getPluginInfo(query, options.id, options.source);

    // End timer and display execution time
    timer.end();
  });

configureCommandHelp(command);
configureCommandOutput(command);

/**
 * Validates the command input parameters
 * @param query - The search query or plugin name
 * @param options - Command options
 * @returns true if valid, false otherwise
 */
function validateInputParameters(query: string, options: any): boolean {
  if (!query && !options.id) {
    console.error(
      pc.red(pc.bold("Error: ") + "Plugin name or ID is required. Run ") +
        pc.yellow("shulkers info --help") +
        pc.red(" for more information.")
    );
    return false;
  }

  // Validate source option
  const validSources = ["all", "spigot", "modrinth"];
  const source = options.source.toLowerCase();
  if (!validSources.includes(source)) {
    console.error(
      pc.red(
        `Error: Invalid source '${
          options.source
        }'. Valid sources are: ${validSources.join(", ")}`
      )
    );
    return false;
  }

  // Check if using ID search with appropriate source
  if (options.id && source === "all") {
    console.error(
      pc.red(
        pc.bold("Error: ") +
          "When using --id, you must specify --source (spigot or modrinth)."
      )
    );
    return false;
  }

  return true;
}

/**
 * Main function to get plugin information
 * @param query - Plugin name query
 * @param id - Plugin ID for direct lookup
 * @param source - Source to search from
 */
async function getPluginInfo(
  query: string,
  id?: string,
  source: string = "all"
): Promise<void> {
  console.log(pc.green(pc.bold("📦 Shulkers info")) + ` ${packJson.version}`);

  const spinner = ora({
    text: "Searching for plugin...",
    spinner: cliSpinners.dots,
    color: "cyan",
  }).start();

  // Direct ID lookup if provided
  if (id) {
    await getPluginById(id, source, spinner);
    return;
  }

  // Name-based search
  await getPluginByName(query, source, spinner);
}

/**
 * Get plugin information by its ID
 * @param id - Plugin ID
 * @param source - Source (spigot or modrinth)
 * @param spinner - Ora spinner instance
 */
async function getPluginById(
  id: string,
  source: string,
  spinner: ReturnType<typeof ora>
): Promise<void> {
  try {
    if (source === "spigot") {
      const resource = await Spigot_IDtoResource(Number(id));
      if (resource) {
        spinner.succeed("Successfully retrieved plugin information");
        displayPluginDetails(resource, "Spigot");
      } else {
        spinner.fail(`No plugin found with ID ${id} on Spigot`);
      }
    } else if (source === "modrinth") {
      const resource = await modrinth_IDtoResource(id);
      if (resource) {
        spinner.succeed("Successfully retrieved plugin information");
        displayPluginDetails(resource, "Modrinth");
      } else {
        spinner.fail(`No plugin found with ID ${id} on Modrinth`);
      }
    }
  } catch (error) {
    spinner.fail(
      `Failed to retrieve plugin information: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

/**
 * Get plugin information by its name
 * @param query - Plugin name query
 * @param source - Source to search from
 * @param spinner - Ora spinner instance
 */
async function getPluginByName(
  query: string,
  source: string,
  spinner: ReturnType<typeof ora>
): Promise<void> {
  let spigotResults: any[] = [];
  let modrinthResults: any[] = [];
  const searchPromises: Promise<void>[] = [];

  // Add search promises based on selected source
  if (source === "all" || source === "spigot") {
    searchPromises.push(
      (async () => {
        try {
          spinner.text = "Searching Spigot plugins...";
          const results = await SpigotAPI(query, 5);
          if (results) {
            spigotResults = results;
            if (source === "spigot") {
              spinner.text = `Found ${results.length} results from Spigot`;
            }
          }
        } catch (error) {}
      })()
    );
  }

  if (source === "all" || source === "modrinth") {
    searchPromises.push(
      (async () => {
        try {
          spinner.text = "Searching Modrinth plugins...";
          // バージョン情報を後で取得するよう設定
          const results = await ModrinthAPI(query, 5, false);
          if (results) {
            modrinthResults = results;
            if (source === "modrinth") {
              spinner.text = `Found ${results.length} results from Modrinth`;
            }
          }
        } catch (error) {}
      })()
    );
  }

  // Wait for all searches to complete
  await Promise.all(searchPromises);

  // Update spinner text with combined results count
  if (source === "all") {
    spinner.text = `Found ${spigotResults.length} results from Spigot and ${modrinthResults.length} from Modrinth`;
  }

  // Combine results with source information
  const allResults = [
    ...spigotResults.map((result) => ({ ...result, source: "Spigot" })),
    ...modrinthResults.map((result) => ({ ...result, source: "Modrinth" })),
  ];

  // Handle search results
  await processSearchResults(query, allResults, spinner);
}

/**
 * Process the search results to display appropriate information
 * @param query - Original search query
 * @param allResults - Combined search results
 * @param spinner - Ora spinner instance
 */
async function processSearchResults(
  query: string,
  allResults: any[],
  spinner: ReturnType<typeof ora>
): Promise<void> {
  const totalResultsCount = allResults.length;

  if (totalResultsCount === 0) {
    spinner.fail("No plugins found matching your query");
    return;
  }

  spinner.succeed(`Found ${totalResultsCount} plugins matching your query`);

  // Check for duplicate names first
  const nameMap = new Map<string, number>();
  allResults.forEach((result) => {
    const name = result.source === "Modrinth" ? result.title : result.name;
    if (name) {
      const lowerName = name.toLowerCase();
      nameMap.set(lowerName, (nameMap.get(lowerName) || 0) + 1);
    }
  });

  // Check for exact name match
  const exactMatchName = query.toLowerCase();
  const exactMatches = allResults.filter((result) => {
    const name = result.source === "Modrinth" ? result.title : result.name;
    return name && name.toLowerCase() === exactMatchName;
  });

  // If we found exact matches, show all plugins containing that string
  if (exactMatches.length >= 1) {
    // Find all plugins that contain the search string
    const containingMatches = allResults.filter((result) => {
      const name = result.source === "Modrinth" ? result.title : result.name;
      return name && name.toLowerCase().includes(exactMatchName);
    });

    console.log(
      pc.green(
        `Found ${exactMatches.length} exact matches and ${
          containingMatches.length - exactMatches.length
        } partial matches for "${query}"`
      )
    );
    console.log(
      pc.green("Please choose one specifically or use ") +
        pc.bold(pc.yellow("--id <id> --source <source>")) +
        pc.green(" to get details for a specific plugin.")
    );
    displaySearchResults(containingMatches);
    return;
  }

  // If only one result and no duplicates, show its details
  if (allResults.length === 1) {
    displayPluginDetails(allResults[0], allResults[0].source);
    return;
  }

  // Use fuzzySearch helper for search and sorting
  const searchResults = fuzzySearch(query, allResults, { threshold: 0.2 });
  const filteredResults = searchResults.results;

  console.log(
    pc.blue(
      `${filteredResults.length} results found, ${
        allResults.length - filteredResults.length
      } excluded.`
    )
  );

  // If we have any good matches
  if (filteredResults.length > 0) {
    // If only one good match and no duplicates, display it directly
    const bestMatch = filteredResults[0];
    const bestMatchName =
      bestMatch.source === "Modrinth" ? bestMatch.title : bestMatch.name;
    const hasDuplicates = bestMatchName
      ? (nameMap.get(bestMatchName.toLowerCase()) || 0) > 1
      : false;

    if (filteredResults.length === 1 && !hasDuplicates) {
      console.log(pc.green(`Found a best match: "${bestMatchName}"`));
      displayPluginDetails(bestMatch, bestMatch.source);
      return;
    }

    // Multiple good matches or duplicates, show them as a table
    console.log(
      pc.green(
        "Multiple matches found. Please choose one specifically or use "
      ) +
        pc.bold(pc.yellow("--id <id> --source <source>")) +
        pc.green(" to get details for a specific plugin.")
    );

    displaySearchResults(filteredResults);
    return;
  }

  // No good matches found, show all results in table
  console.log(
    pc.yellow(
      `No close matches found. Showing all ${allResults.length} results.`
    )
  );
  console.log(
    pc.green("Please be more specific or use ") +
      pc.bold(pc.yellow("--id <id> --source <source>")) +
      pc.green(" to get details for a specific plugin.")
  );

  displaySearchResults(allResults);
}

/**
 * Displays detailed information about a plugin
 * @param plugin - Plugin data object
 * @param source - Source of the plugin (Spigot or Modrinth)
 */
function displayPluginDetails(plugin: any, source: string) {
  console.log("\n" + pc.bold(pc.green("Plugin Details:")));

  // Common fields with different naming conventions based on source
  const name = source === "Modrinth" ? plugin.title : plugin.name;
  const id = plugin.id || plugin.project_id || "Unknown";
  const version = plugin.version_raw || plugin.latest_version || "Unknown";
  const downloads = plugin.downloads || 0;

  // Display header with name
  console.log(pc.bold(pc.yellow(`Name: `)) + pc.white(name));
  console.log(pc.bold(pc.cyan(`Source: `)) + pc.white(source));
  console.log(pc.bold(pc.magenta(`ID: `)) + pc.white(id));

  if (source === "Modrinth") {
    // Modrinth specific fields
    console.log(
      pc.bold(pc.blue(`Author: `)) + pc.white(plugin.author || "Unknown")
    );
    console.log(pc.bold(pc.blue(`Latest Version: `)) + pc.white(version));
    console.log(
      pc.bold(pc.blue(`Support Version: `)) +
        pc.white(plugin.versions?.join(", ") || "Unknown")
    );
    console.log(
      pc.bold(pc.blue(`Downloads: `)) + pc.white(formatDownloads(downloads))
    );
    console.log(
      pc.bold(pc.blue(`Categories: `)) +
        pc.white(plugin.categories ? plugin.categories.join(", ") : "None")
    );
  } else {
    // Spigot specific fields
    let author = "Unknown";
    if (plugin.author) {
      if (plugin.author.name) {
        author = plugin.author.name;
      } else if (plugin.author.id) {
        author = `ID: ${plugin.author.id}`;
      } else {
        author = "Unknown Author";
      }
    }

    console.log(pc.bold(pc.blue(`Author: `)) + pc.white(author));
    console.log(pc.bold(pc.blue(`Latest Version: `)) + pc.white(version));
    console.log(
      pc.bold(pc.blue(`Support Version: `)) +
        pc.white(plugin.testedVersions?.join(", ") || "Unknown")
    );
    console.log(
      pc.bold(pc.blue(`Downloads: `)) + pc.white(formatDownloads(downloads))
    );
    console.log(
      pc.bold(pc.blue(`Categories: `)) +
        pc.white(plugin.category?.name || "Unknown")
    );

    if (plugin.tag) {
      console.log(pc.bold(pc.blue(`Tags: `)) + pc.white(plugin.tag));
    }
  }
}

/**
 * Formats download counts to be more readable
 * @param downloads The number of downloads
 * @returns Formatted download count string
 */
function formatDownloads(downloads: number): string {
  if (downloads === undefined || downloads === null) return "Unknown";

  if (downloads >= 1000000) {
    return `${(downloads / 1000000).toFixed(1)}M`;
  } else if (downloads >= 1000) {
    return `${(downloads / 1000).toFixed(1)}K`;
  }

  return downloads.toString();
}

export default command;
