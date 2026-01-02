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
import { Badge } from "@/components/ui/badge";
import {
    BookOpen,
    Upload,
    ArrowLeft,
    Trash2,
    FileText,
    Clock,
    HardDrive,
} from "lucide-react";
import { toast } from "sonner";

interface Book {
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
    const [books, setBooks] = useState<Book[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    const fetchBooks = useCallback(async () => {
        try {
            const response = await fetch("/api/books");
            if (!response.ok) throw new Error("Failed to fetch books");
            const data = await response.json();
            setBooks(data);
        } catch (error) {
            console.error("Error fetching books:", error);
            toast.error("Не удалось загрузить книги");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchBooks();
    }, [fetchBooks]);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.name.endsWith(".epub")) {
            toast.error("Поддерживаются только файлы EPUB");
            return;
        }

        setUploading(true);
        const formData = new FormData();
        formData.append("file", file);

        try {
            const response = await fetch("/api/books", {
                method: "POST",
                body: formData,
            });

            const data = await response.json().catch(() => null);

            if (!response.ok) {
                if (response.status === 409) {
                    toast.info("Книга уже загружена");
                    setIsDialogOpen(false);
                    fetchBooks();
                    return;
                }
                throw new Error(data?.error || "Failed to upload");
            }

            toast.success("Книга успешно загружена");
            setIsDialogOpen(false);
            fetchBooks();
        } catch (error) {
            console.error("Error uploading book:", error);
            toast.error("Не удалось загрузить книгу");
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async (id: string, title: string) => {
        if (!confirm(`Удалить книгу "${title}"?`)) return;

        try {
            const response = await fetch(`/api/books/${id}`, {
                method: "DELETE",
            });

            if (!response.ok) throw new Error("Failed to delete");

            toast.success("Книга удалена");
            fetchBooks();
        } catch (error) {
            console.error("Error deleting book:", error);
            toast.error("Не удалось удалить книгу");
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
                                    Загрузить книгу
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="border-border bg-background">
                                <DialogHeader>
                                    <DialogTitle className="text-foreground">
                                        Загрузить EPUB книгу
                                    </DialogTitle>
                                    <DialogDescription className="text-muted-foreground">
                                        Выберите файл в формате .epub для загрузки в библиотеку
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="mt-4">
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
                                            accept=".epub"
                                            className="hidden"
                                            onChange={handleFileUpload}
                                            disabled={uploading}
                                        />
                                    </label>
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
                ) : books.length === 0 ? (
                    <div className="flex min-h-[400px] flex-col items-center justify-center text-center">
                        <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-muted/60">
                            <BookOpen className="h-12 w-12 text-muted-foreground" />
                        </div>
                        <h2 className="mb-2 text-2xl font-bold text-foreground">
                            Библиотека пуста
                        </h2>
                        <p className="mb-6 text-muted-foreground">
                            Загрузите свою первую книгу в формате EPUB
                        </p>
                        <Button
                            onClick={() => setIsDialogOpen(true)}
                            className="gap-2"
                        >
                            <Upload className="h-4 w-4" />
                            Загрузить книгу
                        </Button>
                    </div>
                ) : (
                    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {books.map((book) => (
                            <Card
                                key={book.id}
                                className="group relative min-w-0 overflow-hidden border-border bg-card transition-all hover:border-foreground/30 hover:shadow-lg hover:shadow-black/5"
                            >
                                <CardHeader className="pb-2">
                                    {/* Book Cover */}
                                    <div className="mb-4 flex aspect-[3/4] items-center justify-center overflow-hidden rounded-lg bg-muted/60 transition-transform group-hover:scale-[1.02]">
                                        {book.coverPath ? (
                                            <img
                                                src={`/api${book.coverPath}`}
                                                alt={book.title}
                                                className="h-full w-full object-cover"
                                            />
                                        ) : (
                                            <FileText className="h-16 w-16 text-muted-foreground" />
                                        )}
                                    </div>
                                    <CardTitle
                                        className="min-h-[3rem] text-lg leading-snug text-foreground break-words"
                                        title={book.title}
                                        style={{
                                            display: "-webkit-box",
                                            WebkitBoxOrient: "vertical",
                                            WebkitLineClamp: 2,
                                            overflow: "hidden",
                                        }}
                                    >
                                        {book.title}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="pb-2">
                                    <p className="mb-3 text-sm text-muted-foreground">
                                        {book.author || "Автор неизвестен"}
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                        <Badge variant="secondary" className="gap-1">
                                            <HardDrive className="h-3 w-3" />
                                            {formatFileSize(book.fileSize)}
                                        </Badge>
                                        <Badge variant="secondary" className="gap-1">
                                            <Clock className="h-3 w-3" />
                                            {formatDate(book.createdAt)}
                                        </Badge>
                                    </div>
                                    {book.readingProgress[0]?.progress > 0 && (
                                        <div className="mt-3">
                                            <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                                                <span>Прогресс</span>
                                                <span>
                                                    {Math.round(book.readingProgress[0].progress)}%
                                                </span>
                                            </div>
                                            <div className="h-1.5 overflow-hidden rounded-full bg-border">
                                                <div
                                                    className="h-full rounded-full bg-foreground"
                                                    style={{
                                                        width: `${book.readingProgress[0].progress}%`,
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </CardContent>
                                <CardFooter className="gap-2">
                                    <Link href={`/library/${book.id}`} className="flex-1">
                                        <Button className="w-full">
                                            <BookOpen className="mr-2 h-4 w-4" />
                                            Читать
                                        </Button>
                                    </Link>
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        className="text-muted-foreground hover:text-foreground"
                                        onClick={() => handleDelete(book.id, book.title)}
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
