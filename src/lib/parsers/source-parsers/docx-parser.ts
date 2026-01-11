import mammoth from "mammoth";
import { BaseParser } from "./base-parser";
import type { ParsedDocx, TocItem, SpineItem, DocxMetadata } from "./types";

interface HeadingInfo {
    level: number;
    text: string;
    id: string;
}

export class DocxParser extends BaseParser<ParsedDocx> {
    private htmlContent: string = "";
    private headings: HeadingInfo[] = [];

    constructor(buffer: Buffer) {
        super(buffer);
    }

    async parse(): Promise<ParsedDocx> {
        // Convert DOCX to HTML using mammoth
        const result = await mammoth.convertToHtml(
            { buffer: this.buffer },
            {
                styleMap: [
                    "p[style-name='Heading 1'] => h1:fresh",
                    "p[style-name='Heading 2'] => h2:fresh",
                    "p[style-name='Heading 3'] => h3:fresh",
                    "p[style-name='Heading 4'] => h4:fresh",
                    "p[style-name='Heading 5'] => h5:fresh",
                    "p[style-name='Heading 6'] => h6:fresh",
                ],
            }
        );

        this.htmlContent = result.value;

        // Extract headings from HTML for ToC
        this.extractHeadings();

        // Build ToC from headings
        const toc = this.buildToc();

        // Build spine (single chapter for simple documents, or multiple based on h1)
        const spine = this.buildSpine();

        // Extract title from first heading or use default
        const title = this.extractTitle();

        const metadata: DocxMetadata = {
            title,
            author: null,
            language: null,
            publisher: null,
            description: null,
        };

        return {
            metadata,
            toc,
            spine,
            coverBuffer: null,
            coverMimeType: null,
        };
    }

    private extractHeadings(): void {
        // Match all heading tags (h1-h6) and their content
        const headingRegex = /<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi;
        let match;
        let index = 0;

        while ((match = headingRegex.exec(this.htmlContent)) !== null) {
            const level = parseInt(match[1], 10);
            // Strip HTML tags from heading text
            const text = match[2].replace(/<[^>]+>/g, "").trim();

            if (text) {
                this.headings.push({
                    level,
                    text,
                    id: `heading-${index}`,
                });
                index++;
            }
        }
    }

    private buildToc(): TocItem[] {
        if (this.headings.length === 0) {
            // If no headings, create a single "Document" chapter
            return [
                {
                    id: "toc-0",
                    title: "Документ",
                    href: "content",
                    order: 0,
                    children: [],
                },
            ];
        }

        const result: TocItem[] = [];
        const stack: { item: TocItem; level: number }[] = [];
        let order = 0;

        for (const heading of this.headings) {
            const tocItem: TocItem = {
                id: `toc-${order}`,
                title: heading.text,
                href: heading.id,
                order,
                children: [],
            };

            // Pop items from stack that are at same or higher level
            while (stack.length > 0 && stack[stack.length - 1].level >= heading.level) {
                stack.pop();
            }

            if (stack.length === 0) {
                // Top-level item
                result.push(tocItem);
            } else {
                // Child of the last item in stack
                stack[stack.length - 1].item.children.push(tocItem);
            }

            stack.push({ item: tocItem, level: heading.level });
            order++;
        }

        return result;
    }

    private buildSpine(): SpineItem[] {
        if (this.headings.length === 0) {
            return [
                {
                    id: "content",
                    href: "content",
                    order: 0,
                },
            ];
        }

        // Build spine from top-level headings (h1) or all headings if no h1
        const h1Headings = this.headings.filter((h) => h.level === 1);
        const baseHeadings = h1Headings.length > 0 ? h1Headings : this.headings;

        return baseHeadings.map((heading, index) => ({
            id: heading.id,
            href: heading.id,
            order: index,
        }));
    }

    private extractTitle(): string {
        // Try to get title from first h1, or first heading of any level
        const h1 = this.headings.find((h) => h.level === 1);
        if (h1) return h1.text;

        if (this.headings.length > 0) {
            return this.headings[0].text;
        }

        return "Untitled Document";
    }

    async getChapterContent(href: string): Promise<string> {
        if (href === "content") {
            // Return entire document content
            return this.processHtmlContent(this.htmlContent);
        }

        // Find the heading index
        const headingIndex = this.headings.findIndex((h) => h.id === href);
        if (headingIndex === -1) {
            return this.processHtmlContent(this.htmlContent);
        }

        const currentHeading = this.headings[headingIndex];

        // Extract content from this heading until the next heading of same or higher level
        const parts = this.splitByHeadings();

        // Find content for this specific heading
        let content = "";
        let foundStart = false;

        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];

            if (part.headingId === href) {
                foundStart = true;
                content += part.content;
                continue;
            }

            if (foundStart) {
                // Check if this is a heading of same or higher level, then stop
                const h = this.headings.find((h) => h.id === part.headingId);
                if (h && h.level <= currentHeading.level) {
                    break;
                }
                content += part.content;
            }
        }

        return this.processHtmlContent(content || this.htmlContent);
    }

    private splitByHeadings(): { headingId: string | null; content: string }[] {
        const parts: { headingId: string | null; content: string }[] = [];

        // Create regex that matches any heading
        const headingRegex = /<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi;

        let lastIndex = 0;
        let headingIdx = 0;
        let match;

        // Reset regex
        headingRegex.lastIndex = 0;

        while ((match = headingRegex.exec(this.htmlContent)) !== null) {
            // Content before this heading (belongs to previous section or start)
            if (match.index > lastIndex && headingIdx > 0) {
                // Add content to the previous heading's section
                const lastPart = parts[parts.length - 1];
                if (lastPart) {
                    lastPart.content += this.htmlContent.substring(lastIndex, match.index);
                }
            } else if (match.index > lastIndex) {
                // Content before first heading
                parts.push({
                    headingId: null,
                    content: this.htmlContent.substring(lastIndex, match.index),
                });
            }

            // Add new heading section
            const headingInfo = this.headings[headingIdx];
            if (headingInfo) {
                parts.push({
                    headingId: headingInfo.id,
                    content: match[0], // Start with the heading itself
                });
            }

            lastIndex = match.index + match[0].length;
            headingIdx++;
        }

        // Add remaining content
        if (lastIndex < this.htmlContent.length) {
            if (parts.length > 0) {
                parts[parts.length - 1].content += this.htmlContent.substring(lastIndex);
            } else {
                parts.push({
                    headingId: null,
                    content: this.htmlContent.substring(lastIndex),
                });
            }
        }

        return parts;
    }

    private processHtmlContent(html: string): string {
        // Add IDs to headings for navigation
        let processedHtml = html;
        let headingIdx = 0;

        processedHtml = processedHtml.replace(
            /<h([1-6])([^>]*)>/gi,
            (match, level, attrs) => {
                const heading = this.headings[headingIdx];
                headingIdx++;
                if (heading) {
                    // Check if id already exists in attrs
                    if (attrs.includes("id=")) {
                        return match;
                    }
                    return `<h${level}${attrs} id="${heading.id}">`;
                }
                return match;
            }
        );

        return processedHtml;
    }
}

export async function parseDocxFile(buffer: Buffer): Promise<ParsedDocx> {
    const parser = new DocxParser(buffer);
    return parser.parse();
}

export async function getDocxChapterContent(
    buffer: Buffer,
    chapterHref: string
): Promise<string> {
    const parser = new DocxParser(buffer);
    await parser.parse();
    return parser.getChapterContent(chapterHref);
}
