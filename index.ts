#! /usr/bin/env bun
import { Command } from "commander";
import pc from "picocolors";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  configureCommandHelp,
  configureCommandOutput,
} from "@/helpers/cliConfig";

const program = new Command();
const packJson = await import("./package.json", { assert: { type: "json" } });

// CLI Help page Configuration
program
  .name("shulkers")
  .alias("skc")
  .version(packJson.version, "-v, --version", "output the current version")
  .addHelpText(
    "beforeAll",
    pc.green(pc.bold("📦 Shulkers")) +
      ` v${packJson.version}\nMinecaft Plugin Manager CLI\n`
  )
  .showHelpAfterError(pc.red("(add --help for additional information)"))
  .helpCommand("help [command]", "display help for command")
  .usage("<command> [options]")
  .passThroughOptions(true);

configureCommandHelp(program);
configureCommandOutput(program);

// Load Command functions
async function loadCommands() {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const commandsPath = path.join(__dirname, "src", "commands");

    if (!fs.existsSync(commandsPath)) {
      console.error(pc.yellow("Warning: Commands directory not found."));
      return;
    }

    const commandFiles = fs
      .readdirSync(commandsPath)
      .filter((file) => file.endsWith(".ts") || file.endsWith(".js"));

    // Use Promise.all for parallel loading of command modules
    const commandModules = await Promise.all(
      commandFiles.map(async (file) => {
        const filePath = path.join(commandsPath, file);
        try {
          return {
            file,
            module: await import(`${filePath}`),
          };
        } catch (error) {
          console.error(
            pc.yellow(
              `Warning: Failed to load command from ${file}: ${
                error instanceof Error ? error.message : String(error)
              }`
            )
          );
          return null;
        }
      })
    );

    // Filter out failed imports and add valid commands
    commandModules.filter(Boolean).forEach((item) => {
      if (!item) return;
      const { file, module } = item;

      if (module.default && module.default instanceof Command) {
        program.addCommand(module.default);
      } else {
        console.warn(
          pc.yellow(
            `Warning: ${file} does not export a valid Commander.Command instance.`
          )
        );
      }
    });
  } catch (error) {
    console.error(
      pc.red(
        `Error loading commands: ${
          error instanceof Error ? error.message : String(error)
        }`
      )
    );
  }
}

// Command Loading and execute
await loadCommands();

process.on("SIGINT", () => {
  console.log(pc.red("\n❌ Operation canceled."));
  process.exit(0);
});

program.parse(process.argv);
