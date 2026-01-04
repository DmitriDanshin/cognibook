"use client";

import { useState, useEffect, useCallback, use, useMemo, useRef, memo } from "react";
import type { RefObject } from "react";
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
    Search,
    ChevronUp,
    ChevronDown,
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

interface Source {
    id: string;
    title: string;
    author: string | null;
    chapters: Chapter[];
}

interface ValidationError {
    path: string;
    message: string;
}

type ChapterContentProps = {
    contentLoading: boolean;
    orderedChapters: Chapter[];
    chapterContents: Record<string, string>;
    contentRef: RefObject<HTMLDivElement | null>;
    isSearchOpen: boolean;
};

const ChapterContent = memo(function ChapterContent({
    contentLoading,
    orderedChapters,
    chapterContents,
    contentRef,
    isSearchOpen,
}: ChapterContentProps) {
    return (
        <ScrollArea className={isSearchOpen ? "h-[calc(100dvh-6.5rem)] sm:h-[calc(100dvh-7rem)]" : "h-[calc(100dvh-3.5rem)] sm:h-[calc(100dvh-4rem)]"}>
            {contentLoading ? (
                <div className="flex h-full items-center justify-center py-20">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            ) : orderedChapters.length > 0 ? (
                <article className="prose mx-auto w-full max-w-3xl px-4 pt-6 pb-[calc(2rem+env(safe-area-inset-bottom))] sm:px-6 sm:pt-8 sm:pb-[calc(2.5rem+env(safe-area-inset-bottom))]">
                    <div ref={contentRef}>
                        {orderedChapters.map((chapter, index) => {
                            const chapterHtml = chapterContents[chapter.id];
                            return (
                                <section
                                    key={chapter.id}
                                    id={`chapter-${chapter.id}`}
                                    data-chapter-id={chapter.id}
                                    className="scroll-mt-24"
                                >
                                    <h2 className={index === 0 ? "mt-0" : "mt-8"}>
                                        {chapter.title}
                                    </h2>
                                    {chapterHtml === undefined ? (
                                        <p className="text-muted-foreground">
                                            Загрузка содержимого главы...
                                        </p>
                                    ) : (
                                        <div
                                            dangerouslySetInnerHTML={{
                                                __html: chapterHtml,
                                            }}
                                        />
                                    )}
                                </section>
                            );
                        })}
                    </div>
                </article>
            ) : (
                <div className="flex h-full flex-col items-center justify-center py-20 text-muted-foreground">
                    <BookOpen className="mb-4 h-16 w-16" />
                    <p>Главы не найдены</p>
                </div>
            )}
        </ScrollArea>
    );
});

ChapterContent.displayName = "ChapterContent";

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

