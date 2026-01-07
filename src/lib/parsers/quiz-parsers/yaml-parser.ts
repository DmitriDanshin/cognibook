import { parse as parseYaml } from "yaml";
import type { QuizParserStrategy } from "./types";

export const yamlQuizParser: QuizParserStrategy = {
    format: "yaml",
    extensions: [".yaml", ".yml"],
    parse: (content: string) => parseYaml(content),
};
