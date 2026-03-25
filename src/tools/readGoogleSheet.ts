import { extractGoogleUrls } from "../utils/urlParser.js";
import { getAuthenticatedClient } from "../auth/oauth.js";
import { readGoogleSheet, type SheetResult } from "../readers/sheetsReader.js";
import { ContentCache } from "../cache/contentCache.js";
import { sanitizeErrorMessage } from "../utils/sanitize.js";

export interface SheetResponse {
  title: string;
  sheets: SheetResult[];
}

export interface SheetErrorResponse {
  error: string;
}

const cache = new ContentCache<SheetResponse>(60);

export async function handleReadGoogleSheet(params: {
  url: string;
  sheet_name?: string;
  range?: string;
  all_sheets?: boolean;
}): Promise<SheetResponse | SheetErrorResponse> {
  // Extract spreadsheet ID from URL
  const urls = extractGoogleUrls(params.url);
  const spreadsheet = urls.find((u) => u.type === "spreadsheet");

  if (!spreadsheet) {
    return {
      error:
        "Invalid Google Sheets URL. Please provide a URL in the format: https://docs.google.com/spreadsheets/d/...",
    };
  }

  // Build cache key
  const cacheKey = [
    spreadsheet.documentId,
    params.sheet_name ?? "",
    params.range ?? "",
    params.all_sheets ? "all" : "",
  ].join(":");

  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const auth = await getAuthenticatedClient();

  try {
    const result = await readGoogleSheet(auth, spreadsheet.documentId, {
      sheetName: params.sheet_name,
      range: params.range,
      allSheets: params.all_sheets,
    });

    cache.set(cacheKey, result);
    return result;
  } catch (err) {
    return { error: sanitizeErrorMessage(err) };
  }
}
