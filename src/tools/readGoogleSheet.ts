import { z } from "zod";
import { extractGoogleUrls } from "../utils/urlParser.js";
import { getAuthenticatedClient } from "../auth/oauth.js";
import { readGoogleSheet, type SheetResult } from "../readers/sheetsReader.js";
import { ContentCache } from "../cache/contentCache.js";

export interface SheetResponse {
  title: string;
  sheets: SheetResult[];
}

export interface SheetErrorResponse {
  error: string;
}

const cache = new ContentCache<SheetResponse>(60);

export const readGoogleSheetSchema = z.object({
  url: z
    .string()
    .describe("Google Sheets URL"),
  sheet_name: z
    .string()
    .optional()
    .describe("Specific sheet/tab name to read. If omitted, reads the first sheet."),
  range: z
    .string()
    .optional()
    .describe("Specific cell range to read, e.g. 'A1:Z100'. If omitted, reads all data."),
  all_sheets: z
    .boolean()
    .optional()
    .default(false)
    .describe("If true, reads all sheets/tabs in the spreadsheet."),
});

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
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    return { error: errorMessage };
  }
}
