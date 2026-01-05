import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { writeFile, mkdir, readFile } from "fs/promises";
import path from "path";
import { parseEpubFile, TocItem } from "@/lib/parsers/epub-parser";
import { parseMarkdownFile } from "@/lib/parsers/markdown-parser";
import { parseYouTubeTranscript } from "@/lib/parsers/youtube-parser";
import { exec } from "child_process";
import { promisify } from "util";
import crypto from "crypto";

const execAsync = promisify(exec);

/**
 * Extract YouTube video ID from URL or return the ID if already extracted
 */
function extractYouTubeVideoId(input: string): string | null {
    // If it's already just an ID (11 characters, alphanumeric)
    if (/^[a-zA-Z0-9_-]{11}$/.test(input)) {
        return input;
    }

    // Match various YouTube URL formats
    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
        /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
        /youtube\.com\/v\/([a-zA-Z0-9_-]{11})/,
    ];

    for (const pattern of patterns) {
        const match = input.match(pattern);
        if (match) {
            return match[1];
        }
    }

    return null;
}

/**
 * Fetch YouTube video info using yt-dlp
 */
async function getYouTubeVideoInfo(videoId: string): Promise<{
    title: string;
    author: string | null;
    duration: number;
    thumbnail: string | null;
}> {
    try {
        const { stdout } = await execAsync(
            `uv run --with yt-dlp yt-dlp --dump-json --no-download --skip-download "${videoId}"`,
            {
                maxBuffer: 10 * 1024 * 1024,
            }
        );

        const data = JSON.parse(stdout);
        return {
            title: data.title || `YouTube Video: ${videoId}`,
            author: data.uploader || data.channel || null,
            duration: data.duration || 0,
            thumbnail: data.thumbnail || null,
        };
    } catch (error) {
        console.error("Error fetching YouTube video info:", error);
        // Fallback to basic info
        return {
            title: `YouTube Video: ${videoId}`,
            author: null,
            duration: 0,
            thumbnail: null,
        };
    }
}

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

/**
 * Handle adding a YouTube source
 */
async function handleYouTubeSource(youtubeUrl: string, userId: string) {
    // Extract video ID
    const videoId = extractYouTubeVideoId(youtubeUrl);
    if (!videoId) {
        return NextResponse.json(
            { error: "Invalid YouTube URL" },
            { status: 400 }
        );
    }

    // Check if this video is already added by this user
    const existing = await prisma.source.findFirst({
        where: { youtubeVideoId: videoId, userId },
    });

    if (existing) {
        return NextResponse.json(
            { error: "YouTube video already added", source: existing },
            { status: 409 }
        );
    }

    // Fetch transcript using youtube_transcript_api CLI via uv
    let transcript;
    try {
        const { stdout, stderr } = await execAsync(
            `uv run --with youtube-transcript-api youtube_transcript_api "${videoId}" --languages ru en --format json`,
            {
                maxBuffer: 10 * 1024 * 1024,
            }
        );

        // Check for error in stdout (CLI outputs errors as text)
        if (stdout.includes("Could not retrieve a transcript")) {
            return NextResponse.json(
                { error: "Не удалось получить транскрипт. Возможно, у видео нет субтитров на русском/английском языках, или YouTube блокирует запросы." },
                { status: 400 }
            );
        }

        // Parse JSON output - remove outer array wrapper [[...]] -> [...]
        const cleanedOutput = stdout.trim().replace(/^\[\[/, '[').replace(/\]\]$/, ']');
        transcript = JSON.parse(cleanedOutput);
    } catch (error) {
        console.error("Error fetching YouTube transcript:", error);
        const errorMessage = error instanceof Error ? error.message : "Unknown error";

        return NextResponse.json(
            { error: "Не удалось получить транскрипт YouTube видео: " + errorMessage },
            { status: 500 }
        );
    }

    // Get video info
    const videoInfo = await getYouTubeVideoInfo(videoId);

    // Parse transcript and create single chapter
    const parsed = parseYouTubeTranscript(
        videoId,
        videoInfo.title,
        transcript,
        "Auto", // Language name (we don't have this from CLI)
        "auto", // Language code
        true // Assume generated for now
    );

    // Download and save thumbnail if available
    let coverPath: string | null = null;
    if (videoInfo.thumbnail) {
        try {
            const thumbnailResponse = await fetch(videoInfo.thumbnail);
            if (thumbnailResponse.ok) {
                const thumbnailBuffer = Buffer.from(
                    await thumbnailResponse.arrayBuffer()
                );

                // Ensure uploads/sources directory exists
                const uploadsDir = path.join(process.cwd(), "uploads", "sources");
                await mkdir(uploadsDir, { recursive: true });

                const thumbnailFileName = `${videoId}-thumb.jpg`;
                const thumbnailPath = path.join(uploadsDir, thumbnailFileName);
                await writeFile(thumbnailPath, thumbnailBuffer);
                coverPath = `/uploads/sources/${thumbnailFileName}`;
            }
        } catch (error) {
            console.warn("Failed to download YouTube thumbnail:", error);
        }
    }

    // Calculate transcript "file size" based on actual transcript content
    const transcriptText = transcript.map((t: any) => t.text).join(' ');
    const transcriptSize = Buffer.byteLength(transcriptText, 'utf-8');

    // Create source record
    const source = await prisma.source.create({
        data: {
            title: parsed.metadata.title,
            author: videoInfo.author,
            coverPath,
            fileSize: transcriptSize,
            sourceType: "youtube",
            youtubeVideoId: videoId,
            userId,
        },
    });

    // Create chapters
    if (parsed.toc.length > 0) {
        await createChapters(source.id, parsed.toc, null);
    }

    // Store full transcript as JSON in a file
    const transcriptDir = path.join(process.cwd(), "uploads", "transcripts");
    await mkdir(transcriptDir, { recursive: true });

    const transcriptFileName = `${videoId}.json`;
    const transcriptFilePath = path.join(transcriptDir, transcriptFileName);
    await writeFile(
        transcriptFilePath,
        JSON.stringify(parsed.fullTranscript, null, 2)
    );

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
        const file = formData.get("file") as File | null;
        const youtubeUrl = formData.get("youtubeUrl") as string | null;

        // Handle YouTube URL
        if (youtubeUrl) {
            return await handleYouTubeSource(youtubeUrl, authResult.user.userId);
        }

        // Handle file upload
        if (!file) {
            return NextResponse.json(
                { error: "No file or YouTube URL provided" },
                { status: 400 }
            );
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
