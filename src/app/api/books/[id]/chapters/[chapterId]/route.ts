import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { readFile } from "fs/promises";
import path from "path";
import { getEpubChapterContent } from "@/lib/epub-parser";

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

        // Read EPUB file
        const epubPath = path.join(process.cwd(), book.filePath);
        const epubBuffer = await readFile(epubPath);

        // Get chapter content
        const content = await getEpubChapterContent(epubBuffer, chapter.href, id);

        return NextResponse.json({
            id: chapter.id,
            title: chapter.title,
            content,
        });
    } catch (error) {
        console.error("Error fetching chapter content:", error);
        return NextResponse.json(
            { error: "Failed to fetch chapter content" },
            { status: 500 }
        );
    }
}
