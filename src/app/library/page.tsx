"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
    BookOpen,
    Upload,
    ArrowLeft,
    Trash2,
    FileText,
    Clock,
    HardDrive,
    Youtube,
    Globe,
    ClipboardPaste,
    Maximize2,
    ImagePlus,
    Pencil,
    Tag,
    SlidersHorizontal,
} from "lucide-react";
import { toast } from "sonner";
import { CoverUploadDialog } from "./components/cover-upload-dialog";
import { SOURCE_FILE_EXTENSIONS, SOURCE_TYPE_LABELS } from "@/lib/constants";
import { formatDateRuShort, formatFileSizeMb } from "@/lib/utils/format";

/**
 * Extract title from markdown content:
 * 1. Try to find heading (# to ######)
 * 2. If not found, try bold text (**text** or __text__)
 * 3. If not found, use first sentence (up to 256 chars)
 */
function extractTitleFromContent(content: string): string {
    const lines = content.split(/\r?\n/);

    // Remove quotes from title
    const stripQuotes = (s: string) => s.replace(/^["'«»"']+|["'«»"']+$/g, "").trim();

    // Try headings from # to ######
    for (let level = 1; level <= 6; level++) {
        const prefix = "#".repeat(level);
        for (const line of lines) {
            const trimmed = line.trim();
            // Match exactly this level (not more #)
            const regex = new RegExp(`^${prefix}(?!#)\\s+(.+)$`);
            const match = regex.exec(trimmed);
            if (match) {
                return stripQuotes(match[1]).slice(0, 256);
            }
        }
    }

    // Try bold text **text** or __text__
    const boldMatch = /\*\*([^*]+)\*\*|__([^_]+)__/.exec(content);
    if (boldMatch) {
        const boldText = stripQuotes(boldMatch[1] || boldMatch[2]);
        if (boldText.length > 0) {
            return boldText.slice(0, 256);
        }
    }

    // Use first sentence
    const text = content.replace(/\s+/g, " ").trim();
    const sentenceMatch = /^(.+?)[.!?]/.exec(text);
    if (sentenceMatch) {
        return stripQuotes(sentenceMatch[1]).slice(0, 256);
    }

    // Fallback: first 256 characters
    return stripQuotes(text).slice(0, 256) || "Вставленный текст";
}

interface Source {
    id: string;
    title: string;
    author: string | null;
    coverPath: string | null;
    filePath: string | null;
    fileSize: number | null;
    createdAt: string;
    sourceType: string | null;
    readingProgress: { progress: number }[];
    _count: { chapters: number };
}

type LibrarySortOption =
    | "created_desc"
    | "created_asc"
    | "title_asc"
    | "title_desc"
    | "progress_desc"
    | "progress_asc"
    | "size_desc"
    | "size_asc";

type LibraryProgressFilter = "all" | "not_started" | "in_progress" | "completed";

const LIBRARY_VIEW_SETTINGS_KEY = "library-view-settings-v1";

export default function LibraryPage() {
    const getStoredViewSettings = () => {
        if (typeof window === "undefined") {
            return null;
        }

        try {
            const raw = window.localStorage.getItem(LIBRARY_VIEW_SETTINGS_KEY);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            if (!parsed || typeof parsed !== "object") return null;
            return parsed as Record<string, unknown>;
        } catch {
            return null;
        }
    };

    const [sources, setSources] = useState<Source[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isPasteFullscreen, setIsPasteFullscreen] = useState(false);
    const [isCoverDialogOpen, setIsCoverDialogOpen] = useState(false);
    const [activeCoverSource, setActiveCoverSource] = useState<Source | null>(
        null
    );
    const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
    const [renaming, setRenaming] = useState(false);
    const [renameTitle, setRenameTitle] = useState("");
    const [renameSource, setRenameSource] = useState<Source | null>(null);
    const [sourceType, setSourceType] = useState<"file" | "youtube" | "web" | "paste">(
        "file"
    );
    const [youtubeUrl, setYoutubeUrl] = useState("");
    const [webUrl, setWebUrl] = useState("");
    const [pasteTitle, setPasteTitle] = useState("");
    const [pasteContent, setPasteContent] = useState("");
    const [viewMode, setViewMode] = useState<"cards" | "table">(() => {
        const stored = getStoredViewSettings()?.viewMode;
        return stored === "cards" || stored === "table" ? stored : "cards";
    });
    const [isFiltersExpanded, setIsFiltersExpanded] = useState(false);
    const [sortBy, setSortBy] = useState<LibrarySortOption>(() => {
        const stored = getStoredViewSettings()?.sortBy;
        return stored === "created_desc" ||
            stored === "created_asc" ||
            stored === "title_asc" ||
            stored === "title_desc" ||
            stored === "progress_desc" ||
            stored === "progress_asc" ||
            stored === "size_desc" ||
            stored === "size_asc"
            ? stored
            : "created_desc";
    });
    const [typeFilter, setTypeFilter] = useState<string>(() => {
        const stored = getStoredViewSettings()?.typeFilter;
        return typeof stored === "string" ? stored : "all";
    });
    const [progressFilter, setProgressFilter] = useState<LibraryProgressFilter>(() => {
        const stored = getStoredViewSettings()?.progressFilter;
        return stored === "all" ||
            stored === "not_started" ||
            stored === "in_progress" ||
            stored === "completed"
            ? stored
            : "all";
    });
    const [searchQuery, setSearchQuery] = useState<string>(() => {
        const stored = getStoredViewSettings()?.searchQuery;
        return typeof stored === "string" ? stored : "";
    });

    const fetchSources = useCallback(async () => {
        try {
            const response = await fetch("/api/sources");
            if (!response.ok) throw new Error("Failed to fetch sources");
            const data = await response.json();
            setSources(data);
        } catch (error) {
            console.error("Error fetching sources:", error);
            toast.error("Не удалось загрузить источники");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchSources();
    }, [fetchSources]);

    useEffect(() => {
        if (typeof window === "undefined") return;
        window.localStorage.setItem(
            LIBRARY_VIEW_SETTINGS_KEY,
            JSON.stringify({
                viewMode,
                sortBy,
                typeFilter,
                progressFilter,
                searchQuery,
            })
        );
    }, [viewMode, sortBy, typeFilter, progressFilter, searchQuery]);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const allowedExtensions = SOURCE_FILE_EXTENSIONS;
        const lowerName = file.name.toLowerCase();
        if (!allowedExtensions.some((ext) => lowerName.endsWith(ext))) {
            toast.error("Поддерживаются только файлы EPUB, Markdown, Word или PDF");
            return;
        }

        setUploading(true);
        const formData = new FormData();
        formData.append("file", file);

        try {
            const response = await fetch("/api/sources", {
                method: "POST",
                body: formData,
            });

            const data = await response.json().catch(() => null);

            if (!response.ok) {
                if (response.status === 409) {
                    toast.info("Источник уже загружен");
                    setIsDialogOpen(false);
                    fetchSources();
                    return;
                }
                throw new Error(data?.error || "Failed to upload");
            }

            toast.success("Источник успешно загружен");
            setIsDialogOpen(false);
            fetchSources();
        } catch (error) {
            console.error("Error uploading source:", error);
            toast.error("Не удалось загрузить источник");
        } finally {
            setUploading(false);
        }
    };

    const handleYouTubeSubmit = async () => {
        if (!youtubeUrl.trim()) {
            toast.error("Введите URL YouTube видео");
            return;
        }

        setUploading(true);
        const formData = new FormData();
        formData.append("youtubeUrl", youtubeUrl);

        try {
            const response = await fetch("/api/sources", {
                method: "POST",
                body: formData,
            });

            const data = await response.json().catch(() => null);

            if (!response.ok) {
                if (response.status === 409) {
                    toast.info("Видео уже добавлено");
                    setIsDialogOpen(false);
                    setYoutubeUrl("");
                    fetchSources();
                    return;
                }
                throw new Error(data?.error || "Failed to add YouTube video");
            }

            toast.success("YouTube видео успешно добавлено");
            setIsDialogOpen(false);
            setYoutubeUrl("");
            fetchSources();
        } catch (error) {
            console.error("Error adding YouTube source:", error);
            const errorMessage =
                error instanceof Error ? error.message : "Не удалось добавить YouTube видео";
            toast.error(errorMessage);
        } finally {
            setUploading(false);
        }
    };

    const handleWebSubmit = async () => {
        if (!webUrl.trim()) {
            toast.error("Введите URL страницы");
            return;
        }

        setUploading(true);
        const formData = new FormData();
        formData.append("webUrl", webUrl);

        try {
            const response = await fetch("/api/sources", {
                method: "POST",
                body: formData,
            });

            const data = await response.json().catch(() => null);

            if (!response.ok) {
                if (response.status === 409) {
                    toast.info("Страница уже добавлена");
                    setIsDialogOpen(false);
                    setWebUrl("");
                    fetchSources();
                    return;
                }
                throw new Error(data?.error || "Failed to add web page");
            }

            toast.success("Страница успешно добавлена");
            setIsDialogOpen(false);
            setWebUrl("");
            fetchSources();
        } catch (error) {
            console.error("Error adding web source:", error);
            const errorMessage =
                error instanceof Error ? error.message : "Не удалось добавить страницу";
            toast.error(errorMessage);
        } finally {
            setUploading(false);
        }
    };

    const handlePasteSubmit = async () => {
        if (!pasteContent.trim()) {
            toast.error("Введите текст");
            return;
        }

        setUploading(true);
        const formData = new FormData();
        formData.append("pasteContent", pasteContent);
        formData.append("pasteTitle", pasteTitle.trim() || extractTitleFromContent(pasteContent));

        try {
            const response = await fetch("/api/sources", {
                method: "POST",
                body: formData,
            });

            const data = await response.json().catch(() => null);

            if (!response.ok) {
                if (response.status === 409) {
                    toast.info("Текст уже добавлен");
                    setIsDialogOpen(false);
                    setPasteTitle("");
                    setPasteContent("");
                    fetchSources();
                    return;
                }
                throw new Error(data?.error || "Failed to add text");
            }

            toast.success("Текст успешно добавлен");
            setIsDialogOpen(false);
            setPasteTitle("");
            setPasteContent("");
            fetchSources();
        } catch (error) {
            console.error("Error adding paste source:", error);
            const errorMessage =
                error instanceof Error ? error.message : "Не удалось добавить текст";
            toast.error(errorMessage);
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async (id: string, title: string) => {
        if (!confirm(`Удалить источник "${title}"?`)) return;

        try {
            const response = await fetch(`/api/sources/${id}`, {
                method: "DELETE",
            });

            if (!response.ok) throw new Error("Failed to delete");

            toast.success("Источник удалён");
            fetchSources();
        } catch (error) {
            console.error("Error deleting source:", error);
            toast.error("Не удалось удалить источник");
        }
    };

    const getSourceProgress = useCallback(
        (source: Source) => source.readingProgress[0]?.progress ?? 0,
        []
    );

    const getSourceTypeKey = useCallback((source: Source) => {
        const rawType = source.sourceType?.toLowerCase();
        if (rawType && SOURCE_TYPE_LABELS[rawType]) {
            return rawType;
        }

        const ext = source.filePath?.split(".").pop()?.toLowerCase();
        if (ext && SOURCE_TYPE_LABELS[ext]) {
            return ext;
        }

        if (rawType) return rawType;
        if (ext) return ext;
        return "unknown";
    }, []);

    const getSourceTypeLabel = useCallback(
        (source: Source) => {
            const typeKey = getSourceTypeKey(source);
            if (SOURCE_TYPE_LABELS[typeKey]) {
                return SOURCE_TYPE_LABELS[typeKey];
            }
            if (!source.filePath) return "Источник";
            return "Файл";
        },
        [getSourceTypeKey]
    );

    const isMarkdownSource = (source: Source) => {
        const rawType = source.sourceType?.toLowerCase();
        if (rawType === "markdown" || rawType === "paste") return true;
        const ext = source.filePath?.split(".").pop()?.toLowerCase();
        return ext === "md" || ext === "markdown";
    };

    const isWebSource = (source: Source) => source.sourceType?.toLowerCase() === "web";

    const getAuthorLabel = (source: Source) => {
        if (source.author) return source.author;
        if (isWebSource(source) || isMarkdownSource(source)) return null;
        return "Автор неизвестен";
    };

    const sourceTypeOptions = useMemo(() => {
        const typeMap = new Map<string, string>();
        sources.forEach((source) => {
            const key = getSourceTypeKey(source);
            if (!typeMap.has(key)) {
                typeMap.set(key, getSourceTypeLabel(source));
            }
        });

        return Array.from(typeMap.entries())
            .map(([value, label]) => ({ value, label }))
            .sort((a, b) => a.label.localeCompare(b.label, "ru"));
    }, [sources, getSourceTypeKey, getSourceTypeLabel]);

    useEffect(() => {
        if (typeFilter === "all") return;
        if (!sourceTypeOptions.some((option) => option.value === typeFilter)) {
            setTypeFilter("all");
        }
    }, [sourceTypeOptions, typeFilter]);

    const visibleSources = useMemo(() => {
        const normalizedQuery = searchQuery.trim().toLowerCase();

        const filtered = sources.filter((source) => {
            if (typeFilter !== "all" && getSourceTypeKey(source) !== typeFilter) {
                return false;
            }

            const progress = getSourceProgress(source);
            if (progressFilter === "not_started" && progress > 0) {
                return false;
            }
            if (progressFilter === "in_progress" && (progress <= 0 || progress >= 99.5)) {
                return false;
            }
            if (progressFilter === "completed" && progress < 99.5) {
                return false;
            }

            if (!normalizedQuery) {
                return true;
            }

            const searchHaystack = [
                source.title,
                source.author ?? "",
                getSourceTypeLabel(source),
            ]
                .join(" ")
                .toLowerCase();

            return searchHaystack.includes(normalizedQuery);
        });

        const sorted = [...filtered];
        sorted.sort((a, b) => {
            switch (sortBy) {
                case "created_asc":
                    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
                case "created_desc":
                    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
                case "title_asc":
                    return a.title.localeCompare(b.title, "ru");
                case "title_desc":
                    return b.title.localeCompare(a.title, "ru");
                case "progress_asc":
                    return getSourceProgress(a) - getSourceProgress(b);
                case "progress_desc":
                    return getSourceProgress(b) - getSourceProgress(a);
                case "size_asc":
                    return (a.fileSize ?? 0) - (b.fileSize ?? 0);
                case "size_desc":
                    return (b.fileSize ?? 0) - (a.fileSize ?? 0);
                default:
                    return 0;
            }
        });

        return sorted;
    }, [
        sources,
        sortBy,
        typeFilter,
        progressFilter,
        searchQuery,
        getSourceProgress,
        getSourceTypeKey,
        getSourceTypeLabel,
    ]);

    const hasActiveFilters =
        searchQuery.trim().length > 0 ||
        typeFilter !== "all" ||
        progressFilter !== "all" ||
        sortBy !== "created_desc";

    const activeFiltersCount =
        Number(searchQuery.trim().length > 0) +
        Number(typeFilter !== "all") +
        Number(progressFilter !== "all") +
        Number(sortBy !== "created_desc");

    const resetFiltersAndSort = useCallback(() => {
        setSearchQuery("");
        setTypeFilter("all");
        setProgressFilter("all");
        setSortBy("created_desc");
    }, []);


    const handleCoverDialogChange = (open: boolean) => {
        setIsCoverDialogOpen(open);
        if (!open) {
            setActiveCoverSource(null);
        }
    };

    const handleRenameDialogChange = (open: boolean) => {
        setIsRenameDialogOpen(open);
        if (!open) {
            setRenameSource(null);
            setRenameTitle("");
        }
    };

    const handleRename = async () => {
        const nextTitle = renameTitle.trim();
        if (!renameSource || !nextTitle) {
            toast.error("Введите название источника");
            return;
        }

        setRenaming(true);
        try {
            const response = await fetch(`/api/sources/${renameSource.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ title: nextTitle }),
            });

            const data = await response.json().catch(() => null);
            if (!response.ok) {
                throw new Error(data?.error || "Failed to update");
            }

            toast.success("Название источника обновлено");
            handleRenameDialogChange(false);
            fetchSources();
        } catch (error) {
            console.error("Error renaming source:", error);
            toast.error("Не удалось переименовать источник");
        } finally {
            setRenaming(false);
        }
    };


    return (
        <div className="min-h-dvh bg-background text-foreground">
            {/* Header */}
            <header className="sticky top-0 z-50 border-b border-border bg-background/85 backdrop-blur-xl">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                    <div className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:py-4">
                        <div className="flex min-w-0 items-center gap-3">
                            <Link href="/">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="text-muted-foreground hover:text-foreground"
                                >
                                    <ArrowLeft className="h-5 w-5" />
                                </Button>
                            </Link>
                            <div className="flex items-center gap-2">
                                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-foreground/10 text-foreground">
                                    <BookOpen className="h-5 w-5" />
                                </div>
                                <h1 className="text-lg font-bold text-foreground sm:text-xl">
                                    Библиотека
                                </h1>
                            </div>
                        </div>

                        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                            <div className="inline-flex rounded-lg border border-border p-1">
                                <Button
                                    type="button"
                                    variant={viewMode === "cards" ? "default" : "ghost"}
                                    size="sm"
                                    onClick={() => setViewMode("cards")}
                                    className="px-3"
                                >
                                    Карточки
                                </Button>
                                <Button
                                    type="button"
                                    variant={viewMode === "table" ? "default" : "ghost"}
                                    size="sm"
                                    onClick={() => setViewMode("table")}
                                    className="px-3"
                                >
                                    Таблица
                                </Button>
                            </div>
                            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                            <DialogTrigger asChild>
                                <Button className="w-full gap-2 sm:w-auto">
                                    <Upload className="h-4 w-4" />
                                    Загрузить
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="flex h-[520px] w-full flex-col border-border bg-background sm:max-w-3xl">
                                <DialogHeader className="shrink-0">
                                    <DialogTitle className="text-foreground">
                                        Добавить источник
                                    </DialogTitle>
                                    <DialogDescription className="text-muted-foreground">
                                        Загрузите файл, добавьте YouTube видео, страницу сайта или вставьте текст
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="mt-4 min-h-0 flex-1 overflow-y-auto">
                                    {/* Source Type Selector */}
                                    <div className="mb-4 flex gap-2">
                                        <Button
                                            type="button"
                                            variant={sourceType === "file" ? "default" : "outline"}
                                            className="flex-1 gap-2"
                                            onClick={() => setSourceType("file")}
                                        >
                                            <Upload className="h-4 w-4" />
                                            Файл
                                        </Button>
                                        <Button
                                            type="button"
                                            variant={sourceType === "youtube" ? "default" : "outline"}
                                            className="flex-1 gap-2"
                                            onClick={() => setSourceType("youtube")}
                                        >
                                            <Youtube className="h-4 w-4" />
                                            YouTube
                                        </Button>
                                        <Button
                                            type="button"
                                            variant={sourceType === "web" ? "default" : "outline"}
                                            className="flex-1 gap-2"
                                            onClick={() => setSourceType("web")}
                                        >
                                            <Globe className="h-4 w-4" />
                                            Сайт
                                        </Button>
                                        <Button
                                            type="button"
                                            variant={sourceType === "paste" ? "default" : "outline"}
                                            className="flex-1 gap-2"
                                            onClick={() => setSourceType("paste")}
                                        >
                                            <ClipboardPaste className="h-4 w-4" />
                                            Текст
                                        </Button>
                                    </div>

                                    {/* File Upload */}
                                    {sourceType === "file" && (
                                        <label
                                            htmlFor="epub-upload"
                                            className="group flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/40 p-8 transition-all hover:border-foreground/40 hover:bg-muted/60"
                                        >
                                            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-foreground/10 text-foreground transition-transform group-hover:scale-110">
                                                <Upload className="h-8 w-8" />
                                            </div>
                                            <span className="mb-2 text-lg font-medium text-foreground">
                                                {uploading ? "Загрузка..." : "Нажмите для выбора файла"}
                                            </span>
                                            <span className="text-sm text-muted-foreground">
                                                или перетащите файл сюда
                                            </span>
                                            <Input
                                                id="epub-upload"
                                                type="file"
                                                accept=".epub,.md,.markdown,.docx,.pdf"
                                                className="hidden"
                                                onChange={handleFileUpload}
                                                disabled={uploading}
                                            />
                                        </label>
                                    )}

                                    {/* YouTube URL */}
                                    {sourceType === "youtube" && (
                                        <div className="space-y-4">
                                            <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/40 p-8">
                                                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-foreground/10 text-foreground">
                                                    <Youtube className="h-8 w-8" />
                                                </div>
                                                <span className="mb-4 text-lg font-medium text-foreground">
                                                    Добавить YouTube видео
                                                </span>
                                                <Input
                                                    type="url"
                                                    placeholder="https://www.youtube.com/watch?v=..."
                                                    value={youtubeUrl}
                                                    onChange={(e) => setYoutubeUrl(e.target.value)}
                                                    disabled={uploading}
                                                    className="w-full"
                                                />
                                            </div>
                                            <Button
                                                onClick={handleYouTubeSubmit}
                                                disabled={uploading || !youtubeUrl.trim()}
                                                className="w-full"
                                            >
                                                {uploading ? "Добавление..." : "Добавить видео"}
                                            </Button>
                                        </div>
                                    )}

                                    {/* Web URL */}
                                    {sourceType === "web" && (
                                        <div className="space-y-4">
                                            <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/40 p-8">
                                                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-foreground/10 text-foreground">
                                                    <Globe className="h-8 w-8" />
                                                </div>
                                                <span className="mb-4 text-lg font-medium text-foreground">
                                                    Добавить страницу сайта
                                                </span>
                                                <Input
                                                    type="url"
                                                    placeholder="https://example.com/article"
                                                    value={webUrl}
                                                    onChange={(e) => setWebUrl(e.target.value)}
                                                    disabled={uploading}
                                                    className="w-full"
                                                />
                                            </div>
                                            <Button
                                                onClick={handleWebSubmit}
                                                disabled={uploading || !webUrl.trim()}
                                                className="w-full"
                                            >
                                                {uploading ? "Добавление..." : "Добавить страницу"}
                                            </Button>
                                        </div>
                                    )}

                                    {/* Paste Text */}
                                    {sourceType === "paste" && (
                                        <div className="space-y-4">
                                            <div className="flex flex-col rounded-xl border-2 border-dashed border-border bg-muted/40 p-4">
                                                <div className="mb-3 flex items-center gap-3">
                                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-foreground/10 text-foreground">
                                                        <ClipboardPaste className="h-5 w-5" />
                                                    </div>
                                                    <Input
                                                        type="text"
                                                        placeholder="Заголовок (необязательно)"
                                                        value={pasteTitle}
                                                        onChange={(e) => setPasteTitle(e.target.value)}
                                                        disabled={uploading}
                                                        className="flex-1"
                                                    />
                                                </div>
                                                <div className="relative">
                                                    <Textarea
                                                        placeholder="Вставьте текст здесь... (поддерживается Markdown)"
                                                        value={pasteContent}
                                                        onChange={(e) => setPasteContent(e.target.value)}
                                                        disabled={uploading}
                                                        className="h-[180px] resize-none pr-12 pb-10"
                                                    />
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="icon"
                                                        onClick={() => setIsPasteFullscreen(true)}
                                                        disabled={uploading}
                                                        aria-label="Развернуть редактор"
                                                        className="absolute bottom-2 right-2 z-10 h-8 w-8"
                                                    >
                                                        <Maximize2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                            <Button
                                                onClick={handlePasteSubmit}
                                                disabled={uploading || !pasteContent.trim()}
                                                className="w-full"
                                            >
                                                {uploading ? "Добавление..." : "Добавить текст"}
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            </DialogContent>
                            </Dialog>
                        </div>
                        <Dialog open={isPasteFullscreen} onOpenChange={setIsPasteFullscreen}>
                            <DialogContent showCloseButton={false} className="flex !h-[80vh] !w-[80vw] max-w-none sm:max-w-none flex-col border-border bg-background p-4">
                                <DialogHeader className="sr-only">
                                    <DialogTitle>Редактировать текст</DialogTitle>
                                </DialogHeader>
                                <div className="relative flex-1">
                                    <Textarea
                                        placeholder="Вставьте текст здесь... (поддерживается Markdown)"
                                        value={pasteContent}
                                        onChange={(e) => setPasteContent(e.target.value)}
                                        disabled={uploading}
                                        className="h-full resize-none pr-12 pb-10"
                                    />
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => setIsPasteFullscreen(false)}
                                        disabled={uploading}
                                        className="absolute bottom-3 right-3 z-10"
                                    >
                                        Закрыть
                                    </Button>
                                </div>
                            </DialogContent>
                        </Dialog>
                        <CoverUploadDialog
                            isOpen={isCoverDialogOpen}
                            source={activeCoverSource}
                            onOpenChange={handleCoverDialogChange}
                            onSaved={fetchSources}
                        />
                        <Dialog
                            open={isRenameDialogOpen}
                            onOpenChange={handleRenameDialogChange}
                        >
                            <DialogContent className="border-border bg-background sm:max-w-md">
                                <DialogHeader>
                                    <DialogTitle className="text-foreground">
                                        Переименовать источник
                                    </DialogTitle>
                                    <DialogDescription className="text-muted-foreground">
                                        Новое название будет видно в библиотеке и тестах.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4">
                                    <Input
                                        value={renameTitle}
                                        onChange={(e) => setRenameTitle(e.target.value)}
                                        placeholder="Название источника"
                                        disabled={renaming}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter") {
                                                e.preventDefault();
                                                handleRename();
                                            }
                                        }}
                                    />
                                    <div className="flex gap-2">
                                        <Button
                                            variant="outline"
                                            className="flex-1"
                                            onClick={() => handleRenameDialogChange(false)}
                                            disabled={renaming}
                                        >
                                            Отмена
                                        </Button>
                                        <Button
                                            className="flex-1"
                                            onClick={handleRename}
                                            disabled={renaming || !renameTitle.trim()}
                                        >
                                            {renaming ? "Сохранение..." : "Сохранить"}
                                        </Button>
                                    </div>
                                </div>
                            </DialogContent>
                        </Dialog>
                    </div>
                </div>
            </header>

            {/* Content */}
            <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
                {loading ? (
                    <div className="flex min-h-[400px] items-center justify-center">
                        <div className="h-8 w-8 animate-spin rounded-full border-2 border-foreground/40 border-t-transparent" />
                    </div>
                ) : sources.length === 0 ? (
                    <div className="flex min-h-[400px] flex-col items-center justify-center text-center">
                        <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-muted/60">
                            <BookOpen className="h-12 w-12 text-muted-foreground" />
                        </div>
                        <h2 className="mb-2 text-2xl font-bold text-foreground">
                            Библиотека пуста
                        </h2>
                        <p className="mb-6 text-muted-foreground">
                            Загрузите свой первый источник, добавьте YouTube видео или страницу сайта
                        </p>
                        <Button
                            onClick={() => setIsDialogOpen(true)}
                            className="gap-2"
                        >
                            <Upload className="h-4 w-4" />
                            Загрузить
                        </Button>
                    </div>
                ) : (
                    <>
                        <div className="mb-4 rounded-xl border border-border bg-card p-3">
                            <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
                                <div className="min-w-0 flex-1">
                                    <Input
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        placeholder="Поиск по названию, автору и типу"
                                        className="h-9 bg-background text-foreground placeholder:text-muted-foreground"
                                    />
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                    <select
                                        value={sortBy}
                                        onChange={(e) => setSortBy(e.target.value as LibrarySortOption)}
                                        className="h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:border-foreground/60 focus:outline-none"
                                    >
                                        <option value="created_desc">Сначала новые</option>
                                        <option value="created_asc">Сначала старые</option>
                                        <option value="title_asc">Название А-Я</option>
                                        <option value="title_desc">Название Я-А</option>
                                        <option value="progress_desc">Прогресс по убыванию</option>
                                        <option value="progress_asc">Прогресс по возрастанию</option>
                                        <option value="size_desc">Размер по убыванию</option>
                                        <option value="size_asc">Размер по возрастанию</option>
                                    </select>
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant={isFiltersExpanded || hasActiveFilters ? "secondary" : "outline"}
                                        onClick={() => setIsFiltersExpanded((prev) => !prev)}
                                        className="gap-2"
                                    >
                                        <SlidersHorizontal className="h-4 w-4" />
                                        Фильтры
                                        {activeFiltersCount > 0 && (
                                            <span className="rounded-full bg-foreground/10 px-1.5 py-0.5 text-xs text-foreground">
                                                {activeFiltersCount}
                                            </span>
                                        )}
                                    </Button>
                                    {hasActiveFilters && (
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="ghost"
                                            onClick={resetFiltersAndSort}
                                        >
                                            Сбросить
                                        </Button>
                                    )}
                                </div>
                            </div>
                            {isFiltersExpanded && (
                                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                                    <select
                                        value={typeFilter}
                                        onChange={(e) => setTypeFilter(e.target.value)}
                                        className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:border-foreground/60 focus:outline-none"
                                    >
                                        <option value="all">Все типы</option>
                                        {sourceTypeOptions.map((option) => (
                                            <option key={option.value} value={option.value}>
                                                {option.label}
                                            </option>
                                        ))}
                                    </select>
                                    <select
                                        value={progressFilter}
                                        onChange={(e) =>
                                            setProgressFilter(e.target.value as LibraryProgressFilter)
                                        }
                                        className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:border-foreground/60 focus:outline-none"
                                    >
                                        <option value="all">Весь прогресс</option>
                                        <option value="not_started">Не начат</option>
                                        <option value="in_progress">В процессе</option>
                                        <option value="completed">Завершён</option>
                                    </select>
                                </div>
                            )}
                        </div>
                        {visibleSources.length === 0 ? (
                            <div className="flex min-h-[280px] flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 text-center">
                                <h3 className="mb-2 text-lg font-semibold text-foreground">
                                    Ничего не найдено
                                </h3>
                                <p className="mb-4 text-sm text-muted-foreground">
                                    Измените фильтры или очистите поиск
                                </p>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={resetFiltersAndSort}
                                >
                                    Очистить фильтры
                                </Button>
                            </div>
                        ) : viewMode === "cards" ? (
                    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {visibleSources.map((source) => (
                            <Card
                                key={source.id}
                                className="group relative min-w-0 overflow-hidden border-border bg-card transition-all hover:border-foreground/30 hover:shadow-lg hover:shadow-black/5"
                            >
                                <CardHeader className="pb-2">
                                    {/* Source Cover */}
                                    <Link
                                        href={`/library/${source.id}`}
                                        className="mb-4 flex aspect-[3/4] items-center justify-center overflow-hidden rounded-lg bg-muted/60 transition-transform group-hover:scale-[1.02]"
                                        aria-label={`Открыть ${source.title}`}
                                    >
                                        {source.coverPath ? (
                                            <img
                                                src={`/api${source.coverPath}`}
                                                alt={source.title}
                                                className="h-full w-full object-cover"
                                            />
                                        ) : (
                                            <FileText className="h-16 w-16 text-muted-foreground" />
                                        )}
                                    </Link>
                                    <CardTitle
                                        className="min-h-[3rem] text-lg leading-snug text-foreground break-words"
                                        title={source.title}
                                        style={{
                                            display: "-webkit-box",
                                            WebkitBoxOrient: "vertical",
                                            WebkitLineClamp: 2,
                                            overflow: "hidden",
                                        }}
                                    >
                                        {source.title}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="pb-2">
                                    <p className="mb-3 min-h-[1.25rem] text-sm text-muted-foreground">
                                        {getAuthorLabel(source) ?? ""}
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                        <Badge variant="secondary" className="gap-1">
                                            <Tag className="h-3 w-3" />
                                            {getSourceTypeLabel(source)}
                                        </Badge>
                                        <Badge variant="secondary" className="gap-1">
                                            <HardDrive className="h-3 w-3" />
                                            {formatFileSizeMb(source.fileSize)}
                                        </Badge>
                                        <Badge variant="secondary" className="gap-1">
                                            <Clock className="h-3 w-3" />
                                            {formatDateRuShort(source.createdAt)}
                                        </Badge>
                                    </div>
                                    {getSourceProgress(source) > 0 && (
                                        <div className="mt-3">
                                            <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                                                <span>Прогресс</span>
                                                <span>
                                                    {Math.round(getSourceProgress(source))}%
                                                </span>
                                            </div>
                                            <div className="h-1.5 overflow-hidden rounded-full bg-border">
                                                <div
                                                    className="h-full rounded-full bg-foreground"
                                                    style={{
                                                        width: `${getSourceProgress(source)}%`,
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </CardContent>
                                <CardFooter className="gap-2">
                                    <Link href={`/library/${source.id}`} className="flex-1">
                                        <Button className="w-full">
                                            <BookOpen className="mr-2 h-4 w-4" />
                                            Читать
                                        </Button>
                                    </Link>
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        className="text-muted-foreground hover:text-foreground"
                                        onClick={() => {
                                            setRenameSource(source);
                                            setRenameTitle(source.title);
                                            setIsRenameDialogOpen(true);
                                        }}
                                        aria-label="Переименовать источник"
                                        title="Переименовать источник"
                                    >
                                        <Pencil className="h-4 w-4" />
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        className="text-muted-foreground hover:text-foreground"
                                        onClick={() => {
                                            setActiveCoverSource(source);
                                            setIsCoverDialogOpen(true);
                                        }}
                                        aria-label="Изменить обложку"
                                        title="Изменить обложку"
                                    >
                                        <ImagePlus className="h-4 w-4" />
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        className="text-muted-foreground hover:text-foreground"
                                        onClick={() => handleDelete(source.id, source.title)}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </CardFooter>
                            </Card>
                        ))}
                    </div>
                ) : (
                    <div className="overflow-hidden rounded-xl border border-border bg-card">
                        <div className="overflow-x-auto">
                            <table className="min-w-[980px] w-full text-sm">
                                <thead className="bg-muted/60 text-left">
                                    <tr>
                                        <th className="px-4 py-3 font-medium text-foreground">Источник</th>
                                        <th className="px-4 py-3 font-medium text-foreground">Автор</th>
                                        <th className="px-4 py-3 font-medium text-foreground">Тип</th>
                                        <th className="px-4 py-3 font-medium text-foreground">Размер</th>
                                        <th className="px-4 py-3 font-medium text-foreground">Добавлен</th>
                                        <th className="px-4 py-3 font-medium text-foreground">Прогресс</th>
                                        <th className="px-4 py-3 text-right font-medium text-foreground">Действия</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {visibleSources.map((source) => (
                                        <tr key={source.id} className="border-t border-border align-middle">
                                            <td className="px-4 py-3">
                                                <Link
                                                    href={`/library/${source.id}`}
                                                    className="block max-w-[280px] truncate font-medium text-foreground hover:underline"
                                                    title={source.title}
                                                >
                                                    {source.title}
                                                </Link>
                                            </td>
                                            <td className="px-4 py-3 text-muted-foreground">
                                                {getAuthorLabel(source) ?? "—"}
                                            </td>
                                            <td className="px-4 py-3">
                                                <Badge variant="secondary" className="gap-1">
                                                    <Tag className="h-3 w-3" />
                                                    {getSourceTypeLabel(source)}
                                                </Badge>
                                            </td>
                                            <td className="px-4 py-3 text-muted-foreground">
                                                {formatFileSizeMb(source.fileSize)}
                                            </td>
                                            <td className="px-4 py-3 text-muted-foreground">
                                                {formatDateRuShort(source.createdAt)}
                                            </td>
                                            <td className="px-4 py-3 text-muted-foreground">
                                                {getSourceProgress(source) > 0
                                                    ? `${Math.round(getSourceProgress(source))}%`
                                                    : "—"}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center justify-end gap-2">
                                                    <Link href={`/library/${source.id}`}>
                                                        <Button size="sm">
                                                            <BookOpen className="mr-2 h-4 w-4" />
                                                            Читать
                                                        </Button>
                                                    </Link>
                                                    <Button
                                                        variant="outline"
                                                        size="icon"
                                                        className="text-muted-foreground hover:text-foreground"
                                                        onClick={() => {
                                                            setRenameSource(source);
                                                            setRenameTitle(source.title);
                                                            setIsRenameDialogOpen(true);
                                                        }}
                                                        aria-label="Переименовать источник"
                                                        title="Переименовать источник"
                                                    >
                                                        <Pencil className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        size="icon"
                                                        className="text-muted-foreground hover:text-foreground"
                                                        onClick={() => {
                                                            setActiveCoverSource(source);
                                                            setIsCoverDialogOpen(true);
                                                        }}
                                                        aria-label="Изменить обложку"
                                                        title="Изменить обложку"
                                                    >
                                                        <ImagePlus className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        size="icon"
                                                        className="text-muted-foreground hover:text-foreground"
                                                        onClick={() => handleDelete(source.id, source.title)}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                        )}
                    </>
                )}
            </main>
        </div>
    );
}
