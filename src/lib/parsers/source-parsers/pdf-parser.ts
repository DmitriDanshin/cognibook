import { BaseParser } from "./base-parser";
import type { TocItem, SpineItem, SourceMetadata, ParsedSource } from "./types";

export type PdfMetadata = SourceMetadata;
export type ParsedPdf = ParsedSource<PdfMetadata>;

/**
 * PDF Parser - Simple implementation that treats PDF as a single document
 * No actual parsing is done; PDF is displayed as-is via iframe
 */
export class PdfParser extends BaseParser<ParsedPdf> {
    constructor(buffer: Buffer) {
        super(buffer);
    }

    async parse(): Promise<ParsedPdf> {
        // PDF files are displayed directly in iframe, no parsing needed
        // Create a single chapter representing the entire document
        const toc: TocItem[] = [
            {
                id: "toc-0",
                title: "Документ",
                href: "content",
                order: 0,
                children: [],
            },
        ];

        const spine: SpineItem[] = [
            {
                id: "content",
                href: "content",
                order: 0,
            },
        ];

        const metadata: PdfMetadata = {
            title: "PDF Document",
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

    // PDF doesn't have chapters; content is the whole document
    async getChapterContent(_href: string): Promise<string> {
        return "PDF_EMBED";
    }
}

export async function parsePdfFile(buffer: Buffer): Promise<ParsedPdf> {
    const parser = new PdfParser(buffer);
    return parser.parse();
}

export async function getPdfChapterContent(
    _buffer: Buffer,
    _chapterHref: string
): Promise<string> {
    // Returns special marker indicating PDF should be embedded
    return "PDF_EMBED";
}
