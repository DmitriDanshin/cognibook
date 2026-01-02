"use client";

import { useState, useEffect, useCallback, use } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import {
    ArrowLeft,
    BookOpen,
    Copy,
    Download,
    Menu,
    X,
    ChevronRight,
    Loader2,
} from "lucide-react";
import { toast } from "sonner";

interface Chapter {
    id: string;
    title: string;
    href: string;
    order: number;
    parentId: string | null;
    children?: Chapter[];
}

interface Book {
    id: string;
    title: string;
    author: string | null;
    chapters: Chapter[];
}

export default function BookReaderPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = use(params);
    const [book, setBook] = useState<Book | null>(null);
    const [loading, setLoading] = useState(true);
    const [selectedChapter, setSelectedChapter] = useState<Chapter | null>(null);
    const [chapterContent, setChapterContent] = useState<string>("");
    const [contentLoading, setContentLoading] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(true);

    const fetchBook = useCallback(async () => {
        try {
            const response = await fetch(`/api/books/${id}`);
            if (!response.ok) throw new Error("Failed to fetch book");
            const data = await response.json();
            setBook(data);

            // Build chapter hierarchy
            const chaptersWithChildren = buildChapterTree(data.chapters || []);
            if (chaptersWithChildren.length > 0) {
                setSelectedChapter(chaptersWithChildren[0]);
            }
        } catch (error) {
            console.error("Error fetching book:", error);
            toast.error("Не удалось загрузить книгу");
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        fetchBook();
    }, [fetchBook]);

    const fetchChapterContent = useCallback(async (chapter: Chapter) => {
        setContentLoading(true);
        try {
            const response = await fetch(`/api/books/${id}/chapters/${chapter.id}`);
            if (!response.ok) throw new Error("Failed to fetch chapter");
            const data = await response.json();
            setChapterContent(data.content || "");
        } catch (error) {
            console.error("Error fetching chapter:", error);
            toast.error("Не удалось загрузить содержимое главы");
            setChapterContent("<p>Не удалось загрузить содержимое главы.</p>");
        } finally {
            setContentLoading(false);
        }
    }, [id]);

    useEffect(() => {
        if (selectedChapter) {
            fetchChapterContent(selectedChapter);
        }
    }, [selectedChapter, fetchChapterContent]);

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

    const renderChapterItem = (chapter: Chapter, level: number = 0) => {
        const hasChildren = chapter.children && chapter.children.length > 0;
        const isSelected = selectedChapter?.id === chapter.id;

        if (hasChildren) {
            return (
                <AccordionItem key={chapter.id} value={chapter.id} className="border-0">
                    <AccordionTrigger
                        className={`px-4 py-2 text-sm hover:bg-slate-700/50 hover:no-underline ${isSelected ? "bg-violet-500/20 text-violet-300" : "text-slate-300"
                            }`}
                        style={{ paddingLeft: `${level * 16 + 16}px` }}
                    >
                        {chapter.title}
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
                onClick={() => setSelectedChapter(chapter)}
                className={`flex w-full items-center gap-2 px-4 py-2 text-left text-sm transition-colors hover:bg-slate-700/50 ${isSelected
                        ? "bg-violet-500/20 text-violet-300"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                style={{ paddingLeft: `${level * 16 + 16}px` }}
            >
                <ChevronRight className="h-3 w-3 flex-shrink-0" />
                <span className="line-clamp-1">{chapter.title}</span>
            </button>
        );
    };

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-900">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
            </div>
        );
    }

    if (!book) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center bg-slate-900 text-white">
                <BookOpen className="mb-4 h-16 w-16 text-slate-600" />
                <h1 className="mb-2 text-2xl font-bold">Книга не найдена</h1>
                <Link href="/library">
                    <Button variant="outline">Вернуться в библиотеку</Button>
                </Link>
            </div>
        );
    }

    // Build chapter tree
    const chapterTree = buildChapterTree(book.chapters);

    return (
        <div className="flex h-screen bg-slate-900">
            {/* Sidebar */}
            <aside
                className={`fixed inset-y-0 left-0 z-40 w-80 transform border-r border-slate-800 bg-slate-900 transition-transform duration-300 lg:relative lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"
                    }`}
            >
                {/* Sidebar Header */}
                <div className="flex h-16 items-center justify-between border-b border-slate-800 px-4">
                    <Link href="/library" className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="text-slate-400 hover:text-white"
                        >
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                    </Link>
                    <span className="line-clamp-1 flex-1 px-2 text-sm font-medium text-white">
                        {book.title}
                    </span>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="text-slate-400 hover:text-white lg:hidden"
                        onClick={() => setSidebarOpen(false)}
                    >
                        <X className="h-5 w-5" />
                    </Button>
                </div>

                {/* Table of Contents */}
                <div className="px-4 py-3">
                    <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Оглавление
                    </h2>
                </div>
                <ScrollArea className="h-[calc(100vh-8rem)]">
                    {chapterTree.length > 0 ? (
                        <Accordion type="multiple" className="w-full">
                            {chapterTree.map((chapter) => renderChapterItem(chapter))}
                        </Accordion>
                    ) : (
                        <div className="px-4 py-8 text-center text-slate-500">
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
                <header className="flex h-16 items-center justify-between border-b border-slate-800 bg-slate-900/95 px-4 backdrop-blur">
                    <div className="flex items-center gap-4">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="text-slate-400 hover:text-white lg:hidden"
                            onClick={() => setSidebarOpen(true)}
                        >
                            <Menu className="h-5 w-5" />
                        </Button>
                        <h1 className="line-clamp-1 text-lg font-medium text-white">
                            {selectedChapter?.title || "Выберите главу"}
                        </h1>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            className="gap-2 border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white"
                            onClick={handleCopyText}
                        >
                            <Copy className="h-4 w-4" />
                            <span className="hidden sm:inline">Копировать</span>
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            className="gap-2 border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white"
                            onClick={handleDownloadTxt}
                        >
                            <Download className="h-4 w-4" />
                            <span className="hidden sm:inline">Скачать TXT</span>
                        </Button>
                    </div>
                </header>

                {/* Reading Area */}
                <ScrollArea className="h-[calc(100vh-4rem)]">
                    {contentLoading ? (
                        <div className="flex h-full items-center justify-center py-20">
                            <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
                        </div>
                    ) : chapterContent ? (
                        <article className="prose prose-invert prose-slate mx-auto max-w-3xl px-6 py-8 prose-headings:text-white prose-p:text-slate-300 prose-a:text-violet-400 prose-strong:text-white prose-blockquote:border-violet-500 prose-blockquote:text-slate-400 prose-li:text-slate-300">
                            <div dangerouslySetInnerHTML={{ __html: chapterContent }} />
                        </article>
                    ) : (
                        <div className="flex h-full flex-col items-center justify-center py-20 text-slate-500">
                            <BookOpen className="mb-4 h-16 w-16" />
                            <p>Выберите главу для чтения</p>
                        </div>
                    )}
                </ScrollArea>
            </main>
        </div>
    );
}
