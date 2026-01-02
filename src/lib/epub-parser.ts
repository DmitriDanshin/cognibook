import JSZip from "jszip";
import { DOMParser } from "xmldom";
import path from "path";

export interface EpubMetadata {
    title: string;
    author: string | null;
    language: string | null;
    publisher: string | null;
    description: string | null;
    coverHref: string | null;
}

export interface TocItem {
    id: string;
    title: string;
    href: string;
    order: number;
    children: TocItem[];
}

export interface SpineItem {
    id: string;
    href: string;
    order: number;
}

export interface EpubChapterContent {
    href: string;
    html: string;
}

export interface ParsedEpub {
    metadata: EpubMetadata;
    toc: TocItem[];
    spine: SpineItem[];
    coverBuffer: Buffer | null;
    coverMimeType: string | null;
}

export class EpubParser {
    private zip: JSZip;
    private opfPath: string = "";
    private opfDir: string = "";
    private opfContent: Document | null = null;
    private manifest: Map<string, { href: string; mediaType: string }> = new Map();

    constructor(private buffer: Buffer) {
        this.zip = new JSZip();
    }

    async parse(): Promise<ParsedEpub> {
        await this.zip.loadAsync(this.buffer);

        // 1. Find and parse container.xml to get OPF path
        await this.findOpfPath();

        // 2. Parse OPF file
        await this.parseOpf();

        // 3. Extract metadata
        const metadata = this.extractMetadata();

        // 4. Build manifest map
        this.buildManifest();

        // 5. Parse table of contents
        const toc = await this.parseToc();

        // 6. Parse spine
        const spine = this.parseSpine();

        // 7. Extract cover
        const { coverBuffer, coverMimeType } = await this.extractCover(metadata.coverHref);

        return {
            metadata,
            toc,
            spine,
            coverBuffer,
            coverMimeType,
        };
    }

    private async findOpfPath(): Promise<void> {
        const containerXml = await this.zip.file("META-INF/container.xml")?.async("text");
        if (!containerXml) {
            throw new Error("Invalid EPUB: container.xml not found");
        }

        const parser = new DOMParser();
        const doc = parser.parseFromString(containerXml, "text/xml");

        const rootfile = doc.getElementsByTagName("rootfile")[0];
        if (!rootfile) {
            throw new Error("Invalid EPUB: rootfile not found in container.xml");
        }

        this.opfPath = rootfile.getAttribute("full-path") || "";
        this.opfDir = path.dirname(this.opfPath);
        if (this.opfDir === ".") {
            this.opfDir = "";
        }
    }

    private async parseOpf(): Promise<void> {
        const opfXml = await this.zip.file(this.opfPath)?.async("text");
        if (!opfXml) {
            throw new Error(`Invalid EPUB: OPF file not found at ${this.opfPath}`);
        }

        const parser = new DOMParser();
        this.opfContent = parser.parseFromString(opfXml, "text/xml");
    }

