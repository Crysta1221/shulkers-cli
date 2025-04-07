import { Command } from "commander";
import pc from "picocolors";
import {
  configureCommandHelp,
  configureCommandOutput,
} from "@/helpers/cliConfig";
import ora from "ora";
import cliSpinners from "cli-spinners";
import { SpigotAPI } from "@/handlers/Sources/spigot";
import { ModrinthAPI } from "@/handlers/Sources/modrinth";
import { displaySearchResults } from "@/handlers/Views/table";
import { createTimer } from "@/handlers/Views/timer";

const packJson = await import("../../package.json", {
  assert: { type: "json" },
});

const command = new Command("search")
  .description("Search and display plugins from multiple sources")
  .option("-l, --limit <number>", "Limit the number of results", "10")
  .option("-s, --source <source>", "Source to search from", "all")
  .argument("[query]", "Search query")
  .usage("[query] [options]")
  .action(async (query, options) => {
    if (!query) {
      console.error(
        pc.red(pc.bold("Error: ") + "Search query is required. Run ") +
          pc.yellow("shulkers search --help") +
          pc.red(" for more information.")
      );
      return;
    }

    // Validate limit option
    const limit = Number(options.limit);
    if (isNaN(limit) || limit <= 0) {
      console.error(
        pc.red(pc.bold("Error: ") + "Limit must be a positive number.")
      );
      return;
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
      return;
    }

    // Create a timer for performance tracking
    const timer = createTimer();

    // Execute search
    await searchPlugins(query, limit, source);

    // End timer and show execution time
    timer.end();
  });

configureCommandHelp(command);
configureCommandOutput(command);

/**
 * Search for plugins across multiple sources
 * @param query - Search term
 * @param limit - Maximum number of results
 * @param source - Source to search from
 */
async function searchPlugins(
  query: string,
  limit: number = 10,
  source: string = "all"
): Promise<void> {
  console.log(pc.green(pc.bold("📦 Shulkers search")) + ` ${packJson.version}`);

  const spinner = ora({
    text: "Searching for plugins...",
    spinner: cliSpinners.dots,
    color: "cyan",
  }).start();

  // Execute searches in parallel when possible
  const searchPromises: Promise<any>[] = [];
  let spigotResults: any[] = [];
  let modrinthResults: any[] = [];

  // Add search promises based on selected source
  if (source === "all" || source === "spigot") {
    searchPromises.push(
      SpigotAPI(query, limit)
        .then((results) => {
          if (results) {
            spigotResults = results;
            spinner.text = `Found ${results.length} results from Spigot, continuing search...`;
          }
        })
        .catch((error) => {
          console.error(`Error searching Spigot: ${error}`);
        })
    );
  }

  if (source === "all" || source === "modrinth") {
    searchPromises.push(
      ModrinthAPI(query, limit, false) // バージョン情報を後で取得するよう設定
        .then((results) => {
          if (results) {
            modrinthResults = results;
            spinner.text = `Found ${results.length} results from Modrinth`;
          }
        })
        .catch((error) => {
          console.error(`Error searching Modrinth: ${error}`);
        })
    );
  }

  // Wait for all searches to complete
  await Promise.all(searchPromises);

  // Combine and format results
  const allResults = [
    ...spigotResults.map((result) => ({ ...result, source: "Spigot" })),
    ...modrinthResults.map((result) => ({ ...result, source: "Modrinth" })),
  ];

  // Update UI based on search results
  if (allResults.length === 0) {
    spinner.fail("No plugins found matching your query.");
    return;
  }

  spinner.succeed(`Found ${allResults.length} plugins matching "${query}"`);

  console.log(
    pc.green(`\nUse`) +
      pc.bold(pc.yellow(" shulkers info <name> ")) +
      pc.green("or") +
      pc.bold(pc.yellow(" shulkers info --id <id> --source <source> ")) +
      pc.green("for more details about a specific plugin.")
  );

  // Display results in table format
  displaySearchResults(allResults);
}

export default command;
