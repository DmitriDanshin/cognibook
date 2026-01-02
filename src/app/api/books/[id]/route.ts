import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { unlink } from "fs/promises";
import path from "path";

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
        const book = await prisma.book.findUnique({
            where: { id, userId: authResult.user.userId },
            include: {
                chapters: {
                    orderBy: { order: "asc" },
                },
                readingProgress: {
                    where: { userId: authResult.user.userId },
                },
            },
        });

        if (!book) {
            return NextResponse.json({ error: "Book not found" }, { status: 404 });
        }

        return NextResponse.json(book);
    } catch (error) {
        console.error("Error fetching book:", error);
        return NextResponse.json(
            { error: "Failed to fetch book" },
            { status: 500 }
        );
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const authResult = await requireAuth(request);
    if ("error" in authResult) {
        return authResult.error;
    }

    try {
        const { id } = await params;
        const book = await prisma.book.findUnique({
            where: { id, userId: authResult.user.userId },
        });

        if (!book) {
            return NextResponse.json({ error: "Book not found" }, { status: 404 });
        }

        // Delete file from filesystem
        if (book.filePath) {
            const fullPath = path.join(process.cwd(), book.filePath);
            try {
                await unlink(fullPath);
            } catch {
                // File may not exist, continue with database deletion
            }
        }

        // Delete from database (cascades to chapters and reading progress)
        await prisma.book.delete({
            where: { id },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error deleting book:", error);
        return NextResponse.json(
            { error: "Failed to delete book" },
            { status: 500 }
        );
    }
}