    private extractMetadata(): EpubMetadata {
        if (!this.opfContent) {
            throw new Error("OPF not parsed");
        }

        const getMetaValue = (tagName: string): string | null => {
            const elements = this.opfContent!.getElementsByTagName(`dc:${tagName}`);
            if (elements.length === 0) {
                // Try without namespace prefix
                const elementsNoNs = this.opfContent!.getElementsByTagName(tagName);
                return elementsNoNs.length > 0 ? elementsNoNs[0].textContent : null;
            }
            return elements[0].textContent;
        };

        // Find cover href from manifest
        let coverHref: string | null = null;

        // Method 1: Look for meta cover
        const metas = this.opfContent.getElementsByTagName("meta");
        for (let i = 0; i < metas.length; i++) {
            const meta = metas[i];
            if (meta.getAttribute("name") === "cover") {
                const coverId = meta.getAttribute("content");
                if (coverId) {
                    const manifestItems = this.opfContent.getElementsByTagName("item");
                    for (let j = 0; j < manifestItems.length; j++) {
                        if (manifestItems[j].getAttribute("id") === coverId) {
                            coverHref = manifestItems[j].getAttribute("href");
                            break;
                        }
                    }
                }
                break;
            }
        }

        // Method 2: Look for item with properties="cover-image" (EPUB 3)
        if (!coverHref) {
            const items = this.opfContent.getElementsByTagName("item");
            for (let i = 0; i < items.length; i++) {
                const props = items[i].getAttribute("properties");
                if (props && props.includes("cover-image")) {
                    coverHref = items[i].getAttribute("href");
                    break;
                }
            }
        }

        // Method 3: Look for item with id containing "cover" and image type
        if (!coverHref) {
            const items = this.opfContent.getElementsByTagName("item");
            for (let i = 0; i < items.length; i++) {
                const id = items[i].getAttribute("id")?.toLowerCase() || "";
                const mediaType = items[i].getAttribute("media-type") || "";
                if (id.includes("cover") && mediaType.startsWith("image/")) {
                    coverHref = items[i].getAttribute("href");
                    break;
                }
            }
        }

        return {
            title: getMetaValue("title") || "Untitled",
            author: getMetaValue("creator"),
            language: getMetaValue("language"),
            publisher: getMetaValue("publisher"),
            description: getMetaValue("description"),
            coverHref,
        };
    }

    private buildManifest(): void {
        if (!this.opfContent) return;

        const items = this.opfContent.getElementsByTagName("item");
        for (let i = 0; i < items.length; i++) {
            const id = items[i].getAttribute("id");
            const href = items[i].getAttribute("href");
            const mediaType = items[i].getAttribute("media-type");
            if (id && href) {
                this.manifest.set(id, { href, mediaType: mediaType || "" });
            }
        }
    }

    private async parseToc(): Promise<TocItem[]> {
        // Try EPUB 3 nav document first
        const navToc = await this.parseNavToc();
        if (navToc.length > 0) {
            return navToc;
        }

        // Fall back to NCX
        return this.parseNcxToc();
    }

    private async parseNavToc(): Promise<TocItem[]> {
        if (!this.opfContent) return [];

        // Find nav document in manifest
        const items = this.opfContent.getElementsByTagName("item");
        let navHref: string | null = null;

        for (let i = 0; i < items.length; i++) {
            const props = items[i].getAttribute("properties");
            if (props && props.includes("nav")) {
                navHref = items[i].getAttribute("href");
                break;
            }
        }

        if (!navHref) return [];

        const navPath = this.resolvePath(navHref);
        const navXml = await this.zip.file(navPath)?.async("text");
        if (!navXml) return [];

        const parser = new DOMParser();
        const doc = parser.parseFromString(navXml, "text/html");

        // Find nav with epub:type="toc"
        const navElements = doc.getElementsByTagName("nav");
        let tocNav: Element | null = null;

        for (let i = 0; i < navElements.length; i++) {
            const epubType = navElements[i].getAttribute("epub:type");
            if (epubType && epubType.includes("toc")) {
                tocNav = navElements[i];
                break;
            }
        }

        if (!tocNav) {
            // Try first nav
            tocNav = navElements[0] || null;
        }

        if (!tocNav) return [];

        const ol = tocNav.getElementsByTagName("ol")[0];
        if (!ol) return [];

        return this.parseNavList(ol, navHref, 0);
    }

