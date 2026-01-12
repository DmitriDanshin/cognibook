import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import path from "path";
import { getEpubChapterContent } from "@/lib/parsers/source-parsers/epub-parser";
import { getDocxChapterContent } from "@/lib/parsers/source-parsers/docx-parser";
import { getPdfChapterContent } from "@/lib/parsers/source-parsers/pdf-parser";
import { getMarkdownChapterContent } from "@/lib/parsers/source-parsers/markdown-parser";
import { getChapterContent as getYouTubeChapterContent } from "@/lib/parsers/source-parsers/youtube-parser";
import { cache } from "@/lib/cache";
import { storage } from "@/lib/storage";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; chapterId: string }> }
) {
    const authResult = await requireAuth(request);
    if ("error" in authResult) {
        return authResult.error;
    }

    try {
        const { id, chapterId } = await params;
        const cacheKey = `chapter:${id}:${chapterId}`;

        // Check chapter content cache first
        const cachedContent = cache.get(cacheKey) as string | undefined;
        if (cachedContent !== undefined) {
            // Get chapter title from DB (fast query)
            const chapter = await prisma.chapter.findUnique({
                where: { id: chapterId },
                select: { id: true, title: true, sourceId: true },
            });

            if (chapter && chapter.sourceId === id) {
                return NextResponse.json(
                    { id: chapter.id, title: chapter.title, content: cachedContent },
                    {
                        headers: {
                            "Cache-Control": "private, max-age=300",
                        },
                    }
                );
            }
        }

        // Get source and chapter
        const source = await prisma.source.findUnique({
            where: { id, userId: authResult.user.userId },
        });

        if (!source) {
            return NextResponse.json({ error: "Source not found" }, { status: 404 });
        }

        const chapter = await prisma.chapter.findUnique({
            where: { id: chapterId },
        });

        if (!chapter || chapter.sourceId !== id) {
            return NextResponse.json({ error: "Chapter not found" }, { status: 404 });
        }

        let content = "";

        // Handle YouTube sources
        if (source.sourceType === "youtube" && source.youtubeVideoId) {
            // Load transcript from JSON file
            const transcriptKey = `transcripts/${source.youtubeVideoId}.json`;

            try {
                const transcriptBuffer = await storage.read(transcriptKey);
                const transcript = JSON.parse(transcriptBuffer.toString("utf-8"));
                content = getYouTubeChapterContent(transcript, chapter.href);
            } catch (error) {
                console.error("Error loading YouTube transcript:", error);
                return NextResponse.json(
                    { error: "Failed to load YouTube transcript" },
                    { status: 500 }
                );
            }
        } else if (source.filePath) {
            // Handle file-based sources
            // Try to get cached source buffer, otherwise read from disk
            const bufferCacheKey = `buffer:${id}`;
            let sourceBuffer = cache.get(bufferCacheKey) as Buffer | undefined;
            if (!sourceBuffer) {
                const sourceKey = storage.resolveKeyFromPath(source.filePath);
                if (!sourceKey) {
                    return NextResponse.json(
                        { error: "Invalid source file path" },
                        { status: 500 }
                    );
                }
                sourceBuffer = await storage.read(sourceKey);
                cache.set(bufferCacheKey, sourceBuffer);
            }

            const fileExt = path.extname(source.filePath).toLowerCase();

            if (fileExt === ".epub") {
                content = await getEpubChapterContent(sourceBuffer, chapter.href, id);
            } else if (fileExt === ".docx") {
                content = await getDocxChapterContent(sourceBuffer, chapter.href);
            } else if (fileExt === ".pdf") {
                const parsePdfPage = (href: string): number => {
                    const match = href.match(/page-(\d+)/);
                    return match ? parseInt(match[1], 10) : 1;
                };

                const startPage = parsePdfPage(chapter.href);
                let endPage: number | undefined;

                try {
                    const chapters = await prisma.chapter.findMany({
                        where: { sourceId: id },
                        orderBy: { order: "asc" },
                        select: { id: true, href: true },
                    });
                    const currentIndex = chapters.findIndex((c) => c.id === chapterId);
                    if (currentIndex !== -1) {
                        for (let i = currentIndex + 1; i < chapters.length; i++) {
                            const nextPage = parsePdfPage(chapters[i].href);
                            if (nextPage > startPage) {
                                endPage = Math.max(startPage, nextPage - 1);
                                break;
                            }
                        }
                    }
                } catch (error) {
                    console.warn("Failed to compute PDF chapter range:", error);
                }

                content = await getPdfChapterContent(sourceBuffer, chapter.href, endPage);
            } else if (fileExt === ".md" || fileExt === ".markdown") {
                content = await getMarkdownChapterContent(sourceBuffer, chapter.href);
            } else {
                return NextResponse.json(
                    { error: "Unsupported source format" },
                    { status: 400 }
                );
            }
        } else {
            return NextResponse.json(
                { error: "Invalid source configuration" },
                { status: 500 }
            );
        }

        // Cache the chapter content
        cache.set(cacheKey, content);

        return NextResponse.json(
            { id: chapter.id, title: chapter.title, content },
            {
                headers: {
                    "Cache-Control": "private, max-age=300",
                },
            }
        );
    } catch (error) {
        console.error("Error fetching chapter content:", error);
        return NextResponse.json(
            { error: "Failed to fetch chapter content" },
            { status: 500 }
        );
    }
}
