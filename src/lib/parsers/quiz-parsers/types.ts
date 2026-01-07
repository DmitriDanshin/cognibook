export type QuizParseErrorCode = "unsupported_format" | "invalid_format";

export interface QuizParseInput {
    content: string;
    fileName?: string | null;
    contentType?: string | null;
}

export interface QuizParserStrategy {
    format: string;
    extensions: string[];
    parse: (content: string) => unknown;
}

export class QuizParseError extends Error {
    readonly code: QuizParseErrorCode;
    readonly format?: string;

    constructor(message: string, code: QuizParseErrorCode, format?: string) {
        super(message);
        this.code = code;
        this.format = format;
        this.name = "QuizParseError";
    }
}
