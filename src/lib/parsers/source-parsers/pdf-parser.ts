import { BaseParser } from "./base-parser";
import type { TocItem, SpineItem, SourceMetadata, ParsedSource } from "./types";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import path from "path";
import { createLogger } from "@/lib/logger";

// Configure worker for Node.js environment
if (typeof window === "undefined") {
    // Server-side: point to the actual worker file using file:// protocol
    const workerPath = path.join(
        process.cwd(),
        "node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs"
    );
    pdfjs.GlobalWorkerOptions.workerSrc = `file://${workerPath.replace(/\\/g, "/")}`;
}

const logger = createLogger("pdf-parser");

export type PdfMetadata = SourceMetadata;
export type ParsedPdf = ParsedSource<PdfMetadata>;

interface PdfOutlineItem {
    title: string;
    dest: string | unknown[] | null;
    items?: PdfOutlineItem[];
}

/**
 * PDF Parser - Extracts metadata and outline (table of contents) from PDF
 */
export class PdfParser extends BaseParser<ParsedPdf> {
    constructor(buffer: Buffer) {
        super(buffer);
    }

    async parse(): Promise<ParsedPdf> {
        logger.info({ size: this.buffer.length }, "PDF parse started");
        const data = new Uint8Array(this.buffer);
        const pdf = await pdfjs.getDocument({
            data,
            useSystemFonts: true,
        }).promise;
        logger.info({ numPages: pdf.numPages }, "PDF loaded");

        // Extract metadata
        const pdfMetadata = await pdf.getMetadata();
        const info = pdfMetadata.info as Record<string, unknown> | undefined;

        const metadata: PdfMetadata = {
            title: (info?.Title as string) || "PDF Document",
            author: (info?.Author as string) || null,
            language: null,
            publisher: null,
            description: (info?.Subject as string) || null,
        };
        logger.debug(
            { title: metadata.title, author: metadata.author },
            "PDF metadata extracted"
        );

        // Extract outline (table of contents)
        const outline = await pdf.getOutline() as PdfOutlineItem[] | null;
        const numPages = pdf.numPages;

        let toc: TocItem[];
        let spine: SpineItem[];

        if (outline && outline.length > 0) {
            // Use PDF bookmarks as chapters
            logger.info({ outlineItems: outline.length }, "PDF outline extracted");
            toc = await this.buildTocFromOutline(outline, pdf);
            spine = toc.map((item, index) => ({
                id: item.id,
                href: item.href,
                order: index,
            }));
        } else {
            // Fallback: create chapter per page (max 50 pages to avoid too many chapters)
            const maxChapters = Math.min(numPages, 50);
            logger.info(
                { numPages, maxChapters },
                "PDF outline missing, falling back to per-page TOC"
            );
            toc = [];
            spine = [];

            for (let i = 1; i <= maxChapters; i++) {
                const id = `page-${i}`;
                toc.push({
                    id: `toc-${i}`,
                    title: `Страница ${i}`,
                    href: id,
                    order: i - 1,
                    children: [],
                });
                spine.push({
                    id,
                    href: id,
                    order: i - 1,
                });
            }

            if (numPages > maxChapters) {
                toc.push({
                    id: `toc-more`,
                    title: `...и ещё ${numPages - maxChapters} страниц`,
                    href: `page-${maxChapters}`,
                    order: maxChapters,
                    children: [],
                });
            }
        }

        logger.info(
            { tocItems: toc.length, spineItems: spine.length },
            "PDF TOC built"
        );
        return {
            metadata,
            toc,
            spine,
            coverBuffer: null,
            coverMimeType: null,
        };
    }

    private async buildTocFromOutline(
        outline: PdfOutlineItem[],
        pdf: pdfjs.PDFDocumentProxy,
        parentOrder = 0
    ): Promise<TocItem[]> {
        const toc: TocItem[] = [];

        for (let i = 0; i < outline.length; i++) {
            const item = outline[i];
            let pageNum = 1;

            // Resolve destination to page number
            if (item.dest) {
                try {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    let dest: any = item.dest;
                    if (typeof dest === "string") {
                        dest = await pdf.getDestination(dest);
                    }
                    if (Array.isArray(dest) && dest[0]) {
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        const pageIndex = await pdf.getPageIndex(dest[0] as any);
                        pageNum = pageIndex + 1;
                    }
                } catch {
                    logger.warn(
                        { title: item.title ?? null },
                        "Failed to resolve PDF outline destination"
                    );
                    // Keep default page 1
                }
            }

            const id = `outline-${parentOrder}-${i}`;
            const children = item.items
                ? await this.buildTocFromOutline(item.items, pdf, parentOrder + i + 1)
                : [];

            toc.push({
                id: `toc-${id}`,
                title: item.title || `Раздел ${i + 1}`,
                href: `page-${pageNum}`,
                order: parentOrder + i,
                children,
            });
        }

        return toc;
    }

    // PDF content is rendered by react-pdf, return marker with page number
    async getChapterContent(href: string): Promise<string> {
        // href is in format "page-N"
        const match = href.match(/page-(\d+)/);
        const page = match ? match[1] : "1";
        return `PDF_EMBED:${page}`;
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
    const match = chapterHref.match(/page-(\d+)/);
    const pageNum = match ? parseInt(match[1], 10) : 1;
    logger.debug({ chapterHref, pageNum }, "PDF chapter content requested");

    const data = new Uint8Array(buffer);
    const pdf = await pdfjs.getDocument({
        data,
        useSystemFonts: true,
    }).promise;

    // Ensure page number is valid
    const validPageNum = Math.max(1, Math.min(pageNum, pdf.numPages));
    if (validPageNum !== pageNum) {
        logger.warn(
            { pageNum, validPageNum, numPages: pdf.numPages },
            "PDF chapter page out of range, clamped"
        );
    }
    const page = await pdf.getPage(validPageNum);
    const textContent = await page.getTextContent();

    // Join text items with proper spacing and line breaks
    let text = "";
    let lastY: number | null = null;

    for (const item of textContent.items) {
        if (!("str" in item)) continue;
        const typedItem = item as { str: string; transform: number[] };
        const currentY = typedItem.transform[5]; // Y position

        if (lastY !== null && Math.abs(currentY - lastY) > 5) {
            // New line detected
            text += "\n";
        } else if (text.length > 0 && !text.endsWith(" ") && !text.endsWith("\n")) {
            text += " ";
        }

        text += typedItem.str;
        lastY = currentY;
    }

    // Return marker for rendering + actual text for copying
    // Format: PDF_EMBED:pageNum\n\n<actual text>
    const trimmedText = text.trim();
    logger.debug(
        { validPageNum, textLength: trimmedText.length },
        "PDF chapter content extracted"
    );
    return `PDF_EMBED:${validPageNum}\n\n${trimmedText}`;
}

