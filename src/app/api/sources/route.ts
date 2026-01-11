import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { writeFile, mkdir, readFile } from "fs/promises";
import path from "path";
import { parseEpubFile, TocItem } from "@/lib/parsers/source-parsers/epub-parser";
import { parseDocxFile } from "@/lib/parsers/source-parsers/docx-parser";
import { parseMarkdownFile } from "@/lib/parsers/source-parsers/markdown-parser";
import { parseYouTubeTranscript } from "@/lib/parsers/source-parsers/youtube-parser";
import { parseWebPageToMarkdown, type WebImage } from "@/lib/parsers/source-parsers/web-parser";
import { exec } from "child_process";
import { promisify } from "util";
import crypto from "crypto";
import { SOURCE_FILE_EXTENSIONS, SOURCE_TYPE_BY_EXTENSION } from "@/lib/constants";
import { IMAGE_EXTENSION_BY_MIME } from "@/lib/mime";

const execAsync = promisify(exec);

type TranscriptSnippet = {
    text: string;
    start: number;
    duration: number;
};

const IMAGE_CONTENT_TYPES: Record<string, string> = {
    ...IMAGE_EXTENSION_BY_MIME,
    "image/jpg": "jpg",
    "image/gif": "gif",
};

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_TOTAL_IMAGE_BYTES = 20 * 1024 * 1024;
const MAX_IMAGE_COUNT = 20;

const resolveImageExtension = (
    contentType: string | null,
    imageUrl: string
): string | null => {
    if (contentType) {
        const cleaned = contentType.split(";")[0]?.trim().toLowerCase();
        if (cleaned && IMAGE_CONTENT_TYPES[cleaned]) {
            return IMAGE_CONTENT_TYPES[cleaned];
        }
    }

    try {
        const url = new URL(imageUrl);
        const ext = path.extname(url.pathname).toLowerCase();
        if (ext && ext.length <= 5) {
            const trimmed = ext.replace(".", "");
            if (["jpg", "jpeg", "png", "gif", "webp"].includes(trimmed)) {
                return trimmed === "jpeg" ? "jpg" : trimmed;
            }
        }
    } catch {
        return null;
    }

    return null;
};

const rewriteMarkdownImages = (
    markdown: string,
    replacements: Map<string, string>
): string => {
    if (replacements.size === 0) return markdown;

    return markdown.replace(
        /!\[([^\]]*)\]\(([^)]+)\)/g,
        (match, alt, urlPart) => {
            const rawUrl = urlPart.trim();
            const replacement = replacements.get(rawUrl);
            if (!replacement) return match;
            return `![${alt}](${replacement})`;
        }
    );
};

const fetchImageBuffer = async (
    imageUrl: string
): Promise<{ buffer: Buffer; ext: string } | null> => {
    try {
        const response = await fetch(imageUrl, {
            redirect: "follow",
            cache: "no-store",
            headers: {
                "User-Agent": "Cognibook/1.0 (+https://cognibook)",
                Accept: "image/*",
            },
        });

        if (!response.ok) return null;

        const contentType = response.headers.get("content-type");
        const ext = resolveImageExtension(contentType, imageUrl);
        if (!ext) return null;

        const contentLength = response.headers.get("content-length");
        if (contentLength && Number(contentLength) > MAX_IMAGE_BYTES) {
            return null;
        }

        const buffer = Buffer.from(await response.arrayBuffer());
        if (buffer.length > MAX_IMAGE_BYTES) {
            return null;
        }

        return { buffer, ext };
    } catch (error) {
        console.warn("Failed to download image:", error);
        return null;
    }
};