export default function SourceReaderPage({
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
    const [source, setSource] = useState<Source | null>(null);
    const [loading, setLoading] = useState(true);
    const [selectedChapter, setSelectedChapter] = useState<Chapter | null>(null);
    const [chapterContents, setChapterContents] = useState<Record<string, string>>({});
    const [contentLoading, setContentLoading] = useState(false);
    const [contentReady, setContentReady] = useState(false);
    const [contentSourceId, setContentSourceId] = useState<string | null>(null);
    const [contentChapterIdsKey, setContentChapterIdsKey] = useState<string | null>(null);
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
    const scrollViewportRef = useRef<HTMLDivElement | null>(null);
    const initialScrollDoneRef = useRef(false);
    const selectedChapterIdRef = useRef<string | null>(null);
    const isManualScrollingRef = useRef(false);
    const [isTocReady, setIsTocReady] = useState(false);
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<HTMLElement[]>([]);
    const [currentSearchIndex, setCurrentSearchIndex] = useState(0);
    const [isSearchLoading, setIsSearchLoading] = useState(false);
    const searchInputRef = useRef<HTMLInputElement | null>(null);
    const chapterStorageKey = useMemo(() => `source-last-chapter:${id}`, [id]);
    const tocStorageKey = useMemo(() => `source-toc-expanded:${id}`, [id]);
    const chapterIdsKey = useMemo(
        () => (source?.chapters ?? []).map((chapter) => chapter.id).join("|"),
        [source]
    );
    const orderedChapters = useMemo(
        () =>
            (source?.chapters ?? [])
                .slice()
                .sort((chapterA, chapterB) => chapterA.order - chapterB.order),
        [source]
    );
    const chapterLookup = useMemo(
        () =>
            new Map(
                (source?.chapters ?? []).map((chapter) => [chapter.id, chapter])
            ),
        [source]
    );

    const fetchSource = useCallback(async () => {
        try {
            setIsTocReady(false);
            const response = await fetch(`/api/sources/${id}`);
            if (!response.ok) throw new Error("Failed to fetch source");
            const data = await response.json();
            setSource(data);

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
            console.error("Error fetching source:", error);
            toast.error("Не удалось загрузить источник");
        } finally {
            setLoading(false);
        }
    }, [id, requestedChapterId, chapterStorageKey, tocStorageKey]);

    // Fetch a single chapter content with caching
    const fetchChapterContent = useCallback(
        async (chapterId: string): Promise<string> => {
            // Check sessionStorage cache first
            const cacheKey = `chapter-content:${id}:${chapterId}`;
            try {
                const cached = sessionStorage.getItem(cacheKey);
                if (cached) return cached;
            } catch {
                // sessionStorage may be unavailable
            }

            try {
                const response = await fetch(
                    `/api/sources/${id}/chapters/${chapterId}`
                );
                if (!response.ok) throw new Error("Failed to fetch chapter");
                const data = await response.json();
                const content = data.content || "";

                // Cache in sessionStorage
                try {
                    sessionStorage.setItem(cacheKey, content);
                } catch {
                    // Storage full or unavailable
                }

                return content;
            } catch (error) {
                console.error("Error fetching chapter:", error);
                return "<p>Не удалось загрузить содержимое главы.</p>";
            }
        },
        [id]
    );

    // Load chapters around the current one (lazy loading)
    const loadChaptersAround = useCallback(
        async (centerIndex: number, chapters: Chapter[]) => {
            // Load current + 2 before + 3 after
            const startIdx = Math.max(0, centerIndex - 2);
            const endIdx = Math.min(chapters.length - 1, centerIndex + 3);

            // Use functional update to check current state
            setChapterContents((prevContents) => {
                const toLoad: Chapter[] = [];
                for (let i = startIdx; i <= endIdx; i++) {
                    const chapter = chapters[i];
                    if (chapter && !prevContents[chapter.id]) {
                        toLoad.push(chapter);
                    }
                }

                if (toLoad.length === 0) return prevContents;

                // Load asynchronously and update state
                Promise.all(
                    toLoad.map(async (chapter) => {
                        const content = await fetchChapterContent(chapter.id);
                        return [chapter.id, content] as const;
                    })
                ).then((entries) => {
                    setChapterContents((prev) => ({
                        ...prev,
                        ...Object.fromEntries(entries),
                    }));
                });

                return prevContents;
            });
        },
        [fetchChapterContent]
    );

    const fetchAllChapterContents = useCallback(
        async (chapters: Chapter[]) => {
            if (chapters.length === 0) {
                return { contentMap: {}, failedCount: 0 };
            }

            // For small books (< 10 chapters), load all at once
            if (chapters.length < 10) {
                const failed: string[] = [];
                const entries = await Promise.all(
                    chapters.map(async (chapter) => {
                        const content = await fetchChapterContent(chapter.id);
                        if (content.includes("Не удалось загрузить")) {
                            failed.push(chapter.id);
                        }
                        return [chapter.id, content] as const;
                    })
                );

                return {
                    contentMap: Object.fromEntries(entries),
                    failedCount: failed.length,
                };
            }

            // For larger books, load first 5 chapters initially
            const initialChapters = chapters.slice(0, 5);
            const failed: string[] = [];
            const entries = await Promise.all(
                initialChapters.map(async (chapter) => {
                    const content = await fetchChapterContent(chapter.id);
                    if (content.includes("Не удалось загрузить")) {
                        failed.push(chapter.id);
                    }
                    return [chapter.id, content] as const;
                })
            );

            return {
                contentMap: Object.fromEntries(entries),
                failedCount: failed.length,
            };
        },
        [fetchChapterContent]
    );

    const scrollToChapter = useCallback(
        (chapterId: string, behavior: ScrollBehavior = "smooth") => {
            const element = document.getElementById(`chapter-${chapterId}`);
            element?.scrollIntoView({ behavior, block: "start" });
        },
        []
    );

    const getAncestorIds = useCallback(
        (chapter: Chapter) => {
            const ancestors: string[] = [];
            let current: Chapter | undefined = chapter;
            while (current?.parentId) {
                ancestors.push(current.parentId);
                current = chapterLookup.get(current.parentId);
            }
            return ancestors;
        },
        [chapterLookup]
    );

    useEffect(() => {
        fetchSource();
    }, [fetchSource]);

    useEffect(() => {
        initialScrollDoneRef.current = false;
    }, [id]);

    useEffect(() => {
        selectedChapterIdRef.current = selectedChapter?.id ?? null;
    }, [selectedChapter?.id]);

    useEffect(() => {
        if (!contentReady) return;
        if (!contentRef.current) return;
        scrollViewportRef.current =
            contentRef.current.closest<HTMLDivElement>(
                '[data-slot="scroll-area-viewport"]'
            ) ?? null;
    }, [contentReady]);

    useEffect(() => {
        if (!source) return;
        if (contentSourceId === source.id && contentChapterIdsKey === chapterIdsKey) {
            return;
        }

        let isCancelled = false;
        setContentLoading(true);
        setContentReady(false);
        setChapterContents({});

        const loadContents = async () => {
            // For large books, find the starting position
            let initialIndex = 0;
            if (orderedChapters.length >= 10) {
                const targetId = requestedChapterId || selectedChapter?.id;
                if (targetId) {
                    const idx = orderedChapters.findIndex((c) => c.id === targetId);
                    if (idx !== -1) initialIndex = idx;
                }
            }

            // Determine which chapters to load initially
            let chaptersToLoad = orderedChapters;
            if (orderedChapters.length >= 10) {
                // Load 2 before + current + 3 after = 6 chapters max
                const startIdx = Math.max(0, initialIndex - 2);
                const endIdx = Math.min(orderedChapters.length, initialIndex + 4);
                chaptersToLoad = orderedChapters.slice(startIdx, endIdx);
            }

            const { contentMap, failedCount } = await fetchAllChapterContents(
                chaptersToLoad
            );
            if (isCancelled) return;
            setChapterContents(contentMap);
            setContentLoading(false);
            setContentReady(true);
            setContentSourceId(source.id);
            setContentChapterIdsKey(chapterIdsKey);
            if (failedCount > 0) {
                toast.error("Не удалось загрузить некоторые главы");
            }
        };

        void loadContents();

        return () => {
            isCancelled = true;
        };
    }, [
        source,
        chapterIdsKey,
        contentSourceId,
        contentChapterIdsKey,
        fetchAllChapterContents,
        orderedChapters,
        requestedChapterId,
        selectedChapter?.id,
    ]);

    useEffect(() => {
        if (!contentReady || contentSourceId !== source?.id || initialScrollDoneRef.current) {
            return;
        }
        const initialChapterId = requestedChapterId || selectedChapter?.id;
        if (initialChapterId) {
            selectedChapterIdRef.current = initialChapterId;
            scrollToChapter(initialChapterId, "auto");
        }
        // Delay enabling observer to let scroll settle
        const timeout = setTimeout(() => {
            initialScrollDoneRef.current = true;
        }, 500);
        return () => clearTimeout(timeout);
    }, [
        source?.id,
        contentSourceId,
        contentReady,
        requestedChapterId,
        scrollToChapter,
        selectedChapter?.id,
    ]);

    useEffect(() => {
        if (!selectedChapter) return;
        try {
            localStorage.setItem(chapterStorageKey, selectedChapter.id);
        } catch {
            // ignore storage errors
        }

        // Lazy load chapters around the selected one
        if (orderedChapters.length >= 10) {
            const currentIndex = orderedChapters.findIndex(
                (c) => c.id === selectedChapter.id
            );
            if (currentIndex !== -1) {
                loadChaptersAround(currentIndex, orderedChapters);
            }
        }
    }, [selectedChapter, chapterStorageKey, orderedChapters, loadChaptersAround]);

    useEffect(() => {
        if (!selectedChapter) return;
        const ancestorIds = getAncestorIds(selectedChapter);
        if (ancestorIds.length === 0) return;
        setExpandedChapters((prev) => {
            const next = new Set(prev);
            let changed = false;
            ancestorIds.forEach((ancestorId) => {
                if (!next.has(ancestorId)) {
                    next.add(ancestorId);
                    changed = true;
                }
            });
            return changed ? Array.from(next) : prev;
        });
    }, [getAncestorIds, selectedChapter]);

    useEffect(() => {
        if (!isTocReady) return;
        try {
            localStorage.setItem(tocStorageKey, JSON.stringify(expandedChapters));
        } catch {
            // ignore storage errors
        }
    }, [expandedChapters, isTocReady, tocStorageKey]);

    useEffect(() => {
        if (!contentReady || contentSourceId !== source?.id) return;
        if (!scrollViewportRef.current) return;
        if (orderedChapters.length === 0) return;

        const viewport = scrollViewportRef.current;
        const chapterElements = orderedChapters
            .map((chapter) => document.getElementById(`chapter-${chapter.id}`))
            .filter((element): element is HTMLElement => Boolean(element));

        if (chapterElements.length === 0) return;

        const observer = new IntersectionObserver(
            (entries) => {
                if (!initialScrollDoneRef.current) return;
                if (isManualScrollingRef.current) return;
                const visibleEntries = entries
                    .filter((entry) => entry.isIntersecting)
                    .sort(
                        (entryA, entryB) =>
                            entryA.boundingClientRect.top -
                            entryB.boundingClientRect.top
                    );
                if (visibleEntries.length === 0) return;

                const target = visibleEntries[0].target as HTMLElement;
                const chapterId = target.dataset.chapterId;
                if (!chapterId) return;
                if (selectedChapterIdRef.current === chapterId) return;
                const chapter = chapterLookup.get(chapterId);
                if (!chapter) return;
                selectedChapterIdRef.current = chapterId;
                setSelectedChapter(chapter);
            },
            {
                root: viewport,
                rootMargin: "0px 0px -60% 0px",
                threshold: 0,
            }
        );

        chapterElements.forEach((element) => observer.observe(element));

        return () => {
            observer.disconnect();
        };
    }, [source?.id, chapterLookup, contentSourceId, contentReady, orderedChapters]);

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

    const requestedChapterContent = requestedChapterId
        ? chapterContents[requestedChapterId]
        : undefined;

    useEffect(() => {
        if (!highlightQuote || !requestedChapterId) return;
        if (requestedChapterContent === undefined) return;
        const container = contentRef.current;
        if (!container) return;
        const chapterNode = container.querySelector<HTMLElement>(
            `[data-chapter-id="${requestedChapterId}"]`
        );
        if (!chapterNode) return;
        const timeout = setTimeout(() => {
            // Clear previous highlights
            chapterNode.querySelectorAll('[data-quote-highlight="true"]').forEach((el) => {
                el.removeAttribute("data-quote-highlight");
                (el as HTMLElement).style.backgroundColor = "";
            });

            const trimmedQuote = highlightQuote.trim();
            if (!trimmedQuote) return;

            // Normalize quote for comparison (lowercase, collapse whitespace)
            const normalizeText = (text: string) =>
                text.toLowerCase().replace(/\s+/g, " ").trim();
            const normalizedQuote = normalizeText(trimmedQuote);

            // Extract key words from quote (3+ chars) for fuzzy matching
            const quoteWords = normalizedQuote
                .split(/\s+/)
                .filter((word) => word.length >= 3);

            if (quoteWords.length === 0) return;

            // Find all paragraph-like elements
            const paragraphs = chapterNode.querySelectorAll("p, li, blockquote, td, th");
            let bestMatchElement: Element | null = null;
            let bestMatchScore = 0;

            paragraphs.forEach((para) => {
                const paraText = normalizeText(para.textContent || "");
                if (!paraText) return;

                // Check for exact substring match first
                if (paraText.includes(normalizedQuote)) {
                    const score = 1000 + normalizedQuote.length;
                    if (score > bestMatchScore) {
                        bestMatchElement = para;
                        bestMatchScore = score;
                    }
                    return;
                }

                // Count matching words for fuzzy match
                let matchedWords = 0;
                for (const word of quoteWords) {
                    if (paraText.includes(word)) {
                        matchedWords++;
                    }
                }

                // Require at least 50% word match
                const matchRatio = matchedWords / quoteWords.length;
                if (matchRatio >= 0.5) {
                    const score = matchRatio * 100;
                    if (score > bestMatchScore) {
                        bestMatchElement = para;
                        bestMatchScore = score;
                    }
                }
            });

            if (bestMatchElement) {
                const element = bestMatchElement as HTMLElement;
                element.dataset.quoteHighlight = "true";
                element.style.backgroundColor = "rgba(250, 204, 21, 0.3)";
                element.scrollIntoView({ behavior: "smooth", block: "center" });
            }
        }, 100);
        return () => clearTimeout(timeout);
    }, [highlightQuote, requestedChapterContent, requestedChapterId]);

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
        if (!selectedChapter) {
            toast.error("Выберите главу для копирования");
            return;
        }
        const chapterHtml = chapterContents[selectedChapter.id];
        if (chapterHtml === undefined) {
            toast.error("Содержимое главы еще загружается");
            return;
        }
        // Strip HTML tags for plain text
        const tempDiv = document.createElement("div");
        tempDiv.innerHTML = chapterHtml;
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
        if (!selectedChapter) {
            toast.error("Выберите главу для скачивания");
            return;
        }
        const chapterHtml = chapterContents[selectedChapter.id];
        if (chapterHtml === undefined) {
            toast.error("Содержимое главы еще загружается");
            return;
        }
        const tempDiv = document.createElement("div");
        tempDiv.innerHTML = chapterHtml;
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

    const clearSearchHighlights = useCallback(() => {
        if (!contentRef.current) return;
        const marks = contentRef.current.querySelectorAll(
            'mark[data-search-highlight="true"]'
        );
        marks.forEach((mark) => {
            const parent = mark.parentNode;
            if (!parent) return;
            while (mark.firstChild) {
                parent.insertBefore(mark.firstChild, mark);
            }
            parent.removeChild(mark);
            (parent as Element).normalize?.();
        });
    }, []);

    const performSearch = useCallback(async (query: string) => {
        clearSearchHighlights();
        setSearchResults([]);
        setCurrentSearchIndex(0);

        const trimmedQuery = query.trim();
        if (!trimmedQuery || trimmedQuery.length < 3 || !contentRef.current) return;

        // First, load all chapters if not loaded
        const missingChapters = orderedChapters.filter(
            (chapter) => chapterContents[chapter.id] === undefined
        );

        if (missingChapters.length > 0) {
            setIsSearchLoading(true);
            try {
                const entries = await Promise.all(
                    missingChapters.map(async (chapter) => {
                        const content = await fetchChapterContent(chapter.id);
                        return [chapter.id, content] as const;
                    })
                );
                setChapterContents((prev) => ({
                    ...prev,
                    ...Object.fromEntries(entries),
                }));
                // Wait for DOM to update
                await new Promise((resolve) => setTimeout(resolve, 100));
            } finally {
                setIsSearchLoading(false);
            }
        }

        const container = contentRef.current;
        const escapedQuery = escapeRegExp(query.trim());
        const searchPattern = escapedQuery.replace(/\s+/g, "\\s+");
        const searchRegex = new RegExp(searchPattern, "giu");

        const textContent = container.textContent || "";
        const matches: { start: number; end: number }[] = [];
        let match: RegExpExecArray | null;

        while ((match = searchRegex.exec(textContent)) !== null) {
            matches.push({ start: match.index, end: match.index + match[0].length });
        }

        if (matches.length === 0) return;

        const getNodeAtTextIndex = (
            root: HTMLElement,
            index: number
        ): { node: Text; offset: number } | null => {
            const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
            let currentIndex = 0;
            let node = walker.nextNode() as Text | null;
            while (node) {
                const length = node.textContent?.length ?? 0;
                if (index < currentIndex + length) {
                    return { node, offset: Math.max(0, index - currentIndex) };
                }
                currentIndex += length;
                node = walker.nextNode() as Text | null;
            }
            return null;
        };

        const highlights: HTMLElement[] = [];

        // Process matches in reverse order to avoid offset issues
        for (let i = matches.length - 1; i >= 0; i--) {
            const { start, end } = matches[i];
            const startNode = getNodeAtTextIndex(container, start);
            const endNode = getNodeAtTextIndex(container, end);
            if (!startNode || !endNode) continue;

            try {
                const range = document.createRange();
                range.setStart(startNode.node, startNode.offset);
                range.setEnd(endNode.node, endNode.offset);

                const mark = document.createElement("mark");
                mark.dataset.searchHighlight = "true";
                mark.className = "bg-yellow-300/50 dark:bg-yellow-500/30";

                range.surroundContents(mark);
                highlights.unshift(mark);
            } catch {
                // Skip if range crosses element boundaries
            }
        }

        setSearchResults(highlights);
        if (highlights.length > 0) {
            highlights[0].scrollIntoView({ behavior: "smooth", block: "center" });
            highlights[0].classList.add("ring-2", "ring-yellow-500");
        }
    }, [clearSearchHighlights, orderedChapters, chapterContents, fetchChapterContent]);

    const navigateSearch = useCallback((direction: "next" | "prev") => {
        if (searchResults.length === 0) return;

        // Remove highlight from current
        searchResults[currentSearchIndex]?.classList.remove("ring-2", "ring-yellow-500");

        let newIndex: number;
        if (direction === "next") {
            newIndex = (currentSearchIndex + 1) % searchResults.length;
        } else {
            newIndex = (currentSearchIndex - 1 + searchResults.length) % searchResults.length;
        }

        setCurrentSearchIndex(newIndex);
        searchResults[newIndex]?.scrollIntoView({ behavior: "smooth", block: "center" });
        searchResults[newIndex]?.classList.add("ring-2", "ring-yellow-500");
    }, [currentSearchIndex, searchResults]);

    const handleSearchKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            e.preventDefault();
            if (e.shiftKey) {
                navigateSearch("prev");
            } else if (searchResults.length > 0) {
                navigateSearch("next");
            } else {
                performSearch(searchQuery);
            }
        } else if (e.key === "Escape") {
            setIsSearchOpen(false);
            clearSearchHighlights();
            setSearchQuery("");
            setSearchResults([]);
        }
    }, [clearSearchHighlights, navigateSearch, performSearch, searchQuery, searchResults.length]);

    const toggleSearch = useCallback(() => {
        if (isSearchOpen) {
            setIsSearchOpen(false);
            clearSearchHighlights();
            setSearchQuery("");
            setSearchResults([]);
        } else {
            setIsSearchOpen(true);
            setTimeout(() => searchInputRef.current?.focus(), 100);
        }
    }, [clearSearchHighlights, isSearchOpen]);

    // Keyboard shortcut for search (Ctrl/Cmd + F)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === "f") {
                e.preventDefault();
                if (!isSearchOpen) {
                    setIsSearchOpen(true);
                    setTimeout(() => searchInputRef.current?.focus(), 100);
                } else {
                    searchInputRef.current?.focus();
                }
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isSearchOpen]);

    // Auto-search with debounce (requires minimum 3 characters)
    useEffect(() => {
        if (!isSearchOpen) return;
        if (searchQuery.trim().length < 3) {
            clearSearchHighlights();
            setSearchResults([]);
            return;
        }
        const timeout = setTimeout(() => {
            performSearch(searchQuery);
        }, 500);
        return () => clearTimeout(timeout);
    }, [searchQuery, isSearchOpen, performSearch, clearSearchHighlights]);

    const handleSelectChapter = useCallback(async (chapter: Chapter) => {
        selectedChapterIdRef.current = chapter.id;
        setSelectedChapter(chapter);

        // Block observer during manual scroll to prevent jumping
        isManualScrollingRef.current = true;

        // First, ensure all chapters before this one are loaded
        // to prevent layout shift during scroll
        const chapterIndex = orderedChapters.findIndex((c) => c.id === chapter.id);
        if (chapterIndex > 0) {
            const chaptersToLoad = orderedChapters
                .slice(0, chapterIndex)
                .filter((c) => chapterContents[c.id] === undefined);

            if (chaptersToLoad.length > 0) {
                const entries = await Promise.all(
                    chaptersToLoad.map(async (c) => {
                        const content = await fetchChapterContent(c.id);
                        return [c.id, content] as const;
                    })
                );
                setChapterContents((prev) => ({
                    ...prev,
                    ...Object.fromEntries(entries),
                }));
                // Wait for DOM update
                await new Promise((resolve) => setTimeout(resolve, 50));
            }
        }

        scrollToChapter(chapter.id);

        // Re-enable observer after scroll animation completes
        setTimeout(() => {
            isManualScrollingRef.current = false;
        }, 800);

        if (typeof window !== "undefined" && window.innerWidth < 1024) {
            setSidebarOpen(false);
        }
    }, [orderedChapters, chapterContents, fetchChapterContent, scrollToChapter]);

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
                        <span
                            className="flex flex-1 items-center gap-2"
                            onClick={(event) => {
                                event.stopPropagation();
                                handleSelectChapter(chapter);
                            }}
                        >
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
            // Refresh the source to update quiz status
            fetchSource();
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

    if (!source) {
        return (
            <div className="flex min-h-dvh flex-col items-center justify-center bg-background text-foreground">
                <BookOpen className="mb-4 h-16 w-16 text-muted-foreground" />
                <h1 className="mb-2 text-2xl font-bold">Источник не найден</h1>
                <Link href="/library">
                    <Button variant="outline">Вернуться в библиотеку</Button>
                </Link>
            </div>
        );
    }

    // Build chapter tree
    const chapterTree = buildChapterTree(source.chapters);
    const expandableChapterIds = getExpandableChapterIds(source.chapters);
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
                        {source.title}
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
                            className={`gap-2 text-muted-foreground hover:text-foreground ${isSearchOpen ? "bg-accent" : ""}`}
                            onClick={toggleSearch}
                            title="Поиск (Ctrl+F)"
                        >
                            <Search className="h-4 w-4" />
                            <span className="hidden sm:inline">Поиск</span>
                        </Button>
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

                {/* Search Bar */}
                {isSearchOpen && (
                    <div className="flex items-center gap-2 border-b border-border bg-background/95 px-4 py-2 backdrop-blur sm:px-6">
                        {isSearchLoading ? (
                            <Loader2 className="h-4 w-4 flex-shrink-0 animate-spin text-muted-foreground" />
                        ) : (
                            <Search className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                        )}
                        <Input
                            ref={searchInputRef}
                            type="text"
                            placeholder="Введите минимум 3 символа..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyDown={handleSearchKeyDown}
                            className="h-8 flex-1"
                            disabled={isSearchLoading}
                        />
                        {isSearchLoading ? (
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                                Загрузка...
                            </span>
                        ) : searchResults.length > 0 ? (
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                                {currentSearchIndex + 1} / {searchResults.length}
                            </span>
                        ) : searchQuery.trim().length >= 3 ? (
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                                Не найдено
                            </span>
                        ) : null}
                        <div className="flex items-center gap-1">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => navigateSearch("prev")}
                                disabled={searchResults.length === 0 || isSearchLoading}
                                title="Предыдущий (Shift+Enter)"
                            >
                                <ChevronUp className="h-4 w-4" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => navigateSearch("next")}
                                disabled={searchResults.length === 0 || isSearchLoading}
                                title="Следующий (Enter)"
                            >
                                <ChevronDown className="h-4 w-4" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={toggleSearch}
                                title="Закрыть (Esc)"
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                )}

                {/* Reading Area */}
                <ChapterContent
                    contentLoading={contentLoading}
                    orderedChapters={orderedChapters}
                    chapterContents={chapterContents}
                    contentRef={contentRef}
                    isSearchOpen={isSearchOpen}
                />
            </main>
        </div>
    );
}
