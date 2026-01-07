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
    Filter,
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
        sourceId: string;
        source: {
            id: string;
            title: string;
            author: string | null;
        };
    } | null;
}

interface Source {
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

type QuizStatusFilter = "all" | "not_started" | "in_progress" | "passed" | "failed";

interface SavedQuizProgress {
    version: number;
    currentQuestionIndex: number;
    answers: Record<string, string[]>;
    checkedQuestions: Record<string, { isCorrect: boolean }>;
    isFinished: boolean;
    finalScore: { score: number; total: number };
}

const STATUS_FILTERS: { value: QuizStatusFilter; label: string }[] = [
    { value: "all", label: "Все" },
    { value: "not_started", label: "Новые" },
    { value: "in_progress", label: "В процессе" },
    { value: "passed", label: "Пройденные" },
    { value: "failed", label: "С ошибками" },
];

export default function QuizzesPage() {
    const router = useRouter();
    const [quizzes, setQuizzes] = useState<Quiz[]>([]);
    const [sources, setSources] = useState<Source[]>([]);
    const [sourcesLoading, setSourcesLoading] = useState(true);
    const [chapters, setChapters] = useState<Chapter[]>([]);
    const [chaptersLoading, setChaptersLoading] = useState(false);
    const [selectedSourceId, setSelectedSourceId] = useState("");
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
    const [statusFilter, setStatusFilter] = useState<QuizStatusFilter>("not_started");
    const [quizStatuses, setQuizStatuses] = useState<Map<string, QuizStatusFilter>>(
        new Map()
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

    // Determine quiz statuses from localStorage and attempts
    useEffect(() => {
        if (quizzes.length === 0) return;

        const statuses = new Map<string, QuizStatusFilter>();

        quizzes.forEach((quiz) => {
            // Check if quiz was completed with a stored attempt
            if (quiz.attempts.length > 0) {
                const lastAttempt = quiz.attempts[0];
                const percentage = Math.round(
                    (lastAttempt.score / lastAttempt.totalQuestions) * 100
                );
                statuses.set(quiz.id, percentage >= 70 ? "passed" : "failed");
                return;
            }

            // Check localStorage for in-progress quizzes
            try {
                const storageKey = `quiz-progress:${quiz.id}`;
                const raw = localStorage.getItem(storageKey);
                if (!raw) {
                    statuses.set(quiz.id, "not_started");
                    return;
                }

                const parsed = JSON.parse(raw) as SavedQuizProgress;
                if (!parsed || parsed.version !== 1) {
                    statuses.set(quiz.id, "not_started");
                    return;
                }

                // Check if there's any progress
                const hasAnswers = Object.keys(parsed.answers || {}).length > 0;
                const hasChecked = Object.keys(parsed.checkedQuestions || {}).length > 0;

                if (parsed.isFinished) {
                    // Quiz finished but not submitted to server
                    const percentage = parsed.finalScore.total > 0
                        ? Math.round((parsed.finalScore.score / parsed.finalScore.total) * 100)
                        : 0;
                    statuses.set(quiz.id, percentage >= 70 ? "passed" : "failed");
                } else if (hasAnswers || hasChecked) {
                    statuses.set(quiz.id, "in_progress");
                } else {
                    statuses.set(quiz.id, "not_started");
                }
            } catch {
                statuses.set(quiz.id, "not_started");
            }
        });

        setQuizStatuses(statuses);
    }, [quizzes]);

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
            setSourcesLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchSources();
    }, [fetchSources]);

