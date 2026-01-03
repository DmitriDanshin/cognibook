import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { writeFile, mkdir, readFile } from "fs/promises";
import path from "path";
import { parseEpubFile, TocItem } from "@/lib/parsers/epub-parser";
import { parseMarkdownFile } from "@/lib/parsers/markdown-parser";
import crypto from "crypto";

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

export async function GET(request: NextRequest) {
    const authResult = await requireAuth(request);
    if ("error" in authResult) {
        return authResult.error;
    }

    try {
        const books = await prisma.book.findMany({
            where: { userId: authResult.user.userId },
            orderBy: { createdAt: "desc" },
            include: {
                readingProgress: {
                    where: { userId: authResult.user.userId },
                },
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
    const authResult = await requireAuth(request);
    if ("error" in authResult) {
        return authResult.error;
    }

    try {
        const formData = await request.formData();
        const file = formData.get("file") as File;

        if (!file) {
            return NextResponse.json({ error: "No file provided" }, { status: 400 });
        }

        const originalExt = path.extname(file.name);
        const fileExt = originalExt.toLowerCase();
        const allowedExtensions = new Set([".epub", ".md", ".markdown"]);

        if (!allowedExtensions.has(fileExt)) {
            return NextResponse.json(
                { error: "Only EPUB or Markdown files are supported" },
                { status: 400 }
            );
        }

        // Create uploads directory if it doesn't exist
        const uploadsDir = path.join(process.cwd(), "uploads", "books");
        await mkdir(uploadsDir, { recursive: true });

        // Generate unique filename
        const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        const fileName = `${uniqueId}${fileExt}`;
        const filePath = path.join(uploadsDir, fileName);

        // Save file
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        const fileHash = crypto.createHash("sha256").update(buffer).digest("hex");

        const existingByHash = await prisma.book.findFirst({
            where: { fileHash, userId: authResult.user.userId },
        });

        if (existingByHash) {
            return NextResponse.json(
                { error: "Book already uploaded", book: existingByHash },
                { status: 409 }
            );
        }

        const hashCandidates = await prisma.book.findMany({
            where: { fileHash: null, fileSize: file.size, userId: authResult.user.userId },
            select: { id: true, filePath: true, title: true, author: true },
        });

        for (const candidate of hashCandidates) {
            try {
                const candidatePath = path.join(process.cwd(), candidate.filePath);
                const candidateBuffer = await readFile(candidatePath);
                const candidateHash = crypto
                    .createHash("sha256")
                    .update(candidateBuffer)
                    .digest("hex");

                await prisma.book.update({
                    where: { id: candidate.id },
                    data: { fileHash: candidateHash },
                });

                if (candidateHash === fileHash) {
                    return NextResponse.json(
                        {
                            error: "Book already uploaded",
                            book: {
                                id: candidate.id,
                                title: candidate.title,
                                author: candidate.author,
                            },
                        },
                        { status: 409 }
                    );
                }
            } catch {
                // ignore missing or unreadable files
            }
        }

        await writeFile(filePath, buffer);

        // Parse EPUB
        let title = path.basename(file.name, originalExt);
        let author: string | null = null;
        let coverPath: string | null = null;
        let tocItems: TocItem[] = [];

        try {
            if (fileExt === ".epub") {
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
            } else {
                const parsed = await parseMarkdownFile(buffer);
                title = parsed.metadata.title || title;
                author = parsed.metadata.author;
                tocItems = parsed.toc;
            }
        } catch (parseError) {
            console.error("Error parsing book:", parseError);
            // Continue with basic metadata from filename
        }

        // Create book record in database
        const book = await prisma.book.create({
            data: {
                title,
                author,
                coverPath,
                filePath: `/uploads/books/${fileName}`,
                fileHash,
                fileSize: file.size,
                userId: authResult.user.userId,
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
