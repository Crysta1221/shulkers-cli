import { Table } from "console-table-printer";

/**
 * Table configuration for consistent styling across application
 */
const DEFAULT_TABLE_CONFIG = {
  style: {
    headerTop: {
      left: "",
      mid: "",
      right: "",
      other: "-",
    },
    headerBottom: {
      left: "",
      mid: "-",
      right: "",
      other: "-",
    },
    tableBottom: {
      left: "",
      mid: "",
      right: "",
      other: "-",
    },
    vertical: " ",
  },
  columns: [
    { name: "Name", alignment: "left", color: "yellow" },
    { name: "Author", alignment: "center", color: "cyan" },
    { name: "ID", alignment: "center" },
    { name: "Version", alignment: "center" },
    { name: "Downloads", alignment: "center" },
    { name: "Source", alignment: "center", color: "magenta" },
  ],
};

/**
 * Plugin data formatting options
 */
interface FormatOptions {
  maxNameLength?: number;
}

/**
 * Displays search results in a formatted table
 * @param results - The plugin search results to display
 * @param options - Formatting options
 */
export function displaySearchResults(
  results: any[],
  options: FormatOptions = {}
): void {
  if (!results || results.length === 0) {
    console.log("No results to display.");
    return;
  }

  const table = new Table(DEFAULT_TABLE_CONFIG);

  // Format each result row
  results.forEach((result) => {
    table.addRow(formatResultRow(result, options));
  });

  table.printTable();
}

/**
 * Format a single result for table display
 * @param result - Plugin data object
 * @param options - Formatting options
 * @returns Formatted row data
 */
function formatResultRow(
  result: any,
  options: FormatOptions = {}
): Record<string, string> {
  const source = result.source || "Unknown";
  const maxNameLength = options.maxNameLength || 35;

  // Format based on source type
  if (source === "Modrinth") {
    return {
      Name: truncateName(result.title, maxNameLength),
      Author: result.author || "Unknown",
      ID: result.id || result.project_id || "Unknown",
      Version: result.version_raw || result.latest_version || "Unknown",
      Downloads: formatDownloads(result.downloads),
      Source: source,
    };
  } else {
    // Default to Spigot format
    return {
      Name: truncateName(result.name, maxNameLength),
      Author: formatAuthor(result.author),
      ID: result.id || "Unknown",
      Version: formatVersion(result, result.version_raw),
      Downloads: formatDownloads(result.downloads),
      Source: source,
    };
  }
}

/**
 * Truncates a name to max_length characters and adds ellipsis if needed
 * @param name - The name to truncate
 * @param maxLength - Maximum allowed length
 * @returns Truncated name with ellipsis if needed
 */
function truncateName(name: string, maxLength: number = 35): string {
  if (!name) return "Unknown";
  return name.length > maxLength ? name.substring(0, maxLength) + "..." : name;
}

/**
 * Formats author information for display
 * @param author - Author data object
 * @returns Formatted author string
 */
function formatAuthor(author: any): string {
  if (!author) return "Unknown";
  return author.name || (author.id ? `ID: ${author.id}` : "Unknown");
}

/**
 * Formats version information for display
 * @param result - The resource object
 * @param versionRaw - The raw version string from the latest version
 * @returns Formatted version string
 */
function formatVersion(result: any, versionRaw?: string): string {
  if (versionRaw) return versionRaw;
  if (!result.version || !result.version.id) return "Unknown";
  return result.version.id.toString();
}

/**
 * Formats download counts to be more readable
 * @param downloads - The number of downloads
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

/**
 * Creates a custom table with provided columns and styling
 * @param columns - Column definitions
 * @returns Configured Table instance
 */
export function createCustomTable(columns: any[]): Table {
  const config = {
    ...DEFAULT_TABLE_CONFIG,
    columns,
  };
  return new Table(config);
}
