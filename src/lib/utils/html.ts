/**
 * Escape HTML special characters to prevent XSS attacks.
 * Converts &, <, >, " to their HTML entity equivalents.
 */
export function escapeHtml(text: string): string {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}
