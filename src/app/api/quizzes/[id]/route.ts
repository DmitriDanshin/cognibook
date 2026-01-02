import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const quiz = await prisma.quiz.findUnique({
            where: { id },
            include: {
                questions: {
                    orderBy: { order: "asc" },
                    include: {
                        options: {
                            orderBy: { order: "asc" },
                        },
                    },
                },
                chapter: {
                    include: {
                        book: true,
                    },
                },
                attempts: {
                    orderBy: { completedAt: "desc" },
                },
            },
        });

        if (!quiz) {
            return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
        }

        return NextResponse.json(quiz);
    } catch (error) {
        console.error("Error fetching quiz:", error);
        return NextResponse.json(
            { error: "Failed to fetch quiz" },
            { status: 500 }
        );
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        const quiz = await prisma.quiz.findUnique({
            where: { id },
        });

        if (!quiz) {
            return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
        }

        await prisma.quiz.delete({
            where: { id },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error deleting quiz:", error);
        return NextResponse.json(
            { error: "Failed to delete quiz" },
            { status: 500 }
        );
    }
}
