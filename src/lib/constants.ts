export const SOURCE_FILE_EXTENSIONS = [".epub", ".md", ".markdown", ".docx", ".pdf"] as const;

export const SOURCE_TYPE_LABELS: Record<string, string> = {
    youtube: "YouTube",
    web: "Сайт",
    epub: "EPUB",
    docx: "DOCX",
    pdf: "PDF",
    markdown: "Markdown",
    paste: "Markdown",
    md: "Markdown",
};

export const SOURCE_TYPE_BY_EXTENSION: Record<string, string> = {
    ".epub": "epub",
    ".docx": "docx",
    ".pdf": "pdf",
    ".md": "markdown",
    ".markdown": "markdown",
};

export const QUIZ_IMPORT_EXTENSIONS = [".json", ".yaml", ".yml"] as const;
