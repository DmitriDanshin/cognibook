import { DOMParser } from "xmldom";

export interface WebImage {
    alt: string;
    url: string;
}

export interface WebParseResult {
    markdown: string;
    title: string | null;
    author: string | null;
    description: string | null;
    coverUrl: string | null;
    images: WebImage[];
}

export interface WebParseOptions {
    baseUrl?: string;
    fallbackTitle?: string;
}

const SKIP_TAGS = new Set([
    "script",
    "style",
    "noscript",
    "svg",
    "canvas",
    "iframe",
    "nav",
    "footer",
    "header",
    "aside",
    "form",
    "input",
    "button",
    "select",
    "option",
]);

const BLOCKQUOTE_PREFIX = "> ";

const normalizeText = (text: string): string =>
    text.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();

const resolveUrl = (rawUrl: string, baseUrl?: string): string | null => {
    const trimmed = rawUrl.trim();
    if (!trimmed) return null;
    if (/^(data|blob|javascript):/i.test(trimmed)) return null;

    try {
        return new URL(trimmed, baseUrl).toString();
    } catch {
        return null;
    }
};

const pickImageSource = (element: Element): string | null => {
    const direct =
        element.getAttribute("src") ||
        element.getAttribute("data-src") ||
        element.getAttribute("data-original") ||
        element.getAttribute("data-lazy-src");

    if (direct) return direct;

    const srcset =
        element.getAttribute("srcset") ||
        element.getAttribute("data-srcset");
    if (!srcset) return null;

    const first = srcset.split(",")[0]?.trim();
    if (!first) return null;
    return first.split(/\s+/)[0]?.trim() || null;
};

const escapeAltText = (text: string): string =>
    text.replace(/[\[\]]/g, "").replace(/\s+/g, " ").trim();

const getMetaContent = (
    doc: Document,
    attr: "name" | "property",
    key: string
): string | null => {
    const metas = doc.getElementsByTagName("meta");
    const target = key.toLowerCase();

    for (let i = 0; i < metas.length; i += 1) {
        const meta = metas.item(i);
        if (!meta) continue;
        const attrValue = meta.getAttribute(attr);
        if (!attrValue || attrValue.toLowerCase() !== target) continue;
        const content = meta.getAttribute("content");
        if (content) return content.trim();
    }

    return null;
};

const pickBestElement = (elements: Element[]): Element | null => {
    let best: Element | null = null;
    let bestScore = 0;

    for (const element of elements) {
        const text = normalizeText(element.textContent ?? "");
        if (text.length > bestScore) {
            bestScore = text.length;
            best = element;
        }
    }

    return best;
};

const selectContentRoot = (doc: Document): Element | null => {
    const candidates: Element[] = [];
    const articles = doc.getElementsByTagName("article");
    const mains = doc.getElementsByTagName("main");

    for (let i = 0; i < articles.length; i += 1) {
        const item = articles.item(i);
        if (item) candidates.push(item);
    }

    for (let i = 0; i < mains.length; i += 1) {
        const item = mains.item(i);
        if (item) candidates.push(item);
    }

    if (candidates.length > 0) {
        return pickBestElement(candidates);
    }

    const body = doc.getElementsByTagName("body").item(0);
    return body ?? doc.documentElement;
};

