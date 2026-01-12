"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
    CheckSquare,
    Copy,
    Download,
    FileText,
    Menu,
    Play,
    Search,
    Undo2,
} from "lucide-react";
import { QuizDialog } from "./quiz-dialog";
import type { ToolbarProps } from "../types";

export function Toolbar({
    selectedChapter,
    source,
    linkedQuiz,
    linkedQuizLoading,
    isQuizDialogOpen,
    setIsQuizDialogOpen,
    isSearchOpen,
    isMultiSelectMode,
    selectedChapterIds,
    returnToQuiz,
    setSidebarOpen,
    toggleSearch,
    toggleMultiSelect,
    handleCopyText,
    handleDownloadTxt,
    quizDialogProps,
}: ToolbarProps) {
    const router = useRouter();
    const isPdfSource = source?.sourceType?.toLowerCase() === "pdf";
    const pdfUrl = source?.filePath
        ? source.filePath.startsWith("/api/")
            ? source.filePath
            : `/api${source.filePath}`
        : null;

    const handleOpenPdf = () => {
        if (!pdfUrl) return;
        window.open(pdfUrl, "_blank", "noopener,noreferrer");
    };

    return (
        <header className="relative z-30 flex h-14 items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur sm:h-16 sm:px-6">
            <div className="flex min-w-0 items-center gap-4">
                <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-foreground lg:hidden"
                    onClick={() => setSidebarOpen(true)}
                >
                    <Menu className="h-5 w-5" />
                </Button>
                {returnToQuiz && (
                    <Link href={`/quizzes/${returnToQuiz}`}>
                        <Button
                            variant="outline"
                            size="sm"
                            className="gap-2"
                        >
                            <Undo2 className="h-4 w-4" />
                            <span className="hidden sm:inline">К тесту</span>
                        </Button>
                    </Link>
                )}
                <h1
                    className="hidden min-w-0 flex-1 truncate text-base font-medium text-foreground sm:block sm:text-lg"
                    title={selectedChapter?.title || "Выберите главу"}
                >
                    {selectedChapter?.title || "Выберите главу"}
                </h1>
            </div>
            <div className="flex items-center gap-2">
                {linkedQuiz ? (
                    <Button
                        variant="outline"
                        size="sm"
                        className="gap-2 text-muted-foreground hover:text-foreground"
                        onClick={() => router.push(`/quizzes/${linkedQuiz.id}`)}
                        disabled={linkedQuizLoading}
                        title={linkedQuiz.title}
                    >
                        <Play className="h-4 w-4" />
                        <span className="hidden sm:inline">Открыть тест</span>
                    </Button>
                ) : (
                    <QuizDialog
                        isOpen={isQuizDialogOpen}
                        onOpenChange={setIsQuizDialogOpen}
                        source={source}
                        selectedChapter={selectedChapter}
                        {...quizDialogProps}
                    />
                )}
                <Button
                    variant="outline"
                    size="sm"
                    className={`gap-2 text-muted-foreground hover:text-foreground ${isSearchOpen ? "bg-accent" : ""}`}
                    onClick={toggleSearch}
                    title="Поиск (Ctrl+F)"
                >
                    <Search className="h-4 w-4" />
                    <span className="hidden sm:inline">Поиск</span>
                </Button>
                <Button
                    variant={isMultiSelectMode ? "default" : "outline"}
                    size="sm"
                    className={`gap-1 sm:gap-2 ${isMultiSelectMode ? "" : "text-muted-foreground hover:text-foreground"}`}
                    onClick={toggleMultiSelect}
                    title={isMultiSelectMode ? `Выбрано ${selectedChapterIds.size} глав` : "Режим выбора глав"}
                >
                    <CheckSquare className="h-4 w-4" />
                    {isMultiSelectMode && selectedChapterIds.size > 0 && (
                        <span className="min-w-[1.25rem] rounded-full bg-primary-foreground px-1.5 py-0.5 text-xs font-medium text-primary sm:hidden">
                            {selectedChapterIds.size}
                        </span>
                    )}
                    <span className="hidden sm:inline">
                        {isMultiSelectMode
                            ? `Выбрано: ${selectedChapterIds.size}`
                            : "Выбрать"}
                    </span>
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 text-muted-foreground hover:text-foreground"
                    onClick={handleCopyText}
                    disabled={isMultiSelectMode && selectedChapterIds.size === 0}
                >
                    <Copy className="h-4 w-4" />
                    <span className="hidden sm:inline">Копировать</span>
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 text-muted-foreground hover:text-foreground"
                    onClick={handleDownloadTxt}
                    disabled={isMultiSelectMode && selectedChapterIds.size === 0}
                >
                    <Download className="h-4 w-4" />
                    <span className="hidden sm:inline">Скачать TXT</span>
                </Button>
                {isPdfSource && pdfUrl && (
                    <Button
                        variant="outline"
                        size="sm"
                        className="gap-2 text-muted-foreground hover:text-foreground"
                        onClick={handleOpenPdf}
                    >
                        <FileText className="h-4 w-4" />
                        <span className="hidden sm:inline">PDF</span>
                    </Button>
                )}
            </div>
        </header>
    );
}