    private parseNavList(ol: Element, navHref: string, startOrder: number): TocItem[] {
        const items: TocItem[] = [];
        let order = startOrder;

        const lis = ol.childNodes;
        for (let i = 0; i < lis.length; i++) {
            const li = lis[i];
            if (li.nodeName.toLowerCase() !== "li") continue;

            const liElement = li as Element;
            const anchor = liElement.getElementsByTagName("a")[0];
            if (!anchor) continue;

            let href = anchor.getAttribute("href") || "";
            // Resolve relative to nav document
            if (href && !href.startsWith("http")) {
                const navDir = path.dirname(navHref);
                href = navDir === "." ? href : `${navDir}/${href}`;
            }

            const title = anchor.textContent?.trim() || "";

            const tocItem: TocItem = {
                id: `toc-${order}`,
                title,
                href,
                order,
                children: [],
            };

            order++;

            // Check for nested ol
            const nestedOl = liElement.getElementsByTagName("ol")[0];
            if (nestedOl) {
                tocItem.children = this.parseNavList(nestedOl, navHref, order);
                order += this.countTocItems(tocItem.children);
            }

            items.push(tocItem);
        }

        return items;
    }

    private async parseNcxToc(): Promise<TocItem[]> {
        if (!this.opfContent) return [];

        // Find NCX file in spine or manifest
        const spine = this.opfContent.getElementsByTagName("spine")[0];
        let ncxId = spine?.getAttribute("toc") || "ncx";

        const ncxItem = this.manifest.get(ncxId);
        if (!ncxItem) {
            // Try to find by media type
            for (const [id, item] of this.manifest) {
                if (item.mediaType === "application/x-dtbncx+xml") {
                    ncxId = id;
                    break;
                }
            }
        }

        const ncxManifestItem = this.manifest.get(ncxId);
        if (!ncxManifestItem) return [];

        const ncxPath = this.resolvePath(ncxManifestItem.href);
        const ncxXml = await this.zip.file(ncxPath)?.async("text");
        if (!ncxXml) return [];

        const parser = new DOMParser();
        const doc = parser.parseFromString(ncxXml, "text/xml");

        const navMap = doc.getElementsByTagName("navMap")[0];
        if (!navMap) return [];

        return this.parseNcxNavPoints(navMap, 0);
    }

    private parseNcxNavPoints(parent: Element, startOrder: number): TocItem[] {
        const items: TocItem[] = [];
        let order = startOrder;

        const navPoints = parent.childNodes;
        for (let i = 0; i < navPoints.length; i++) {
            const np = navPoints[i];
            if (np.nodeName !== "navPoint") continue;

            const npElement = np as Element;
            const navLabel = npElement.getElementsByTagName("navLabel")[0];
            const content = npElement.getElementsByTagName("content")[0];

            if (!navLabel || !content) continue;

            const text = navLabel.getElementsByTagName("text")[0];
            const title = text?.textContent?.trim() || "";
            const href = content.getAttribute("src") || "";

            const tocItem: TocItem = {
                id: npElement.getAttribute("id") || `ncx-${order}`,
                title,
                href,
                order,
                children: [],
            };

            order++;

            // Parse nested navPoints
            tocItem.children = this.parseNcxNavPoints(npElement, order);
            order += this.countTocItems(tocItem.children);

            items.push(tocItem);
        }

        return items;
    }

    private countTocItems(items: TocItem[]): number {
        let count = items.length;
        for (const item of items) {
            count += this.countTocItems(item.children);
        }
        return count;
    }

    private parseSpine(): SpineItem[] {
        if (!this.opfContent) return [];

        const spine = this.opfContent.getElementsByTagName("spine")[0];
        if (!spine) return [];

        const items: SpineItem[] = [];
        const itemrefs = spine.getElementsByTagName("itemref");

        for (let i = 0; i < itemrefs.length; i++) {
            const idref = itemrefs[i].getAttribute("idref");
            if (!idref) continue;

            const manifestItem = this.manifest.get(idref);
            if (!manifestItem) continue;

            items.push({
                id: idref,
                href: manifestItem.href,
                order: i,
            });
        }

        return items;
    }

