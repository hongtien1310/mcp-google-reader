import { google, type docs_v1 } from "googleapis";
import type { OAuth2Client } from "google-auth-library";

/**
 * Read a Google Doc and convert to Markdown.
 */
export async function readGoogleDoc(
  auth: OAuth2Client,
  documentId: string
): Promise<{ title: string; content: string }> {
  const docs = google.docs({ version: "v1", auth });
  const res = await docs.documents.get({ documentId });
  const doc = res.data;

  const title = doc.title ?? "Untitled";
  const content = documentToMarkdown(doc);

  return { title, content };
}

function documentToMarkdown(doc: docs_v1.Schema$Document): string {
  const body = doc.body;
  if (!body?.content) return "";

  const parts: string[] = [];

  for (const element of body.content) {
    if (element.paragraph) {
      parts.push(parseParagraph(element.paragraph));
    } else if (element.table) {
      parts.push(parseTable(element.table));
    }
  }

  return parts.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function parseParagraph(paragraph: docs_v1.Schema$Paragraph): string {
  const style = paragraph.paragraphStyle?.namedStyleType;
  const elements = paragraph.elements ?? [];

  // Handle list items
  const bullet = paragraph.bullet;

  let text = "";
  for (const el of elements) {
    text += parseTextRun(el);
  }

  // Don't output empty lines for truly empty paragraphs
  if (!text.trim() && !bullet) return "";

  // Apply heading styles
  if (style?.startsWith("HEADING_")) {
    const level = parseInt(style.replace("HEADING_", ""), 10);
    const prefix = "#".repeat(Math.min(level, 6));
    return `\n${prefix} ${text.trim()}\n`;
  }

  // Handle bullet/list items
  if (bullet) {
    const nestingLevel = bullet.nestingLevel ?? 0;
    const indent = "  ".repeat(nestingLevel);
    return `${indent}- ${text.trim()}`;
  }

  return text;
}

function parseTextRun(element: docs_v1.Schema$ParagraphElement): string {
  const textRun = element.textRun;
  if (!textRun?.content) return "";

  let text = textRun.content;
  const style = textRun.textStyle;

  if (!style) return text;

  // Apply inline formatting (only to non-whitespace content)
  const trimmed = text.trim();
  if (trimmed) {
    let formatted = trimmed;

    if (style.bold && style.italic) {
      formatted = `***${formatted}***`;
    } else if (style.bold) {
      formatted = `**${formatted}**`;
    } else if (style.italic) {
      formatted = `*${formatted}*`;
    }

    if (style.strikethrough) {
      formatted = `~~${formatted}~~`;
    }

    if (style.link?.url) {
      formatted = `[${formatted}](${style.link.url})`;
    }

    // Preserve leading/trailing whitespace from original
    const leadingSpace = text.match(/^\s*/)?.[0] ?? "";
    const trailingSpace = text.match(/\s*$/)?.[0] ?? "";
    text = `${leadingSpace}${formatted}${trailingSpace}`;
  }

  return text;
}

function parseTable(table: docs_v1.Schema$Table): string {
  const rows = table.tableRows ?? [];
  if (rows.length === 0) return "";

  const markdownRows: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const cells = rows[i].tableCells ?? [];
    const cellTexts = cells.map((cell) => {
      const paragraphs = cell.content ?? [];
      return paragraphs
        .map((p) => {
          if (!p.paragraph) return "";
          return (p.paragraph.elements ?? [])
            .map((el) => (el.textRun?.content ?? "").trim())
            .join("");
        })
        .join(" ")
        .trim();
    });

    markdownRows.push(`| ${cellTexts.join(" | ")} |`);

    // Add separator after header row
    if (i === 0) {
      markdownRows.push(`| ${cellTexts.map(() => "---").join(" | ")} |`);
    }
  }

  return "\n" + markdownRows.join("\n") + "\n";
}
