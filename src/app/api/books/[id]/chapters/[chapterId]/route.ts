import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { readFile } from "fs/promises";
import path from "path";
import { getEpubChapterContent } from "@/lib/parsers/epub-parser";
import { getMarkdownChapterContent } from "@/lib/parsers/markdown-parser";
import { cache } from "@/lib/cache";

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
                select: { id: true, title: true, bookId: true },
            });

            if (chapter && chapter.bookId === id) {
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

        // Get book and chapter
        const book = await prisma.book.findUnique({
            where: { id, userId: authResult.user.userId },
        });

        if (!book) {
            return NextResponse.json({ error: "Book not found" }, { status: 404 });
        }

        const chapter = await prisma.chapter.findUnique({
            where: { id: chapterId },
        });

        if (!chapter || chapter.bookId !== id) {
            return NextResponse.json({ error: "Chapter not found" }, { status: 404 });
        }

        // Try to get cached book buffer, otherwise read from disk
        const bufferCacheKey = `buffer:${id}`;
        let bookBuffer = cache.get(bufferCacheKey) as Buffer | undefined;
        if (!bookBuffer) {
            const bookPath = path.join(process.cwd(), book.filePath);
            bookBuffer = await readFile(bookPath);
            cache.set(bufferCacheKey, bookBuffer);
        }

        const fileExt = path.extname(book.filePath).toLowerCase();
        let content = "";

        if (fileExt === ".epub") {
            content = await getEpubChapterContent(bookBuffer, chapter.href, id);
        } else if (fileExt === ".md" || fileExt === ".markdown") {
            content = await getMarkdownChapterContent(bookBuffer, chapter.href);
        } else {
            return NextResponse.json(
                { error: "Unsupported book format" },
                { status: 400 }
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
