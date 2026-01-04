import type { ParsedSource } from "./types";

export abstract class BaseParser<TParsed extends ParsedSource = ParsedSource> {
    protected constructor(protected buffer: Buffer) {}

    abstract parse(): Promise<TParsed>;
    abstract getChapterContent(href: string, sourceId?: string): Promise<string>;
}
