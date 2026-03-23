import { google } from "googleapis";
import type { OAuth2Client } from "google-auth-library";

export interface SheetResult {
  name: string;
  content: string;
  rowCount: number;
  columnCount: number;
}

/**
 * Read a Google Sheet and convert to Markdown table(s).
 */
export async function readGoogleSheet(
  auth: OAuth2Client,
  spreadsheetId: string,
  options: {
    sheetName?: string;
    range?: string;
    allSheets?: boolean;
  } = {}
): Promise<{ title: string; sheets: SheetResult[] }> {
  const sheetsApi = google.sheets({ version: "v4", auth });

  // Get spreadsheet metadata
  const meta = await sheetsApi.spreadsheets.get({ spreadsheetId });
  const title = meta.data.properties?.title ?? "Untitled";
  const sheetList = meta.data.sheets ?? [];

  // Determine which sheets to read
  let sheetsToRead: string[];

  if (options.range) {
    // Specific range provided (e.g. "Sheet1!A1:Z100")
    sheetsToRead = [options.range];
  } else if (options.sheetName) {
    sheetsToRead = [options.sheetName];
  } else if (options.allSheets) {
    sheetsToRead = sheetList.map(
      (s) => s.properties?.title ?? "Sheet1"
    );
  } else {
    // Default: first sheet
    const firstSheet = sheetList[0]?.properties?.title ?? "Sheet1";
    sheetsToRead = [firstSheet];
  }

  // Fetch data for all requested sheets in one batch
  const ranges = sheetsToRead.map((name) =>
    name.includes("!") ? name : `'${name}'`
  );

  const batchRes = await sheetsApi.spreadsheets.values.batchGet({
    spreadsheetId,
    ranges,
  });

  const valueRanges = batchRes.data.valueRanges ?? [];
  const results: SheetResult[] = [];

  for (let i = 0; i < valueRanges.length; i++) {
    const values = valueRanges[i].values ?? [];
    const sheetName = sheetsToRead[i];

    if (values.length === 0) {
      results.push({
        name: sheetName,
        content: "*Empty sheet*",
        rowCount: 0,
        columnCount: 0,
      });
      continue;
    }

    const markdown = valuesToMarkdownTable(values);
    results.push({
      name: sheetName,
      content: markdown,
      rowCount: values.length,
      columnCount: values[0]?.length ?? 0,
    });
  }

  return { title, sheets: results };
}

function valuesToMarkdownTable(values: string[][]): string {
  if (values.length === 0) return "*Empty*";

  // Determine max columns across all rows
  const maxCols = Math.max(...values.map((row) => row.length));

  // Normalize rows to same column count
  const normalized = values.map((row) => {
    const padded = [...row];
    while (padded.length < maxCols) padded.push("");
    return padded.map((cell) => escapeMarkdownCell(String(cell ?? "")));
  });

  const lines: string[] = [];

  // Header row
  lines.push(`| ${normalized[0].join(" | ")} |`);

  // Separator
  lines.push(`| ${normalized[0].map(() => "---").join(" | ")} |`);

  // Data rows
  for (let i = 1; i < normalized.length; i++) {
    lines.push(`| ${normalized[i].join(" | ")} |`);
  }

  return lines.join("\n");
}

function escapeMarkdownCell(text: string): string {
  return text
    .replace(/\|/g, "\\|")
    .replace(/\n/g, " ")
    .trim();
}
