import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  handleReadGoogleLinks,
} from "./tools/readGoogleLinks.js";
import {
  handleReadGoogleSheet,
  type SheetErrorResponse,
} from "./tools/readGoogleSheet.js";
import { sanitizeErrorMessage } from "./utils/sanitize.js";

export function createServer(): McpServer {
  const server = new McpServer({
    name: "mcp-google-reader",
    version: "1.0.0",
  });

  // Tool: read_google_links
  server.tool(
    "read_google_links",
    "Extract Google Docs/Sheets URLs from a message and return their content. " +
      "Docs are returned as Markdown, Sheets as Markdown tables. " +
      "Supports multiple URLs in a single message.",
    {
      message: z
        .string()
        .describe(
          "A message containing one or more Google Docs/Sheets URLs. " +
            "URLs will be automatically extracted and their content fetched."
        ),
    },
    async ({ message }) => {
      try {
        const response = await handleReadGoogleLinks(message);
        return {
          content: [
            {
              type: "text" as const,
              text: formatLinksResponse(response),
            },
          ],
        };
      } catch (err) {
        const msg = sanitizeErrorMessage(err);
        return {
          content: [{ type: "text" as const, text: `Error: ${msg}` }],
          isError: true,
        };
      }
    }
  );

  // Tool: read_google_sheet
  server.tool(
    "read_google_sheet",
    "Read a specific Google Sheet with options for sheet name, range, or all sheets. " +
      "Use this when you need fine-grained control over which sheet/tab or cell range to read.",
    {
      url: z.string().describe("Google Sheets URL"),
      sheet_name: z
        .string()
        .optional()
        .describe(
          "Specific sheet/tab name to read. If omitted, reads the first sheet."
        ),
      range: z
        .string()
        .optional()
        .describe(
          "Specific cell range to read, e.g. 'A1:Z100'. If omitted, reads all data."
        ),
      all_sheets: z
        .boolean()
        .optional()
        .describe(
          "If true, reads all sheets/tabs in the spreadsheet."
        ),
    },
    async (params) => {
      try {
        const result = await handleReadGoogleSheet({
          url: params.url,
          sheet_name: params.sheet_name,
          range: params.range,
          all_sheets: params.all_sheets ?? false,
        });

        if ("error" in result) {
          const errResult = result as SheetErrorResponse;
          return {
            content: [
              { type: "text" as const, text: `Error: ${errResult.error}` },
            ],
            isError: true,
          };
        }

        return {
          content: [
            {
              type: "text" as const,
              text: formatSheetResponse(result as { title: string; sheets: Array<{ name: string; content: string; rowCount: number; columnCount: number }> }),
            },
          ],
        };
      } catch (err) {
        const msg = sanitizeErrorMessage(err);
        return {
          content: [{ type: "text" as const, text: `Error: ${msg}` }],
          isError: true,
        };
      }
    }
  );

  return server;
}

function formatLinksResponse(response: {
  results: Array<{
    url: string;
    type: string;
    title: string;
    content?: string;
    sheets?: Array<{ name: string; content: string; rowCount: number; columnCount: number }>;
  }>;
  errors: Array<{ url: string; error: string }>;
}): string {
  const parts: string[] = [];

  for (const result of response.results) {
    parts.push(`## ${result.title}`);
    parts.push(`> Source: ${result.url}`);
    parts.push(`> Type: ${result.type}\n`);

    if (result.type === "document" && result.content) {
      parts.push(result.content);
    } else if (result.type === "spreadsheet" && result.sheets) {
      for (const sheet of result.sheets) {
        if (result.sheets.length > 1) {
          parts.push(`### Sheet: ${sheet.name}`);
        }
        parts.push(sheet.content);
      }
    }

    parts.push("\n---\n");
  }

  for (const err of response.errors) {
    parts.push(`**Error** reading ${err.url}: ${err.error}`);
  }

  return parts.join("\n");
}

function formatSheetResponse(result: {
  title: string;
  sheets: Array<{ name: string; content: string; rowCount: number; columnCount: number }>;
}): string {
  const parts: string[] = [];

  parts.push(`## ${result.title}\n`);

  for (const sheet of result.sheets) {
    if (result.sheets.length > 1) {
      parts.push(`### Sheet: ${sheet.name} (${sheet.rowCount} rows x ${sheet.columnCount} cols)\n`);
    }
    parts.push(sheet.content);
    parts.push("");
  }

  return parts.join("\n");
}

/**
 * Start the MCP server with stdio transport.
 */
export async function startServer(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
