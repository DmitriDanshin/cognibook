import type { QuizParserStrategy } from "./types";

export const jsonQuizParser: QuizParserStrategy = {
    format: "json",
    extensions: [".json"],
    parse: (content: string) => JSON.parse(content),
};