const buildMarkdownFromElement = (
    root: Element,
    baseUrl?: string
): { markdown: string; hasHeading: boolean; images: WebImage[] } => {
    const blocks: string[] = [];
    let hasHeading = false;
    const images: WebImage[] = [];

    const pushBlock = (text: string) => {
        const trimmed = text.trim();
        if (!trimmed) return;
        blocks.push(trimmed);
    };

    const pushImage = (element: Element) => {
        const rawUrl = pickImageSource(element);
        if (!rawUrl) return;

        const resolved = resolveUrl(rawUrl, baseUrl);
        if (!resolved) return;

        const encoded = encodeURI(resolved)
            .replace(/\(/g, "%28")
            .replace(/\)/g, "%29");
        const alt = escapeAltText(element.getAttribute("alt") || "");

        images.push({ alt, url: encoded });
        pushBlock(`![${alt}](${encoded})`);
    };

    const walk = (node: Node, listDepth: number) => {
        if (node.nodeType === 1) {
            const element = node as Element;
            const tag = element.tagName?.toLowerCase();

            if (tag && SKIP_TAGS.has(tag)) return;

            if (tag && /^h[1-6]$/.test(tag)) {
                const level = Number(tag.slice(1));
                const text = normalizeText(element.textContent ?? "");
                if (text) {
                    hasHeading = true;
                    pushBlock(`${"#".repeat(level)} ${text}`);
                }
                return;
            }

            if (tag === "img") {
                pushImage(element);
                return;
            }

            if (tag === "p") {
                const text = normalizeText(element.textContent ?? "");
                if (text) pushBlock(text);
                const imgs = element.getElementsByTagName("img");
                for (let i = 0; i < imgs.length; i += 1) {
                    const img = imgs.item(i);
                    if (img) pushImage(img);
                }
                return;
            }

            if (tag === "li") {
                const text = normalizeText(element.textContent ?? "");
                if (text) {
                    const indent = "  ".repeat(listDepth);
                    pushBlock(`${indent}- ${text}`);
                }
                return;
            }

            if (tag === "ul" || tag === "ol") {
                const children = element.childNodes;
                for (let i = 0; i < children.length; i += 1) {
                    const child = children.item(i);
                    if (child) walk(child, listDepth + 1);
                }
                return;
            }

            if (tag === "pre") {
                const code = element.textContent ?? "";
                const cleaned = code
                    .replace(/\r\n/g, "\n")
                    .replace(/\n{3,}/g, "\n\n")
                    .trim();
                if (cleaned) {
                    pushBlock(`\`\`\`\n${cleaned}\n\`\`\``);
                }
                return;
            }

            if (tag === "blockquote") {
                const text = normalizeText(element.textContent ?? "");
                if (text) {
                    const quoted = text
                        .split(/\r?\n/)
                        .map((line) => `${BLOCKQUOTE_PREFIX}${line}`)
                        .join("\n");
                    pushBlock(quoted);
                }
                return;
            }

            const children = element.childNodes;
            for (let i = 0; i < children.length; i += 1) {
                const child = children.item(i);
                if (child) walk(child, listDepth);
            }
            return;
        }

        if (node.nodeType === 3) {
            const text = normalizeText(node.nodeValue ?? "");
            if (text) pushBlock(text);
        }
    };

    walk(root, 0);

    const markdown = blocks.join("\n\n").replace(/\n{3,}/g, "\n\n").trim();
    return { markdown, hasHeading, images };
};

export function parseWebPageToMarkdown(
    html: string,
    options: WebParseOptions = {}
): WebParseResult {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");

    const title =
        getMetaContent(doc, "property", "og:title") ||
        getMetaContent(doc, "name", "title") ||
        doc.getElementsByTagName("title").item(0)?.textContent?.trim() ||
        null;

    const author =
        getMetaContent(doc, "name", "author") ||
        getMetaContent(doc, "property", "article:author") ||
        null;

    const description =
        getMetaContent(doc, "name", "description") ||
        getMetaContent(doc, "property", "og:description") ||
        null;

    const coverUrlRaw =
        getMetaContent(doc, "property", "og:image") ||
        getMetaContent(doc, "name", "twitter:image");
    const coverUrl = coverUrlRaw
        ? resolveUrl(coverUrlRaw, options.baseUrl)
        : null;

    const root = selectContentRoot(doc);
    const { markdown, hasHeading, images } = root
        ? buildMarkdownFromElement(root, options.baseUrl)
        : { markdown: "", hasHeading: false, images: [] };

    let finalMarkdown = markdown;
    if (!finalMarkdown) {
        const fallbackText = normalizeText(doc.textContent ?? "");
        finalMarkdown = fallbackText;
    }

    if (!hasHeading) {
        const safeTitle = title || options.fallbackTitle || null;
        if (safeTitle) {
            finalMarkdown = `# ${safeTitle}\n\n${finalMarkdown}`.trim();
        }
    }

    return {
        markdown: finalMarkdown,
        title,
        author,
        description,
        coverUrl,
        images,
    };
}