const downloadWebImages = async (
    images: WebImage[],
    uploadsDir: string,
    prefix: string
): Promise<Map<string, string>> => {
    const replacements = new Map<string, string>();
    const seen = new Set<string>();
    let totalBytes = 0;
    let downloaded = 0;

    for (const image of images) {
        if (downloaded >= MAX_IMAGE_COUNT) break;
        if (!image.url || seen.has(image.url)) continue;
        seen.add(image.url);

        const result = await fetchImageBuffer(image.url);
        if (!result) continue;

        if (totalBytes + result.buffer.length > MAX_TOTAL_IMAGE_BYTES) {
            break;
        }

        const fileName = `${prefix}-${downloaded + 1}.${result.ext}`;
        const filePath = path.join(uploadsDir, fileName);
        await writeFile(filePath, result.buffer);

        replacements.set(image.url, `/api/uploads/sources/${fileName}`);
        totalBytes += result.buffer.length;
        downloaded += 1;
    }

    return replacements;
};

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
    let transcript: TranscriptSnippet[] = [];
    try {
        const { stdout } = await execAsync(
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
        transcript = JSON.parse(cleanedOutput) as TranscriptSnippet[];
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
    const transcriptText = transcript.map((t) => t.text).join(" ");
    const transcriptSize = Buffer.byteLength(transcriptText, "utf-8");

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

/**
 * Handle adding a web page source
 */
async function handleWebSource(webUrl: string, userId: string) {
    let parsedUrl: URL;
    try {
        parsedUrl = new URL(webUrl);
    } catch {
        return NextResponse.json(
            { error: "Некорректный URL" },
            { status: 400 }
        );
    }

    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
        return NextResponse.json(
            { error: "Поддерживаются только HTTP/HTTPS ссылки" },
            { status: 400 }
        );
    }

    let html = "";
    try {
        const response = await fetch(parsedUrl.toString(), {
            redirect: "follow",
            cache: "no-store",
            headers: {
                "User-Agent": "Cognibook/1.0 (+https://cognibook)",
                Accept: "text/html,application/xhtml+xml,text/plain;q=0.9",
            },
        });

        if (!response.ok) {
            return NextResponse.json(
                { error: "Не удалось загрузить страницу" },
                { status: 400 }
            );
        }

        const contentType = response.headers.get("content-type") || "";
        if (
            contentType &&
            !contentType.includes("text/html") &&
            !contentType.includes("text/plain") &&
            !contentType.includes("application/xhtml+xml")
        ) {
            return NextResponse.json(
                { error: "Неподдерживаемый формат страницы" },
                { status: 400 }
            );
        }

        html = await response.text();
    } catch (error) {
        console.error("Error fetching web page:", error);
        return NextResponse.json(
            { error: "Не удалось загрузить страницу" },
            { status: 500 }
        );
    }

    if (!html.trim()) {
        return NextResponse.json(
            { error: "Страница не содержит текста" },
            { status: 400 }
        );
    }

    const maxHtmlChars = 2_000_000;
    if (html.length > maxHtmlChars) {
        return NextResponse.json(
            { error: "Страница слишком большая для обработки" },
            { status: 413 }
        );
    }

    const parsed = parseWebPageToMarkdown(html, {
        baseUrl: parsedUrl.toString(),
        fallbackTitle: parsedUrl.hostname,
    });
    if (!parsed.markdown.trim()) {
        return NextResponse.json(
            { error: "Не удалось извлечь текст со страницы" },
            { status: 400 }
        );
    }

    const fileHash = crypto
        .createHash("sha256")
        .update(parsed.markdown, "utf-8")
        .digest("hex");

    const existingByHash = await prisma.source.findFirst({
        where: { fileHash, userId },
    });

    if (existingByHash) {
        return NextResponse.json(
            { error: "Страница уже добавлена", source: existingByHash },
            { status: 409 }
        );
    }

    const uploadsDir = path.join(process.cwd(), "uploads", "sources");
    await mkdir(uploadsDir, { recursive: true });

    const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    let coverPath: string | null = null;

    if (parsed.coverUrl) {
        const coverResult = await fetchImageBuffer(parsed.coverUrl);
        if (coverResult) {
            const coverFileName = `${uniqueId}-cover.${coverResult.ext}`;
            const coverFilePath = path.join(uploadsDir, coverFileName);
            await writeFile(coverFilePath, coverResult.buffer);
            coverPath = `/uploads/sources/${coverFileName}`;
        }
    }

    let markdown = parsed.markdown;
    if (parsed.images.length > 0) {
        const replacements = await downloadWebImages(
            parsed.images,
            uploadsDir,
            `${uniqueId}-img`
        );
        markdown = rewriteMarkdownImages(markdown, replacements);
    }

    const markdownBuffer = Buffer.from(markdown, "utf-8");
    const fileName = `${uniqueId}.md`;
    const filePath = path.join(uploadsDir, fileName);
    await writeFile(filePath, markdownBuffer);

    let title = parsed.title || parsedUrl.hostname || "Web page";
    let author = parsed.author;
    let tocItems: TocItem[] = [];

    try {
        const parsedMarkdown = await parseMarkdownFile(markdownBuffer);
        if (parsedMarkdown.metadata.title && parsedMarkdown.metadata.title !== "Untitled") {
            title = parsedMarkdown.metadata.title;
        }
        if (parsedMarkdown.metadata.author) {
            author = parsedMarkdown.metadata.author;
        }
        tocItems = parsedMarkdown.toc;
    } catch (error) {
        console.warn("Failed to parse extracted markdown:", error);
    }

    const source = await prisma.source.create({
        data: {
            title,
            author,
            coverPath,
            filePath: `/uploads/sources/${fileName}`,
            fileHash,
            fileSize: markdownBuffer.length,
            sourceType: "web",
            userId,
        },
    });

    if (tocItems.length > 0) {
        await createChapters(source.id, tocItems, null);
    }

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

/**
 * Handle adding a pasted text source
 */
async function handlePasteSource(content: string, title: string, userId: string) {
    if (!content.trim()) {
        return NextResponse.json(
            { error: "Текст не может быть пустым" },
            { status: 400 }
        );
    }

    // Create markdown content with frontmatter
    const timestamp = new Date().toISOString();
    const markdownContent = `---
title: "${title.replace(/"/g, '\\"')}"
created: ${timestamp}
---

${content}`;

    const markdownBuffer = Buffer.from(markdownContent, "utf-8");

    // Calculate hash for duplicate detection
    const fileHash = crypto
        .createHash("sha256")
        .update(markdownBuffer)
        .digest("hex");

    // Check for duplicate by hash
    const existingByHash = await prisma.source.findFirst({
        where: { fileHash, userId },
    });

    if (existingByHash) {
        return NextResponse.json(
            { error: "Такой текст уже добавлен", source: existingByHash },
            { status: 409 }
        );
    }

    // Create directory and save file
    const uploadsDir = path.join(process.cwd(), "uploads", "sources");
    await mkdir(uploadsDir, { recursive: true });

    const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const fileName = `${uniqueId}.md`;
    const filePath = path.join(uploadsDir, fileName);
    await writeFile(filePath, markdownBuffer);

    // Parse markdown to extract ToC
    let parsedTitle = title;
    let author: string | null = null;
    let tocItems: TocItem[] = [];

    try {
        const parsed = await parseMarkdownFile(markdownBuffer);
        if (parsed.metadata.title && parsed.metadata.title !== "Untitled") {
            parsedTitle = parsed.metadata.title;
        }
        author = parsed.metadata.author;
        tocItems = parsed.toc;
    } catch (error) {
        console.warn("Failed to parse pasted markdown:", error);
    }

    // Create database record
    const source = await prisma.source.create({
        data: {
            title: parsedTitle,
            author,
            coverPath: null,
            filePath: `/uploads/sources/${fileName}`,
            fileHash,
            fileSize: markdownBuffer.length,
            sourceType: "markdown",
            userId,
        },
    });

    // Create chapters from ToC
    if (tocItems.length > 0) {
        await createChapters(source.id, tocItems, null);
    }

    // Return source with chapters
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
        const webUrl = formData.get("webUrl") as string | null;

        // Handle YouTube URL
        if (youtubeUrl) {
            return await handleYouTubeSource(youtubeUrl, authResult.user.userId);
        }

        if (webUrl) {
            return await handleWebSource(webUrl, authResult.user.userId);
        }

        // Handle pasted text
        const pasteContent = formData.get("pasteContent") as string | null;
        const pasteTitle = formData.get("pasteTitle") as string | null;

        if (pasteContent) {
            return await handlePasteSource(
                pasteContent,
                pasteTitle || "Вставленный текст",
                authResult.user.userId
            );
        }

        // Handle file upload
        if (!file) {
            return NextResponse.json(
                { error: "No file or URL provided" },
                { status: 400 }
            );
        }

        const originalExt = path.extname(file.name);
        const fileExt = originalExt.toLowerCase();
        const allowedExtensions = new Set<string>(SOURCE_FILE_EXTENSIONS);
        const sourceType = SOURCE_TYPE_BY_EXTENSION[fileExt] ?? "markdown";

        if (!allowedExtensions.has(fileExt)) {
            return NextResponse.json(
                { error: "Only EPUB, Markdown, or Word files are supported" },
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
            where: {
                fileHash: null,
                fileSize: file.size,
                userId: authResult.user.userId,
                filePath: { not: null }
            },
            select: { id: true, filePath: true, title: true, author: true },
        });

        for (const candidate of hashCandidates) {
            try {
                // filePath is guaranteed to be non-null due to the query filter
                const candidatePath = path.join(process.cwd(), candidate.filePath!);
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
            } else if (fileExt === ".docx") {
                const parsed = await parseDocxFile(buffer);
                title = parsed.metadata.title || title;
                author = parsed.metadata.author;
                tocItems = parsed.toc;
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
                sourceType,
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
