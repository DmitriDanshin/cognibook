"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import type { Chapter } from "../types";
import { escapeRegExp } from "../utils";

interface UseSearchOptions {
    contentRef: React.RefObject<HTMLDivElement | null>;
    orderedChapters: Chapter[];
    chapterContents: Record<string, string>;
    fetchChapterContent: (chapterId: string) => Promise<string>;
    setChapterContents: React.Dispatch<React.SetStateAction<Record<string, string>>>;
}

interface UseSearchReturn {
    isSearchOpen: boolean;
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    searchResults: HTMLElement[];
    currentSearchIndex: number;
    isSearchLoading: boolean;
    searchInputRef: React.RefObject<HTMLInputElement | null>;
    toggleSearch: () => void;
    navigateSearch: (direction: "next" | "prev") => void;
    handleSearchKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}

export function useSearch({
    contentRef,
    orderedChapters,
    chapterContents,
    fetchChapterContent,
    setChapterContents,
}: UseSearchOptions): UseSearchReturn {
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<HTMLElement[]>([]);
    const [currentSearchIndex, setCurrentSearchIndex] = useState(0);
    const [isSearchLoading, setIsSearchLoading] = useState(false);
    const searchInputRef = useRef<HTMLInputElement | null>(null);

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
    }, [contentRef]);

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
    }, [clearSearchHighlights, orderedChapters, chapterContents, fetchChapterContent, setChapterContents, contentRef]);

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

    return {
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
    };
}
