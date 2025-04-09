import pc from "picocolors";
import ora from "ora";
import cliSpinners from "cli-spinners";
import fs from "fs";
import path from "path";
import { select } from "@inquirer/prompts";
// Plugin Server types
type PluginServer = "spigot" | "paper" | "bukkit" | "purpur";

/**
 * Find JAR files in the current directory
 * @returns Array of JAR file paths
 */
async function findJarFiles(): Promise<string[]> {
  try {
    const currentDir = process.cwd();
    const files = fs.readdirSync(currentDir);
    return files.filter((file) => file.toLowerCase().endsWith(".jar"));
  } catch (error) {
    console.error("Failed to read directory:", error);
    return [];
  }
}

export async function detectPluginServer(): Promise<PluginServer | unknown> {
  const spinner = ora({
    text: "Detecting plugin server...",
    spinner: cliSpinners.dots,
    color: "cyan",
  }).start();

  try {
    const { execSync } = await import("child_process");

    // Find JAR files in the current directory
    spinner.text = "Looking for JAR files...";
    const jarFiles = await findJarFiles();

    if (jarFiles.length === 0) {
      spinner.fail(pc.red("No JAR files found in the current directory."));
      return "unknown";
    }

    // Select JAR file to use
    let selectedJar: string;
    if (jarFiles.length === 1) {
      selectedJar = jarFiles[0];
      spinner.text = `Found JAR file: ${selectedJar}`;
    } else {
      spinner.stop();
      console.log(pc.cyan("Multiple JAR files found. Please select one:"));

      selectedJar = await select({
        message: "Select JAR file to detect server type",
        choices: jarFiles.map((file) => ({
          name: file,
          value: file,
        })),
      });

      spinner.start("Detecting plugin server...");
    }

    const result = execSync(`java -jar "${selectedJar}" --version`, {
      encoding: "utf-8",
    });
    if (result.includes("Paper")) {
      spinner.succeed(pc.green("It seems you are using Paper"));
      return "paper";
    } else if (result.includes("Spigot")) {
      spinner.succeed(pc.green("It seems you are using Spigot"));
      spinner.stop();
      return "spigot";
    } else if (result.includes("Bukkit")) {
      spinner.succeed(pc.green("It seems you are using Bukkit"));
      spinner.stop();
      return "bukkit";
    } else if (result.includes("Purpur")) {
      spinner.succeed(pc.green("It seems you are using Purpur"));
      spinner.stop();
      return "purpur";
    } else {
      spinner.fail(pc.red("Failed to detect plugin server."));
      return "unknown";
    }
  } catch (error) {
    spinner.fail(pc.red("Failed to detect plugin server."));
    return "unknown";
  }
}
