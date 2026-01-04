import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { writeFile, mkdir, readFile } from "fs/promises";
import path from "path";
import { parseEpubFile, TocItem } from "@/lib/parsers/epub-parser";
import { parseMarkdownFile } from "@/lib/parsers/markdown-parser";
import crypto from "crypto";

async function createChapters(
    sourceId: string,
    tocItems: TocItem[],
    parentId: string | null
): Promise<void> {
    for (const item of tocItems) {
        const chapter = await prisma.chapter.create({
            data: {
                sourceId,
                title: item.title,
                href: item.href,
                order: item.order,
                parentId,
            },
        });

        if (item.children && item.children.length > 0) {
            await createChapters(sourceId, item.children, chapter.id);
        }
    }
}

export async function GET(request: NextRequest) {
    const authResult = await requireAuth(request);
    if ("error" in authResult) {
        return authResult.error;
    }

    try {
        const sources = await prisma.source.findMany({
            where: { userId: authResult.user.userId },
            include: {
                readingProgress: {
                    where: { userId: authResult.user.userId },
                },
                _count: {
                    select: { chapters: true },
                },
            },
        });

        // Sort by last access time (readingProgress.updatedAt), fallback to createdAt
        sources.sort((a, b) => {
            const aTime = a.readingProgress[0]?.updatedAt ?? a.createdAt;
            const bTime = b.readingProgress[0]?.updatedAt ?? b.createdAt;
            return new Date(bTime).getTime() - new Date(aTime).getTime();
        });

        return NextResponse.json(sources);
    } catch (error) {
        console.error("Error fetching sources:", error);
        return NextResponse.json(
            { error: "Failed to fetch sources" },
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
        const uploadsDir = path.join(process.cwd(), "uploads", "sources");
        await mkdir(uploadsDir, { recursive: true });

        // Generate unique filename
        const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        const fileName = `${uniqueId}${fileExt}`;
        const filePath = path.join(uploadsDir, fileName);

        // Save file
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        const fileHash = crypto.createHash("sha256").update(buffer).digest("hex");

        const existingByHash = await prisma.source.findFirst({
            where: { fileHash, userId: authResult.user.userId },
        });

        if (existingByHash) {
            return NextResponse.json(
                { error: "Source already uploaded", source: existingByHash },
                { status: 409 }
            );
        }

        const hashCandidates = await prisma.source.findMany({
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

                await prisma.source.update({
                    where: { id: candidate.id },
                    data: { fileHash: candidateHash },
                });

                if (candidateHash === fileHash) {
                    return NextResponse.json(
                        {
                            error: "Source already uploaded",
                            source: {
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

        // Parse file
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
                    coverPath = `/uploads/sources/${coverFileName}`;
                }
            } else {
                const parsed = await parseMarkdownFile(buffer);
                title = parsed.metadata.title || title;
                author = parsed.metadata.author;
                tocItems = parsed.toc;
            }
        } catch (parseError) {
            console.error("Error parsing source:", parseError);
            // Continue with basic metadata from filename
        }

        // Create source record in database
        const source = await prisma.source.create({
            data: {
                title,
                author,
                coverPath,
                filePath: `/uploads/sources/${fileName}`,
                fileHash,
                fileSize: file.size,
                userId: authResult.user.userId,
            },
        });

        // Create chapter records from TOC
        if (tocItems.length > 0) {
            await createChapters(source.id, tocItems, null);
        }

        // Fetch source with chapters for response
        const sourceWithChapters = await prisma.source.findUnique({
            where: { id: source.id },
            include: {
                chapters: {
                    orderBy: { order: "asc" },
                },
            },
        });

        return NextResponse.json(sourceWithChapters, { status: 201 });
    } catch (error) {
        console.error("Error uploading source:", error);
        return NextResponse.json(
            { error: "Failed to upload source" },
            { status: 500 }
        );
    }
}
