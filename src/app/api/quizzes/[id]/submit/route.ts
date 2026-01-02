import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { z } from "zod";

const SubmitQuizSchema = z.object({
    answers: z.array(
        z.object({
            questionId: z.string(),
            selectedIds: z.array(z.string()),
        })
    ),
});

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const authResult = await requireAuth(request);
    if ("error" in authResult) {
        return authResult.error;
    }

    try {
        const { id } = await params;
        const body = await request.json();
        const { answers } = SubmitQuizSchema.parse(body);

        // Get quiz with questions
        const quiz = await prisma.quiz.findUnique({
            where: { id, userId: authResult.user.userId },
            include: {
                questions: true,
            },
        });

        if (!quiz) {
            return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
        }

        // Calculate score
        let correctCount = 0;
        const attemptAnswers = answers.map((answer) => {
            const question = quiz.questions.find((q: { id: string; correctAnswers: string }) => q.id === answer.questionId);
            if (!question) {
                return {
                    questionId: answer.questionId,
                    selectedIds: JSON.stringify(answer.selectedIds),
                    isCorrect: false,
                };
            }

            const correctAnswers = JSON.parse(question.correctAnswers) as string[];
            const isCorrect =
                correctAnswers.length === answer.selectedIds.length &&
                correctAnswers.every((ca) => answer.selectedIds.includes(ca));

            if (isCorrect) correctCount++;

            return {
                questionId: answer.questionId,
                selectedIds: JSON.stringify(answer.selectedIds),
                isCorrect,
            };
        });

        // Create attempt record
        const attempt = await prisma.quizAttempt.create({
            data: {
                quizId: id,
                userId: authResult.user.userId,
                score: correctCount,
                totalQuestions: quiz.questions.length,
                answers: {
                    create: attemptAnswers,
                },
            },
            include: {
                answers: true,
            },
        });

        return NextResponse.json(attempt, { status: 201 });
    } catch (error) {
        console.error("Error submitting quiz:", error);

        if (error instanceof z.ZodError) {
            return NextResponse.json(
                { error: "Invalid submission data", details: error.issues },
                { status: 400 }
            );
        }

        return NextResponse.json(
            { error: "Failed to submit quiz" },
            { status: 500 }
        );
    }
}
