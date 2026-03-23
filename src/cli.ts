#!/usr/bin/env node

import { saveOAuthConfig, loadOAuthConfig, getConfigDir } from "./auth/tokenStore.js";
import { runAuthFlow } from "./auth/oauth.js";
import { startServer } from "./index.js";
import * as readline from "readline";

const args = process.argv.slice(2);
const command = args[0];

async function main() {
  switch (command) {
    case "auth":
      await handleAuth();
      break;
    case "serve":
    case undefined:
      await startServer();
      break;
    case "help":
    case "--help":
    case "-h":
      printHelp();
      break;
    default:
      console.error(`Unknown command: ${command}`);
      printHelp();
      process.exit(1);
  }
}

async function handleAuth() {
  console.log("🔧 MCP Google Reader - OAuth Setup\n");
  console.log(`Config directory: ${getConfigDir()}\n`);

  let config = loadOAuthConfig();

  if (!config) {
    console.log("To get OAuth credentials:");
    console.log("1. Go to https://console.cloud.google.com/apis/credentials");
    console.log("2. Create an OAuth 2.0 Client ID (Desktop app)");
    console.log("3. Enable Google Docs API and Google Sheets API\n");

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const question = (prompt: string): Promise<string> =>
      new Promise((resolve) => rl.question(prompt, resolve));

    const clientId = await question("Client ID: ");
    const clientSecret = await question("Client Secret: ");
    rl.close();

    if (!clientId.trim() || !clientSecret.trim()) {
      console.error("\n❌ Client ID and Client Secret are required.");
      process.exit(1);
    }

    config = {
      client_id: clientId.trim(),
      client_secret: clientSecret.trim(),
    };
    saveOAuthConfig(config);
    console.log("\n✅ OAuth config saved.");
  } else {
    console.log("✅ OAuth config already exists.");
  }

  console.log("\nStarting authorization flow...");
  await runAuthFlow(config);
}

function printHelp() {
  console.log(`
mcp-google-reader - MCP server for reading Google Docs & Sheets

USAGE:
  mcp-google-reader [command]

COMMANDS:
  serve     Start the MCP server (default)
  auth      Set up OAuth2 credentials and authorize
  help      Show this help message

SETUP:
  1. npx mcp-google-reader auth
  2. claude mcp add -s user google-reader -- npx mcp-google-reader serve
`);
}

main().catch((err) => {
  console.error("Fatal error:", err.message ?? err);
  process.exit(1);
});
