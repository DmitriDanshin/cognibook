"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import type { Chapter } from "../types";

interface UseChapterContentOptions {
    sourceId: string;
    orderedChapters: Chapter[];
    selectedChapter: Chapter | null;
    requestedChapterId: string | null;
}

interface UseChapterContentReturn {
    chapterContents: Record<string, string>;
    setChapterContents: React.Dispatch<React.SetStateAction<Record<string, string>>>;
    contentLoading: boolean;
    contentReady: boolean;
    contentRef: React.RefObject<HTMLDivElement | null>;
    scrollViewportRef: React.RefObject<HTMLDivElement | null>;
    scrollToChapter: (chapterId: string, behavior?: ScrollBehavior) => void;
    fetchChapterContent: (chapterId: string) => Promise<string>;
    loadChaptersAround: (centerIndex: number, chapters: Chapter[]) => Promise<void>;
    handleSelectChapter: (chapter: Chapter) => Promise<void>;
}

export function useChapterContent({
    sourceId,
    orderedChapters,
    selectedChapter,
    requestedChapterId,
}: UseChapterContentOptions): UseChapterContentReturn {
    const [chapterContents, setChapterContents] = useState<Record<string, string>>({});
    const [contentLoading, setContentLoading] = useState(false);
    const [contentReady, setContentReady] = useState(false);
    const [contentSourceId, setContentSourceId] = useState<string | null>(null);
    const [contentChapterIdsKey, setContentChapterIdsKey] = useState<string | null>(null);

    const contentRef = useRef<HTMLDivElement | null>(null);
    const scrollViewportRef = useRef<HTMLDivElement | null>(null);
    const initialScrollDoneRef = useRef(false);
    const selectedChapterIdRef = useRef<string | null>(null);
    const isManualScrollingRef = useRef(false);

    const chapterIdsKey = orderedChapters.map((chapter) => chapter.id).join("|");

    // Fetch a single chapter content with caching
    const fetchChapterContent = useCallback(
        async (chapterId: string): Promise<string> => {
            // Check sessionStorage cache first
            const cacheKey = `chapter-content:${sourceId}:${chapterId}`;
            try {
                const cached = sessionStorage.getItem(cacheKey);
                if (cached) return cached;
            } catch {
                // sessionStorage may be unavailable
            }

            try {
                const response = await fetch(
                    `/api/sources/${sourceId}/chapters/${chapterId}`
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
        [sourceId]
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

    const scrollToChapter = useCallback(
        (chapterId: string, behavior: ScrollBehavior = "smooth") => {
            const element = document.getElementById(`chapter-${chapterId}`);
            element?.scrollIntoView({ behavior, block: "start" });
        },
        []
    );

    const handleSelectChapter = useCallback(
        async (chapter: Chapter) => {
            selectedChapterIdRef.current = chapter.id;

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
        },
        [orderedChapters, chapterContents, fetchChapterContent, scrollToChapter]
    );

    // Set up scroll viewport ref
    useEffect(() => {
        if (!contentReady) return;
        if (!contentRef.current) return;
        scrollViewportRef.current =
            contentRef.current.closest<HTMLDivElement>(
                '[data-slot="scroll-area-viewport"]'
            ) ?? null;
    }, [contentReady]);

    // Reset initial scroll on source change
    useEffect(() => {
        initialScrollDoneRef.current = false;
    }, [sourceId]);

    // Update selected chapter ref
    useEffect(() => {
        selectedChapterIdRef.current = selectedChapter?.id ?? null;
    }, [selectedChapter?.id]);

    // Load initial chapters
    useEffect(() => {
        if (!sourceId) return;
        if (contentSourceId === sourceId && contentChapterIdsKey === chapterIdsKey) {
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
            } else if (orderedChapters.length < 10) {
                // For small books, load all at once
                chaptersToLoad = orderedChapters;
            }

            const entries = await Promise.all(
                chaptersToLoad.map(async (chapter) => {
                    const content = await fetchChapterContent(chapter.id);
                    return [chapter.id, content] as const;
                })
            );

            if (isCancelled) return;

            setChapterContents(Object.fromEntries(entries));
            setContentLoading(false);
            setContentReady(true);
            setContentSourceId(sourceId);
            setContentChapterIdsKey(chapterIdsKey);
        };

        void loadContents();

        return () => {
            isCancelled = true;
        };
    }, [
        sourceId,
        chapterIdsKey,
        contentSourceId,
        contentChapterIdsKey,
        fetchChapterContent,
        orderedChapters,
        requestedChapterId,
        selectedChapter?.id,
    ]);

    // Initial scroll to chapter
    useEffect(() => {
        if (!contentReady || contentSourceId !== sourceId || initialScrollDoneRef.current) {
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
        sourceId,
        contentSourceId,
        contentReady,
        requestedChapterId,
        scrollToChapter,
        selectedChapter?.id,
    ]);

    // Lazy load chapters around selected one
    useEffect(() => {
        if (!selectedChapter) return;

        if (orderedChapters.length >= 10) {
            const currentIndex = orderedChapters.findIndex(
                (c) => c.id === selectedChapter.id
            );
            if (currentIndex !== -1) {
                loadChaptersAround(currentIndex, orderedChapters);
            }
        }
    }, [selectedChapter, orderedChapters, loadChaptersAround]);

    return {
        chapterContents,
        setChapterContents,
        contentLoading,
        contentReady,
        contentRef,
        scrollViewportRef,
        scrollToChapter,
        fetchChapterContent,
        loadChaptersAround,
        handleSelectChapter,
    };
}
