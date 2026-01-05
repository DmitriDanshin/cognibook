"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";
import type { Chapter, Source } from "../types";
import { buildChapterTree, getExpandableChapterIds } from "../utils";

interface UseSourceOptions {
    id: string;
    requestedChapterId: string | null;
}

interface UseSourceReturn {
    source: Source | null;
    loading: boolean;
    selectedChapter: Chapter | null;
    setSelectedChapter: (chapter: Chapter | null) => void;
    orderedChapters: Chapter[];
    chapterLookup: Map<string, Chapter>;
    expandedChapters: string[];
    setExpandedChapters: (chapters: string[]) => void;
    isTocReady: boolean;
    fetchSource: () => Promise<void>;
    getAncestorIds: (chapter: Chapter) => string[];
}

export function useSource({ id, requestedChapterId }: UseSourceOptions): UseSourceReturn {
    const [source, setSource] = useState<Source | null>(null);
    const [loading, setLoading] = useState(true);
    const [selectedChapter, setSelectedChapter] = useState<Chapter | null>(null);
    const [expandedChapters, setExpandedChapters] = useState<string[]>([]);
    const [isTocReady, setIsTocReady] = useState(false);

    const chapterStorageKey = useMemo(() => `source-last-chapter:${id}`, [id]);
    const tocStorageKey = useMemo(() => `source-toc-expanded:${id}`, [id]);

    const orderedChapters = useMemo(
        () =>
            (source?.chapters ?? [])
                .slice()
                .sort((chapterA, chapterB) => chapterA.order - chapterB.order),
        [source]
    );

    const chapterLookup = useMemo(
        () =>
            new Map((source?.chapters ?? []).map((chapter) => [chapter.id, chapter])),
        [source]
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

    // Auto-expand parents when selecting a chapter
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

    // Persist selected chapter
    useEffect(() => {
        if (!selectedChapter) return;
        try {
            localStorage.setItem(chapterStorageKey, selectedChapter.id);
        } catch {
            // ignore storage errors
        }
    }, [selectedChapter, chapterStorageKey]);

    // Persist expanded chapters
    useEffect(() => {
        if (!isTocReady) return;
        try {
            localStorage.setItem(tocStorageKey, JSON.stringify(expandedChapters));
        } catch {
            // ignore storage errors
        }
    }, [expandedChapters, isTocReady, tocStorageKey]);

    return {
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
    };
}
