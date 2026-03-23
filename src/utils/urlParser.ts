/**
 * Extract and classify Google Docs/Sheets URLs from a message string.
 */

export interface ParsedGoogleUrl {
  url: string;
  type: "document" | "spreadsheet";
  documentId: string;
}

const GOOGLE_URL_REGEX =
  /https?:\/\/docs\.google\.com\/(document|spreadsheets)\/d\/([a-zA-Z0-9_-]+)(?:\/[^\s)}\]"'<>]*)*/gi;

export function extractGoogleUrls(message: string): ParsedGoogleUrl[] {
  const results: ParsedGoogleUrl[] = [];
  const seen = new Set<string>();

  let match: RegExpExecArray | null;
  while ((match = GOOGLE_URL_REGEX.exec(message)) !== null) {
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
