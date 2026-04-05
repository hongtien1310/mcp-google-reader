import { extractGoogleUrls } from "../utils/urlParser.js";
import { getAuthenticatedClient } from "../auth/oauth.js";
import { readGoogleDoc, type DocTab } from "../readers/docsReader.js";
import { readGoogleSheet, type SheetResult } from "../readers/sheetsReader.js";
import { ContentCache } from "../cache/contentCache.js";
import { sanitizeErrorMessage } from "../utils/sanitize.js";

const cache = new ContentCache<DocumentResult | SpreadsheetResult>(60);

const MAX_URLS = 20;
const MAX_CONCURRENT = 5;

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const i = index++;
      results[i] = await fn(items[i]);
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => worker()
  );
  await Promise.all(workers);
  return results;
}

interface DocumentResult {
  url: string;
  type: "document";
  title: string;
  content: string;
  tabs?: DocTab[];
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

  if (urls.length > MAX_URLS) {
    urls.length = MAX_URLS;
  }

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

  // Fetch URLs with concurrency limit
  const settled = await mapWithConcurrency(urls, MAX_CONCURRENT, async (parsed) => {
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
          tabs: doc.tabs,
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
      const errorMessage = sanitizeErrorMessage(err);
      return {
        result: null,
        error: { url: parsed.url, error: errorMessage },
      };
    }
  });

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
