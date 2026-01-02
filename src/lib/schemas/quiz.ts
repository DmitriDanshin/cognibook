import { z } from "zod";

export const OptionSchema = z.object({
    id: z.string(),
    text: z.string().min(1, "Текст ответа обязателен"),
    explanation: z
        .string()
        .min(1, "Пояснение (explanation) обязательно для каждого ответа"),
});

export const QuestionSchema = z.object({
    id: z.union([z.string(), z.number()]).transform((val) => String(val)),
    text: z.string().min(1, "Текст вопроса обязателен"),
    type: z.enum(["single", "multiple"]),
    options: z.array(OptionSchema).min(2, "Минимум 2 варианта ответа"),
    correctAnswers: z.array(z.string()).min(1, "Укажите правильные ответы (ID)"),
});

export const QuizSchema = z.object({
    title: z.string().min(1, "Название теста обязательно"),
    questions: z
        .array(QuestionSchema)
        .min(1, "Тест должен содержать хотя бы один вопрос"),
});

export type QuizInput = z.infer<typeof QuizSchema>;
export type QuestionInput = z.infer<typeof QuestionSchema>;
export type OptionInput = z.infer<typeof OptionSchema>;
