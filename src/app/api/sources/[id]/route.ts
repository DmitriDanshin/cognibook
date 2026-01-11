import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { storage } from "@/lib/storage";
import path from "path";

const isStorageReference = (value: string): boolean => {
    const trimmed = value.trim();
    if (!trimmed) return false;
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
        try {
            const { pathname } = new URL(trimmed);
            return (
                pathname.startsWith("/uploads/") ||
                pathname.startsWith("/api/uploads/")
            );
        } catch {
            return false;
        }
    }

    return (
        trimmed.startsWith("/uploads/") ||
        trimmed.startsWith("/api/uploads/") ||
        trimmed.startsWith("uploads/") ||
        trimmed.startsWith("api/uploads/")
    );
};

const extractLocalAssetKeys = (markdown: string): Set<string> => {
    const urls = new Set<string>();
    const markdownImageRegex = /!\[[^\]]*]\(([^)]+)\)/g;
    const htmlImageRegex = /<img[^>]+src=["']([^"']+)["']/gi;
    let match: RegExpExecArray | null;

    while ((match = markdownImageRegex.exec(markdown)) !== null) {
        urls.add(match[1].trim());
    }

    while ((match = htmlImageRegex.exec(markdown)) !== null) {
        urls.add(match[1].trim());
    }

    const keys = new Set<string>();
    for (const url of urls) {
        if (!isStorageReference(url)) continue;
        const key = storage.resolveKeyFromPath(url);
        if (key) {
            keys.add(key);
        }
    }

    return keys;
};

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

        const keysToDelete = new Set<string>();
        const fileExt = source.filePath
            ? path.extname(source.filePath).toLowerCase()
            : null;

        if (source.filePath) {
            const storageKey = storage.resolveKeyFromPath(source.filePath);
            if (storageKey) {
                keysToDelete.add(storageKey);
            }

            const isMarkdown =
                fileExt === ".md" ||
                fileExt === ".markdown" ||
                source.sourceType === "web" ||
                source.sourceType === "markdown" ||
                source.sourceType === "paste";

            if (isMarkdown && storageKey) {
                try {
                    const markdownBuffer = await storage.read(storageKey);
                    const markdown = markdownBuffer.toString("utf-8");
                    const assetKeys = extractLocalAssetKeys(markdown);
                    assetKeys.forEach((key) => keysToDelete.add(key));
                } catch {
                    // Ignore missing or unreadable markdown
                }
            }
        }

        if (source.coverPath) {
            const coverKey = storage.resolveKeyFromPath(source.coverPath);
            if (coverKey) {
                keysToDelete.add(coverKey);
            }
        }

        if (source.sourceType === "youtube" && source.youtubeVideoId) {
            keysToDelete.add(`transcripts/${source.youtubeVideoId}.json`);
        }

        for (const key of keysToDelete) {
            await storage.delete(key, { ignoreErrors: true });
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
