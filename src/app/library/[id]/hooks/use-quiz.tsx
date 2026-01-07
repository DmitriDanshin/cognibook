"use client";

import React, { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { Chapter, Source, ValidationError, LinkedQuiz } from "../types";

interface UseQuizOptions {
    source: Source | null;
    selectedChapter: Chapter | null;
    fetchSource: () => Promise<void>;
}

interface UseQuizReturn {
    isQuizDialogOpen: boolean;
    setIsQuizDialogOpen: (open: boolean) => void;
    quizUploading: boolean;
    quizJsonText: string;
    setQuizJsonText: (text: string) => void;
    quizValidationErrors: ValidationError[];
    linkedQuiz: LinkedQuiz | null;
    linkedQuizLoading: boolean;
    handleQuizFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
    handleQuizTextUpload: () => Promise<void>;
}

export function useQuiz({
    source,
    selectedChapter,
    fetchSource,
}: UseQuizOptions): UseQuizReturn {
    const router = useRouter();
    const [isQuizDialogOpen, setIsQuizDialogOpen] = useState(false);
    const [quizUploading, setQuizUploading] = useState(false);
    const [quizJsonText, setQuizJsonText] = useState("");
    const [quizValidationErrors, setQuizValidationErrors] = useState<ValidationError[]>([]);
    const [linkedQuiz, setLinkedQuiz] = useState<LinkedQuiz | null>(null);
    const [linkedQuizLoading, setLinkedQuizLoading] = useState(false);

    const submitQuiz = useCallback(async (formData: FormData) => {
        if (!source || !selectedChapter) {
            toast.error("Выберите главу для создания теста");
            return;
        }

        setQuizUploading(true);
        setQuizValidationErrors([]);

        try {
            formData.append("sourceId", source.id);
            formData.append("chapterId", selectedChapter.id);

            const response = await fetch("/api/quizzes", {
                method: "POST",
                body: formData,
            });

            const data = await response.json();

            if (!response.ok) {
                if (data.details) {
                    setQuizValidationErrors(data.details);
                    toast.error("Ошибка валидации формата");
                } else {
                    toast.error(data.error || "Не удалось загрузить тест");
                }
                return;
            }

            const createdQuizId = data?.id as string | undefined;
            toast.success(
                <div className="flex items-center gap-3">
                    <span>Тест успешно создан</span>
                    {createdQuizId && (
                        <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                                router.push(`/quizzes/${createdQuizId}`);
                                toast.dismiss();
                            }}
                            className="h-7 px-3 py-1"
                        >
                            Перейти к тесту
                        </Button>
                    )}
                </div>,
                {
                    duration: 5000,
                }
            );
            setIsQuizDialogOpen(false);
            setQuizValidationErrors([]);
            setQuizJsonText("");
            // Refresh the source to update quiz status
            fetchSource();
        } catch (error) {
            console.error("Error uploading quiz:", error);
            toast.error("Не удалось загрузить тест");
        } finally {
            setQuizUploading(false);
        }
    }, [source, selectedChapter, router, fetchSource]);

    const handleQuizFileUpload = useCallback(async (
        e: React.ChangeEvent<HTMLInputElement>
    ) => {
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
    }, [submitQuiz]);

    const handleQuizTextUpload = useCallback(async () => {
        if (!quizJsonText.trim()) {
            toast.error("Вставьте JSON или YAML");
            return;
        }

        const formData = new FormData();
        const file = new File([quizJsonText], "quiz.yaml", {
            type: "text/yaml",
        });
        formData.append("file", file);
        await submitQuiz(formData);
    }, [quizJsonText, submitQuiz]);

    // Fetch linked quiz for selected chapter
    useEffect(() => {
        if (!selectedChapter) {
            setLinkedQuiz(null);
            setLinkedQuizLoading(false);
            return;
        }

        // Clear immediately and start loading
        setLinkedQuiz(null);
        setLinkedQuizLoading(true);

        let cancelled = false;
        const timeout = setTimeout(async () => {
            try {
                const response = await fetch(`/api/quizzes?chapterId=${selectedChapter.id}`);
                if (cancelled) return;
                if (!response.ok) throw new Error("Failed to fetch linked quiz");
                const data = await response.json();
                if (cancelled) return;
                setLinkedQuiz(data);
            } catch (error) {
                if (cancelled) return;
                console.error("Error fetching linked quiz:", error);
                setLinkedQuiz(null);
            } finally {
                if (!cancelled) {
                    setLinkedQuizLoading(false);
                }
            }
        }, 250);

        return () => {
            cancelled = true;
            clearTimeout(timeout);
        };
    }, [selectedChapter?.id]);

    return {
        isQuizDialogOpen,
        setIsQuizDialogOpen,
        quizUploading,
        quizJsonText,
        setQuizJsonText,
        quizValidationErrors,
        linkedQuiz,
        linkedQuizLoading,
        handleQuizFileUpload,
        handleQuizTextUpload,
    };
}
