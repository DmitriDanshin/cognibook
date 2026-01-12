import { BaseParser } from "./base-parser";
import type { ParsedPdf, PdfMetadata, SpineItem, TocItem } from "./types";
import { GlobalWorkerOptions, getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

// Configure worker for server-side PDF parsing
if (!GlobalWorkerOptions.workerSrc) {
    GlobalWorkerOptions.workerSrc = require.resolve(
        "pdfjs-dist/legacy/build/pdf.worker.mjs"
    );
}

type OutlineItem = {
    title?: string;
    dest?: unknown;
    items?: OutlineItem[];
};

type PdfTextItem = {
    str: string;
    hasEOL?: boolean;
};

type PdfPageProxy = {
    getTextContent: () => Promise<{ items: PdfTextItem[] }>;
};

type PdfDocumentProxy = {
    numPages: number;
    getMetadata: () => Promise<{
        info?: Record<string, unknown>;
        metadata?: { get?: (key: string) => string | null } | null;
    }>;
    getOutline: () => Promise<OutlineItem[] | null>;
    getDestination: (dest: string) => Promise<unknown[] | null>;
    getPageIndex: (ref: unknown) => Promise<number>;
    getPage: (pageNumber: number) => Promise<PdfPageProxy>;
};

const DEFAULT_TITLE = "Untitled PDF";
const EMPTY_TEXT_MESSAGE = "No text found for this page.";

const clamp = (value: number, min: number, max: number): number =>
    Math.min(Math.max(value, min), max);

const escapeHtml = (text: string): string =>
    text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");

const textToHtml = (text: string): string => {
    const lines = text
        .split(/\n+/)
        .map((line) => line.trim())
        .filter(Boolean);
    if (lines.length === 0) {
        return `<p>${escapeHtml(EMPTY_TEXT_MESSAGE)}</p>`;
    }
    return lines.map((line) => `<p>${escapeHtml(line)}</p>`).join("");
};

const parsePageRange = (href: string): { start: number; end: number } => {
    const cleanHref = href.split("#")[0];
    const match = /^page-(\d+)(?:-(\d+))?$/i.exec(cleanHref);
    if (!match) {
        return { start: 1, end: 1 };
    }

    const start = Math.max(1, Number.parseInt(match[1], 10));
    const end = match[2]
        ? Math.max(start, Number.parseInt(match[2], 10))
        : start;
    return { start, end };
};

const extractPageText = async (page: PdfPageProxy): Promise<string> => {
    const textContent = await page.getTextContent();
    const items = textContent.items ?? [];
    const lines: string[] = [];
    let line = "";

    for (const item of items) {
        const chunk = item.str ?? "";
        if (chunk) {
            line = line ? `${line} ${chunk}` : chunk;
        }
        if (item.hasEOL) {
            if (line) lines.push(line);
            line = "";
        }
    }

    if (line) lines.push(line);
    return lines.join("\n");
};

export class PdfParser extends BaseParser<ParsedPdf> {
    private pdfDoc: PdfDocumentProxy | null = null;

    private async getPdfDocument(): Promise<PdfDocumentProxy> {
        if (this.pdfDoc) return this.pdfDoc;
        const loadingTask = getDocument({
            data: new Uint8Array(this.buffer),
        }) as { promise: Promise<PdfDocumentProxy> };
        this.pdfDoc = await loadingTask.promise;
        return this.pdfDoc;
    }

    async parse(): Promise<ParsedPdf> {
        const pdf = await this.getPdfDocument();
        const metadata = await this.extractMetadata(pdf);
        const toc = await this.buildToc(pdf);
        const spine = this.buildSpine(pdf.numPages);

        return {
            metadata,
            toc,
            spine,
            coverBuffer: null,
            coverMimeType: null,
        };
    }

    async getChapterContent(href: string): Promise<string> {
        const pdf = await this.getPdfDocument();
        const { start, end } = parsePageRange(href);
        const maxPage = pdf.numPages;
        const safeStart = clamp(start, 1, maxPage);
        const safeEnd = clamp(end, safeStart, maxPage);

        const pageTexts: string[] = [];
        for (let pageNumber = safeStart; pageNumber <= safeEnd; pageNumber += 1) {
            const page = await pdf.getPage(pageNumber);
            const pageText = await extractPageText(page);
            if (pageText.trim()) {
                pageTexts.push(pageText);
            }
        }

        return textToHtml(pageTexts.join("\n\n"));
    }

    private async extractMetadata(pdf: PdfDocumentProxy): Promise<PdfMetadata> {
        try {
            const { info, metadata } = await pdf.getMetadata();
            const dcTitle = metadata?.get?.("dc:title") ?? null;
            const dcAuthor = metadata?.get?.("dc:creator") ?? null;
            const dcLanguage = metadata?.get?.("dc:language") ?? null;
            const dcDescription = metadata?.get?.("dc:description") ?? null;

            const title =
                (typeof info?.Title === "string" && info.Title.trim()) ||
                (typeof dcTitle === "string" && dcTitle.trim()) ||
                DEFAULT_TITLE;

            const author =
                (typeof info?.Author === "string" && info.Author.trim()) ||
                (typeof dcAuthor === "string" && dcAuthor.trim()) ||
                null;

            return {
                title,
                author,
                language:
                    typeof dcLanguage === "string" && dcLanguage.trim()
                        ? dcLanguage.trim()
                        : null,
                publisher: null,
                description:
                    typeof dcDescription === "string" && dcDescription.trim()
                        ? dcDescription.trim()
                        : null,
            };
        } catch {
            return {
                title: DEFAULT_TITLE,
                author: null,
                language: null,
                publisher: null,
                description: null,
            };
        }
    }

    private buildSpine(pageCount: number): SpineItem[] {
        return Array.from({ length: pageCount }, (_, index) => ({
            id: `page-${index + 1}`,
            href: `page-${index + 1}`,
            order: index,
        }));
    }

    private async buildToc(pdf: PdfDocumentProxy): Promise<TocItem[]> {
        const outline = await pdf.getOutline().catch(() => null);
        if (outline && outline.length > 0) {
            const flatOutline = await this.flattenOutline(outline, pdf);
            if (flatOutline.length > 0) {
                return this.buildOutlineToc(flatOutline, pdf.numPages);
            }
        }

        return this.buildPageToc(pdf.numPages);
    }

    private buildPageToc(pageCount: number): TocItem[] {
        return Array.from({ length: pageCount }, (_, index) => ({
            id: `toc-${index}`,
            title: `Page ${index + 1}`,
            href: `page-${index + 1}`,
            order: index,
            children: [],
        }));
    }

    private buildOutlineToc(
        items: Array<{ title: string; page: number }>,
        pageCount: number
    ): TocItem[] {
        return items.map((item, index) => {
            const startPage = clamp(item.page, 1, pageCount);
            const nextPage = items[index + 1]?.page ?? null;
            const endPage =
                nextPage && nextPage > startPage
                    ? clamp(nextPage - 1, startPage, pageCount)
                    : startPage;
            const href =
                endPage > startPage
                    ? `page-${startPage}-${endPage}`
                    : `page-${startPage}`;

            return {
                id: `toc-${index}`,
                title: item.title,
                href,
                order: index,
                children: [],
            };
        });
    }

    private async flattenOutline(
        items: OutlineItem[],
        pdf: PdfDocumentProxy
    ): Promise<Array<{ title: string; page: number }>> {
        const result: Array<{ title: string; page: number }> = [];

        const walk = async (nodes: OutlineItem[]) => {
            for (const node of nodes) {
                const title = node.title?.trim();
                const page = await this.resolveOutlinePage(pdf, node.dest);
                if (title && page) {
                    result.push({ title, page });
                }
                if (node.items && node.items.length > 0) {
                    await walk(node.items);
                }
            }
        };

        await walk(items);
        return result;
    }

    private async resolveOutlinePage(
        pdf: PdfDocumentProxy,
        dest: unknown
    ): Promise<number | null> {
        if (!dest) return null;
        let destination = dest;
        if (typeof dest === "string") {
            destination = await pdf.getDestination(dest);
        }

        if (!Array.isArray(destination) || destination.length === 0) {
            return null;
        }

        const pageRef = destination[0];
        if (typeof pageRef === "number") {
            return pageRef + 1;
        }

        try {
            const pageIndex = await pdf.getPageIndex(pageRef);
            return pageIndex + 1;
        } catch {
            return null;
        }
    }
}

export async function parsePdfFile(buffer: Buffer): Promise<ParsedPdf> {
    const parser = new PdfParser(buffer);
    return parser.parse();
}

export async function getPdfChapterContent(
    buffer: Buffer,
    chapterHref: string
): Promise<string> {
    const parser = new PdfParser(buffer);
    await parser.parse();
    return parser.getChapterContent(chapterHref);
}
