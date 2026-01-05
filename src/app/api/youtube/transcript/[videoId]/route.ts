import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import { requireAuth } from "@/lib/auth";

const execAsync = promisify(exec);

interface TranscriptSnippet {
    text: string;
    start: number;
    duration: number;
}

interface TranscriptResponse {
    success: boolean;
    video_id?: string;
    language?: string;
    language_code?: string;
    is_generated?: boolean;
    transcript?: TranscriptSnippet[];
    error?: string;
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ videoId: string }> }
) {
    const authResult = await requireAuth(request);
    if ("error" in authResult) {
        return authResult.error;
    }

    const { videoId } = await params;

    // Get languages from query params
    const searchParams = request.nextUrl.searchParams;
    const languages = searchParams.get("languages") || "ru,en";

    try {
        // Use youtube_transcript_api CLI directly via uv
        const languageArgs = languages.split(',').join(' ');
        const { stdout, stderr } = await execAsync(
            `uv run --with youtube-transcript-api youtube_transcript_api "${videoId}" --languages ${languageArgs} --format json`,
            {
                maxBuffer: 10 * 1024 * 1024, // 10MB buffer for large transcripts
            }
        );

        if (stderr && !stderr.includes('Resolved')) {
            console.error("youtube_transcript_api stderr:", stderr);
        }

        // The CLI outputs Python list format, we need to parse it as JSON
        // Remove the outer array wrapper [[...]] -> [...]
        const cleanedOutput = stdout.trim().replace(/^\[\[/, '[').replace(/\]\]$/, ']');
        const transcript: TranscriptSnippet[] = JSON.parse(cleanedOutput);

        // Return formatted response
        return NextResponse.json({
            success: true,
            video_id: videoId,
            transcript: transcript,
        });
    } catch (error) {
        console.error("Error fetching YouTube transcript:", error);

        // Try to parse error output as JSON
        if (error instanceof Error && "stdout" in error) {
            try {
                const errorResult = JSON.parse((error as any).stdout);
                return NextResponse.json(
                    { error: errorResult.error || "Failed to fetch transcript" },
                    { status: 400 }
                );
            } catch {
                // Continue to generic error
            }
        }

        return NextResponse.json(
            {
                error:
                    error instanceof Error
                        ? error.message
                        : "Failed to fetch YouTube transcript",
            },
            { status: 500 }
        );
    }
}
