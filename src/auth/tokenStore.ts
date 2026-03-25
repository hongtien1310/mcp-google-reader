import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { z } from "zod";

const CONFIG_DIR = path.join(os.homedir(), ".mcp-google-reader");
const CREDENTIALS_FILE = path.join(CONFIG_DIR, "credentials.json");
const OAUTH_CONFIG_FILE = path.join(CONFIG_DIR, "oauth-config.json");

const StoredTokensSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
  token_type: z.string(),
  expiry_date: z.number(),
});

const OAuthConfigSchema = z.object({
  client_id: z.string(),
  client_secret: z.string(),
});

export type StoredTokens = z.infer<typeof StoredTokensSchema>;
export type OAuthConfig = z.infer<typeof OAuthConfigSchema>;

function ensureConfigDir(): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  }
}

export function saveTokens(tokens: StoredTokens): void {
  ensureConfigDir();
  fs.writeFileSync(CREDENTIALS_FILE, JSON.stringify(tokens, null, 2), {
    mode: 0o600,
  });
}

export function loadTokens(): StoredTokens | null {
  try {
    if (!fs.existsSync(CREDENTIALS_FILE)) return null;
    const data = fs.readFileSync(CREDENTIALS_FILE, "utf-8");
    return StoredTokensSchema.parse(JSON.parse(data));
  } catch (err) {
    if (fs.existsSync(CREDENTIALS_FILE)) {
      console.error("Warning: credentials.json exists but contains invalid data. Re-run `mcp-google-reader auth`.");
    }
    return null;
  }
}

export function saveOAuthConfig(config: OAuthConfig): void {
  ensureConfigDir();
  fs.writeFileSync(OAUTH_CONFIG_FILE, JSON.stringify(config, null, 2), {
    mode: 0o600,
  });
}

export function loadOAuthConfig(): OAuthConfig | null {
  try {
    if (!fs.existsSync(OAUTH_CONFIG_FILE)) return null;
    const data = fs.readFileSync(OAUTH_CONFIG_FILE, "utf-8");
    return OAuthConfigSchema.parse(JSON.parse(data));
  } catch (err) {
    if (fs.existsSync(OAUTH_CONFIG_FILE)) {
      console.error("Warning: oauth-config.json exists but contains invalid data. Re-run `mcp-google-reader auth`.");
    }
    return null;
  }
}

export function getConfigDir(): string {
  return CONFIG_DIR;
}
