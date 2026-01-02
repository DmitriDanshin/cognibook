import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { parseEpubFile, TocItem } from "@/lib/epub-parser";

async function createChapters(
    bookId: string,
    tocItems: TocItem[],
    parentId: string | null
): Promise<void> {
    for (const item of tocItems) {
        const chapter = await prisma.chapter.create({
            data: {
                bookId,
                title: item.title,
                href: item.href,
                order: item.order,
                parentId,
            },
        });

        if (item.children && item.children.length > 0) {
            await createChapters(bookId, item.children, chapter.id);
        }
    }
}

export async function GET() {
    try {
        const books = await prisma.book.findMany({
            orderBy: { createdAt: "desc" },
            include: {
                readingProgress: true,
                _count: {
                    select: { chapters: true },
                },
            },
        });

        return NextResponse.json(books);
    } catch (error) {
        console.error("Error fetching books:", error);
        return NextResponse.json(
            { error: "Failed to fetch books" },
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

        if (!file.name.endsWith(".epub")) {
            return NextResponse.json(
                { error: "Only EPUB files are supported" },
                { status: 400 }
            );
        }

        // Create uploads directory if it doesn't exist
        const uploadsDir = path.join(process.cwd(), "uploads", "books");
        await mkdir(uploadsDir, { recursive: true });

        // Generate unique filename
        const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        const fileName = `${uniqueId}.epub`;
        const filePath = path.join(uploadsDir, fileName);

        // Save file
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        await writeFile(filePath, buffer);

        // Parse EPUB
        let title = file.name.replace(".epub", "");
        let author: string | null = null;
        let coverPath: string | null = null;
        let tocItems: TocItem[] = [];

        try {
            const parsed = await parseEpubFile(buffer);
            title = parsed.metadata.title || title;
            author = parsed.metadata.author;
            tocItems = parsed.toc;

            // Save cover image if available
            if (parsed.coverBuffer && parsed.coverMimeType) {
                const coverExt = parsed.coverMimeType.split("/")[1] || "jpg";
                const coverFileName = `${uniqueId}-cover.${coverExt}`;
                const coverFilePath = path.join(uploadsDir, coverFileName);
                await writeFile(coverFilePath, parsed.coverBuffer);
                coverPath = `/uploads/books/${coverFileName}`;
            }
        } catch (parseError) {
            console.error("Error parsing EPUB:", parseError);
            // Continue with basic metadata from filename
        }

        // Create book record in database
        const book = await prisma.book.create({
            data: {
                title,
                author,
                coverPath,
                filePath: `/uploads/books/${fileName}`,
                fileSize: file.size,
            },
        });

        // Create chapter records from TOC
        if (tocItems.length > 0) {
            await createChapters(book.id, tocItems, null);
        }

        // Fetch book with chapters for response
        const bookWithChapters = await prisma.book.findUnique({
            where: { id: book.id },
            include: {
                chapters: {
                    orderBy: { order: "asc" },
                },
            },
        });

        return NextResponse.json(bookWithChapters, { status: 201 });
    } catch (error) {
        console.error("Error uploading book:", error);
        return NextResponse.json(
            { error: "Failed to upload book" },
            { status: 500 }
        );
    }
}
