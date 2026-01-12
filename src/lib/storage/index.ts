import "server-only";
import path from "path";
import { mkdir, readFile, stat, unlink, writeFile } from "fs/promises";
import { createLogger } from "@/lib/logger";

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
const logger = createLogger("storage");

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
        logger.info({
            key: normalized,
            bytes: data.byteLength,
        }, "storage save");
    },
    async read(key) {
        const normalized = normalizeKey(key);
        const buffer = await readFile(toDiskPathFromNormalized(normalized));
        logger.info({
            key: normalized,
            bytes: buffer.length,
        }, "storage read");
        return buffer;
    },
    async delete(key, options) {
        const normalized = normalizeKey(key);
        const filePath = toDiskPathFromNormalized(normalized);
        try {
            await unlink(filePath);
            logger.info({ key: normalized }, "storage delete");
        } catch (error) {
            if (options?.ignoreErrors) {
                logger.warn({
                    key: normalized,
                    error,
                }, "storage delete failed (ignored)");
                return;
            }
            if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
                logger.error({
                    key: normalized,
                    error,
                }, "storage delete failed");
                throw error;
            }
        }
    },
    async exists(key) {
        const normalized = normalizeKey(key);
        try {
            await stat(toDiskPathFromNormalized(normalized));
            logger.debug({ key: normalized, exists: true }, "storage exists");
            return true;
        } catch {
            logger.debug({
                key: normalized,
                exists: false,
            }, "storage exists");
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
