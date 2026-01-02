import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { QuizSchema } from "@/lib/schemas/quiz";
import { ZodError } from "zod";

export async function GET() {
    try {
        const quizzes = await prisma.quiz.findMany({
            orderBy: { createdAt: "desc" },
            include: {
                _count: {
                    select: { questions: true, attempts: true },
                },
                attempts: {
                    orderBy: { completedAt: "desc" },
                    take: 1,
                },
            },
        });

        return NextResponse.json(quizzes);
    } catch (error) {
        console.error("Error fetching quizzes:", error);
        return NextResponse.json(
            { error: "Failed to fetch quizzes" },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get("file") as File;

        if (!file) {
            return NextResponse.json({ error: "No file provided" }, { status: 400 });
        }

        if (!file.name.endsWith(".json")) {
            return NextResponse.json(
                { error: "Only JSON files are supported" },
                { status: 400 }
            );
        }

        // Read and parse JSON
        const text = await file.text();
        let jsonData: unknown;

        try {
            jsonData = JSON.parse(text);
        } catch {
            return NextResponse.json(
                { error: "Invalid JSON format" },
                { status: 400 }
            );
        }

        // Validate with Zod schema
        const validatedData = QuizSchema.parse(jsonData);

        // Create quiz with questions and options
        const quiz = await prisma.quiz.create({
            data: {
                title: validatedData.title,
                questions: {
                    create: validatedData.questions.map((question, index) => ({
                        externalId: question.id,
                        text: question.text,
                        type: question.type,
                        order: index,
                        correctAnswers: JSON.stringify(question.correctAnswers),
                        options: {
                            create: question.options.map((option, optIndex) => ({
                                externalId: option.id,
                                text: option.text,
                                explanation: option.explanation,
                                order: optIndex,
                            })),
                        },
                    })),
                },
            },
            include: {
                questions: {
                    include: {
                        options: true,
                    },
                },
            },
        });

        return NextResponse.json(quiz, { status: 201 });
    } catch (error) {
        console.error("Error creating quiz:", error);

        if (error instanceof ZodError) {
            const formattedErrors = error.issues.map((issue) => ({
                path: issue.path.map(String).join("."),
                message: issue.message,
            }));

            return NextResponse.json(
                {
                    error: "Validation failed",
                    details: formattedErrors,
                },
                { status: 400 }
            );
        }

        return NextResponse.json(
            { error: "Failed to create quiz" },
            { status: 500 }
        );
    }
}
