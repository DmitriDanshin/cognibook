"use client";

import { useState, useEffect, useCallback, use, useMemo, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
    ArrowLeft,
    BookOpen,
    Clock,
    Copy,
    Download,
    FileJson,
    FileText,
    Play,
    Menu,
    X,
    XCircle,
    ChevronRight,
    Loader2,
    Trophy,
    Undo2,
} from "lucide-react";
import { toast } from "sonner";

interface Chapter {
    id: string;
    title: string;
    href: string;
    order: number;
    parentId: string | null;
    quizStatus?: "none" | "created" | "started" | "failed" | "perfect";
    children?: Chapter[];
}

interface Book {
    id: string;
    title: string;
    author: string | null;
    chapters: Chapter[];
}

interface ValidationError {
    path: string;
    message: string;
}

const escapeRegExp = (value: string) =>
    value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const getExpandableChapterIds = (chapters: Chapter[]) => {
    const parentIds = new Set<string>();
    chapters.forEach((chapter) => {
        if (chapter.parentId) {
            parentIds.add(chapter.parentId);
        }
    });
    return Array.from(parentIds);
};

export default function BookReaderPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = use(params);
    const router = useRouter();
    const searchParams = useSearchParams();
    const requestedChapterId = searchParams.get("chapterId");
    const highlightQuote = searchParams.get("quote");
    const returnToQuiz = searchParams.get("returnToQuiz");
    const [book, setBook] = useState<Book | null>(null);
    const [loading, setLoading] = useState(true);
    const [selectedChapter, setSelectedChapter] = useState<Chapter | null>(null);
    const [chapterContent, setChapterContent] = useState<string>("");
    const [contentLoading, setContentLoading] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [expandedChapters, setExpandedChapters] = useState<string[]>([]);
    const [isQuizDialogOpen, setIsQuizDialogOpen] = useState(false);
    const [quizUploading, setQuizUploading] = useState(false);
    const [quizJsonText, setQuizJsonText] = useState("");
    const [quizValidationErrors, setQuizValidationErrors] = useState<
        ValidationError[]
    >([]);
    const [linkedQuiz, setLinkedQuiz] = useState<{ id: string; title: string } | null>(
        null
    );
    const [linkedQuizLoading, setLinkedQuizLoading] = useState(false);
    const contentRef = useRef<HTMLDivElement | null>(null);
    const [isTocReady, setIsTocReady] = useState(false);
    const chapterStorageKey = useMemo(() => `book-last-chapter:${id}`, [id]);
    const tocStorageKey = useMemo(() => `book-toc-expanded:${id}`, [id]);

    const fetchBook = useCallback(async () => {
        try {
            setIsTocReady(false);
            const response = await fetch(`/api/books/${id}`);
            if (!response.ok) throw new Error("Failed to fetch book");
            const data = await response.json();
            setBook(data);

            // Build chapter hierarchy
            const chaptersWithChildren = buildChapterTree(data.chapters || []);
            const parentIds = new Set<string>();
            (data.chapters || []).forEach((chapter: Chapter) => {
                if (chapter.parentId) {
                    parentIds.add(chapter.parentId);
                }
            });
            const expandableChapterIds = Array.from(parentIds);
            let savedChapterId: string | null = null;
            let savedExpanded: string[] = [];
            try {
                savedChapterId = localStorage.getItem(chapterStorageKey);
                const expandedRaw = localStorage.getItem(tocStorageKey);
                savedExpanded = expandedRaw ? (JSON.parse(expandedRaw) as string[]) : [];
            } catch {
                savedChapterId = null;
                savedExpanded = [];
            }

            const requestedChapter = requestedChapterId
                ? data.chapters?.find(
                    (chapter: Chapter) => chapter.id === requestedChapterId
                )
                : null;
            const savedChapter =
                !requestedChapter && savedChapterId
                    ? data.chapters?.find(
                        (chapter: Chapter) => chapter.id === savedChapterId
                    )
                    : null;
            if (requestedChapter) {
                setSelectedChapter(requestedChapter);
            } else if (savedChapter) {
                setSelectedChapter(savedChapter);
            } else if (chaptersWithChildren.length > 0) {
                setSelectedChapter(chaptersWithChildren[0]);
            }

            if (savedExpanded.length > 0) {
                setExpandedChapters(
                    savedExpanded.filter((chapterId) => parentIds.has(chapterId))
                );
            } else {
                setExpandedChapters(expandableChapterIds);
            }
            setIsTocReady(true);
        } catch (error) {
            console.error("Error fetching book:", error);
            toast.error("Не удалось загрузить книгу");
        } finally {
            setLoading(false);
        }
    }, [id, requestedChapterId, chapterStorageKey, tocStorageKey]);

    useEffect(() => {
        fetchBook();
    }, [fetchBook]);

    const fetchChapterContent = useCallback(async (chapter: Chapter) => {
        setContentLoading(true);
        try {
            const response = await fetch(`/api/books/${id}/chapters/${chapter.id}`);
            if (!response.ok) throw new Error("Failed to fetch chapter");
            const data = await response.json();
            const rawContent = data.content || "";
            setChapterContent(rawContent);
        } catch (error) {
            console.error("Error fetching chapter:", error);
            toast.error("Не удалось загрузить содержимое главы");
            setChapterContent("<p>Не удалось загрузить содержимое главы.</p>");
        } finally {
            setContentLoading(false);
        }
    }, [id, highlightQuote, requestedChapterId]);

    useEffect(() => {
        if (selectedChapter) {
            fetchChapterContent(selectedChapter);
        }
    }, [selectedChapter, fetchChapterContent]);

    useEffect(() => {
        if (!selectedChapter) return;
        try {
            localStorage.setItem(chapterStorageKey, selectedChapter.id);
        } catch {
            // ignore storage errors
        }
    }, [selectedChapter, chapterStorageKey]);

    useEffect(() => {
        if (!isTocReady) return;
        try {
            localStorage.setItem(tocStorageKey, JSON.stringify(expandedChapters));
        } catch {
            // ignore storage errors
        }
    }, [expandedChapters, isTocReady, tocStorageKey]);

    const fetchLinkedQuiz = useCallback(async (chapterId: string) => {
        setLinkedQuizLoading(true);
        try {
            const response = await fetch(`/api/quizzes?chapterId=${chapterId}`);
            if (!response.ok) throw new Error("Failed to fetch linked quiz");
            const data = await response.json();
            setLinkedQuiz(data);
        } catch (error) {
            console.error("Error fetching linked quiz:", error);
            setLinkedQuiz(null);
        } finally {
            setLinkedQuizLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!selectedChapter) {
            setLinkedQuiz(null);
            return;
        }
        fetchLinkedQuiz(selectedChapter.id);
    }, [fetchLinkedQuiz, selectedChapter]);

    useEffect(() => {
        if (!highlightQuote || !requestedChapterId) return;
        if (selectedChapter?.id !== requestedChapterId) return;
        const container = contentRef.current;
        if (!container) return;
        const timeout = setTimeout(() => {
            const clearHighlights = () => {
                const marks = container.querySelectorAll(
                    'mark[data-quote-highlight="true"]'
                );
                marks.forEach((mark) => {
                    const parent = mark.parentNode;
                    if (!parent) return;
                    while (mark.firstChild) {
                        parent.insertBefore(mark.firstChild, mark);
                    }
                    parent.removeChild(mark);
                });
            };

            const getNodeAtTextIndex = (
                root: HTMLElement,
                index: number
            ): { node: Text; offset: number } | null => {
                const walker = document.createTreeWalker(
                    root,
                    NodeFilter.SHOW_TEXT
                );
                let currentIndex = 0;
                let node = walker.nextNode() as Text | null;
                while (node) {
                    const length = node.textContent?.length ?? 0;
                    if (index <= currentIndex + length) {
                        return { node, offset: Math.max(0, index - currentIndex) };
                    }
                    currentIndex += length;
                    node = walker.nextNode() as Text | null;
                }
                return null;
            };

            clearHighlights();

            const trimmedQuote = highlightQuote.trim();
            if (!trimmedQuote) return;

            const textContent = container.textContent || "";
            const escapedQuote = escapeRegExp(trimmedQuote);
            const quotePattern = escapedQuote.replace(/\s+/g, "\\s+");
            const quoteRegex = new RegExp(quotePattern, "u");
            const match = quoteRegex.exec(textContent);
            if (!match) return;

            const startIndex = match.index;
            const endIndex = startIndex + match[0].length;
            const startNode = getNodeAtTextIndex(container, startIndex);
            const endNode = getNodeAtTextIndex(container, endIndex);
            if (!startNode || !endNode) return;

            const range = document.createRange();
            range.setStart(startNode.node, startNode.offset);
            range.setEnd(endNode.node, endNode.offset);

            const mark = document.createElement("mark");
            mark.dataset.quoteHighlight = "true";

            try {
                range.surroundContents(mark);
            } catch {
                const fragment = range.extractContents();
                mark.appendChild(fragment);
                range.insertNode(mark);
            }

            mark.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 100);
        return () => clearTimeout(timeout);
    }, [chapterContent, highlightQuote, requestedChapterId, selectedChapter?.id]);

    const buildChapterTree = (chapters: Chapter[]): Chapter[] => {
        const chapterMap = new Map<string, Chapter>();
        const rootChapters: Chapter[] = [];

        chapters.forEach((chapter) => {
            chapterMap.set(chapter.id, { ...chapter, children: [] });
        });

        chapters.forEach((chapter) => {
            const mappedChapter = chapterMap.get(chapter.id)!;
            if (chapter.parentId) {
                const parent = chapterMap.get(chapter.parentId);
                if (parent) {
                    parent.children = parent.children || [];
                    parent.children.push(mappedChapter);
                }
            } else {
                rootChapters.push(mappedChapter);
            }
        });

        return rootChapters;
    };

    const handleCopyText = async () => {
        // Strip HTML tags for plain text
        const tempDiv = document.createElement("div");
        tempDiv.innerHTML = chapterContent;
        const plainText = tempDiv.textContent || tempDiv.innerText;

        try {
            // Try modern clipboard API first
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(plainText);
            } else {
                // Fallback for non-secure contexts (HTTP)
                const textArea = document.createElement("textarea");
                textArea.value = plainText;
                textArea.style.position = "fixed";
                textArea.style.left = "-999999px";
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand("copy");
                document.body.removeChild(textArea);
            }
            toast.success("Текст скопирован в буфер обмена");
        } catch {
            toast.error("Не удалось скопировать текст");
        }
    };

    const handleDownloadTxt = () => {
        const tempDiv = document.createElement("div");
        tempDiv.innerHTML = chapterContent;
        const plainText = tempDiv.textContent || tempDiv.innerText;

        const blob = new Blob([plainText], { type: "text/plain;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${selectedChapter?.title || "chapter"}.txt`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        toast.success("Файл скачан");
    };

    const handleSelectChapter = (chapter: Chapter) => {
        setSelectedChapter(chapter);
        if (typeof window !== "undefined" && window.innerWidth < 1024) {
            setSidebarOpen(false);
        }
    };

    const renderQuizStatusIcon = (status: Chapter["quizStatus"]) => {
        switch (status) {
            case "perfect":
                return <span title="Пройден на 100%"><Trophy className="h-3.5 w-3.5 flex-shrink-0 text-amber-400" /></span>;
            case "started":
                return <span title="В процессе"><Clock className="h-3.5 w-3.5 flex-shrink-0 text-orange-400" /></span>;
            case "failed":
                return <span title="Провален (<50%)"><XCircle className="h-3.5 w-3.5 flex-shrink-0 text-red-400" /></span>;
            case "created":
                return <span title="Тест создан"><FileText className="h-3.5 w-3.5 flex-shrink-0 text-blue-400" /></span>;
            default:
                return null;
        }
    };

    const renderChapterItem = (chapter: Chapter, level: number = 0) => {
        const hasChildren = chapter.children && chapter.children.length > 0;
        const isSelected = selectedChapter?.id === chapter.id;

        if (hasChildren) {
            return (
                <AccordionItem key={chapter.id} value={chapter.id} className="border-0">
                    <AccordionTrigger
                        className={`px-4 py-2 text-sm hover:bg-foreground/5 hover:no-underline ${isSelected ? "bg-foreground/10 text-foreground" : "text-muted-foreground"
                            }`}
                        style={{ paddingLeft: `${level * 16 + 16}px` }}
                    >
                        <span className="flex items-center gap-2">
                            {chapter.title}
                            {renderQuizStatusIcon(chapter.quizStatus)}
                        </span>
                    </AccordionTrigger>
                    <AccordionContent className="pb-0">
                        {chapter.children!.map((child) =>
                            renderChapterItem(child, level + 1)
                        )}
                    </AccordionContent>
                </AccordionItem>
            );
        }

        return (
            <button
                key={chapter.id}
                onClick={() => handleSelectChapter(chapter)}
                className={`flex w-full items-center gap-2 px-4 py-2 text-left text-sm transition-colors hover:bg-foreground/5 ${isSelected
                    ? "bg-foreground/10 text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                    }`}
                style={{ paddingLeft: `${level * 16 + 16}px` }}
            >
                <ChevronRight className="h-3 w-3 flex-shrink-0" />
                <span className="line-clamp-1 flex-1">{chapter.title}</span>
                {renderQuizStatusIcon(chapter.quizStatus)}
            </button>
        );
    };

    const submitQuiz = async (formData: FormData) => {
        if (!book || !selectedChapter) {
            toast.error("Выберите главу для создания теста");
            return;
        }

        setQuizUploading(true);
        setQuizValidationErrors([]);

        try {
            formData.append("bookId", book.id);
            formData.append("chapterId", selectedChapter.id);

            const response = await fetch("/api/quizzes", {
                method: "POST",
                body: formData,
            });

            const data = await response.json();

            if (!response.ok) {
                if (data.details) {
                    setQuizValidationErrors(data.details);
                    toast.error("Ошибка валидации JSON");
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
            // Refresh the book to update quiz status
            fetchBook();
        } catch (error) {
            console.error("Error uploading quiz:", error);
            toast.error("Не удалось загрузить тест");
        } finally {
            setQuizUploading(false);
        }
    };

    const handleQuizFileUpload = async (
        e: React.ChangeEvent<HTMLInputElement>
    ) => {
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

    const handleQuizTextUpload = async () => {
        if (!quizJsonText.trim()) {
            toast.error("Вставьте JSON");
            return;
        }

        try {
            JSON.parse(quizJsonText);
        } catch {
            toast.error("Невалидный JSON");
            return;
        }

        const formData = new FormData();
        const file = new File([quizJsonText], "quiz.json", {
            type: "application/json",
        });
        formData.append("file", file);
        await submitQuiz(formData);
    };

    if (loading) {
        return (
            <div className="flex min-h-dvh items-center justify-center bg-background">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-foreground/40 border-t-transparent" />
            </div>
        );
    }

    if (!book) {
        return (
            <div className="flex min-h-dvh flex-col items-center justify-center bg-background text-foreground">
                <BookOpen className="mb-4 h-16 w-16 text-muted-foreground" />
                <h1 className="mb-2 text-2xl font-bold">Книга не найдена</h1>
                <Link href="/library">
                    <Button variant="outline">Вернуться в библиотеку</Button>
                </Link>
            </div>
        );
    }

    // Build chapter tree
    const chapterTree = buildChapterTree(book.chapters);
    const expandableChapterIds = getExpandableChapterIds(book.chapters);
    const expandedSet = new Set(expandedChapters);
    const isAllExpanded =
        expandableChapterIds.length > 0 &&
        expandableChapterIds.every((id) => expandedSet.has(id));

    return (
        <div className="flex min-h-dvh bg-background text-foreground">
            {/* Sidebar */}
            <aside
                className={`fixed inset-y-0 left-0 z-40 w-[85vw] max-w-sm transform border-r border-border bg-background transition-transform duration-300 sm:w-80 lg:relative lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"
                    }`}
            >
                {/* Sidebar Header */}
                <div className="flex h-14 items-center justify-between border-b border-border px-4 sm:h-16">
                    <Link href="/library" className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="text-muted-foreground hover:text-foreground"
                        >
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                    </Link>
                    <span className="line-clamp-1 min-w-0 flex-1 px-2 text-sm font-medium text-foreground">
                        {book.title}
                    </span>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-foreground lg:hidden"
                        onClick={() => setSidebarOpen(false)}
                    >
                        <X className="h-5 w-5" />
                    </Button>
                </div>

                {/* Table of Contents */}
                <div className="flex items-center justify-between px-4 py-3">
                    <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Оглавление
                    </h2>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                        onClick={() =>
                            setExpandedChapters(
                                isAllExpanded ? [] : expandableChapterIds
                            )
                        }
                        disabled={expandableChapterIds.length === 0}
                    >
                        {isAllExpanded ? "Свернуть" : "Раскрыть"}
                    </Button>
                </div>
                <ScrollArea className="h-[calc(100dvh-8rem)]">
                    {chapterTree.length > 0 ? (
                        <Accordion
                            type="multiple"
                            className="w-full"
                            value={expandedChapters}
                            onValueChange={setExpandedChapters}
                        >
                            {chapterTree.map((chapter) => renderChapterItem(chapter))}
                        </Accordion>
                    ) : (
                        <div className="px-4 py-8 text-center text-muted-foreground">
                            <p>Оглавление не найдено</p>
                        </div>
                    )}
                </ScrollArea>
            </aside>

            {/* Mobile sidebar overlay */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 z-30 bg-black/50 lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Main Content */}
            <main className="flex-1 overflow-hidden">
                {/* Toolbar */}
                <header className="flex h-14 items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur sm:h-16 sm:px-6">
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
                        <h1 className="line-clamp-1 text-base font-medium text-foreground sm:text-lg">
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
                            <Dialog
                                open={isQuizDialogOpen}
                                onOpenChange={setIsQuizDialogOpen}
                            >
                                <DialogTrigger asChild>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="gap-2 text-muted-foreground hover:text-foreground"
                                        disabled={!selectedChapter || linkedQuizLoading}
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
                                                Книга:{" "}
                                                <span className="text-foreground">
                                                    {book?.title || "-"}
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
                                                        {quizValidationErrors.map(
                                                            (error, index) => (
                                                                <div
                                                                    key={index}
                                                                    className="text-sm"
                                                                >
                                                                    <span className="font-medium">
                                                                        {error.path}:
                                                                    </span>{" "}
                                                                    {error.message}
                                                                </div>
                                                            )
                                                        )}
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
                                                onChange={(e) =>
                                                    setQuizJsonText(e.target.value)
                                                }
                                                placeholder="Вставьте JSON теста сюда"
                                                className="min-h-40 max-h-60 resize-y overflow-y-auto bg-background text-foreground placeholder:text-muted-foreground"
                                                disabled={quizUploading}
                                            />
                                            <Button
                                                type="button"
                                                className="w-full"
                                                onClick={handleQuizTextUpload}
                                                disabled={quizUploading || !quizJsonText.trim()}
                                            >
                                                {quizUploading
                                                    ? "Загрузка..."
                                                    : "Импортировать из текста"}
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
                                                    onChange={handleQuizFileUpload}
                                                    disabled={quizUploading}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </DialogContent>
                            </Dialog>
                        )}
                        <Button
                            variant="outline"
                            size="sm"
                            className="gap-2 text-muted-foreground hover:text-foreground"
                            onClick={handleCopyText}
                        >
                            <Copy className="h-4 w-4" />
                            <span className="hidden sm:inline">Копировать</span>
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            className="gap-2 text-muted-foreground hover:text-foreground"
                            onClick={handleDownloadTxt}
                        >
                            <Download className="h-4 w-4" />
                            <span className="hidden sm:inline">Скачать TXT</span>
                        </Button>
                    </div>
                </header>

                {/* Reading Area */}
                <ScrollArea className="h-[calc(100dvh-3.5rem)] sm:h-[calc(100dvh-4rem)]">
                    {contentLoading ? (
                        <div className="flex h-full items-center justify-center py-20">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                    ) : chapterContent ? (
                        <article className="prose mx-auto w-full max-w-3xl px-4 pt-6 pb-[calc(2rem+env(safe-area-inset-bottom))] sm:px-6 sm:pt-8 sm:pb-[calc(2.5rem+env(safe-area-inset-bottom))]">
                            <div
                                ref={contentRef}
                                dangerouslySetInnerHTML={{ __html: chapterContent }}
                            />
                        </article>
                    ) : (
                        <div className="flex h-full flex-col items-center justify-center py-20 text-muted-foreground">
                            <BookOpen className="mb-4 h-16 w-16" />
                            <p>Выберите главу для чтения</p>
                        </div>
                    )}
                </ScrollArea>
            </main>
        </div>
    );
}
