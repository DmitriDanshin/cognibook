"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FileJson } from "lucide-react";
import type { QuizDialogProps } from "../types";

export function QuizDialog({
    isOpen,
    onOpenChange,
    source,
    selectedChapter,
    quizValidationErrors,
    quizUploading,
    quizJsonText,
    setQuizJsonText,
    onQuizFileUpload,
    onQuizTextUpload,
}: QuizDialogProps) {
    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogTrigger asChild>
                <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 text-muted-foreground hover:text-foreground"
                    disabled={!selectedChapter}
                >
                    <FileJson className="h-4 w-4" />
                    <span className="hidden sm:inline">Создать тест</span>
                </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto border-border bg-background">
                <DialogHeader>
                    <DialogTitle className="text-foreground">
                        Загрузить JSON тест
                    </DialogTitle>
                    <DialogDescription className="text-muted-foreground">
                        Вставьте готовый JSON. Файл .json можно загрузить дополнительно
                    </DialogDescription>
                </DialogHeader>
                <div className="mt-4 space-y-4">
                    <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
                        <div className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">
                            Привязка
                        </div>
                        <div>
                            Источник:{" "}
                            <span className="text-foreground">
                                {source?.title || "-"}
                            </span>
                        </div>
                        <div>
                            Глава:{" "}
                            <span className="text-foreground">
                                {selectedChapter?.title || "-"}
                            </span>
                        </div>
                    </div>

                    {quizValidationErrors.length > 0 && (
                        <Alert
                            variant="destructive"
                            className="border-destructive/30 bg-destructive/10"
                        >
                            <AlertDescription>
                                <div className="space-y-1">
                                    {quizValidationErrors.map((error, index) => (
                                        <div key={index} className="text-sm">
                                            <span className="font-medium">
                                                {error.path}:
                                            </span>{" "}
                                            {error.message}
                                        </div>
                                    ))}
                                </div>
                            </AlertDescription>
                        </Alert>
                    )}

                    <div className="space-y-3">
                        <label className="text-sm font-medium text-foreground">
                            JSON теста
                        </label>
                        <Textarea
                            value={quizJsonText}
                            onChange={(e) => setQuizJsonText(e.target.value)}
                            placeholder="Вставьте JSON теста сюда"
                            className="min-h-40 max-h-60 resize-y overflow-y-auto bg-background text-foreground placeholder:text-muted-foreground"
                            disabled={quizUploading}
                        />
                        <Button
                            type="button"
                            className="w-full"
                            onClick={onQuizTextUpload}
                            disabled={quizUploading || !quizJsonText.trim()}
                        >
                            {quizUploading ? "Загрузка..." : "Импортировать из текста"}
                        </Button>
                        <p className="text-xs text-muted-foreground">
                            Вставьте готовый JSON. Для файлов используйте загрузку ниже.
                        </p>
                    </div>

                    <div className="rounded-lg border border-border bg-muted/40 p-3">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="space-y-1">
                                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                                    <FileJson className="h-4 w-4" />
                                    Файл .json
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Поддерживаются файлы только в формате JSON.
                                </p>
                            </div>
                            <Button
                                asChild
                                variant="outline"
                                size="sm"
                                className={
                                    quizUploading
                                        ? "pointer-events-none opacity-50"
                                        : ""
                                }
                            >
                                <label htmlFor="chapter-quiz-upload">
                                    Выбрать файл
                                </label>
                            </Button>
                            <Input
                                id="chapter-quiz-upload"
                                type="file"
                                accept=".json"
                                className="hidden"
                                onChange={onQuizFileUpload}
                                disabled={quizUploading}
                            />
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
