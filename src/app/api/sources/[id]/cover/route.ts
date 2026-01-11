import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { IMAGE_EXTENSION_BY_MIME } from "@/lib/mime";
import { storage } from "@/lib/storage";

const ALLOWED_TYPES = IMAGE_EXTENSION_BY_MIME;

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const authResult = await requireAuth(request);
    if ("error" in authResult) {
        return authResult.error;
    }

    try {
        const { id } = await params;
        const formData = await request.formData();
        const file = formData.get("file");
        if (!(file instanceof File)) {
            return NextResponse.json({ error: "File required" }, { status: 400 });
        }

        const ext = ALLOWED_TYPES[file.type];
        if (!ext) {
            return NextResponse.json(
                { error: "Unsupported image type" },
                { status: 400 }
            );
        }

        const source = await prisma.source.findUnique({
            where: { id, userId: authResult.user.userId },
        });

        if (!source) {
            return NextResponse.json({ error: "Source not found" }, { status: 404 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const fileName = `${id}-cover-${Date.now()}.${ext}`;
        const storageKey = `sources/${fileName}`;
        await storage.save(storageKey, buffer);

        const previousKey = storage.resolveKeyFromPath(source.coverPath);
        if (previousKey) {
            await storage.delete(previousKey, { ignoreErrors: true });
        }

        const coverPath = storage.getPublicPath(storageKey);
        await prisma.source.update({
            where: { id },
            data: { coverPath },
        });

        return NextResponse.json({ coverPath });
    } catch (error) {
        console.error("Error updating cover:", error);
        return NextResponse.json(
            { error: "Failed to update cover" },
            { status: 500 }
        );
    }
}
