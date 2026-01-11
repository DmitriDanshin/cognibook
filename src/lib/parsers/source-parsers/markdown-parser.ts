import { BaseParser } from "./base-parser";
import type { SourceMetadata, ParsedMarkdown, SpineItem, TocItem } from "./types";

import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkRehype from "remark-rehype";
import rehypeRaw from "rehype-raw";
import rehypeKatex from "rehype-katex";
import rehypeStringify from "rehype-stringify";

// Dangerous tags to completely remove (including content)
const DANGEROUS_TAGS = new Set([
    "script", "style", "iframe", "object", "embed", "form",
    "input", "button", "textarea", "noscript", "frame", "frameset"
]);

/**
 * Sanitize HTML string before processing with KaTeX
 * This removes dangerous elements while preserving safe markdown-generated HTML
 */
function sanitizeHtmlBeforeKatex(html: string): string {
    // Remove dangerous tags entirely (including content)
    for (const tag of DANGEROUS_TAGS) {
        // Remove opening and closing tags with content
        const regex = new RegExp(`<${tag}[^>]*>[\\s\\S]*?</${tag}>`, "gi");
        html = html.replace(regex, "");
        // Remove self-closing
        const selfClosing = new RegExp(`<${tag}[^>]*/?>`, "gi");
        html = html.replace(selfClosing, "");
    }

    // Remove event handlers (onclick, onerror, etc.)
    html = html.replace(/\s+on\w+\s*=\s*["'][^"']*["']/gi, "");
    html = html.replace(/\s+on\w+\s*=\s*[^\s>]+/gi, "");

    // Sanitize javascript: in href
    html = html.replace(/href\s*=\s*["']?\s*javascript:[^"'\s>]*/gi, 'href="#"');

    return html;
}

/**
 * Escape dollar signs inside <code> tags to prevent KaTeX from parsing them as math
 */
function escapeDollarsInCodeTags(content: string): string {
    // Replace $ with HTML entity inside <code>...</code> tags
    return content.replace(/<code>([^<]*)<\/code>/gi, (match, inner) => {
        const escaped = inner.replace(/\$/g, '&#36;');
        return `<code>${escaped}</code>`;
    });
}

type MarkdownHeading = {
    level: number;
    title: string;
    href: string;
    order: number;
    lineIndex: number;
};

// Create the unified processor
// Order: parse markdown -> GFM -> math -> convert to HTML -> process raw HTML -> render KaTeX -> stringify
// Note: We do NOT use rehype-sanitize here because it strips KaTeX output.
// Instead, we sanitize the input HTML before processing.
const createProcessor = () => {
    return unified()
        .use(remarkParse)
        .use(remarkGfm)
        .use(remarkMath, { singleDollarTextMath: true })
        .use(remarkRehype, { allowDangerousHtml: true })
        .use(rehypeRaw)
        .use(rehypeKatex, {
            strict: false,
            throwOnError: false,
        })
        .use(rehypeStringify, { allowDangerousHtml: true });
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

    private extractFrontMatter(content: string): { metadata: Partial<SourceMetadata>; body: string } {
        const lines = content.split(/\r?\n/);
        if (lines.length === 0) {
            return { metadata: {}, body: content };
        }

        if (lines[0].charCodeAt(0) === 0xfeff) {
            lines[0] = lines[0].slice(1);
        }

        let startIndex = 0;
        while (startIndex < lines.length && lines[startIndex].trim() === "") {
            startIndex += 1;
        }

        if (startIndex >= lines.length || lines[startIndex].trim() !== "---") {
            return { metadata: {}, body: content };
        }

        let endIndex = -1;
        for (let i = startIndex + 1; i < lines.length; i++) {
            if (lines[i].trim() === "---") {
                endIndex = i;
                break;
            }
        }

        if (endIndex === -1) {
            return { metadata: {}, body: content };
        }

        const matterLines = lines.slice(startIndex + 1, endIndex);
        const metadata: Partial<SourceMetadata> = {};

        for (const line of matterLines) {
            const match = /^([^:]+):\s*(.*)$/.exec(line);
            if (!match) continue;

            const key = match[1].trim().toLowerCase();
            // Remove surrounding quotes from YAML values
            let value = match[2].trim();
            if ((value.startsWith('"') && value.endsWith('"')) ||
                (value.startsWith("'") && value.endsWith("'"))) {
                value = value.slice(1, -1);
            }

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
        metadata: Partial<SourceMetadata>,
        headings: MarkdownHeading[]
    ): SourceMetadata {
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
        let inMathBlock = false;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();

            // Track code blocks
            if (trimmed.startsWith("```")) {
                inCodeBlock = !inCodeBlock;
                continue;
            }

            // Track math blocks ($$...$$)
            if (trimmed === "$$") {
                inMathBlock = !inMathBlock;
                continue;
            }

            if (inCodeBlock || inMathBlock) continue;

            const match = /^(#{1,6})\s+(.+)$/.exec(line);
            if (!match) continue;

            const level = match[1].length;
            // Strip trailing hashes and clean up title
            const title = match[2].trim().replace(/\s+#+\s*$/, "");
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

    private async renderMarkdownToHtml(markdown: string): Promise<string> {
        // Escape $ inside <code> tags to prevent KaTeX from parsing them as math
        const escapedMarkdown = escapeDollarsInCodeTags(markdown);

        // Pre-sanitize raw HTML in markdown before processing
        const sanitizedMarkdown = sanitizeHtmlBeforeKatex(escapedMarkdown);

        const processor = createProcessor();
        const result = await processor.process(sanitizedMarkdown);

        // Post-process: sanitize any remaining dangerous patterns in output
        let html = String(result);

        // Final safety check - remove any javascript: URLs that might have slipped through
        html = html.replace(/href\s*=\s*["']?\s*javascript:[^"'\s>]*/gi, 'href="#"');

        return html;
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
