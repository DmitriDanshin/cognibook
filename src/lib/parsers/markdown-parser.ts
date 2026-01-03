import { BaseParser } from "./base-parser";
import type { BookMetadata, ParsedMarkdown, SpineItem, TocItem } from "./types";

type MarkdownHeading = {
    level: number;
    title: string;
    href: string;
    order: number;
    lineIndex: number;
};

export class MarkdownParser extends BaseParser<ParsedMarkdown> {
    private content: string = "";
    private lines: string[] = [];
    private headings: MarkdownHeading[] = [];

    constructor(buffer: Buffer) {
        super(buffer);
    }

    async parse(): Promise<ParsedMarkdown> {
        const rawContent = this.buffer.toString("utf-8");
        const { metadata, body } = this.extractFrontMatter(rawContent);

        this.content = body;
        this.lines = body.split(/\r?\n/);
        this.headings = this.extractHeadings(this.lines);

        const resolvedMetadata = this.resolveMetadata(metadata, this.headings);
        const toc = this.buildToc(this.headings, resolvedMetadata.title);
        const spine = this.buildSpine(this.headings);

        return {
            metadata: resolvedMetadata,
            toc,
            spine,
            coverBuffer: null,
            coverMimeType: null,
        };
    }

    async getChapterContent(href: string): Promise<string> {
        if (!this.lines.length) {
            const rawContent = this.buffer.toString("utf-8");
            const { body } = this.extractFrontMatter(rawContent);
            this.content = body;
            this.lines = body.split(/\r?\n/);
            this.headings = this.extractHeadings(this.lines);
        }

        if (this.headings.length === 0) {
            return this.renderMarkdownToHtml(this.content);
        }

        const heading = this.headings.find((item) => item.href === href);
        if (!heading) {
            return this.renderMarkdownToHtml(this.content);
        }

        const { start, end } = this.getSectionRange(heading);
        const section = this.lines.slice(start, end).join("\n");
        return this.renderMarkdownToHtml(section);
    }

    private extractFrontMatter(content: string): { metadata: Partial<BookMetadata>; body: string } {
        const lines = content.split(/\r?\n/);
        if (lines.length === 0 || lines[0].trim() !== "---") {
            return { metadata: {}, body: content };
        }

        let endIndex = -1;
        for (let i = 1; i < lines.length; i++) {
            if (lines[i].trim() === "---") {
                endIndex = i;
                break;
            }
        }

        if (endIndex === -1) {
            return { metadata: {}, body: content };
        }

        const matterLines = lines.slice(1, endIndex);
        const metadata: Partial<BookMetadata> = {};

        for (const line of matterLines) {
            const match = /^([^:]+):\s*(.*)$/.exec(line);
            if (!match) continue;

            const key = match[1].trim().toLowerCase();
            const value = match[2].trim();

            switch (key) {
                case "title":
                    metadata.title = value;
                    break;
                case "author":
                case "creator":
                    metadata.author = value;
                    break;
                case "language":
                case "lang":
                    metadata.language = value;
                    break;
                case "publisher":
                    metadata.publisher = value;
                    break;
                case "description":
                case "summary":
                    metadata.description = value;
                    break;
                default:
                    break;
            }
        }

        const body = lines.slice(endIndex + 1).join("\n");
        return { metadata, body };
    }

    private resolveMetadata(
        metadata: Partial<BookMetadata>,
        headings: MarkdownHeading[]
    ): BookMetadata {
        const titleFromHeading =
            headings.find((heading) => heading.level === 1)?.title ||
            headings[0]?.title ||
            "Untitled";

        return {
            title: metadata.title || titleFromHeading,
            author: metadata.author || null,
            language: metadata.language || null,
            publisher: metadata.publisher || null,
            description: metadata.description || null,
        };
    }

    private extractHeadings(lines: string[]): MarkdownHeading[] {
        const headings: MarkdownHeading[] = [];
        let order = 0;
        let inCodeBlock = false;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();

            if (trimmed.startsWith("```")) {
                inCodeBlock = !inCodeBlock;
                continue;
            }

            if (inCodeBlock) continue;

            const match = /^(#{1,6})\s+(.+)$/.exec(line);
            if (!match) continue;

            const level = match[1].length;
            const title = match[2].trim();
            const href = `#md-${order}`;

            headings.push({ level, title, href, order, lineIndex: i });
            order += 1;
        }

        return headings;
    }

