import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import path from "path";
import JSZip from "jszip";
import { IMAGE_MIME_BY_EXTENSION } from "@/lib/mime";
import { storage } from "@/lib/storage";

const MIME_TYPES = IMAGE_MIME_BY_EXTENSION;

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

        // Get source
        const source = await prisma.source.findUnique({
            where: { id, userId: authResult.user.userId },
        });

        if (!source) {
            return NextResponse.json({ error: "Source not found" }, { status: 404 });
        }

        // Check if source has a file
        if (!source.filePath) {
            return NextResponse.json({ error: "This source type does not support images" }, { status: 400 });
        }

        const storageKey = storage.resolveKeyFromPath(source.filePath);
        if (!storageKey) {
            return NextResponse.json({ error: "Invalid source file path" }, { status: 500 });
        }

        // Read EPUB file
        const epubBuffer = await storage.read(storageKey);

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
