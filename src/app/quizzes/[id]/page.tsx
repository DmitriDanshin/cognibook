"use client";

import { useState, useEffect, useCallback, use, useMemo, useRef } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    GraduationCap,
    ArrowLeft,
    ArrowRight,
    CheckCircle2,
    XCircle,
    AlertCircle,
    Trophy,
    RotateCcw,
    Home,
    HelpCircle,
    Lightbulb,
    ChevronDown,
} from "lucide-react";
import { toast } from "sonner";

interface Option {
    id: string;
    externalId: string;
    text: string;
    explanation: string;
    order: number;
}

interface Question {
    id: string;
    externalId: string;
    text: string;
    quote?: string | null;
    type: "single" | "multiple";
    correctAnswers: string;
    options: Option[];
}

interface Quiz {
    id: string;
    title: string;
    questions: Question[];
    chapter?: {
        id: string;
        title: string;
        bookId: string;
        book: {
            id: string;
            title: string;
        };
    } | null;
}

interface Answer {
    questionId: string;
    selectedIds: string[];
}

interface QuestionResult {
    isCorrect: boolean;
    correctAnswers: string[];
    selectedIds: string[];
}

interface SavedQuizProgress {
    version: number;
    currentQuestionIndex: number;
    answers: Record<string, string[]>;
    checkedQuestions: Record<string, QuestionResult>;
    isFinished: boolean;
    finalScore: { score: number; total: number };
    optionOrder: Record<string, string[]>;
}

