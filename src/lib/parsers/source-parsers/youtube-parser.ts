import { TocItem } from "./types";
import { escapeHtml } from "../../utils/html";

interface TranscriptSnippet {
    text: string;
    start: number;
    duration: number;
}

interface YouTubeMetadata {
    videoId: string;
    title: string;
    language: string;
    languageCode: string;
    isGenerated: boolean;
}

interface ParsedYouTubeTranscript {
    metadata: YouTubeMetadata;
    toc: TocItem[];
    fullTranscript: TranscriptSnippet[];
}

/**
 * Format seconds into HH:MM:SS or MM:SS
 */
function formatTimestamp(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
    return `${minutes}:${secs.toString().padStart(2, "0")}`;
}

/**
 * Parse YouTube transcript - creates a single chapter with full transcript
 */
export function parseYouTubeTranscript(
    videoId: string,
    title: string,
    transcript: TranscriptSnippet[],
    language: string,
    languageCode: string,
    isGenerated: boolean
): ParsedYouTubeTranscript {
    const metadata: YouTubeMetadata = {
        videoId,
        title,
        language,
        languageCode,
        isGenerated,
    };

    // Create a single chapter for the full video
    const toc: TocItem[] = [
        {
            id: "chapter-0",
            title: title,
            href: "#full",
            order: 0,
            children: [],
        },
    ];

    return {
        metadata,
        toc,
        fullTranscript: transcript,
    };
}

/**
 * Get transcript content for a specific chapter
 * For YouTube videos, this always returns the full transcript
 */
export function getChapterContent(
    transcript: TranscriptSnippet[],
    chapterHref: string
): string {
    // For YouTube, always return full transcript
    return getFullTranscriptContent(transcript);
}

/**
 * Get full transcript content as HTML
 */
export function getFullTranscriptContent(transcript: TranscriptSnippet[]): string {
    let html = '<div class="youtube-transcript">\n';

    for (const snippet of transcript) {
        const timestamp = formatTimestamp(snippet.start);
        html += `  <p data-timestamp="${snippet.start}">`;
        html += `<span class="timestamp">[${timestamp}]</span> `;
        html += `${escapeHtml(snippet.text)}`;
        html += `</p>\n`;
    }

    html += "</div>";

    return html;
}