    const fetchChapters = useCallback(async (sourceId: string) => {
        setChaptersLoading(true);
        try {
            const response = await fetch(`/api/sources/${sourceId}`);
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

    const handleSourceChange = async (sourceId: string) => {
        setSelectedSourceId(sourceId);
        setSelectedChapterId("");
        setChapterSearch("");
        if (!sourceId) {
            setChapters([]);
            return;
        }
        await fetchChapters(sourceId);
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
            if (selectedSourceId && !selectedChapterId) {
                toast.error("Выберите главу для выбранного источника");
                return;
            }

            if (selectedSourceId) {
                formData.append("sourceId", selectedSourceId);
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
                    toast.error("Ошибка валидации формата");
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

        const lowerName = file.name.toLowerCase();
        const allowedExtensions = [".json", ".yaml", ".yml"];
        if (!allowedExtensions.some((ext) => lowerName.endsWith(ext))) {
            toast.error("Поддерживаются файлы JSON или YAML");
            return;
        }

        const formData = new FormData();
        formData.append("file", file);
        await submitQuiz(formData);
    };

    const handleTextUpload = async () => {
        if (!jsonText.trim()) {
            toast.error("Вставьте JSON или YAML");
            return;
        }

        const formData = new FormData();
        const file = new File([jsonText], "quiz.yaml", {
            type: "text/yaml",
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
                <Badge variant="secondary" className="gap-1">
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
                <Badge className="gap-1 bg-foreground/10 text-foreground">
                    <Trophy className="h-3 w-3" />
                    {percentage}%
                </Badge>
            );
        } else if (percentage >= 50) {
            return (
                <Badge className="gap-1 bg-muted/60 text-foreground">
                    <CheckCircle2 className="h-3 w-3" />
                    {percentage}%
                </Badge>
            );
        } else {
            return (
                <Badge className="gap-1 bg-border text-muted-foreground">
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

    // Count quizzes by status
    const statusCounts = useMemo(() => {
        const counts = new Map<QuizStatusFilter, number>();
        STATUS_FILTERS.forEach((filter) => counts.set(filter.value, 0));

        quizzes.forEach((quiz) => {
            const status = quizStatuses.get(quiz.id);
            if (status) {
                counts.set(status, (counts.get(status) || 0) + 1);
            }
        });
        counts.set("all", quizzes.length);

        return counts;
    }, [quizzes, quizStatuses]);

    // Filter quizzes by status
    const filteredQuizzes = useMemo(() => {
        if (statusFilter === "all") return quizzes;
        return quizzes.filter((quiz) => quizStatuses.get(quiz.id) === statusFilter);
    }, [quizzes, quizStatuses, statusFilter]);

    const sourceGroups = useMemo(() => {
        const map = new Map<
            string,
            { source: { id: string; title: string; author: string | null }; quizzes: Quiz[] }
        >();

        filteredQuizzes.forEach((quiz) => {
            if (!quiz.chapter?.source) return;
            const sourceId = quiz.chapter.source.id;
            if (!map.has(sourceId)) {
                map.set(sourceId, {
                    source: {
                        id: quiz.chapter.source.id,
                        title: quiz.chapter.source.title,
                        author: quiz.chapter.source.author ?? null,
                    },
                    quizzes: [],
                });
            }
            map.get(sourceId)!.quizzes.push(quiz);
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

        return groups.sort((a, b) => a.source.title.localeCompare(b.source.title));
    }, [filteredQuizzes]);

    const otherQuizzes = useMemo(
        () => filteredQuizzes.filter((quiz) => !quiz.chapter),
        [filteredQuizzes]
    );

    useEffect(() => {
        if (selectedSection === "other") {
            if (otherQuizzes.length > 0) return;
        } else if (
            selectedSection &&
            sourceGroups.some((group) => group.source.id === selectedSection)
        ) {
            return;
        }

        if (sourceGroups.length > 0) {
            setSelectedSection(sourceGroups[0].source.id);
        } else if (otherQuizzes.length > 0) {
            setSelectedSection("other");
        } else {
            setSelectedSection("");
        }
    }, [sourceGroups, otherQuizzes, selectedSection]);

    const selectedSourceGroup = sourceGroups.find(
        (group) => group.source.id === selectedSection
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
                className="group relative min-w-0 overflow-hidden border-border bg-card transition-all hover:border-foreground/30 hover:shadow-lg hover:shadow-black/5"
            >
                <CardHeader>
                    <CardTitle
                        className="text-lg leading-snug text-foreground break-words"
                        title={heading}
                        style={{
                            display: "-webkit-box",
                            WebkitBoxOrient: "vertical",
                            WebkitLineClamp: 2,
                            overflow: "hidden",
                        }}
                    >
                        {quiz.chapter ? (
                            <Link
                                href={`/library/${quiz.chapter.sourceId}?chapterId=${quiz.chapter.id}`}
                                className="hover:text-blue-600 transition-colors"
                            >
                                {heading}
                            </Link>
                        ) : (
                            heading
                        )}
                    </CardTitle>
                    {showSubtitle && (
                        <p className="mt-2 text-sm text-muted-foreground">{quiz.title}</p>
                    )}
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                        <Badge variant="secondary" className="gap-1">
                            <HelpCircle className="h-3 w-3" />
                            {quiz._count.questions} вопросов
                        </Badge>
                        {getLastAttemptBadge(quiz)}
                        {mode === "other" && (
                            <Badge variant="secondary">
                                Без источника
                            </Badge>
                        )}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        <span>Создан {formatDate(quiz.createdAt)}</span>
                    </div>
                    {quiz._count.attempts > 0 && (
                        <div className="text-sm text-muted-foreground">
                            Попыток: {quiz._count.attempts}
                        </div>
                    )}
                </CardContent>
                <CardFooter className="gap-2">
                    <Link href={`/quizzes/${quiz.id}`} className="flex-1">
                        <Button className="w-full">
                            <Play className="mr-2 h-4 w-4" />
                            Начать тест
                        </Button>
                    </Link>
                    <Button
                        variant="outline"
                        size="icon"
                        className="text-muted-foreground hover:text-foreground"
                        onClick={() => handleDelete(quiz.id, quiz.title)}
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </CardFooter>
            </Card>
        );
    };

    return (
        <div className="min-h-dvh bg-background text-foreground">
            {/* Header */}
            <header className="sticky top-0 z-50 border-b border-border bg-background/85 backdrop-blur-xl">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                    <div className="flex h-16 items-center justify-between">
                        <div className="flex items-center gap-4">
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
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-foreground/10 text-foreground">
                                    <GraduationCap className="h-5 w-5" />
                                </div>
                                <h1 className="text-xl font-bold text-foreground">Тесты</h1>
                            </div>
                        </div>

                        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                            <DialogTrigger asChild>
                                <Button className="gap-2">
                                    <Upload className="h-4 w-4" />
                                    Загрузить тест
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto border-border bg-background">
                                <DialogHeader>
                                    <DialogTitle className="text-foreground">
                                        Загрузить тест (JSON или YAML)
                                    </DialogTitle>
                                    <DialogDescription className="text-muted-foreground">
                                        Вставьте готовый JSON или YAML либо загрузите файл .json/.yaml/.yml
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="mt-4 space-y-4">
                                    {validationErrors.length > 0 && (
                                        <Alert
                                            variant="destructive"
                                            className="border-border bg-muted/40 text-foreground"
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

                                    <div className="space-y-3">
                                        <label className="text-sm font-medium text-foreground">
                                            Текст теста (JSON или YAML)
                                        </label>
                                        <Textarea
                                            value={jsonText}
                                            onChange={(e) => setJsonText(e.target.value)}
                                            placeholder="Вставьте JSON или YAML теста сюда"
                                            className="min-h-40 max-h-60 resize-y overflow-y-auto bg-background text-foreground placeholder:text-muted-foreground"
                                            disabled={uploading}
                                        />
                                        <Button
                                            type="button"
                                            className="w-full"
                                            onClick={handleTextUpload}
                                            disabled={uploading || !jsonText.trim()}
                                        >
                                            {uploading ? "Загрузка..." : "Импортировать из текста"}
                                        </Button>
                                        <p className="text-xs text-muted-foreground">
                                            Вставьте готовый JSON или YAML. Для файлов используйте загрузку ниже.
                                        </p>
                                    </div>

                                    <div className="rounded-lg border border-border bg-muted/40 p-3">
                                        <div className="flex flex-wrap items-center justify-between gap-3">
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                                                    <FileJson className="h-4 w-4" />
                                                    Файл .json/.yaml/.yml
                                                </div>
                                                <p className="text-xs text-muted-foreground">
                                                    Поддерживаются файлы JSON или YAML.
                                                </p>
                                            </div>
                                            <Button
                                                asChild
                                                variant="outline"
                                                size="sm"
                                                className={
                                                    uploading ? "pointer-events-none opacity-50" : ""
                                                }
                                            >
                                                <label htmlFor="json-upload">Выбрать файл</label>
                                            </Button>
                                            <Input
                                                id="json-upload"
                                                type="file"
                                                accept=".json,.yaml,.yml"
                                                className="hidden"
                                                onChange={handleFileUpload}
                                                disabled={uploading}
                                            />
                                        </div>
                                    </div>

                                    <div className="rounded-xl border border-border bg-muted/40 p-4">
                                        <div className="mb-3 text-sm font-medium text-foreground">
                                            Привязка к источнику (необязательно)
                                        </div>
                                        <div className="space-y-3">
                                            <label className="text-sm text-muted-foreground">
                                                Источник
                                            </label>
                                            <select
                                                value={selectedSourceId}
                                                onChange={(e) => handleSourceChange(e.target.value)}
                                                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-foreground/60 focus:outline-none"
                                                disabled={uploading || sourcesLoading}
                                            >
                                                <option value="">Не привязывать</option>
                                                {sources.map((source) => (
                                                    <option key={source.id} value={source.id}>
                                                        {source.title}
                                                    </option>
                                                ))}
                                            </select>

                                            {selectedSourceId && (
                                                <>
                                                    <label className="text-sm text-muted-foreground">
                                                        Глава
                                                    </label>
                                                    <Input
                                                        value={chapterSearch}
                                                        onChange={(e) =>
                                                            setChapterSearch(e.target.value)
                                                        }
                                                        placeholder="Поиск главы"
                                                        className="bg-background text-foreground placeholder:text-muted-foreground"
                                                        disabled={uploading || chaptersLoading}
                                                    />
                                                    <ScrollArea className="h-40 rounded-lg border border-border bg-muted/40">
                                                        <div className="p-2">
                                                            {chaptersLoading ? (
                                                                <div className="px-3 py-2 text-sm text-muted-foreground">
                                                                    Загрузка глав...
                                                                </div>
                                                            ) : filteredChapters.length === 0 ? (
                                                                <div className="px-3 py-2 text-sm text-muted-foreground">
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
                                                                            ? "bg-foreground/10 text-foreground"
                                                                            : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
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

                                    <details className="rounded-lg border border-border bg-muted/40 p-4">
                                        <summary className="cursor-pointer text-sm font-medium text-foreground">
                                            Пример структуры (JSON или YAML)
                                        </summary>
                                        <pre className="mt-3 overflow-x-auto text-xs text-muted-foreground">
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
                                    </details>
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
                ) : quizzes.length === 0 ? (
                    <div className="flex min-h-[400px] flex-col items-center justify-center text-center">
                        <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-muted/60">
                            <GraduationCap className="h-12 w-12 text-muted-foreground" />
                        </div>
                        <h2 className="mb-2 text-2xl font-bold text-foreground">
                            Тестов пока нет
                        </h2>
                        <p className="mb-6 text-muted-foreground">
                            Загрузите свой первый тест в формате JSON или YAML
                        </p>
                        <Button
                            onClick={() => setIsDialogOpen(true)}
                            className="gap-2"
                        >
                            <Upload className="h-4 w-4" />
                            Загрузить тест
                        </Button>
                    </div>
                ) : (
                    <div className="space-y-8">
                        {/* Status Filter */}
                        <div className="flex flex-wrap items-center gap-2">
                            <Filter className="h-4 w-4 text-muted-foreground" />
                            {STATUS_FILTERS.map((filter) => {
                                const count = statusCounts.get(filter.value) || 0;
                                return (
                                    <button
                                        key={filter.value}
                                        type="button"
                                        onClick={() => setStatusFilter(filter.value)}
                                        className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-all ${statusFilter === filter.value
                                                ? "border-foreground/40 bg-foreground/10 text-foreground"
                                                : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground"
                                            }`}
                                    >
                                        <span>{filter.label}</span>
                                        <span
                                            className={`flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-medium ${statusFilter === filter.value
                                                    ? "bg-foreground/20 text-foreground"
                                                    : "bg-muted text-muted-foreground"
                                                }`}
                                        >
                                            {count}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>

                        {filteredQuizzes.length === 0 ? (
                            <div className="flex min-h-[200px] flex-col items-center justify-center text-center">
                                <Filter className="mb-4 h-12 w-12 text-muted-foreground" />
                                <p className="text-muted-foreground">
                                    Нет тестов с выбранным статусом
                                </p>
                                <button
                                    type="button"
                                    onClick={() => setStatusFilter("all")}
                                    className="mt-4 text-sm text-foreground underline underline-offset-2"
                                >
                                    Показать все тесты
                                </button>
                            </div>
                        ) : (
                            <>
                                <div className="flex flex-wrap gap-3">
                                    {sourceGroups.map((group) => (
                                        <button
                                            key={group.source.id}
                                            type="button"
                                            onClick={() => setSelectedSection(group.source.id)}
                                            className={`w-full max-w-full rounded-xl border px-4 py-3 text-left transition-all sm:w-56 ${selectedSection === group.source.id
                                                ? "border-foreground/40 bg-foreground/10 text-foreground"
                                                : "border-border bg-muted/40 text-muted-foreground hover:border-foreground/30 hover:bg-muted/60"
                                                }`}
                                            title={group.source.title}
                                        >
                                            <div className="line-clamp-2 text-sm font-semibold break-words">
                                                {group.source.title}
                                            </div>
                                            <div className="mt-1 text-xs text-muted-foreground">
                                                {group.quizzes.length} тестов
                                            </div>
                                        </button>
                                    ))}
                                    {otherQuizzes.length > 0 && (
                                        <button
                                            type="button"
                                            onClick={() => setSelectedSection("other")}
                                            className={`w-full max-w-full rounded-xl border px-4 py-3 text-left transition-all sm:w-56 ${selectedSection === "other"
                                                ? "border-foreground/40 bg-foreground/10 text-foreground"
                                                : "border-border bg-muted/40 text-muted-foreground hover:border-foreground/30 hover:bg-muted/60"
                                                }`}
                                        >
                                            <div className="text-sm font-semibold">Другие тесты</div>
                                            <div className="mt-1 text-xs text-muted-foreground">
                                                {otherQuizzes.length} тестов
                                            </div>
                                        </button>
                                    )}
                                </div>

                                {selectedSourceGroup && (
                                    <section className="space-y-4">
                                        <div>
                                            <h2
                                                className="text-xl font-semibold text-foreground break-words line-clamp-2"
                                                title={selectedSourceGroup.source.title}
                                            >
                                                <Link
                                                    href={`/library/${selectedSourceGroup.source.id}`}
                                                    className="hover:text-blue-600 transition-colors"
                                                >
                                                    {selectedSourceGroup.source.title}
                                                </Link>
                                            </h2>
                                            {selectedSourceGroup.source.author && (
                                                <div className="text-sm text-muted-foreground">
                                                    {selectedSourceGroup.source.author}
                                                </div>
                                            )}
                                        </div>
                                        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                                            {selectedSourceGroup.quizzes.map((quiz) =>
                                                renderQuizCard(quiz, "chapter")
                                            )}
                                        </div>
                                    </section>
                                )}

                                {showingOther && (
                                    <section className="space-y-4">
                                        <h2 className="text-xl font-semibold text-foreground">
                                            Другие тесты
                                        </h2>
                                        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                                            {otherQuizzes.map((quiz) =>
                                                renderQuizCard(quiz, "other")
                                            )}
                                        </div>
                                    </section>
                                )}
                            </>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
}
