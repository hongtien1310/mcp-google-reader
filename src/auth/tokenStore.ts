import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const CONFIG_DIR = path.join(os.homedir(), ".mcp-google-reader");
const CREDENTIALS_FILE = path.join(CONFIG_DIR, "credentials.json");
const OAUTH_CONFIG_FILE = path.join(CONFIG_DIR, "oauth-config.json");

export interface StoredTokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expiry_date: number;
}

export interface OAuthConfig {
  client_id: string;
  client_secret: string;
}

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
    return JSON.parse(data) as StoredTokens;
  } catch {
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
    return JSON.parse(data) as OAuthConfig;
  } catch {
    return null;
  }
}

export function getConfigDir(): string {
  return CONFIG_DIR;
}
