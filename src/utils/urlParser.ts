/**
 * Extract and classify Google Docs/Sheets URLs from a message string.
 */

export interface ParsedGoogleUrl {
  url: string;
  type: "document" | "spreadsheet";
  documentId: string;
}

const GOOGLE_URL_REGEX =
  /https:\/\/docs\.google\.com\/(document|spreadsheets)\/d\/([a-zA-Z0-9_-]{1,128})(?:\/[^\s)}\]"'<>]*)?\/?/gi;

export function extractGoogleUrls(message: string): ParsedGoogleUrl[] {
  const results: ParsedGoogleUrl[] = [];
  const seen = new Set<string>();

  // Create new regex each call to avoid shared lastIndex state
  const regex = new RegExp(GOOGLE_URL_REGEX.source, GOOGLE_URL_REGEX.flags);

  let match: RegExpExecArray | null;
  while ((match = regex.exec(message)) !== null) {
    const docType = match[1] === "document" ? "document" : "spreadsheet";
    const documentId = match[2];

    // Deduplicate by document ID
    if (!seen.has(documentId)) {
      seen.add(documentId);
      results.push({
        url: match[0],
        type: docType,
        documentId,
      });
    }
  }

  return results;
}
