export interface BookMetadata {
    title: string;
    author: string | null;
    language: string | null;
    publisher: string | null;
    description: string | null;
}

export interface TocItem {
    id: string;
    title: string;
    href: string;
    order: number;
    children: TocItem[];
}

export interface SpineItem {
    id: string;
    href: string;
    order: number;
}

export interface ChapterContent {
    href: string;
    html: string;
}

export interface ParsedBook<TMetadata extends BookMetadata = BookMetadata> {
    metadata: TMetadata;
    toc: TocItem[];
    spine: SpineItem[];
    coverBuffer: Buffer | null;
    coverMimeType: string | null;
}

export interface EpubMetadata extends BookMetadata {
    coverHref: string | null;
}

export interface EpubChapterContent extends ChapterContent {}

export interface ParsedEpub extends ParsedBook<EpubMetadata> {}

export type MarkdownMetadata = BookMetadata;

export interface ParsedMarkdown extends ParsedBook<MarkdownMetadata> {}
