import { Command } from "commander";
import pc from "picocolors";

/**
 * CLI style configuration options
 */
interface StyleOptions {
  commandColor?: keyof ColorFunctions;
  optionColor?: keyof ColorFunctions;
  titleColor?: keyof ColorFunctions;
  errorColor?: keyof ColorFunctions;
}

/**
 * Type definition for picocolors functions
 */
type ColorFunctions = {
  green: (text: string) => string;
  red: (text: string) => string;
  blue: (text: string) => string;
  yellow: (text: string) => string;
  magenta: (text: string) => string;
  cyan: (text: string) => string;
  white: (text: string) => string;
  black: (text: string) => string;
  gray: (text: string) => string;
  bold: (text: string) => string;
};

/**
 * Default style options
 */
const defaultStyles: StyleOptions = {
  commandColor: "green",
  optionColor: "green",
  titleColor: "yellow",
  errorColor: "red",
};

/**
 * Apply color to string using picocolors
 * @param color Color function name
 * @param text Text to colorize
 * @returns Colorized text
 */
function applyColor(color: keyof ColorFunctions, text: string): string {
  if (color === "bold") {
    return pc.bold(text);
  }
  return pc[color](text);
}

/**
 * Configure CLI help text styling
 * @param program - Commander.Command Instance
 * @param options - Style options to customize colors
 * @returns Configured Command instance
 */
export const configureCommandHelp = (
  program: Command,
  options: StyleOptions = {}
): Command => {
  // Merge default options with provided options
  const styles = { ...defaultStyles, ...options };

  return program.configureHelp({
    subcommandTerm: function (cmd) {
      return applyColor(styles.commandColor || "green", cmd.name());
    },
    styleOptionTerm(str) {
      return applyColor(styles.optionColor || "green", str);
    },
    styleTitle(str) {
      return applyColor(styles.titleColor || "yellow", str);
    },
  });
};

/**
 * Configure CLI output styling, particularly for error messages
 * @param program - Commander.Command Interface
 * @param options - Style options to customize colors
 * @returns Configured Command instance
 */
export const configureCommandOutput = (
  program: Command,
  options: StyleOptions = {}
): Command => {
  // Merge default options with provided options
  const styles = { ...defaultStyles, ...options };

  return program.configureOutput({
    outputError: (str, write) => {
      // Extract the actual error message by removing the "error: " prefix
      const errorMessage = str.replace("error: ", "");
      write(
        applyColor(styles.errorColor || "red", pc.bold("Error: ")) +
          applyColor(styles.errorColor || "red", errorMessage)
      );
    },
    // Add custom formatting for warning messages
    writeOut: (str) => process.stdout.write(str),
    writeErr: (str) => process.stderr.write(str),
  });
};

/**
 * Apply consistent CLI formatting to all commands
 * @param commands - Array of Command instances to configure
 * @param options - Style options to customize colors
 */
export const configureAllCommands = (
  commands: Command[],
  options: StyleOptions = {}
): void => {
  commands.forEach((cmd) => {
    configureCommandHelp(cmd, options);
    configureCommandOutput(cmd, options);
  });
};

/**
 * Format a message for CLI error display
 * @param message - Error message to format
 * @returns Formatted error message
 */
export const formatErrorMessage = (message: string): string => {
  return pc.red(pc.bold("Error: ") + message);
};

/**
 * Format a message for CLI success display
 * @param message - Success message to format
 * @returns Formatted success message
 */
export const formatSuccessMessage = (message: string): string => {
  return pc.green(pc.bold("Success: ") + message);
};

/**
 * Format a message for CLI warning display
 * @param message - Warning message to format
 * @returns Formatted warning message
 */
export const formatWarningMessage = (message: string): string => {
  return pc.yellow(pc.bold("Warning: ") + message);
};
