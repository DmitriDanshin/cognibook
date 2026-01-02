"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    GraduationCap,
    Upload,
    ArrowLeft,
    Trash2,
    FileJson,
    Clock,
    CheckCircle2,
    HelpCircle,
    AlertCircle,
    Play,
    Trophy,
} from "lucide-react";
import { toast } from "sonner";

interface Quiz {
    id: string;
    title: string;
    createdAt: string;
    _count: { questions: number; attempts: number };
    attempts: { score: number; totalQuestions: number; completedAt: string }[];
    chapter?: {
        id: string;
        title: string;
        order: number;
        bookId: string;
        book: {
            id: string;
            title: string;
            author: string | null;
        };
    } | null;
}

interface Book {
    id: string;
    title: string;
    author: string | null;
}

interface Chapter {
    id: string;
    title: string;
    parentId: string | null;
    order: number;
}

interface ChapterOption {
    id: string;
    label: string;
    depth: number;
}

interface ValidationError {
    path: string;
    message: string;
}

export default function QuizzesPage() {
    const router = useRouter();
    const [quizzes, setQuizzes] = useState<Quiz[]>([]);
    const [books, setBooks] = useState<Book[]>([]);
    const [booksLoading, setBooksLoading] = useState(true);
    const [chapters, setChapters] = useState<Chapter[]>([]);
    const [chaptersLoading, setChaptersLoading] = useState(false);
    const [selectedBookId, setSelectedBookId] = useState("");
    const [selectedChapterId, setSelectedChapterId] = useState("");
    const [chapterSearch, setChapterSearch] = useState("");
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [jsonText, setJsonText] = useState("");
    const [selectedSection, setSelectedSection] = useState("");
    const [validationErrors, setValidationErrors] = useState<ValidationError[]>(
        []
    );

    const fetchQuizzes = useCallback(async () => {
        try {
            const response = await fetch("/api/quizzes");
            if (!response.ok) throw new Error("Failed to fetch quizzes");
            const data = await response.json();
            setQuizzes(data);
        } catch (error) {
            console.error("Error fetching quizzes:", error);
            toast.error("Не удалось загрузить тесты");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchQuizzes();
    }, [fetchQuizzes]);

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
            setBooksLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchBooks();
    }, [fetchBooks]);

    const fetchChapters = useCallback(async (bookId: string) => {
        setChaptersLoading(true);
        try {
            const response = await fetch(`/api/books/${bookId}`);
            if (!response.ok) throw new Error("Failed to fetch chapters");
            const data = await response.json();
            setChapters(data.chapters || []);
        } catch (error) {
            console.error("Error fetching chapters:", error);
            toast.error("Не удалось загрузить главы");
        } finally {
            setChaptersLoading(false);
        }
    }, []);

    const handleBookChange = async (bookId: string) => {
        setSelectedBookId(bookId);
        setSelectedChapterId("");
        setChapterSearch("");
        if (!bookId) {
            setChapters([]);
            return;
        }
        await fetchChapters(bookId);
    };

    const buildChapterOptions = useCallback((chapterList: Chapter[]) => {
        const map = new Map<string, Chapter>();
        chapterList.forEach((chapter) => map.set(chapter.id, chapter));

        const getDepth = (chapter: Chapter) => {
            let depth = 0;
            let current = chapter;
            while (current.parentId) {
                const parent = map.get(current.parentId);
                if (!parent) break;
                depth += 1;
                current = parent;
            }
            return depth;
        };

        const getLabel = (chapter: Chapter) => {
            const titles: string[] = [chapter.title];
            let current = chapter;
            while (current.parentId) {
                const parent = map.get(current.parentId);
                if (!parent) break;
                titles.push(parent.title);
                current = parent;
            }
            return titles.reverse().join(" / ");
        };

        return chapterList.map((chapter) => ({
            id: chapter.id,
            label: getLabel(chapter),
            depth: getDepth(chapter),
        }));
    }, []);

    const submitQuiz = async (formData: FormData) => {
        setUploading(true);
        setValidationErrors([]);

        try {
            if (selectedBookId && !selectedChapterId) {
                toast.error("Выберите главу для выбранной книги");
                return;
            }

            if (selectedBookId) {
                formData.append("bookId", selectedBookId);
                formData.append("chapterId", selectedChapterId);
            }

            const response = await fetch("/api/quizzes", {
                method: "POST",
                body: formData,
            });

            const data = await response.json();

            if (!response.ok) {
                if (data.details) {
                    setValidationErrors(data.details);
                    toast.error("Ошибка валидации JSON");
                } else {
                    toast.error(data.error || "Не удалось загрузить тест");
                }
                return;
            }

            toast.success("Тест успешно загружен");
            setIsDialogOpen(false);
            setValidationErrors([]);
            setJsonText("");
            const createdQuizId = data?.id as string | undefined;
            if (createdQuizId) {
                router.push(`/quizzes/${createdQuizId}`);
                return;
            }
            fetchQuizzes();
        } catch (error) {
            console.error("Error uploading quiz:", error);
            toast.error("Не удалось загрузить тест");
        } finally {
            setUploading(false);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.name.endsWith(".json")) {
            toast.error("Поддерживаются только файлы JSON");
            return;
        }

        const formData = new FormData();
        formData.append("file", file);
        await submitQuiz(formData);
    };

    const handleTextUpload = async () => {
        if (!jsonText.trim()) {
            toast.error("Вставьте JSON");
            return;
        }

        try {
            JSON.parse(jsonText);
        } catch {
            toast.error("Невалидный JSON");
            return;
        }

        const formData = new FormData();
        const file = new File([jsonText], "quiz.json", {
            type: "application/json",
        });
        formData.append("file", file);
        await submitQuiz(formData);
    };

    const handleDelete = async (id: string, title: string) => {
        if (!confirm(`Удалить тест "${title}"?`)) return;

        try {
            const response = await fetch(`/api/quizzes/${id}`, {
                method: "DELETE",
            });

            if (!response.ok) throw new Error("Failed to delete");

            toast.success("Тест удалён");
            fetchQuizzes();
        } catch (error) {
            console.error("Error deleting quiz:", error);
            toast.error("Не удалось удалить тест");
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString("ru-RU", {
            day: "numeric",
            month: "short",
            year: "numeric",
        });
    };

    const getLastAttemptBadge = (quiz: Quiz) => {
        if (quiz.attempts.length === 0) {
            return (
                <Badge
                    variant="secondary"
                    className="gap-1 bg-slate-700/50 text-slate-300"
                >
                    <HelpCircle className="h-3 w-3" />
                    Новый
                </Badge>
            );
        }

        const lastAttempt = quiz.attempts[0];
        const percentage = Math.round(
            (lastAttempt.score / lastAttempt.totalQuestions) * 100
        );

        if (percentage >= 80) {
            return (
                <Badge className="gap-1 bg-emerald-500/20 text-emerald-400">
                    <Trophy className="h-3 w-3" />
                    {percentage}%
                </Badge>
            );
        } else if (percentage >= 50) {
            return (
                <Badge className="gap-1 bg-amber-500/20 text-amber-400">
                    <CheckCircle2 className="h-3 w-3" />
                    {percentage}%
                </Badge>
            );
        } else {
            return (
                <Badge className="gap-1 bg-red-500/20 text-red-400">
                    <AlertCircle className="h-3 w-3" />
                    {percentage}%
                </Badge>
            );
        }
    };

    const chapterOptions = buildChapterOptions(chapters);
    const filteredChapters = chapterOptions.filter((chapter) =>
        chapter.label.toLowerCase().includes(chapterSearch.trim().toLowerCase())
    );

    const bookGroups = useMemo(() => {
        const map = new Map<
            string,
            { book: { id: string; title: string; author: string | null }; quizzes: Quiz[] }
        >();

        quizzes.forEach((quiz) => {
            if (!quiz.chapter?.book) return;
            const bookId = quiz.chapter.book.id;
            if (!map.has(bookId)) {
                map.set(bookId, {
                    book: {
                        id: quiz.chapter.book.id,
                        title: quiz.chapter.book.title,
                        author: quiz.chapter.book.author ?? null,
                    },
                    quizzes: [],
                });
            }
            map.get(bookId)!.quizzes.push(quiz);
        });

        const groups = Array.from(map.values());
        groups.forEach((group) => {
            group.quizzes.sort((a, b) => {
                const orderA = a.chapter?.order ?? 0;
                const orderB = b.chapter?.order ?? 0;
                if (orderA !== orderB) return orderA - orderB;
                return a.title.localeCompare(b.title);
            });
        });

        return groups.sort((a, b) => a.book.title.localeCompare(b.book.title));
    }, [quizzes]);

    const otherQuizzes = useMemo(
        () => quizzes.filter((quiz) => !quiz.chapter),
        [quizzes]
    );

    useEffect(() => {
        if (selectedSection === "other") {
            if (otherQuizzes.length > 0) return;
        } else if (
            selectedSection &&
            bookGroups.some((group) => group.book.id === selectedSection)
        ) {
            return;
        }

        if (bookGroups.length > 0) {
            setSelectedSection(bookGroups[0].book.id);
        } else if (otherQuizzes.length > 0) {
            setSelectedSection("other");
        } else {
            setSelectedSection("");
        }
    }, [bookGroups, otherQuizzes, selectedSection]);

    const selectedBookGroup = bookGroups.find(
        (group) => group.book.id === selectedSection
    );
    const showingOther = selectedSection === "other";

    const renderQuizCard = (quiz: Quiz, mode: "chapter" | "other") => {
        const baseTitle =
            mode === "chapter"
                ? quiz.chapter?.title || quiz.title
                : quiz.title;
        const heading =
            mode === "chapter" ? `Глава: ${baseTitle}` : baseTitle;
        const showSubtitle =
            mode === "chapter" &&
            quiz.chapter?.title &&
            quiz.title !== quiz.chapter.title;

        return (
            <Card
                key={quiz.id}
                className="group relative min-w-0 overflow-hidden border-slate-800 bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur transition-all hover:border-indigo-500/50 hover:shadow-lg hover:shadow-indigo-500/10"
            >
                <CardHeader>
                    <CardTitle
                        className="text-lg leading-snug text-white break-words"
                        title={heading}
                        style={{
                            display: "-webkit-box",
                            WebkitBoxOrient: "vertical",
                            WebkitLineClamp: 2,
                            overflow: "hidden",
                        }}
                    >
                        {heading}
                    </CardTitle>
                    {showSubtitle && (
                        <p className="mt-2 text-sm text-slate-400">{quiz.title}</p>
                    )}
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                        <Badge
                            variant="secondary"
                            className="gap-1 bg-slate-700/50 text-slate-300"
                        >
                            <HelpCircle className="h-3 w-3" />
                            {quiz._count.questions} вопросов
                        </Badge>
                        {getLastAttemptBadge(quiz)}
                        {mode === "other" && (
                            <Badge
                                variant="secondary"
                                className="bg-slate-700/50 text-slate-300"
                            >
                                Без книги
                            </Badge>
                        )}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-400">
                        <Clock className="h-4 w-4" />
                        <span>Создан {formatDate(quiz.createdAt)}</span>
                    </div>
                    {quiz._count.attempts > 0 && (
                        <div className="text-sm text-slate-500">
                            Попыток: {quiz._count.attempts}
                        </div>
                    )}
                </CardContent>
                <CardFooter className="gap-2">
                    <Link href={`/quizzes/${quiz.id}`} className="flex-1">
                        <Button className="w-full bg-indigo-600 hover:bg-indigo-500">
                            <Play className="mr-2 h-4 w-4" />
                            Начать тест
                        </Button>
                    </Link>
                    <Button
                        variant="outline"
                        size="icon"
                        className="border-slate-700 text-slate-400 hover:border-red-500 hover:bg-red-500/10 hover:text-red-400"
                        onClick={() => handleDelete(quiz.id, quiz.title)}
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </CardFooter>
            </Card>
        );
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
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-600">
                                    <GraduationCap className="h-5 w-5 text-white" />
                                </div>
                                <h1 className="text-xl font-bold text-white">Тесты</h1>
                            </div>
                        </div>

                        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                            <DialogTrigger asChild>
                                <Button className="gap-2 bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500">
                                    <Upload className="h-4 w-4" />
                                    Загрузить тест
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto border-slate-800 bg-slate-900">
                                <DialogHeader>
                                    <DialogTitle className="text-white">
                                        Загрузить JSON тест
                                    </DialogTitle>
                                <DialogDescription className="text-slate-400">
                                    Выберите файл .json с тестом в правильном формате
                                </DialogDescription>
                            </DialogHeader>
                            <div className="mt-4 space-y-4">
                                <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
                                    <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                                        Привязка к книге
                                    </div>
                                    <div className="space-y-3">
                                        <label className="text-sm text-slate-300">
                                            Книга
                                        </label>
                                        <select
                                            value={selectedBookId}
                                            onChange={(e) => handleBookChange(e.target.value)}
                                            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:border-indigo-500 focus:outline-none"
                                            disabled={uploading || booksLoading}
                                        >
                                            <option value="">Не привязывать</option>
                                            {books.map((book) => (
                                                <option key={book.id} value={book.id}>
                                                    {book.title}
                                                </option>
                                            ))}
                                        </select>

                                        {selectedBookId && (
                                            <>
                                                <label className="text-sm text-slate-300">
                                                    Глава
                                                </label>
                                                <Input
                                                    value={chapterSearch}
                                                    onChange={(e) =>
                                                        setChapterSearch(e.target.value)
                                                    }
                                                    placeholder="Поиск главы"
                                                    className="bg-slate-900 text-slate-100 placeholder:text-slate-500"
                                                    disabled={uploading || chaptersLoading}
                                                />
                                                <ScrollArea className="h-40 rounded-lg border border-slate-800 bg-slate-900/60">
                                                    <div className="p-2">
                                                        {chaptersLoading ? (
                                                            <div className="px-3 py-2 text-sm text-slate-500">
                                                                Загрузка глав...
                                                            </div>
                                                        ) : filteredChapters.length === 0 ? (
                                                            <div className="px-3 py-2 text-sm text-slate-500">
                                                                Главы не найдены
                                                            </div>
                                                        ) : (
                                                            filteredChapters.map((chapter) => (
                                                                <button
                                                                    key={chapter.id}
                                                                    type="button"
                                                                    onClick={() =>
                                                                        setSelectedChapterId(chapter.id)
                                                                    }
                                                                    className={`flex w-full items-center rounded-md px-3 py-2 text-left text-sm transition-colors ${selectedChapterId === chapter.id
                                                                            ? "bg-indigo-500/20 text-indigo-200"
                                                                            : "text-slate-300 hover:bg-slate-800 hover:text-slate-100"
                                                                        }`}
                                                                    style={{
                                                                        paddingLeft: `${chapter.depth * 12 + 12}px`,
                                                                    }}
                                                                >
                                                                    {chapter.label}
                                                                </button>
                                                            ))
                                                        )}
                                                    </div>
                                                </ScrollArea>
                                            </>
                                        )}
                                    </div>
                                </div>

                                <label
                                    htmlFor="json-upload"
                                    className="group flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-700 bg-slate-800/50 p-8 transition-all hover:border-indigo-500 hover:bg-slate-800"
                                    >
                                        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-indigo-500/20 text-indigo-400 transition-transform group-hover:scale-110">
                                            <FileJson className="h-8 w-8" />
                                        </div>
                                        <span className="mb-2 text-lg font-medium text-white">
                                            {uploading ? "Загрузка..." : "Нажмите для выбора файла"}
                                        </span>
                                        <span className="text-sm text-slate-400">
                                            или перетащите файл сюда
                                        </span>
                                        <Input
                                            id="json-upload"
                                            type="file"
                                            accept=".json"
                                            className="hidden"
                                            onChange={handleFileUpload}
                                            disabled={uploading}
                                        />
                                    </label>

                                    {validationErrors.length > 0 && (
                                        <Alert
                                            variant="destructive"
                                            className="border-red-500/50 bg-red-500/10"
                                        >
                                            <AlertCircle className="h-4 w-4" />
                                            <AlertDescription>
                                                <div className="mt-2 space-y-1">
                                                    {validationErrors.map((error, index) => (
                                                        <div key={index} className="text-sm">
                                                            <span className="font-medium">{error.path}:</span>{" "}
                                                            {error.message}
                                                        </div>
                                                    ))}
                                                </div>
                                            </AlertDescription>
                                        </Alert>
                                    )}

                                    <div className="flex items-center gap-3 text-xs uppercase tracking-wide text-slate-500">
                                        <span className="h-px flex-1 bg-slate-800" />
                                        или вставьте JSON
                                        <span className="h-px flex-1 bg-slate-800" />
                                    </div>

                                    <div className="space-y-3">
                                        <Textarea
                                            value={jsonText}
                                            onChange={(e) => setJsonText(e.target.value)}
                                            placeholder="Вставьте JSON теста сюда"
                                            className="min-h-40 max-h-60 resize-y overflow-y-auto bg-slate-950/40 text-slate-100 placeholder:text-slate-500"
                                            disabled={uploading}
                                        />
                                        <Button
                                            type="button"
                                            className="w-full bg-indigo-600 hover:bg-indigo-500"
                                            onClick={handleTextUpload}
                                            disabled={uploading || !jsonText.trim()}
                                        >
                                            {uploading ? "Загрузка..." : "Импортировать из текста"}
                                        </Button>
                                    </div>

                                    <div className="rounded-lg bg-slate-800/50 p-4">
                                        <h4 className="mb-2 text-sm font-medium text-slate-300">
                                            Пример структуры JSON:
                                        </h4>
                                        <pre className="overflow-x-auto text-xs text-slate-400">
                                            {`{
  "title": "Название теста",
  "questions": [{
    "id": "q1",
    "text": "Вопрос?",
    "quote": "Цитата из текста (опционально)",
    "type": "single",
    "options": [{
      "id": "opt1",
      "text": "Ответ",
      "explanation": "Пояснение"
    }],
    "correctAnswers": ["opt1"]
  }]
}`}
                                        </pre>
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
                        <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
                    </div>
                ) : quizzes.length === 0 ? (
                    <div className="flex min-h-[400px] flex-col items-center justify-center text-center">
                        <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-slate-800">
                            <GraduationCap className="h-12 w-12 text-slate-600" />
                        </div>
                        <h2 className="mb-2 text-2xl font-bold text-white">
                            Тестов пока нет
                        </h2>
                        <p className="mb-6 text-slate-400">
                            Загрузите свой первый тест в формате JSON
                        </p>
                        <Button
                            onClick={() => setIsDialogOpen(true)}
                            className="gap-2 bg-gradient-to-r from-indigo-600 to-cyan-600"
                        >
                            <Upload className="h-4 w-4" />
                            Загрузить тест
                        </Button>
                    </div>
                ) : (
                    <div className="space-y-8">
                        <div className="flex flex-wrap gap-3">
                            {bookGroups.map((group) => (
                                <button
                                    key={group.book.id}
                                    type="button"
                                    onClick={() => setSelectedSection(group.book.id)}
                                    className={`w-full max-w-full rounded-xl border px-4 py-3 text-left transition-all sm:w-56 ${selectedSection === group.book.id
                                            ? "border-indigo-500/70 bg-indigo-500/10 text-white"
                                            : "border-slate-800 bg-slate-900/60 text-slate-300 hover:border-indigo-500/40 hover:bg-slate-800"
                                        }`}
                                    title={group.book.title}
                                >
                                    <div className="line-clamp-2 text-sm font-semibold break-words">
                                        {group.book.title}
                                    </div>
                                    <div className="mt-1 text-xs text-slate-400">
                                        {group.quizzes.length} тестов
                                    </div>
                                </button>
                            ))}
                            {otherQuizzes.length > 0 && (
                                <button
                                    type="button"
                                    onClick={() => setSelectedSection("other")}
                                    className={`w-full max-w-full rounded-xl border px-4 py-3 text-left transition-all sm:w-56 ${selectedSection === "other"
                                            ? "border-indigo-500/70 bg-indigo-500/10 text-white"
                                            : "border-slate-800 bg-slate-900/60 text-slate-300 hover:border-indigo-500/40 hover:bg-slate-800"
                                        }`}
                                >
                                    <div className="text-sm font-semibold">Другие тесты</div>
                                    <div className="mt-1 text-xs text-slate-400">
                                        {otherQuizzes.length} тестов
                                    </div>
                                </button>
                            )}
                        </div>

                        {selectedBookGroup && (
                            <section className="space-y-4">
                                <div>
                                    <h2
                                        className="text-xl font-semibold text-white break-words line-clamp-2"
                                        title={selectedBookGroup.book.title}
                                    >
                                        {selectedBookGroup.book.title}
                                    </h2>
                                    {selectedBookGroup.book.author && (
                                        <div className="text-sm text-slate-400">
                                            {selectedBookGroup.book.author}
                                        </div>
                                    )}
                                </div>
                                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                                    {selectedBookGroup.quizzes.map((quiz) =>
                                        renderQuizCard(quiz, "chapter")
                                    )}
                                </div>
                            </section>
                        )}

                        {showingOther && (
                            <section className="space-y-4">
                                <h2 className="text-xl font-semibold text-white">
                                    Другие тесты
                                </h2>
                                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                                    {otherQuizzes.map((quiz) =>
                                        renderQuizCard(quiz, "other")
                                    )}
                                </div>
                            </section>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
}
