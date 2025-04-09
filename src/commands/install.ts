import { Command } from "commander";
import pc from "picocolors";
import {
  configureAllCommands,
  configureCommandOutput,
} from "@/helpers/cliConfig";
import { detectPluginServer } from "@/helpers/detect";

const packJson = await import("../../package.json", {
  assert: { type: "json" },
});

const command = new Command("install")
  .description("Install plugins")
  .argument("[name...]", "Plugin name")
  .alias("i")
  .option("-f, --force", "Force install plugins")
  .option("--id <id>", "Plugin ID (requires --source option)")
  .action(async (query, options) => {
    await detectPluginServer();
  });

export default command;
