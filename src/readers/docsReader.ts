import { google, type docs_v1 } from "googleapis";
import type { OAuth2Client } from "google-auth-library";

export interface DocTab {
  tabId: string;
  title: string;
  content: string;
}

export interface DocResult {
  title: string;
  content: string;
  tabs: DocTab[];
}

/**
 * Read a Google Doc and convert to Markdown.
 * Supports multi-tab documents by using includeTabsContent.
 */
export async function readGoogleDoc(
  auth: OAuth2Client,
  documentId: string
): Promise<DocResult> {
  const docs = google.docs({ version: "v1", auth });
  const res = await docs.documents.get({
    documentId,
    includeTabsContent: true,
  });
  const doc = res.data;

  const title = doc.title ?? "Untitled";
  const tabs = extractTabs(doc);

  // For backward compatibility, content is all tabs concatenated
  const content =
    tabs.length === 1
      ? tabs[0].content
      : tabs
          .map((tab) => `## Tab: ${tab.title}\n\n${tab.content}`)
          .join("\n\n---\n\n");

  return { title, content, tabs };
}

/**
 * Recursively extract all tabs (including child tabs) from a document.
 */
function extractTabs(doc: docs_v1.Schema$Document): DocTab[] {
  const tabs: DocTab[] = [];

  function processTab(tab: docs_v1.Schema$Tab): void {
    const tabProperties = tab.tabProperties;
    const documentTab = tab.documentTab;

    if (documentTab?.body) {
      const tabTitle = tabProperties?.title ?? "Untitled Tab";
      const tabId = tabProperties?.tabId ?? "";
      const content = bodyToMarkdown(documentTab.body);
      tabs.push({ tabId, title: tabTitle, content });
    }

    // Process child tabs recursively
    if (tab.childTabs) {
      for (const child of tab.childTabs) {
        processTab(child);
      }
    }
  }

  if (doc.tabs && doc.tabs.length > 0) {
    for (const tab of doc.tabs) {
      processTab(tab);
    }
  } else {
    // Fallback for documents without tabs structure (shouldn't happen with includeTabsContent)
    const content = documentToMarkdown(doc);
    tabs.push({ tabId: "", title: "Default", content });
  }

  return tabs;
}

function bodyToMarkdown(body: docs_v1.Schema$Body): string {
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
