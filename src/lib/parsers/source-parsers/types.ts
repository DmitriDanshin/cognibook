export interface SourceMetadata {
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

export interface ParsedSource<TMetadata extends SourceMetadata = SourceMetadata> {
    metadata: TMetadata;
    toc: TocItem[];
    spine: SpineItem[];
    coverBuffer: Buffer | null;
    coverMimeType: string | null;
}

export interface EpubMetadata extends SourceMetadata {
    coverHref: string | null;
}

export type EpubChapterContent = ChapterContent;

export type ParsedEpub = ParsedSource<EpubMetadata>;

export type MarkdownMetadata = SourceMetadata;

export type ParsedMarkdown = ParsedSource<MarkdownMetadata>;

export type DocxMetadata = SourceMetadata;

export type ParsedDocx = ParsedSource<DocxMetadata>;
