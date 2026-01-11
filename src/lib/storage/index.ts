import "server-only";
import path from "path";
import { mkdir, readFile, stat, unlink, writeFile } from "fs/promises";

export type StorageKey = string;

export interface StorageProvider {
    save: (key: StorageKey, data: Buffer | Uint8Array) => Promise<void>;
    read: (key: StorageKey) => Promise<Buffer>;
    delete: (
        key: StorageKey,
        options?: { ignoreErrors?: boolean }
    ) => Promise<void>;
    exists: (key: StorageKey) => Promise<boolean>;
    getPublicPath: (key: StorageKey) => string;
    getPublicUrl: (key: StorageKey) => string;
    resolveKeyFromPath: (value: string | null | undefined) => StorageKey | null;
}

const UPLOADS_PREFIX = "uploads";
const API_PREFIX = "/api";
const DISK_BASE_DIR = path.join(process.cwd(), UPLOADS_PREFIX);

const normalizeKey = (key: StorageKey): StorageKey => {
    const normalized = key.replace(/\\/g, "/").replace(/^\/+/, "");
    if (!normalized || normalized.includes("..")) {
        throw new Error("Invalid storage key");
    }
    return normalized;
};

const stripPublicPrefix = (value: string): string => {
    let candidate = value.trim();
    if (!candidate) return "";

    if (candidate.startsWith("http://") || candidate.startsWith("https://")) {
        try {
            candidate = new URL(candidate).pathname;
        } catch {
            return "";
        }
    }

    if (candidate.startsWith(API_PREFIX)) {
        candidate = candidate.slice(API_PREFIX.length);
    }

    if (candidate.startsWith(`/${UPLOADS_PREFIX}/`)) {
        candidate = candidate.slice(`/${UPLOADS_PREFIX}/`.length);
    } else if (candidate.startsWith(`${UPLOADS_PREFIX}/`)) {
        candidate = candidate.slice(`${UPLOADS_PREFIX}/`.length);
    }

    return candidate.replace(/^\/+/, "");
};

const toDiskPathFromNormalized = (normalized: StorageKey): string =>
    path.join(DISK_BASE_DIR, ...normalized.split("/"));

const toDiskPath = (key: StorageKey): string => {
    const normalized = normalizeKey(key);
    return toDiskPathFromNormalized(normalized);
};

export const storage: StorageProvider = {
    async save(key, data) {
        const normalized = normalizeKey(key);
        const filePath = toDiskPathFromNormalized(normalized);
        await mkdir(path.dirname(filePath), { recursive: true });
        await writeFile(filePath, data);
        console.info("[storage] save", {
            key: normalized,
            bytes: data.byteLength,
        });
    },
    async read(key) {
        const normalized = normalizeKey(key);
        const buffer = await readFile(toDiskPathFromNormalized(normalized));
        console.info("[storage] read", {
            key: normalized,
            bytes: buffer.length,
        });
        return buffer;
    },
    async delete(key, options) {
        const normalized = normalizeKey(key);
        const filePath = toDiskPathFromNormalized(normalized);
        try {
            await unlink(filePath);
            console.info("[storage] delete", { key: normalized });
        } catch (error) {
            if (options?.ignoreErrors) {
                console.warn("[storage] delete failed", {
                    key: normalized,
                    error,
                });
                return;
            }
            if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
                console.error("[storage] delete failed", {
                    key: normalized,
                    error,
                });
                throw error;
            }
        }
    },
    async exists(key) {
        const normalized = normalizeKey(key);
        try {
            await stat(toDiskPathFromNormalized(normalized));
            console.debug("[storage] exists", { key: normalized, exists: true });
            return true;
        } catch {
            console.debug("[storage] exists", {
                key: normalized,
                exists: false,
            });
            return false;
        }
    },
    getPublicPath(key) {
        const normalized = normalizeKey(key);
        return `/${UPLOADS_PREFIX}/${normalized}`;
    },
    getPublicUrl(key) {
        const normalized = normalizeKey(key);
        return `${API_PREFIX}/${UPLOADS_PREFIX}/${normalized}`;
    },
    resolveKeyFromPath(value) {
        if (!value) return null;
        const stripped = stripPublicPrefix(value);
        if (!stripped) return null;
        try {
            return normalizeKey(stripped);
        } catch {
            return null;
        }
    },
};