    private buildToc(headings: MarkdownHeading[], fallbackTitle: string): TocItem[] {
        if (headings.length === 0) {
            return [
                {
                    id: "toc-0",
                    title: fallbackTitle,
                    href: "#md-0",
                    order: 0,
                    children: [],
                },
            ];
        }

        const toc: TocItem[] = [];
        const stack: Array<{ level: number; item: TocItem }> = [];

        for (const heading of headings) {
            const item: TocItem = {
                id: `toc-${heading.order}`,
                title: heading.title,
                href: heading.href,
                order: heading.order,
                children: [],
            };

            while (stack.length > 0 && heading.level <= stack[stack.length - 1].level) {
                stack.pop();
            }

            if (stack.length === 0) {
                toc.push(item);
            } else {
                stack[stack.length - 1].item.children.push(item);
            }

            stack.push({ level: heading.level, item });
        }

        return toc;
    }

    private buildSpine(headings: MarkdownHeading[]): SpineItem[] {
        if (headings.length === 0) {
            return [
                {
                    id: "md-0",
                    href: "#md-0",
                    order: 0,
                },
            ];
        }

        return headings.map((heading) => ({
            id: `md-${heading.order}`,
            href: heading.href,
            order: heading.order,
        }));
    }

    private getSectionRange(heading: MarkdownHeading): { start: number; end: number } {
        const start = heading.lineIndex;
        let end = this.lines.length;

        for (const next of this.headings) {
            if (next.lineIndex <= heading.lineIndex) continue;
            if (next.level <= heading.level) {
                end = next.lineIndex;
                break;
            }
        }

        return { start, end };
    }

    private renderMarkdownToHtml(markdown: string): string {
        const lines = markdown.split(/\r?\n/);
        let html = "";
        let inCodeBlock = false;
        let listType: "ul" | "ol" | null = null;
        let paragraph: string[] = [];

        const flushParagraph = () => {
            if (paragraph.length === 0) return;
            html += `<p>${this.formatInline(paragraph.join(" "))}</p>`;
            paragraph = [];
        };

        const closeList = () => {
            if (!listType) return;
            html += `</${listType}>`;
            listType = null;
        };

        for (const line of lines) {
            const trimmed = line.trim();

            if (trimmed.startsWith("```")) {
                flushParagraph();
                closeList();
                if (!inCodeBlock) {
                    html += "<pre><code>";
                    inCodeBlock = true;
                } else {
                    html += "</code></pre>";
                    inCodeBlock = false;
                }
                continue;
            }

            if (inCodeBlock) {
                html += `${this.escapeHtml(line)}\n`;
                continue;
            }

            const headingMatch = /^(#{1,6})\s+(.+)$/.exec(line);
            if (headingMatch) {
                flushParagraph();
                closeList();
                const level = headingMatch[1].length;
                const text = headingMatch[2].trim();
                html += `<h${level}>${this.formatInline(text)}</h${level}>`;
                continue;
            }

            const orderedMatch = /^\d+\.\s+(.+)$/.exec(trimmed);
            const unorderedMatch = /^[-*+]\s+(.+)$/.exec(trimmed);
            if (orderedMatch || unorderedMatch) {
                flushParagraph();
                const type = orderedMatch ? "ol" : "ul";
                if (listType !== type) {
                    closeList();
                    html += `<${type}>`;
                    listType = type;
                }
                const itemText = (orderedMatch ? orderedMatch[1] : unorderedMatch![1]).trim();
                html += `<li>${this.formatInline(itemText)}</li>`;
                continue;
            }

            if (trimmed === "") {
                flushParagraph();
                closeList();
                continue;
            }

            paragraph.push(trimmed);
        }

        if (inCodeBlock) {
            html += "</code></pre>";
        }

        flushParagraph();
        closeList();

        return html;
    }

    private formatInline(text: string): string {
        let escaped = this.escapeHtml(text);

        escaped = escaped.replace(/`([^`]+)`/g, "<code>$1</code>");
        escaped = escaped.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
        escaped = escaped.replace(/__([^_]+)__/g, "<strong>$1</strong>");
        escaped = escaped.replace(/\*([^*]+)\*/g, "<em>$1</em>");
        escaped = escaped.replace(/_([^_]+)_/g, "<em>$1</em>");
        escaped = escaped.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, textPart, url) => {
            return `<a href="${url}">${textPart}</a>`;
        });

        return escaped;
    }

    private escapeHtml(text: string): string {
        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }
}

export async function parseMarkdownFile(buffer: Buffer): Promise<ParsedMarkdown> {
    const parser = new MarkdownParser(buffer);
    return parser.parse();
}

export async function getMarkdownChapterContent(
    buffer: Buffer,
    chapterHref: string
): Promise<string> {
    const parser = new MarkdownParser(buffer);
    await parser.parse();
    return parser.getChapterContent(chapterHref);
}