    private async extractCover(
        coverHref: string | null
    ): Promise<{ coverBuffer: Buffer | null; coverMimeType: string | null }> {
        if (!coverHref) {
            return { coverBuffer: null, coverMimeType: null };
        }

        const coverPath = this.resolvePath(coverHref);
        const coverFile = this.zip.file(coverPath);

        if (!coverFile) {
            return { coverBuffer: null, coverMimeType: null };
        }

        const coverBuffer = Buffer.from(await coverFile.async("arraybuffer"));
        const ext = path.extname(coverHref).toLowerCase();
        const mimeTypes: Record<string, string> = {
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".png": "image/png",
            ".gif": "image/gif",
            ".webp": "image/webp",
        };

        return {
            coverBuffer,
            coverMimeType: mimeTypes[ext] || "image/jpeg",
        };
    }

    async getChapterContent(href: string, bookId?: string): Promise<string> {
        // Remove fragment identifier
        const cleanHref = href.split("#")[0];
        const chapterPath = this.resolvePath(cleanHref);

        const content = await this.zip.file(chapterPath)?.async("text");
        if (!content) {
            return "";
        }

        // Extract body content and clean up
        return this.extractBodyContent(content, cleanHref, bookId);
    }

    private extractBodyContent(html: string, chapterHref: string, bookId?: string): string {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, "text/html");

        const body = doc.getElementsByTagName("body")[0];
        if (!body) {
            return html;
        }

        // Convert body content to string
        let bodyHtml = "";
        for (let i = 0; i < body.childNodes.length; i++) {
            const node = body.childNodes[i];
            if (node.nodeType === 1) {
                // Element node
                bodyHtml += this.serializeElement(node as Element, chapterHref, bookId);
            } else if (node.nodeType === 3) {
                // Text node
                bodyHtml += node.textContent || "";
            }
        }

        return bodyHtml;
    }

    private serializeElement(element: Element, chapterHref: string, bookId?: string): string {
        const tagName = element.tagName.toLowerCase();

        // Skip script and style tags
        if (tagName === "script" || tagName === "style") {
            return "";
        }

        // Handle self-closing tags
        const selfClosing = ["img", "br", "hr", "input", "meta", "link"];

        let html = `<${tagName}`;

        // Copy attributes, updating image src paths
        for (let i = 0; i < element.attributes.length; i++) {
            const attr = element.attributes[i];
            let value = attr.value;

            // Update image src to use API route
            if (tagName === "img" && attr.name === "src" && !value.startsWith("http")) {
                const chapterDir = path.dirname(chapterHref);
                const imagePath = chapterDir === "." ? value : `${chapterDir}/${value}`;
                const fullPath = this.opfDir ? `${this.opfDir}/${imagePath}` : imagePath;
                if (bookId) {
                    value = `/api/books/${bookId}/image?path=${encodeURIComponent(fullPath)}`;
                } else {
                    value = `/api/epub-image?path=${encodeURIComponent(fullPath)}`;
                }
            }

            // Skip epub: namespaced attributes and some irrelevant attributes
            if (!attr.name.startsWith("epub:") && attr.name !== "xmlns") {
                html += ` ${attr.name}="${this.escapeHtml(value)}"`;
            }
        }

        if (selfClosing.includes(tagName)) {
            html += " />";
        } else {
            html += ">";

            for (let i = 0; i < element.childNodes.length; i++) {
                const node = element.childNodes[i];
                if (node.nodeType === 1) {
                    html += this.serializeElement(node as Element, chapterHref, bookId);
                } else if (node.nodeType === 3) {
                    html += this.escapeHtml(node.textContent || "");
                }
            }

            html += `</${tagName}>`;
        }

        return html;
    }

    private escapeHtml(text: string): string {
        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    private resolvePath(href: string): string {
        if (!this.opfDir) {
            return href;
        }
        return `${this.opfDir}/${href}`;
    }
}

export async function parseEpubFile(buffer: Buffer): Promise<ParsedEpub> {
    const parser = new EpubParser(buffer);
    return parser.parse();
}

export async function getEpubChapterContent(
    buffer: Buffer,
    chapterHref: string,
    bookId?: string
): Promise<string> {
    const parser = new EpubParser(buffer);
    await parser.parse();
    return parser.getChapterContent(chapterHref, bookId);
}
