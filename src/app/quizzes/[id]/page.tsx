"use client";

import { useState, useEffect, useCallback, use } from "react";
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
    type: "single" | "multiple";
    correctAnswers: string;
    options: Option[];
}

interface Quiz {
    id: string;
    title: string;
    questions: Question[];
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

    const fetchQuiz = useCallback(async () => {
        try {
            const response = await fetch(`/api/quizzes/${id}`);
            if (!response.ok) throw new Error("Failed to fetch quiz");
            const data = await response.json();
            setQuiz(data);
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

    const currentQuestion = quiz?.questions[currentQuestionIndex];
    const currentAnswer = currentQuestion
        ? answers.get(currentQuestion.id) || []
        : [];
    const currentResult = currentQuestion
        ? checkedQuestions.get(currentQuestion.id)
        : undefined;
    const isCurrentChecked = !!currentResult;

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
        if (quiz && currentQuestionIndex < quiz.questions.length - 1) {
            setCurrentQuestionIndex(currentQuestionIndex + 1);
        }
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
    };

    const getOptionStyle = (option: Option) => {
        if (!currentResult) return "";

        const isSelected = currentResult.selectedIds.includes(option.externalId);
        const isCorrect = currentResult.correctAnswers.includes(option.externalId);

        if (isCorrect) {
            return "border-emerald-500 bg-emerald-500/10";
        }
        if (isSelected && !isCorrect) {
            return "border-red-500 bg-red-500/10";
        }
        return "";
    };

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-900">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
            </div>
        );
    }

    if (!quiz) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center bg-slate-900 text-white">
                <GraduationCap className="mb-4 h-16 w-16 text-slate-600" />
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
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
                <div className="flex min-h-screen flex-col items-center justify-center p-4">
                    <Card className="w-full max-w-md border-slate-800 bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur">
                        <CardHeader className="text-center">
                            <div
                                className={`mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-full ${isPassing
                                    ? "bg-emerald-500/20 text-emerald-400"
                                    : "bg-amber-500/20 text-amber-400"
                                    }`}
                            >
                                {isPassing ? (
                                    <Trophy className="h-12 w-12" />
                                ) : (
                                    <AlertCircle className="h-12 w-12" />
                                )}
                            </div>
                            <CardTitle className="text-2xl text-white">
                                {isPassing ? "Отлично!" : "Попробуйте ещё раз"}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="text-center">
                            <div className="mb-6">
                                <div className="mb-2 text-6xl font-bold text-white">
                                    {percentage}%
                                </div>
                                <div className="text-slate-400">
                                    Правильных ответов: {finalScore.score} из {finalScore.total}
                                </div>
                            </div>
                            <div className="mb-4 h-3 overflow-hidden rounded-full bg-slate-700">
                                <div
                                    className={`h-full rounded-full transition-all duration-1000 ${isPassing
                                        ? "bg-gradient-to-r from-emerald-500 to-cyan-500"
                                        : "bg-gradient-to-r from-amber-500 to-orange-500"
                                        }`}
                                    style={{ width: `${percentage}%` }}
                                />
                            </div>
                        </CardContent>
                        <CardFooter className="flex flex-col gap-3">
                            <Button
                                onClick={handleRestartQuiz}
                                className="w-full gap-2 bg-indigo-600 hover:bg-indigo-500"
                            >
                                <RotateCcw className="h-4 w-4" />
                                Пройти заново
                            </Button>
                            <Link href="/quizzes" className="w-full">
                                <Button
                                    variant="outline"
                                    className="w-full gap-2 border-slate-700 text-slate-300"
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
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
            {/* Header */}
            <header className="sticky top-0 z-50 border-b border-white/10 bg-slate-900/80 backdrop-blur-xl">
                <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
                    <div className="flex h-16 items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Link href="/quizzes">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="text-slate-400 hover:text-white"
                                >
                                    <ArrowLeft className="h-5 w-5" />
                                </Button>
                            </Link>
                            <div>
                                <h1 className="line-clamp-1 text-lg font-bold text-white">
                                    {quiz.title}
                                </h1>
                                <div className="text-sm text-slate-400">
                                    Вопрос {currentQuestionIndex + 1} из {quiz.questions.length}
                                </div>
                            </div>
                        </div>
                        <Badge
                            variant="secondary"
                            className="bg-slate-700/50 text-slate-300"
                        >
                            {checkedQuestions.size} / {quiz.questions.length} проверено
                        </Badge>
                    </div>
                </div>
            </header>

            {/* Progress Bar */}
            <div className="h-1 bg-slate-800">
                <div
                    className="h-full bg-gradient-to-r from-indigo-500 to-cyan-500 transition-all duration-300"
                    style={{
                        width: `${((currentQuestionIndex + 1) / quiz.questions.length) * 100}%`,
                    }}
                />
            </div>

