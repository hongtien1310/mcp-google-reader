import { extractGoogleUrls } from "../utils/urlParser.js";
import { getAuthenticatedClient } from "../auth/oauth.js";
import { readGoogleDoc } from "../readers/docsReader.js";
import { readGoogleSheet, type SheetResult } from "../readers/sheetsReader.js";
import { ContentCache } from "../cache/contentCache.js";

const cache = new ContentCache<DocumentResult | SpreadsheetResult>(60);

interface DocumentResult {
  url: string;
  type: "document";
  title: string;
  content: string;
}

interface SpreadsheetResult {
  url: string;
  type: "spreadsheet";
  title: string;
  sheets: SheetResult[];
}

type ReadResult = DocumentResult | SpreadsheetResult;

interface ReadGoogleLinksResponse {
  results: ReadResult[];
  errors: Array<{ url: string; error: string }>;
}

export async function handleReadGoogleLinks(
  message: string
): Promise<ReadGoogleLinksResponse> {
  const urls = extractGoogleUrls(message);

  if (urls.length === 0) {
    return {
      results: [],
      errors: [
        {
          url: "",
          error:
            "No Google Docs or Sheets URLs found in the message. Please provide URLs in the format: https://docs.google.com/document/d/... or https://docs.google.com/spreadsheets/d/...",
        },
      ],
    };
  }

  const auth = await getAuthenticatedClient();
  const results: ReadResult[] = [];
  const errors: Array<{ url: string; error: string }> = [];

  // Fetch all URLs in parallel
  const promises = urls.map(async (parsed) => {
    // Check cache first
    const cacheKey = parsed.documentId;
    const cached = cache.get(cacheKey);
    if (cached) {
      return { result: cached, error: null };
    }

    try {
      let result: ReadResult;

      if (parsed.type === "document") {
        const doc = await readGoogleDoc(auth, parsed.documentId);
        result = {
          url: parsed.url,
          type: "document",
          title: doc.title,
          content: doc.content,
        };
      } else {
        const sheet = await readGoogleSheet(auth, parsed.documentId);
        result = {
          url: parsed.url,
          type: "spreadsheet",
          title: sheet.title,
          sheets: sheet.sheets,
        };
      }

      cache.set(cacheKey, result);
      return { result, error: null };
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Unknown error";
      return {
        result: null,
        error: { url: parsed.url, error: errorMessage },
      };
    }
  });

  const settled = await Promise.all(promises);

  for (const item of settled) {
    if (item.result) {
      results.push(item.result);
    }
    if (item.error) {
      errors.push(item.error);
    }
  }

  return { results, errors };
}
