"use client";

import { useState, useEffect, useCallback, use, useRef } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { BookOpen } from "lucide-react";

import type { Chapter } from "./types";
import { normalizeText } from "./utils";
import { useSource, useChapterContent, useSearch, useQuiz, useChapterActions } from "./hooks";
import { ChapterContent, Sidebar, Toolbar, SearchBar } from "./components";

export default function SourceReaderPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = use(params);
    const searchParams = useSearchParams();
    const requestedChapterId = searchParams.get("chapterId");
    const highlightQuote = searchParams.get("quote");
    const returnToQuiz = searchParams.get("returnToQuiz");

    const [sidebarOpen, setSidebarOpen] = useState(false);

    // Source and chapters management
    const {
        source,
        loading,
        selectedChapter,
        setSelectedChapter,
        orderedChapters,
        chapterLookup,
        expandedChapters,
        setExpandedChapters,
        isTocReady,
        fetchSource,
        getAncestorIds,
    } = useSource({ id, requestedChapterId });

    // Chapter content loading
    const {
        chapterContents,
        setChapterContents,
        contentLoading,
        contentReady,
        contentRef,
        scrollViewportRef,
        scrollToChapter,
        fetchChapterContent,
        loadChaptersAround,
        handleSelectChapter: baseHandleSelectChapter,
    } = useChapterContent({
        sourceId: id,
        orderedChapters,
        selectedChapter,
        requestedChapterId,
    });

    // Search functionality
    const {
        isSearchOpen,
        searchQuery,
        setSearchQuery,
        searchResults,
        currentSearchIndex,
        isSearchLoading,
        searchInputRef,
        toggleSearch,
        navigateSearch,
        handleSearchKeyDown,
    } = useSearch({
        contentRef,
        orderedChapters,
        chapterContents,
        fetchChapterContent,
        setChapterContents,
    });

    // Quiz functionality
    const {
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
    } = useQuiz({
        source,
        selectedChapter,
        fetchSource,
    });

    // Multi-select and copy/download actions
    const {
        isMultiSelectMode,
        setIsMultiSelectMode,
        selectedChapterIds,
        setSelectedChapterIds,
        handleChapterCheckboxChange,
        toggleSelectAll,
        toggleMultiSelect,
        handleCopyText,
        handleDownloadTxt,
    } = useChapterActions({
        selectedChapter,
        orderedChapters,
        chapterContents,
        chapterLookup,
        sourceTitle: source?.title,
    });

    // Wrap the base handleSelectChapter to also set selectedChapter
    const handleSelectChapter = useCallback(async (chapter: Chapter) => {
        setSelectedChapter(chapter);
        await baseHandleSelectChapter(chapter);
        if (typeof window !== "undefined" && window.innerWidth < 1024) {
            setSidebarOpen(false);
        }
    }, [baseHandleSelectChapter, setSelectedChapter]);

    // Initial data fetch
    useEffect(() => {
        fetchSource();
    }, [fetchSource]);

    // IntersectionObserver for scroll-based chapter tracking
    useEffect(() => {
        if (!contentReady) return;
        if (!scrollViewportRef.current) return;
        if (orderedChapters.length === 0) return;

        const viewport = scrollViewportRef.current;
        const chapterElements = orderedChapters
            .map((chapter) => document.getElementById(`chapter-${chapter.id}`))
            .filter((element): element is HTMLElement => Boolean(element));

        if (chapterElements.length === 0) return;

        // We need refs to track state without causing observer recreation
        const selectedChapterIdRef = { current: selectedChapter?.id ?? null };
        const isManualScrolling = { current: false };
        const initialScrollDone = { current: false };

        // Delay enabling observer to let initial scroll settle
        const enableTimeout = setTimeout(() => {
            initialScrollDone.current = true;
        }, 500);

        const observer = new IntersectionObserver(
            (entries) => {
                if (!initialScrollDone.current) return;
                if (isManualScrolling.current) return;
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
            clearTimeout(enableTimeout);
            observer.disconnect();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [contentReady, orderedChapters, chapterLookup, setSelectedChapter, scrollViewportRef, selectedChapter?.id]);

    // Quote highlighting
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
    }, [highlightQuote, requestedChapterContent, requestedChapterId, contentRef]);

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

    return (
        <div className="flex min-h-dvh bg-background text-foreground">
            {/* Sidebar */}
            <Sidebar
                source={source}
                sidebarOpen={sidebarOpen}
                setSidebarOpen={setSidebarOpen}
                selectedChapter={selectedChapter}
                expandedChapters={expandedChapters}
                setExpandedChapters={setExpandedChapters}
                isMultiSelectMode={isMultiSelectMode}
                selectedChapterIds={selectedChapterIds}
                orderedChapters={orderedChapters}
                onChapterSelect={handleSelectChapter}
                onChapterCheckboxChange={handleChapterCheckboxChange}
                toggleSelectAll={toggleSelectAll}
            />

            {/* Main Content */}
            <main className="flex-1 overflow-hidden">
                {/* Toolbar */}
                <Toolbar
                    selectedChapter={selectedChapter}
                    source={source}
                    linkedQuiz={linkedQuiz}
                    linkedQuizLoading={linkedQuizLoading}
                    isQuizDialogOpen={isQuizDialogOpen}
                    setIsQuizDialogOpen={setIsQuizDialogOpen}
                    isSearchOpen={isSearchOpen}
                    isMultiSelectMode={isMultiSelectMode}
                    selectedChapterIds={selectedChapterIds}
                    returnToQuiz={returnToQuiz}
                    sidebarOpen={sidebarOpen}
                    setSidebarOpen={setSidebarOpen}
                    toggleSearch={toggleSearch}
                    toggleMultiSelect={() => toggleMultiSelect(setSidebarOpen)}
                    handleCopyText={handleCopyText}
                    handleDownloadTxt={handleDownloadTxt}
                    quizDialogProps={{
                        quizValidationErrors,
                        quizUploading,
                        quizJsonText,
                        setQuizJsonText,
                        onQuizFileUpload: handleQuizFileUpload,
                        onQuizTextUpload: handleQuizTextUpload,
                    }}
                />

                {/* Search Bar */}
                <SearchBar
                    isSearchOpen={isSearchOpen}
                    isSearchLoading={isSearchLoading}
                    searchQuery={searchQuery}
                    setSearchQuery={setSearchQuery}
                    searchResults={searchResults}
                    currentSearchIndex={currentSearchIndex}
                    searchInputRef={searchInputRef}
                    handleSearchKeyDown={handleSearchKeyDown}
                    navigateSearch={navigateSearch}
                    toggleSearch={toggleSearch}
                />

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