            {/* Main Content */}
            <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
                {currentQuestion && (
                    <Card className="border-slate-800 bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur">
                        <CardHeader>
                            <div className="mb-2 flex items-center gap-2">
                                <Badge
                                    variant="outline"
                                    className="border-indigo-500/50 text-indigo-400"
                                >
                                    {currentQuestion.type === "single"
                                        ? "Один ответ"
                                        : "Несколько ответов"}
                                </Badge>
                                {isCurrentChecked && (
                                    <Badge
                                        className={
                                            currentResult?.isCorrect
                                                ? "bg-emerald-500/20 text-emerald-400"
                                                : "bg-red-500/20 text-red-400"
                                        }
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
                            <CardTitle className="text-xl text-white">
                                <HelpCircle className="mb-1 mr-2 inline h-5 w-5 text-indigo-400" />
                                {currentQuestion.text}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pb-6">
                            <div className="space-y-3">
                                {currentQuestion.type === "single" ? (
                                    <RadioGroup
                                        value={currentAnswer[0] || ""}
                                        onValueChange={handleSingleAnswer}
                                        className="space-y-4"
                                        disabled={isCurrentChecked}
                                    >
                                        {currentQuestion.options.map((option) => (
                                            <div key={option.id} className="space-y-2">
                                                <label
                                                    className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-all ${isCurrentChecked
                                                        ? getOptionStyle(option)
                                                        : currentAnswer.includes(option.externalId)
                                                            ? "border-indigo-500 bg-indigo-500/10"
                                                            : "border-slate-700 hover:border-slate-600 hover:bg-slate-800/50"
                                                        }`}
                                                >
                                                    <RadioGroupItem
                                                        value={option.externalId}
                                                        className="mt-0.5"
                                                    />
                                                    <div className="flex-1">
                                                        <span className="text-white">{option.text}</span>
                                                        {isCurrentChecked && (
                                                            <div className="mt-2 flex items-start gap-2">
                                                                {currentResult?.correctAnswers.includes(
                                                                    option.externalId
                                                                ) ? (
                                                                    <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-400" />
                                                                ) : currentResult?.selectedIds.includes(
                                                                    option.externalId
                                                                ) ? (
                                                                    <XCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-400" />
                                                                ) : (
                                                                    <Lightbulb className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-500" />
                                                                )}
                                                                <span
                                                                    className={`text-sm ${currentResult?.correctAnswers.includes(
                                                                        option.externalId
                                                                    )
                                                                        ? "text-emerald-300"
                                                                        : currentResult?.selectedIds.includes(
                                                                            option.externalId
                                                                        )
                                                                            ? "text-red-300"
                                                                            : "text-slate-400"
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
                                    <div className="space-y-4">
                                        {currentQuestion.options.map((option) => (
                                            <div key={option.id} className="space-y-2">
                                                <label
                                                    className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-all ${isCurrentChecked
                                                        ? getOptionStyle(option)
                                                        : currentAnswer.includes(option.externalId)
                                                            ? "border-indigo-500 bg-indigo-500/10"
                                                            : "border-slate-700 hover:border-slate-600 hover:bg-slate-800/50"
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
                                                        <span className="text-white">{option.text}</span>
                                                        {isCurrentChecked && (
                                                            <div className="mt-2 flex items-start gap-2">
                                                                {currentResult?.correctAnswers.includes(
                                                                    option.externalId
                                                                ) ? (
                                                                    <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-400" />
                                                                ) : currentResult?.selectedIds.includes(
                                                                    option.externalId
                                                                ) ? (
                                                                    <XCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-400" />
                                                                ) : (
                                                                    <Lightbulb className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-500" />
                                                                )}
                                                                <span
                                                                    className={`text-sm ${currentResult?.correctAnswers.includes(
                                                                        option.externalId
                                                                    )
                                                                        ? "text-emerald-300"
                                                                        : currentResult?.selectedIds.includes(
                                                                            option.externalId
                                                                        )
                                                                            ? "text-red-300"
                                                                            : "text-slate-400"
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
                        <CardFooter className="flex flex-wrap justify-between gap-4 border-t border-slate-700/50 bg-slate-900/50 pt-6">
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    onClick={handlePreviousQuestion}
                                    disabled={currentQuestionIndex === 0}
                                    className="gap-2 border-slate-700 text-slate-300"
                                >
                                    <ArrowLeft className="h-4 w-4" />
                                    Назад
                                </Button>
                                {currentQuestionIndex < quiz.questions.length - 1 ? (
                                    <Button
                                        variant="outline"
                                        onClick={handleNextQuestion}
                                        className="gap-2 border-slate-700 text-slate-300"
                                    >
                                        Далее
                                        <ArrowRight className="h-4 w-4" />
                                    </Button>
                                ) : null}
                            </div>
                            <div className="flex gap-2">
                                {!isCurrentChecked ? (
                                    <Button
                                        onClick={handleCheckAnswer}
                                        className="gap-2 bg-indigo-600 hover:bg-indigo-500"
                                    >
                                        <CheckCircle2 className="h-4 w-4" />
                                        Проверить
                                    </Button>
                                ) : currentQuestionIndex === quiz.questions.length - 1 ? (
                                    <Button
                                        onClick={handleFinishQuiz}
                                        className="gap-2 bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500"
                                    >
                                        <Trophy className="h-4 w-4" />
                                        Завершить тест
                                    </Button>
                                ) : null}
                            </div>
                        </CardFooter>
                    </Card>
                )}

                {/* Question Navigation Dots */}
                <div className="mt-6 flex flex-wrap justify-center gap-2">
                    {quiz.questions.map((q, index) => {
                        const result = checkedQuestions.get(q.id);
                        let dotClass = "bg-slate-700 hover:bg-slate-600";

                        if (result) {
                            dotClass = result.isCorrect
                                ? "bg-emerald-500"
                                : "bg-red-500";
                        } else if (answers.has(q.id)) {
                            dotClass = "bg-indigo-500";
                        }

                        if (index === currentQuestionIndex) {
                            dotClass += " ring-2 ring-white ring-offset-2 ring-offset-slate-900";
                        }

                        return (
                            <button
                                key={q.id}
                                onClick={() => setCurrentQuestionIndex(index)}
                                className={`h-3 w-3 rounded-full transition-all ${dotClass}`}
                                title={`Вопрос ${index + 1}`}
                            />
                        );
                    })}
                </div>
            </main>
        </div>
    );
}
