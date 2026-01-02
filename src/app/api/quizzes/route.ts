import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { QuizSchema } from "@/lib/schemas/quiz";
import { ZodError } from "zod";
import { Prisma } from "@/generated/prisma/client";

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const chapterId = searchParams.get("chapterId");

        if (chapterId) {
            const quiz = await prisma.quiz.findUnique({
                where: { chapterId },
                select: {
                    id: true,
                    title: true,
                    chapterId: true,
                    createdAt: true,
                    updatedAt: true,
                },
            });

            return NextResponse.json(quiz);
        }

        const quizzes = await prisma.quiz.findMany({
            orderBy: { createdAt: "desc" },
            include: {
                chapter: {
                    include: {
                        book: true,
                    },
                },
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
        const bookId = formData.get("bookId")?.toString() || null;
        const chapterId = formData.get("chapterId")?.toString() || null;

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

        let resolvedChapterId: string | null = null;

        if (chapterId) {
            const chapter = await prisma.chapter.findUnique({
                where: { id: chapterId },
            });

            if (!chapter) {
                return NextResponse.json(
                    { error: "Chapter not found" },
                    { status: 404 }
                );
            }

            if (bookId && chapter.bookId !== bookId) {
                return NextResponse.json(
                    { error: "Chapter does not belong to selected book" },
                    { status: 400 }
                );
            }

            const existingQuiz = await prisma.quiz.findUnique({
                where: { chapterId: chapter.id },
            });

            if (existingQuiz) {
                return NextResponse.json(
                    { error: "Quiz already exists for this chapter" },
                    { status: 409 }
                );
            }

            resolvedChapterId = chapter.id;
        } else if (bookId) {
            return NextResponse.json(
                { error: "Chapter is required when book is selected" },
                { status: 400 }
            );
        }

        // Create quiz with questions and options
        const quiz = await prisma.quiz.create({
            data: {
                title: validatedData.title,
                chapterId: resolvedChapterId,
                questions: {
                    create: validatedData.questions.map((question, index) => ({
                        externalId: question.id,
                        text: question.text,
                        quote: question.quote ?? null,
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

        if (error instanceof Prisma.PrismaClientKnownRequestError) {
            if (error.code === "P2002") {
                return NextResponse.json(
                    { error: "Quiz already exists for this chapter" },
                    { status: 409 }
                );
            }
        }

        return NextResponse.json({ error: "Failed to create quiz" }, { status: 500 });
    }
}
