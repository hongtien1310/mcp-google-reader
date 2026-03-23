import { google } from "googleapis";
import * as http from "http";
import * as url from "url";
import {
  saveTokens,
  loadTokens,
  loadOAuthConfig,
  type StoredTokens,
  type OAuthConfig,
} from "./tokenStore.js";

const SCOPES = [
  "https://www.googleapis.com/auth/documents.readonly",
  "https://www.googleapis.com/auth/spreadsheets.readonly",
];

const REDIRECT_PORT = 3456;
// Desktop app: Google requires redirect to http://localhost (no path)
const REDIRECT_URI = `http://localhost:${REDIRECT_PORT}`;

function createOAuth2Client(config: OAuthConfig) {
  return new google.auth.OAuth2(
    config.client_id,
    config.client_secret,
    REDIRECT_URI
  );
}

/**
 * Get an authenticated OAuth2 client.
 * Uses stored refresh token if available, otherwise throws.
 */
export async function getAuthenticatedClient() {
  const config = loadOAuthConfig();
  if (!config) {
    throw new Error(
      "OAuth config not found. Run `mcp-google-reader auth` first."
    );
  }

  const tokens = loadTokens();
  if (!tokens) {
    throw new Error(
      "No credentials found. Run `mcp-google-reader auth` first."
    );
  }

  const client = createOAuth2Client(config);
  client.setCredentials({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    token_type: tokens.token_type,
    expiry_date: tokens.expiry_date,
  });

  // Auto-refresh: listen for new tokens and persist them
  client.on("tokens", (newTokens) => {
    const updated: StoredTokens = {
      access_token: newTokens.access_token ?? tokens.access_token,
      refresh_token: newTokens.refresh_token ?? tokens.refresh_token,
      token_type: newTokens.token_type ?? tokens.token_type,
      expiry_date: newTokens.expiry_date ?? tokens.expiry_date,
    };
    saveTokens(updated);
  });

  return client;
}

/**
 * Interactive OAuth2 flow: opens browser for consent, saves tokens.
 */
export async function runAuthFlow(config: OAuthConfig): Promise<void> {
  const client = createOAuth2Client(config);

  const authUrl = client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    prompt: "consent",
  });

  console.log("\n🔐 Open this URL in your browser to authorize:\n");
  console.log(authUrl);
  console.log();

  const code = await waitForAuthCode();

  const { tokens } = await client.getToken(code);

  saveTokens({
    access_token: tokens.access_token ?? "",
    refresh_token: tokens.refresh_token ?? "",
    token_type: tokens.token_type ?? "Bearer",
    expiry_date: tokens.expiry_date ?? 0,
  });

  console.log("✅ Authorization successful! Credentials saved.\n");
}

function waitForAuthCode(): Promise<string> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const parsedUrl = url.parse(req.url ?? "", true);

      // Desktop app: Google redirects to root path with query params
      const code = parsedUrl.query.code as string | undefined;
      const error = parsedUrl.query.error as string | undefined;

      if (code || error) {

        if (error) {
          res.writeHead(400, { "Content-Type": "text/html" });
          res.end(
            `<h1>Authorization Failed</h1><p>${error}</p><p>You can close this tab.</p>`
          );
          server.close();
          reject(new Error(`Authorization failed: ${error}`));
          return;
        }

        if (code) {
          res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
          res.end(
            "<h1>✅ Authorization Successful</h1><p>You can close this tab and return to the terminal.</p>"
          );
          server.close();
          resolve(code);
          return;
        }
      }

      res.writeHead(404);
      res.end();
    });

    server.listen(REDIRECT_PORT, () => {
      console.log(
        `Waiting for authorization on http://localhost:${REDIRECT_PORT}...`
      );
    });

    // Timeout after 2 minutes
    setTimeout(() => {
      server.close();
      reject(new Error("Authorization timed out after 2 minutes."));
    }, 120_000);
  });
}
