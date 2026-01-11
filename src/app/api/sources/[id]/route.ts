import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { unlink } from "fs/promises";
import path from "path";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const authResult = await requireAuth(request);
    if ("error" in authResult) {
        return authResult.error;
    }

    try {
        const { id } = await params;
        const source = await prisma.source.findUnique({
            where: { id, userId: authResult.user.userId },
            include: {
                chapters: {
                    orderBy: { order: "asc" },
                    include: {
                        quiz: {
                            include: {
                                attempts: {
                                    where: { userId: authResult.user.userId },
                                    orderBy: { score: "desc" },
                                },
                            },
                        },
                    },
                },
                readingProgress: {
                    where: { userId: authResult.user.userId },
                },
            },
        });

        if (!source) {
            return NextResponse.json({ error: "Source not found" }, { status: 404 });
        }

        // Calculate quiz status for each chapter
        type QuizStatus = "none" | "created" | "started" | "failed" | "perfect";

        const getQuizStatus = (quiz: typeof source.chapters[0]["quiz"]): QuizStatus => {
            if (!quiz) return "none";

            const attempts = quiz.attempts;
            if (!attempts || attempts.length === 0) return "created";

            // Get best attempt (already sorted by score desc)
            const bestAttempt = attempts[0];
            const scorePercent = bestAttempt.totalQuestions > 0
                ? (bestAttempt.score / bestAttempt.totalQuestions) * 100
                : 0;

            if (scorePercent === 100) return "perfect";
            if (scorePercent < 50) return "failed";
            return "started";
        };

        // Transform chapters to include quiz status
        const chaptersWithQuizStatus = source.chapters.map((chapter) => ({
            id: chapter.id,
            sourceId: chapter.sourceId,
            title: chapter.title,
            href: chapter.href,
            order: chapter.order,
            parentId: chapter.parentId,
            quizStatus: getQuizStatus(chapter.quiz),
        }));

        return NextResponse.json({
            ...source,
            chapters: chaptersWithQuizStatus,
        });
    } catch (error) {
        console.error("Error fetching source:", error);
        return NextResponse.json(
            { error: "Failed to fetch source" },
            { status: 500 }
        );
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const authResult = await requireAuth(request);
    if ("error" in authResult) {
        return authResult.error;
    }

    try {
        const { id } = await params;
        const source = await prisma.source.findUnique({
            where: { id, userId: authResult.user.userId },
        });

        if (!source) {
            return NextResponse.json({ error: "Source not found" }, { status: 404 });
        }

        // Delete file from filesystem
        if (source.filePath) {
            const fullPath = path.join(process.cwd(), source.filePath);
            try {
                await unlink(fullPath);
            } catch {
                // File may not exist, continue with database deletion
            }
        }

        // Delete from database (cascades to chapters and reading progress)
        await prisma.source.delete({
            where: { id },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error deleting source:", error);
        return NextResponse.json(
            { error: "Failed to delete source" },
            { status: 500 }
        );
    }
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const authResult = await requireAuth(request);
    if ("error" in authResult) {
        return authResult.error;
    }

    try {
        const { id } = await params;
        const body = await request.json().catch(() => null);
        const title = body?.title?.toString().trim();

        if (!title) {
            return NextResponse.json(
                { error: "Title is required" },
                { status: 400 }
            );
        }

        const source = await prisma.source.findFirst({
            where: { id, userId: authResult.user.userId },
        });

        if (!source) {
            return NextResponse.json({ error: "Source not found" }, { status: 404 });
        }

        const updated = await prisma.source.update({
            where: { id },
            data: { title },
        });

        return NextResponse.json(updated);
    } catch (error) {
        console.error("Error updating source:", error);
        return NextResponse.json(
            { error: "Failed to update source" },
            { status: 500 }
        );
    }
}
