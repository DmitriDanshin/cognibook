"use client";

import {useCallback, useState} from "react";
import {toast} from "sonner";
import type {Chapter} from "../types";
import {extractTextFromHtml, getChapterWord} from "../utils";

interface UseChapterActionsOptions {
    selectedChapter: Chapter | null;
    orderedChapters: Chapter[];
    chapterContents: Record<string, string>;
    chapterLookup: Map<string, Chapter>;
    sourceTitle: string | undefined;
}

interface UseChapterActionsReturn {
    isMultiSelectMode: boolean;
    setIsMultiSelectMode: (mode: boolean) => void;
    selectedChapterIds: Set<string>;
    setSelectedChapterIds: React.Dispatch<React.SetStateAction<Set<string>>>;
    handleChapterCheckboxChange: (chapterId: string, checked: boolean) => void;
    toggleSelectAll: () => void;
    toggleMultiSelect: (setSidebarOpen: (open: boolean) => void) => void;
    handleCopyText: () => Promise<void>;
    handleDownloadTxt: () => void;
}

export function useChapterActions({
    selectedChapter,
    orderedChapters,
    chapterContents,
    chapterLookup,
    sourceTitle,
}: UseChapterActionsOptions): UseChapterActionsReturn {
    const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
    const [selectedChapterIds, setSelectedChapterIds] = useState<Set<string>>(new Set());

    const handleChapterCheckboxChange = useCallback((chapterId: string, checked: boolean) => {
        setSelectedChapterIds(prev => {
            const newSet = new Set(prev);
            if (checked) {
                newSet.add(chapterId);
            } else {
                newSet.delete(chapterId);
            }
            return newSet;
        });
    }, []);

    const toggleSelectAll = useCallback(() => {
        if (selectedChapterIds.size === orderedChapters.length) {
            setSelectedChapterIds(new Set());
        } else {
            setSelectedChapterIds(new Set(orderedChapters.map(c => c.id)));
        }
    }, [selectedChapterIds.size, orderedChapters]);

    const toggleMultiSelect = useCallback((setSidebarOpen: (open: boolean) => void) => {
        if (!isMultiSelectMode) {
            // Entering multi-select mode - open sidebar
            setIsMultiSelectMode(true);
            setSidebarOpen(true);
        } else {
            // Exiting multi-select mode - clear selection
            setIsMultiSelectMode(false);
            setSelectedChapterIds(new Set());
        }
    }, [isMultiSelectMode]);

    const handleCopyText = useCallback(async () => {
        // Determine which chapters to copy
        const chapterIdsToCopy = isMultiSelectMode && selectedChapterIds.size > 0
            ? orderedChapters.filter(c => selectedChapterIds.has(c.id)).map(c => c.id)
            : selectedChapter ? [selectedChapter.id] : [];

        if (chapterIdsToCopy.length === 0) {
            toast.error("Выберите главу для копирования");
            return;
        }

        // Check if all chapters are loaded
        const notLoadedChapters = chapterIdsToCopy.filter(id => chapterContents[id] === undefined);
        if (notLoadedChapters.length > 0) {
            toast.error("Содержимое некоторых глав еще загружается");
            return;
        }

        // Combine content from all selected chapters in order
        const combinedText = chapterIdsToCopy.map(id => {
            const chapter = chapterLookup.get(id);
            const chapterHtml = chapterContents[id];
            const plainText = extractTextFromHtml(chapterHtml);
            return chapter ? `\n\n=== ${chapter.title} ===\n\n${plainText}` : plainText;
        }).join("\n").trim();

        try {
            // Try modern clipboard API first
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(combinedText);
            } else {
                // Fallback for non-secure contexts (HTTP)
                const textArea = document.createElement("textarea");
                textArea.value = combinedText;
                textArea.style.position = "fixed";
                textArea.style.left = "-999999px";
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand("copy");
                document.body.removeChild(textArea);
            }
            const chapterWord = getChapterWord(chapterIdsToCopy.length);
            toast.success(`Скопировано ${chapterIdsToCopy.length} ${chapterWord}`);
        } catch {
            toast.error("Не удалось скопировать текст");
        }
    }, [isMultiSelectMode, selectedChapterIds, selectedChapter, orderedChapters, chapterContents, chapterLookup]);

    const handleDownloadTxt = useCallback(() => {
        // Determine which chapters to download
        const chapterIdsToDownload = isMultiSelectMode && selectedChapterIds.size > 0
            ? orderedChapters.filter(c => selectedChapterIds.has(c.id)).map(c => c.id)
            : selectedChapter ? [selectedChapter.id] : [];

        if (chapterIdsToDownload.length === 0) {
            toast.error("Выберите главу для скачивания");
            return;
        }

        // Check if all chapters are loaded
        const notLoadedChapters = chapterIdsToDownload.filter(id => chapterContents[id] === undefined);
        if (notLoadedChapters.length > 0) {
            toast.error("Содержимое некоторых глав еще загружается");
            return;
        }

        // Combine content from all selected chapters in order
        const combinedText = chapterIdsToDownload.map(id => {
            const chapter = chapterLookup.get(id);
            const chapterHtml = chapterContents[id];
            const plainText = extractTextFromHtml(chapterHtml);
            return chapter ? `\n\n=== ${chapter.title} ===\n\n${plainText}` : plainText;
        }).join("\n").trim();

        const blob = new Blob([combinedText], { type: "text/plain;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = chapterIdsToDownload.length === 1
            ? `${chapterLookup.get(chapterIdsToDownload[0])?.title || "chapter"}.txt`
            : `${sourceTitle || "chapters"}_${chapterIdsToDownload.length}_chapters.txt`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        const chapterWord = getChapterWord(chapterIdsToDownload.length);
        toast.success(`Скачано ${chapterIdsToDownload.length} ${chapterWord}`);
    }, [isMultiSelectMode, selectedChapterIds, selectedChapter, orderedChapters, chapterContents, chapterLookup, sourceTitle]);

    return {
        isMultiSelectMode,
        setIsMultiSelectMode,
        selectedChapterIds,
        setSelectedChapterIds,
        handleChapterCheckboxChange,
        toggleSelectAll,
        toggleMultiSelect,
        handleCopyText,
        handleDownloadTxt,
    };
}
