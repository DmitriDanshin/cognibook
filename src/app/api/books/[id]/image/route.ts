import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { readFile } from "fs/promises";
import path from "path";
import JSZip from "jszip";

const MIME_TYPES: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
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
        const { searchParams } = new URL(request.url);
        const imagePath = searchParams.get("path");

        if (!imagePath) {
            return NextResponse.json({ error: "Image path required" }, { status: 400 });
        }

        // Get book
        const book = await prisma.book.findUnique({
            where: { id, userId: authResult.user.userId },
        });

        if (!book) {
            return NextResponse.json({ error: "Book not found" }, { status: 404 });
        }

        // Read EPUB file
        const epubPath = path.join(process.cwd(), book.filePath);
        const epubBuffer = await readFile(epubPath);

        // Open EPUB as ZIP
        const zip = await JSZip.loadAsync(epubBuffer);

        // Find and extract image
        const imageFile = zip.file(imagePath);
        if (!imageFile) {
            return NextResponse.json({ error: "Image not found" }, { status: 404 });
        }

        const imageBuffer = await imageFile.async("arraybuffer");
        const ext = path.extname(imagePath).toLowerCase();
        const mimeType = MIME_TYPES[ext] || "application/octet-stream";

        return new NextResponse(imageBuffer, {
            headers: {
                "Content-Type": mimeType,
                "Cache-Control": "public, max-age=31536000, immutable",
            },
        });
    } catch (error) {
        console.error("Error fetching image:", error);
        return NextResponse.json(
            { error: "Failed to fetch image" },
            { status: 500 }
        );
    }
}
