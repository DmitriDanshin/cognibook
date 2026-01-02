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

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || "Failed to upload");
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
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
            {/* Header */}
            <header className="sticky top-0 z-50 border-b border-white/10 bg-slate-900/80 backdrop-blur-xl">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                    <div className="flex h-16 items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Link href="/">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="text-slate-400 hover:text-white"
                                >
                                    <ArrowLeft className="h-5 w-5" />
                                </Button>
                            </Link>
                            <div className="flex items-center gap-2">
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600">
                                    <BookOpen className="h-5 w-5 text-white" />
                                </div>
                                <h1 className="text-xl font-bold text-white">Библиотека</h1>
                            </div>
                        </div>

                        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                            <DialogTrigger asChild>
                                <Button className="gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500">
                                    <Upload className="h-4 w-4" />
                                    Загрузить книгу
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="border-slate-800 bg-slate-900">
                                <DialogHeader>
                                    <DialogTitle className="text-white">
                                        Загрузить EPUB книгу
                                    </DialogTitle>
                                    <DialogDescription className="text-slate-400">
                                        Выберите файл в формате .epub для загрузки в библиотеку
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="mt-4">
                                    <label
                                        htmlFor="epub-upload"
                                        className="group flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-700 bg-slate-800/50 p-8 transition-all hover:border-violet-500 hover:bg-slate-800"
                                    >
                                        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-violet-500/20 text-violet-400 transition-transform group-hover:scale-110">
                                            <Upload className="h-8 w-8" />
                                        </div>
                                        <span className="mb-2 text-lg font-medium text-white">
                                            {uploading ? "Загрузка..." : "Нажмите для выбора файла"}
                                        </span>
                                        <span className="text-sm text-slate-400">
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
                        <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
                    </div>
                ) : books.length === 0 ? (
                    <div className="flex min-h-[400px] flex-col items-center justify-center text-center">
                        <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-slate-800">
                            <BookOpen className="h-12 w-12 text-slate-600" />
                        </div>
                        <h2 className="mb-2 text-2xl font-bold text-white">
                            Библиотека пуста
                        </h2>
                        <p className="mb-6 text-slate-400">
                            Загрузите свою первую книгу в формате EPUB
                        </p>
                        <Button
                            onClick={() => setIsDialogOpen(true)}
                            className="gap-2 bg-gradient-to-r from-violet-600 to-indigo-600"
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
                                className="group relative overflow-hidden border-slate-800 bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur transition-all hover:border-violet-500/50 hover:shadow-lg hover:shadow-violet-500/10"
                            >
                                <CardHeader className="pb-2">
                                    {/* Book Cover */}
                                    <div className="mb-4 flex aspect-[3/4] items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-slate-700 to-slate-800 transition-transform group-hover:scale-[1.02]">
                                        {book.coverPath ? (
                                            <img
                                                src={`/api${book.coverPath}`}
                                                alt={book.title}
                                                className="h-full w-full object-cover"
                                            />
                                        ) : (
                                            <FileText className="h-16 w-16 text-slate-500" />
                                        )}
                                    </div>
                                    <CardTitle className="text-lg text-white" title={book.title}>
                                        {book.title}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="pb-2">
                                    <p className="mb-3 text-sm text-slate-400">
                                        {book.author || "Автор неизвестен"}
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                        <Badge
                                            variant="secondary"
                                            className="gap-1 bg-slate-700/50 text-slate-300"
                                        >
                                            <HardDrive className="h-3 w-3" />
                                            {formatFileSize(book.fileSize)}
                                        </Badge>
                                        <Badge
                                            variant="secondary"
                                            className="gap-1 bg-slate-700/50 text-slate-300"
                                        >
                                            <Clock className="h-3 w-3" />
                                            {formatDate(book.createdAt)}
                                        </Badge>
                                    </div>
                                    {book.readingProgress[0]?.progress > 0 && (
                                        <div className="mt-3">
                                            <div className="mb-1 flex justify-between text-xs text-slate-400">
                                                <span>Прогресс</span>
                                                <span>
                                                    {Math.round(book.readingProgress[0].progress)}%
                                                </span>
                                            </div>
                                            <div className="h-1.5 overflow-hidden rounded-full bg-slate-700">
                                                <div
                                                    className="h-full rounded-full bg-gradient-to-r from-violet-500 to-indigo-500"
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
                                        <Button className="w-full bg-violet-600 hover:bg-violet-500">
                                            <BookOpen className="mr-2 h-4 w-4" />
                                            Читать
                                        </Button>
                                    </Link>
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        className="border-slate-700 text-slate-400 hover:border-red-500 hover:bg-red-500/10 hover:text-red-400"
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
