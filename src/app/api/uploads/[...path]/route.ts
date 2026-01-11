import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { UPLOAD_CONTENT_TYPES } from "@/lib/mime";
import { storage } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ path: string[] }> }
) {
    try {
        const { path: pathSegments } = await params;
        const storageKey = storage.resolveKeyFromPath(pathSegments.join("/"));
        if (!storageKey) {
            return NextResponse.json({ error: "Access denied" }, { status: 403 });
        }

        // Check if file exists
        if (!(await storage.exists(storageKey))) {
            return NextResponse.json({ error: "File not found" }, { status: 404 });
        }

        // Read file
        const fileBuffer = await storage.read(storageKey);

        // Determine content type
        const ext = path.extname(storageKey).toLowerCase();
        const contentType = UPLOAD_CONTENT_TYPES[ext] || "application/octet-stream";

        return new NextResponse(fileBuffer, {
            headers: {
                "Content-Type": contentType,
                "Cache-Control": "public, max-age=31536000",
            },
        });
    } catch (error) {
        console.error("Error serving file:", error);
        return NextResponse.json(
            { error: "Failed to serve file" },
            { status: 500 }
        );
    }
}
