import type { ParsedBook } from "./types";

export abstract class BaseParser<TParsed extends ParsedBook = ParsedBook> {
    protected constructor(protected buffer: Buffer) {}

    abstract parse(): Promise<TParsed>;
    abstract getChapterContent(href: string, bookId?: string): Promise<string>;
}
