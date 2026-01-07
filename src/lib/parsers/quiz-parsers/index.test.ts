import { ZodError } from "zod";
import { parseQuizContent, QuizParseError } from "@/lib/parsers/quiz-parsers/index";

const validQuiz = {
    title: "Sample Quiz",
    questions: [
        {
            id: "q1",
            text: "What is the answer?",
            type: "single",
            options: [
                { id: "opt1", text: "First", explanation: "Because" },
                { id: "opt2", text: "Second", explanation: "Also because" },
            ],
            correctAnswers: ["opt1"],
        },
    ],
};

const validYaml = `title: Sample Quiz
questions:
  - id: q1
    text: What is the answer?
    type: single
    options:
      - id: opt1
        text: First
        explanation: Because
      - id: opt2
        text: Second
        explanation: Also because
    correctAnswers:
      - opt1
`;

describe("parseQuizContent", () => {
    it("parses JSON content by extension", () => {
        const result = parseQuizContent({
            content: JSON.stringify(validQuiz),
            fileName: "quiz.json",
        });

        expect(result.title).toBe(validQuiz.title);
        expect(result.questions).toHaveLength(1);
        expect(result.questions[0].options).toHaveLength(2);
    });

    it("parses YAML content by extension", () => {
        const result = parseQuizContent({
            content: validYaml,
            fileName: "quiz.yaml",
        });

        expect(result.title).toBe(validQuiz.title);
        expect(result.questions[0].correctAnswers).toEqual(["opt1"]);
    });

    it("parses YAML content with .yml extension", () => {
        const result = parseQuizContent({
            content: validYaml,
            fileName: "quiz.yml",
        });

        expect(result.questions[0].id).toBe("q1");
    });

    it("parses JSON content without extension", () => {
        const result = parseQuizContent({
            content: JSON.stringify(validQuiz),
        });

        expect(result.title).toBe(validQuiz.title);
    });

    it("rejects unsupported extensions", () => {
        expect(() =>
            parseQuizContent({
                content: JSON.stringify(validQuiz),
                fileName: "quiz.txt",
            })
        ).toThrow(QuizParseError);

        try {
            parseQuizContent({
                content: JSON.stringify(validQuiz),
                fileName: "quiz.txt",
            });
        } catch (error) {
            expect(error).toBeInstanceOf(QuizParseError);
            expect((error as QuizParseError).code).toBe("unsupported_format");
        }
    });

    it("rejects invalid JSON for .json files", () => {
        expect(() =>
            parseQuizContent({
                content: "{",
                fileName: "quiz.json",
            })
        ).toThrow(QuizParseError);
    });

    it("surfaces schema errors as ZodError", () => {
        expect(() =>
            parseQuizContent({
                content: JSON.stringify({ questions: [] }),
                fileName: "quiz.json",
            })
        ).toThrow(ZodError);
    });
});
