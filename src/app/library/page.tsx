"use client";

import { useState, useEffect, useCallback } from "react";
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
} from "lucide-react";
import { toast } from "sonner";

interface Source {
    id: string;
    title: string;
    author: string | null;
    coverPath: string | null;
    filePath: string;
    fileSize: number | null;
    createdAt: string;
    readingProgress: { progress: number }[];
    _count: { chapters: number };
}

export default function LibraryPage() {
    const [sources, setSources] = useState<Source[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isPasteFullscreen, setIsPasteFullscreen] = useState(false);
    const [sourceType, setSourceType] = useState<"file" | "youtube" | "web" | "paste">(
        "file"
    );
    const [youtubeUrl, setYoutubeUrl] = useState("");
    const [webUrl, setWebUrl] = useState("");
    const [pasteTitle, setPasteTitle] = useState("");
    const [pasteContent, setPasteContent] = useState("");

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

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const allowedExtensions = [".epub", ".md", ".markdown"];
        const lowerName = file.name.toLowerCase();
        if (!allowedExtensions.some((ext) => lowerName.endsWith(ext))) {
            toast.error("Поддерживаются только файлы EPUB или Markdown");
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
        formData.append("pasteTitle", pasteTitle.trim() || "Вставленный текст");

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

    const formatFileSize = (bytes: number | null) => {
        if (!bytes) return "N/A";
        const mb = bytes / (1024 * 1024);
        return `${mb.toFixed(2)} MB`;
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString("ru-RU", {
            day: "numeric",
            month: "short",
            year: "numeric",
        });
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
                                                accept=".epub,.md,.markdown"
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
                    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {sources.map((source) => (
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
                                    <p className="mb-3 text-sm text-muted-foreground">
                                        {source.author || "Автор неизвестен"}
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                        <Badge variant="secondary" className="gap-1">
                                            <HardDrive className="h-3 w-3" />
                                            {formatFileSize(source.fileSize)}
                                        </Badge>
                                        <Badge variant="secondary" className="gap-1">
                                            <Clock className="h-3 w-3" />
                                            {formatDate(source.createdAt)}
                                        </Badge>
                                    </div>
                                    {source.readingProgress[0]?.progress > 0 && (
                                        <div className="mt-3">
                                            <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                                                <span>Прогресс</span>
                                                <span>
                                                    {Math.round(source.readingProgress[0].progress)}%
                                                </span>
                                            </div>
                                            <div className="h-1.5 overflow-hidden rounded-full bg-border">
                                                <div
                                                    className="h-full rounded-full bg-foreground"
                                                    style={{
                                                        width: `${source.readingProgress[0].progress}%`,
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
                                        onClick={() => handleDelete(source.id, source.title)}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </CardFooter>
                            </Card>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}
