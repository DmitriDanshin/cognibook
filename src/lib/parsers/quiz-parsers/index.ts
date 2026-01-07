import path from "node:path";
import { ZodError } from "zod";
import { QuizSchema, type QuizInput } from "@/lib/schemas/quiz";
import { jsonQuizParser } from "./json-parser";
import { yamlQuizParser } from "./yaml-parser";
import {
    QuizParseError,
    type QuizParseInput,
    type QuizParserStrategy,
} from "./types";

const quizParsers: QuizParserStrategy[] = [jsonQuizParser, yamlQuizParser];

const supportedExtensions = Array.from(
    new Set(quizParsers.flatMap((parser) => parser.extensions))
);

function normalizeExtension(fileName?: string | null): string | null {
    if (!fileName) {
        return null;
    }
    const trimmed = fileName.trim();
    if (!trimmed) {
        return null;
    }
    const extension = path.extname(trimmed).toLowerCase();
    return extension || null;
}

function findParserByExtension(
    extension: string | null
): QuizParserStrategy | undefined {
    if (!extension) {
        return undefined;
    }
    return quizParsers.find((parser) => parser.extensions.includes(extension));
}

function formatSupportedExtensions(): string {
    return supportedExtensions.join(", ");
}

export function parseQuizContent(input: QuizParseInput): QuizInput {
    const extension = normalizeExtension(input.fileName);
    const parser = findParserByExtension(extension);

    if (extension && !parser) {
        throw new QuizParseError(
            `Unsupported quiz file format "${extension}". Supported: ${formatSupportedExtensions()}`,
            "unsupported_format"
        );
    }

    const candidates = parser ? [parser] : quizParsers;
    for (const candidate of candidates) {
        try {
            const raw = candidate.parse(input.content);
            return QuizSchema.parse(raw);
        } catch (error) {
            if (error instanceof ZodError) {
                throw error;
            }
            if (parser) {
                throw new QuizParseError(
                    `Invalid ${candidate.format.toUpperCase()} format`,
                    "invalid_format",
                    candidate.format
                );
            }
        }
    }

    const formats = quizParsers
        .map((candidate) => candidate.format.toUpperCase())
        .join(" or ");
    throw new QuizParseError(
        `Invalid ${formats} format`,
        "invalid_format"
    );
}

export { QuizParseError } from "./types";
export type { QuizParseInput, QuizParserStrategy } from "./types";