const shuffleArray = <T,>(items: T[]): T[] => {
    const shuffled = [...items];
    for (let i = shuffled.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
};

export default function QuizPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = use(params);
    const [quiz, setQuiz] = useState<Quiz | null>(null);
    const [loading, setLoading] = useState(true);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [answers, setAnswers] = useState<Map<string, string[]>>(new Map());
    const [checkedQuestions, setCheckedQuestions] = useState<
        Map<string, QuestionResult>
    >(new Map());
    const [isFinished, setIsFinished] = useState(false);
    const [finalScore, setFinalScore] = useState({ score: 0, total: 0 });
    const [isStateRestored, setIsStateRestored] = useState(false);
    const [optionOrderMap, setOptionOrderMap] = useState<Record<string, string[]>>(
        {}
    );
    const storageKey = useMemo(() => `quiz-progress:${id}`, [id]);
    const answersScrollRef = useRef<HTMLDivElement | null>(null);
    const [isQuoteExpanded, setIsQuoteExpanded] = useState(false);

    const fetchQuiz = useCallback(async () => {
        try {
            const response = await fetch(`/api/quizzes/${id}`);
            if (!response.ok) throw new Error("Failed to fetch quiz");
            const data = (await response.json()) as Quiz;
            const savedRaw = localStorage.getItem(storageKey);
            let savedOrder: Record<string, string[]> | null = null;

            if (savedRaw) {
                try {
                    const parsed = JSON.parse(savedRaw) as SavedQuizProgress;
                    if (parsed?.version === 1 && parsed.optionOrder) {
                        savedOrder = parsed.optionOrder;
                    }
                } catch {
                    savedOrder = null;
                }
            }

            const nextOrder: Record<string, string[]> = {};
            const orderedQuestions = data.questions.map((question) => {
                const order = savedOrder?.[question.id];
                const optionMap = new Map(
                    question.options.map((option) => [option.externalId, option])
                );
                const hasValidOrder =
                    Array.isArray(order) &&
                    order.length === question.options.length &&
                    order.every((optionId) => optionMap.has(optionId));

                if (hasValidOrder) {
                    nextOrder[question.id] = order;
                    return {
                        ...question,
                        options: order.map((optionId) => optionMap.get(optionId)!),
                    };
                }

                const shuffledOptions = shuffleArray(question.options);
                nextOrder[question.id] = shuffledOptions.map(
                    (option) => option.externalId
                );
                return {
                    ...question,
                    options: shuffledOptions,
                };
            });

            setOptionOrderMap(nextOrder);
            setQuiz({ ...data, questions: orderedQuestions });
        } catch (error) {
            console.error("Error fetching quiz:", error);
            toast.error("Не удалось загрузить тест");
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        fetchQuiz();
    }, [fetchQuiz]);

    useEffect(() => {
        if (!quiz) return;
        const raw = localStorage.getItem(storageKey);
        if (!raw) {
            setIsStateRestored(true);
            return;
        }

        try {
            const parsed = JSON.parse(raw) as SavedQuizProgress;
            if (!parsed || parsed.version !== 1) {
                setIsStateRestored(true);
                return;
            }

            const questionIds = new Set(quiz.questions.map((q) => q.id));
            const answersEntries = Object.entries(parsed.answers || {}).filter(
                ([questionId, selected]) =>
                    questionIds.has(questionId) &&
                    Array.isArray(selected) &&
                    selected.every((id) => typeof id === "string")
            );
            const checkedEntries = Object.entries(parsed.checkedQuestions || {}).filter(
                ([questionId, result]) =>
                    questionIds.has(questionId) &&
                    result &&
                    Array.isArray(result.correctAnswers) &&
                    Array.isArray(result.selectedIds)
            );

            const restoredAnswers = new Map<string, string[]>(answersEntries);
            const restoredChecked = new Map<string, QuestionResult>(
                checkedEntries.map(([questionId, result]) => [
                    questionId,
                    {
                        isCorrect: Boolean(result.isCorrect),
                        correctAnswers: result.correctAnswers,
                        selectedIds: result.selectedIds,
                    },
                ])
            );

            const safeIndex = Math.min(
                Math.max(parsed.currentQuestionIndex || 0, 0),
                Math.max(quiz.questions.length - 1, 0)
            );

            setAnswers(restoredAnswers);
            setCheckedQuestions(restoredChecked);
            setCurrentQuestionIndex(safeIndex);
            setIsFinished(Boolean(parsed.isFinished));
            setFinalScore(
                parsed.finalScore || { score: 0, total: quiz.questions.length }
            );
        } catch {
            // ignore corrupted localStorage
        } finally {
            setIsStateRestored(true);
        }
    }, [quiz, storageKey]);

    useEffect(() => {
        if (!quiz || !isStateRestored) return;
        const payload: SavedQuizProgress = {
            version: 1,
            currentQuestionIndex,
            answers: Object.fromEntries(answers),
            checkedQuestions: Object.fromEntries(checkedQuestions),
            isFinished,
            finalScore,
            optionOrder: optionOrderMap,
        };
        localStorage.setItem(storageKey, JSON.stringify(payload));
    }, [
        answers,
        checkedQuestions,
        currentQuestionIndex,
        finalScore,
        isFinished,
        isStateRestored,
        optionOrderMap,
        quiz,
        storageKey,
    ]);

    useEffect(() => {
        setIsQuoteExpanded(false);
        if (typeof window === "undefined") return;
        if (!window.matchMedia("(max-width: 640px)").matches) return;
        const viewport = answersScrollRef.current?.querySelector(
            "[data-slot=\"scroll-area-viewport\"]"
        ) as HTMLElement | null;
        if (viewport) {
            viewport.scrollTo({ top: 0, behavior: "auto" });
            return;
        }
        window.scrollTo({ top: 0, behavior: "auto" });
    }, [currentQuestionIndex]);

    const currentQuestion = quiz?.questions[currentQuestionIndex];
    const currentAnswer = currentQuestion
        ? answers.get(currentQuestion.id) || []
        : [];
    const currentResult = currentQuestion
        ? checkedQuestions.get(currentQuestion.id)
        : undefined;
    const isCurrentChecked = !!currentResult;
    const quoteLink =
        currentQuestion?.quote && quiz?.chapter
            ? `/library/${quiz.chapter.bookId}?chapterId=${quiz.chapter.id}&quote=${encodeURIComponent(currentQuestion.quote)}&returnToQuiz=${id}`
            : null;

    const handleSingleAnswer = (optionId: string) => {
        if (!currentQuestion || isCurrentChecked) return;
        setAnswers(new Map(answers.set(currentQuestion.id, [optionId])));
    };

    const handleMultipleAnswer = (optionId: string, checked: boolean) => {
        if (!currentQuestion || isCurrentChecked) return;
        const current = answers.get(currentQuestion.id) || [];
        let updated: string[];
        if (checked) {
            updated = [...current, optionId];
        } else {
            updated = current.filter((id) => id !== optionId);
        }
        setAnswers(new Map(answers.set(currentQuestion.id, updated)));
    };

    const handleCheckAnswer = () => {
        if (!currentQuestion) return;
        const selected = answers.get(currentQuestion.id) || [];
        if (selected.length === 0) {
            toast.error("Выберите ответ");
            return;
        }

        const correctAnswers = JSON.parse(
            currentQuestion.correctAnswers
        ) as string[];
        const isCorrect =
            correctAnswers.length === selected.length &&
            correctAnswers.every((ca) => selected.includes(ca));

        setCheckedQuestions(
            new Map(
                checkedQuestions.set(currentQuestion.id, {
                    isCorrect,
                    correctAnswers,
                    selectedIds: selected,
                })
            )
        );
    };

    const handleNextQuestion = () => {
        if (!quiz) return;

        // If on the last question and answer is checked, finish the quiz
        if (currentQuestionIndex >= quiz.questions.length - 1) {
            const currentQ = quiz.questions[currentQuestionIndex];
            if (currentQ && checkedQuestions.has(currentQ.id)) {
                handleFinishQuiz();
            }
            return;
        }

        setCurrentQuestionIndex(currentQuestionIndex + 1);
    };

    const handlePreviousQuestion = () => {
        if (currentQuestionIndex > 0) {
            setCurrentQuestionIndex(currentQuestionIndex - 1);
        }
    };

    const handleFinishQuiz = async () => {
        if (!quiz) return;

        // Check all unanswered questions
        const unansweredQuestions = quiz.questions.filter((q) => {
            const answer = answers.get(q.id);
            return !answer || answer.length === 0;
        });

        if (unansweredQuestions.length > 0) {
            toast.error(
                `Ответьте на все вопросы. Осталось: ${unansweredQuestions.length}`
            );
            return;
        }

        // Submit results
        const submissionAnswers: Answer[] = quiz.questions.map((q) => ({
            questionId: q.id,
            selectedIds: answers.get(q.id) || [],
        }));

        try {
            const response = await fetch(`/api/quizzes/${id}/submit`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ answers: submissionAnswers }),
            });

            if (!response.ok) throw new Error("Failed to submit");

            const result = await response.json();
            setFinalScore({ score: result.score, total: result.totalQuestions });
            setIsFinished(true);
            toast.success("Тест завершён!");
        } catch (error) {
            console.error("Error submitting quiz:", error);
            toast.error("Не удалось сохранить результат");
        }
    };

    const handleRestartQuiz = () => {
        setAnswers(new Map());
        setCheckedQuestions(new Map());
        setCurrentQuestionIndex(0);
        setIsFinished(false);
        setFinalScore({ score: 0, total: 0 });
        localStorage.removeItem(storageKey);
        setQuiz((current) => {
            if (!current) return current;
            const nextOrder: Record<string, string[]> = {};
            const nextQuestions = current.questions.map((question) => {
                const shuffledOptions = shuffleArray(question.options);
                nextOrder[question.id] = shuffledOptions.map(
                    (option) => option.externalId
                );
                return { ...question, options: shuffledOptions };
            });
            setOptionOrderMap(nextOrder);
            return { ...current, questions: nextQuestions };
        });
    };

    const getOptionStyle = (option: Option) => {
        if (!currentResult) return "";

        const isSelected = currentResult.selectedIds.includes(option.externalId);
        const isCorrect = currentResult.correctAnswers.includes(option.externalId);

        if (isCorrect) {
            return "border-green-500 bg-green-500/10";
        }
        if (isSelected && !isCorrect) {
            return "border-red-500 bg-red-500/10";
        }
        return "";
    };

    if (loading) {
        return (
            <div className="flex min-h-dvh items-center justify-center bg-background">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-foreground/40 border-t-transparent" />
            </div>
        );
    }

    if (!quiz) {
        return (
            <div className="flex min-h-dvh flex-col items-center justify-center bg-background text-foreground">
                <GraduationCap className="mb-4 h-16 w-16 text-muted-foreground" />
                <h1 className="mb-2 text-2xl font-bold">Тест не найден</h1>
                <Link href="/quizzes">
                    <Button variant="outline">Вернуться к тестам</Button>
                </Link>
            </div>
        );
    }

    // Results Screen
    if (isFinished) {
        const percentage = Math.round((finalScore.score / finalScore.total) * 100);
        const isPassing = percentage >= 70;

        return (
            <div className="min-h-dvh bg-background">
                <div className="flex min-h-dvh flex-col items-center justify-center p-4">
                    <Card className="w-full max-w-md border-border bg-card">
                        <CardHeader className="text-center">
                            <div
                                className={`mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-full ${isPassing
                                    ? "bg-foreground/10 text-foreground"
                                    : "bg-muted/60 text-muted-foreground"
                                    }`}
                            >
                                {isPassing ? (
                                    <Trophy className="h-12 w-12" />
                                ) : (
                                    <AlertCircle className="h-12 w-12" />
                                )}
                            </div>
                            <CardTitle className="text-2xl text-foreground">
                                {isPassing ? "Отлично!" : "Попробуйте ещё раз"}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="text-center">
                            <div className="mb-6">
                                <div className="mb-2 text-6xl font-bold text-foreground">
                                    {percentage}%
                                </div>
                                <div className="text-muted-foreground">
                                    Правильных ответов: {finalScore.score} из {finalScore.total}
                                </div>
                            </div>
                            <div className="mb-4 h-3 overflow-hidden rounded-full bg-border">
                                <div
                                    className={`h-full rounded-full transition-all duration-1000 ${isPassing
                                        ? "bg-foreground"
                                        : "bg-muted-foreground"
                                        }`}
                                    style={{ width: `${percentage}%` }}
                                />
                            </div>
                        </CardContent>
                        <CardFooter className="flex flex-col gap-3">
                            <Button
                                onClick={handleRestartQuiz}
                                className="w-full gap-2"
                            >
                                <RotateCcw className="h-4 w-4" />
                                Пройти заново
                            </Button>
                            <Link href="/quizzes" className="w-full">
                                <Button
                                    variant="outline"
                                    className="w-full gap-2"
                                >
                                    <Home className="h-4 w-4" />
                                    К списку тестов
                                </Button>
                            </Link>
                        </CardFooter>
                    </Card>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-dvh bg-background flex flex-col">
            {/* Header */}

            <header className="sticky top-0 z-50 border-b border-border bg-background/85 backdrop-blur-xl">
                <div className="mx-auto max-w-5xl px-3 sm:px-6 lg:px-8">
                    <div className="flex h-14 items-center justify-between sm:h-16">
                        <div className="flex items-center gap-4">
                            <Link href="/quizzes">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="text-muted-foreground hover:text-foreground"
                                >
                                    <ArrowLeft className="h-5 w-5" />
                                </Button>
                            </Link>
                            <div>
                                <h1 className="line-clamp-1 text-base font-bold text-foreground sm:text-lg">
                                    {quiz.title}
                                </h1>
                                <div className="text-xs text-muted-foreground sm:text-sm">
                                    Вопрос {currentQuestionIndex + 1} из {quiz.questions.length}
                                </div>
                            </div>
                        </div>
                        <Badge
                            variant="secondary"
                            className="text-xs sm:text-sm"
                        >
                            {checkedQuestions.size} / {quiz.questions.length} проверено
                        </Badge>
                    </div>
                </div>
            </header>

            {/* Progress Bar */}
            <div className="h-1 bg-border">
                <div
                    className="h-full bg-foreground transition-all duration-300"
                    style={{
                        width: `${((currentQuestionIndex + 1) / quiz.questions.length) * 100}%`,
                    }}
                />
            </div>

            {/* Main Content */}
            <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col min-h-0 overflow-hidden px-3 pt-3 pb-3 sm:px-6 sm:pt-8 lg:px-8">
                {currentQuestion && (
                    <Card className="border-border flex-1 min-h-0 !flex !flex-col overflow-hidden !gap-2 sm:!gap-3 !py-0">
                        <CardHeader className="gap-1.5 px-4 sm:gap-2 sm:px-6 flex-shrink-0 pt-4 sm:pt-6">
                            <div className="mb-1.5 flex flex-wrap items-center gap-2 sm:mb-2">
                                <Badge
                                    variant="outline"
                                    className="border-border text-[11px] text-muted-foreground sm:text-xs"
                                >
                                    {currentQuestion.type === "single"
                                        ? "Один ответ"
                                        : "Несколько ответов"}
                                </Badge>
                                {isCurrentChecked && (
                                    <Badge
                                        className={`${currentResult?.isCorrect
                                            ? "bg-green-500/20 text-green-600 dark:text-green-400"
                                            : "bg-red-500/20 text-red-600 dark:text-red-400"
                                            } text-[11px] sm:text-xs`}
                                    >
                                        {currentResult?.isCorrect ? (
                                            <>
                                                <CheckCircle2 className="mr-1 h-3 w-3" /> Верно
                                            </>
                                        ) : (
                                            <>
                                                <XCircle className="mr-1 h-3 w-3" /> Неверно
                                            </>
                                        )}
                                    </Badge>
                                )}
                            </div>
                            <CardTitle className="text-base leading-snug text-foreground sm:text-lg">
                                <HelpCircle className="mb-0.5 mr-1.5 inline h-4 w-4 text-muted-foreground sm:mb-1 sm:mr-2 sm:h-5 sm:w-5" />
                                {currentQuestion.text}
                            </CardTitle>
                            {isCurrentChecked && quoteLink && currentQuestion?.quote && (
                                <div className="mt-3 sm:mt-4">
                                    <button
                                        onClick={() => setIsQuoteExpanded(!isQuoteExpanded)}
                                        className="flex w-full items-center justify-between rounded-lg border border-border bg-muted/40 p-3 text-left transition-colors hover:bg-muted/60 sm:p-4"
                                    >
                                        <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground sm:text-xs">
                                            <Lightbulb className="mr-1.5 inline h-3 w-3 sm:h-3.5 sm:w-3.5" />
                                            Цитата из источника
                                        </div>
                                        <ChevronDown
                                            className={`h-4 w-4 text-muted-foreground transition-transform sm:h-5 sm:w-5 ${isQuoteExpanded ? "rotate-180" : ""
                                                }`}
                                        />
                                    </button>
                                    {isQuoteExpanded && (
                                        <div className="mt-1 rounded-lg border border-border bg-muted/20 p-3 sm:p-4">
                                            <Link
                                                href={quoteLink}
                                                className="block text-xs text-foreground underline decoration-muted-foreground/60 underline-offset-2 transition-colors hover:decoration-foreground sm:text-sm"
                                                title={`Открыть главу: ${quiz?.chapter?.title}`}
                                            >
                                                "{currentQuestion.quote}"
                                            </Link>
                                        </div>
                                    )}
                                </div>
                            )}
                        </CardHeader>
                        <ScrollArea className="flex-1 min-h-0">
                            <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6 pt-0">
                                <div className="space-y-0">
                                    {currentQuestion.type === "single" ? (
                                        <RadioGroup
                                            value={currentAnswer[0] || ""}
                                            onValueChange={handleSingleAnswer}
                                            className="!gap-1 sm:!gap-1.5"
                                            disabled={isCurrentChecked}
                                        >
                                            {currentQuestion.options.map((option) => (
                                                <div key={option.id} className="space-y-2">
                                                    <label
                                                        className={`flex cursor-pointer items-start gap-1.5 rounded-lg border p-2.5 transition-all sm:gap-2.5 sm:p-3.5 ${isCurrentChecked
                                                            ? getOptionStyle(option)
                                                            : currentAnswer.includes(option.externalId)
                                                                ? "border-foreground/60 bg-foreground/5"
                                                                : "border-border hover:border-foreground/30 hover:bg-muted/40"
                                                            }`}
                                                    >
                                                        <RadioGroupItem
                                                            value={option.externalId}
                                                            className="mt-0.5"
                                                        />
                                                        <div className="flex-1">
                                                            <span className="text-sm text-foreground sm:text-base">
                                                                {option.text}
                                                            </span>
                                                            {isCurrentChecked && (
                                                                currentResult?.correctAnswers.includes(
                                                                    option.externalId
                                                                ) ||
                                                                currentResult?.selectedIds.includes(
                                                                    option.externalId
                                                                )
                                                            ) && (
                                                                    <div className="mt-1.5 flex items-start gap-1.5 sm:mt-2 sm:gap-2">
                                                                        {currentResult?.correctAnswers.includes(
                                                                            option.externalId
                                                                        ) ? (
                                                                            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-green-600 dark:text-green-400 sm:h-4 sm:w-4" />
                                                                        ) : (
                                                                            <XCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-red-600 dark:text-red-400 sm:h-4 sm:w-4" />
                                                                        )}
                                                                        <span
                                                                            className={`text-xs sm:text-sm ${currentResult?.correctAnswers.includes(
                                                                                option.externalId
                                                                            )
                                                                                ? "text-green-600 dark:text-green-400"
                                                                                : "text-red-600 dark:text-red-400"
                                                                                }`}
                                                                        >
                                                                            {option.explanation}
                                                                        </span>
                                                                    </div>
                                                                )}
                                                        </div>
                                                    </label>
                                                </div>
                                            ))}
                                        </RadioGroup>
                                    ) : (
                                        <div className="grid !gap-1 sm:!gap-1.5">
                                            {currentQuestion.options.map((option) => (
                                                <div key={option.id} className="space-y-2">
                                                    <label
                                                        className={`flex cursor-pointer items-start gap-1.5 rounded-lg border p-2.5 transition-all sm:gap-2.5 sm:p-3.5 ${isCurrentChecked
                                                            ? getOptionStyle(option)
                                                            : currentAnswer.includes(option.externalId)
                                                                ? "border-foreground/60 bg-foreground/5"
                                                                : "border-border hover:border-foreground/30 hover:bg-muted/40"
                                                            }`}
                                                    >
                                                        <Checkbox
                                                            checked={currentAnswer.includes(option.externalId)}
                                                            onCheckedChange={(checked) =>
                                                                handleMultipleAnswer(
                                                                    option.externalId,
                                                                    checked as boolean
                                                                )
                                                            }
                                                            disabled={isCurrentChecked}
                                                            className="mt-0.5"
                                                        />
                                                        <div className="flex-1">
                                                            <span className="text-sm text-foreground sm:text-base">
                                                                {option.text}
                                                            </span>
                                                            {isCurrentChecked && (
                                                                currentResult?.correctAnswers.includes(
                                                                    option.externalId
                                                                ) ||
                                                                currentResult?.selectedIds.includes(
                                                                    option.externalId
                                                                )
                                                            ) && (
                                                                    <div className="mt-1.5 flex items-start gap-1.5 sm:mt-2 sm:gap-2">
                                                                        {currentResult?.correctAnswers.includes(
                                                                            option.externalId
                                                                        ) ? (
                                                                            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-green-600 dark:text-green-400 sm:h-4 sm:w-4" />
                                                                        ) : (
                                                                            <XCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-red-600 dark:text-red-400 sm:h-4 sm:w-4" />
                                                                        )}
                                                                        <span
                                                                            className={`text-xs sm:text-sm ${currentResult?.correctAnswers.includes(
                                                                                option.externalId
                                                                            )
                                                                                ? "text-green-600 dark:text-green-400"
                                                                                : "text-red-600 dark:text-red-400"
                                                                                }`}
                                                                        >
                                                                            {option.explanation}
                                                                        </span>
                                                                    </div>
                                                                )}
                                                        </div>
                                                    </label>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </ScrollArea>
                    </Card>
                )}
            </main>

            {/* Sticky Navigation Footer - всегда виден внизу экрана */}
            {currentQuestion && (
                <footer className="sticky bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur-xl pb-[env(safe-area-inset-bottom)]">
                    <div className="mx-auto max-w-5xl px-3 py-2.5 sm:px-6 sm:py-4 lg:px-8">
                        {/* Кнопки навигации */}
                        <div className="flex items-center justify-between gap-4">
                            {/* Кнопка Назад - слева */}
                            <Button
                                variant="outline"
                                onClick={handlePreviousQuestion}
                                disabled={currentQuestionIndex === 0}
                                className="gap-2 text-muted-foreground hover:text-foreground disabled:opacity-50"
                            >
                                <ArrowLeft className="h-4 w-4" />
                                <span className="hidden sm:inline">Назад</span>
                            </Button>

                            {/* Кнопка Проверить/Завершить - по центру */}
                            <div className="flex-1 flex justify-center">
                                {!isCurrentChecked ? (
                                    <Button
                                        onClick={handleCheckAnswer}
                                        className="gap-2 px-5 sm:h-10 sm:px-8"
                                    >
                                        <CheckCircle2 className="h-4 w-4" />
                                        Проверить
                                    </Button>
                                ) : null}
                            </div>

                            {/* Кнопка Далее/Завершить - справа */}
                            <Button
                                variant="outline"
                                onClick={handleNextQuestion}
                                disabled={!isCurrentChecked}
                                className="gap-2 text-muted-foreground hover:text-foreground disabled:opacity-50"
                            >
                                {currentQuestionIndex >= quiz.questions.length - 1 ? (
                                    <>
                                        <span className="hidden sm:inline">Завершить</span>
                                        <Trophy className="h-4 w-4" />
                                    </>
                                ) : (
                                    <>
                                        <span className="hidden sm:inline">Далее</span>
                                        <ArrowRight className="h-4 w-4" />
                                    </>
                                )}
                            </Button>
                        </div>

                        {/* Question Navigation Dots */}
                        <div className="mt-2.5 flex flex-wrap justify-center gap-1.5 sm:mt-3 sm:gap-2">
                            {quiz.questions.map((q, index) => {
                                const result = checkedQuestions.get(q.id);
                                let dotClass = "bg-border hover:bg-muted-foreground/40";

                                if (result) {
                                    dotClass = result.isCorrect
                                        ? "bg-green-500"
                                        : "bg-red-500";
                                } else if (answers.has(q.id)) {
                                    dotClass = "bg-foreground/50";
                                }

                                if (index === currentQuestionIndex) {
                                    dotClass +=
                                        " ring-2 ring-foreground ring-offset-2 ring-offset-background";
                                }

                                return (
                                    <button
                                        key={q.id}
                                        onClick={() => setCurrentQuestionIndex(index)}
                                        className={`h-2.5 w-2.5 rounded-full transition-all sm:h-3 sm:w-3 ${dotClass}`}
                                        title={`Вопрос ${index + 1}`}
                                    />
                                );
                            })}
                        </div>
                    </div>
                </footer>
            )}
        </div>
    );
}
