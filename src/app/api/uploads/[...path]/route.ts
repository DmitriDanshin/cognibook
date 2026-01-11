import { NextRequest, NextResponse } from "next/server";
import { readFile, stat } from "fs/promises";
import path from "path";

export const dynamic = "force-dynamic";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ path: string[] }> }
) {
    try {
        const { path: pathSegments } = await params;
        const filePath = path.join(process.cwd(), "uploads", ...pathSegments);

        // Security check: ensure the path is within uploads directory
        const uploadsDir = path.join(process.cwd(), "uploads");
        const resolvedPath = path.resolve(filePath);

        if (!resolvedPath.startsWith(uploadsDir)) {
            return NextResponse.json({ error: "Access denied" }, { status: 403 });
        }

        // Check if file exists
        try {
            await stat(resolvedPath);
        } catch {
            return NextResponse.json({ error: "File not found" }, { status: 404 });
        }

        // Read file
        const fileBuffer = await readFile(resolvedPath);

        // Determine content type
        const ext = path.extname(resolvedPath).toLowerCase();
        const contentTypes: Record<string, string> = {
            ".epub": "application/epub+zip",
            ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".png": "image/png",
            ".gif": "image/gif",
            ".webp": "image/webp",
        };

        const contentType = contentTypes[ext] || "application/octet-stream";

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
