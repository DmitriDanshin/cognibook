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
import { Alert, AlertDescription } from "@/components/ui/alert";
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
}

interface ValidationError {
    path: string;
    message: string;
}

export default function QuizzesPage() {
    const [quizzes, setQuizzes] = useState<Quiz[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
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

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.name.endsWith(".json")) {
            toast.error("Поддерживаются только файлы JSON");
            return;
        }

        setUploading(true);
        setValidationErrors([]);
        const formData = new FormData();
        formData.append("file", file);

        try {
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
                    throw new Error(data.error || "Failed to upload");
                }
                return;
            }

            toast.success("Тест успешно загружен");
            setIsDialogOpen(false);
            setValidationErrors([]);
            fetchQuizzes();
        } catch (error) {
            console.error("Error uploading quiz:", error);
            toast.error("Не удалось загрузить тест");
        } finally {
            setUploading(false);
        }
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
                            <DialogContent className="max-w-lg border-slate-800 bg-slate-900">
                                <DialogHeader>
                                    <DialogTitle className="text-white">
                                        Загрузить JSON тест
                                    </DialogTitle>
                                    <DialogDescription className="text-slate-400">
                                        Выберите файл .json с тестом в правильном формате
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="mt-4 space-y-4">
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
                    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                        {quizzes.map((quiz) => (
                            <Card
                                key={quiz.id}
                                className="group relative overflow-hidden border-slate-800 bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur transition-all hover:border-indigo-500/50 hover:shadow-lg hover:shadow-indigo-500/10"
                            >
                                <CardHeader>
                                    <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500/20 to-cyan-500/20 text-indigo-400 ring-1 ring-indigo-500/30 transition-transform group-hover:scale-110">
                                        <GraduationCap className="h-7 w-7" />
                                    </div>
                                    <CardTitle className="line-clamp-2 text-xl text-white">
                                        {quiz.title}
                                    </CardTitle>
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
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}
