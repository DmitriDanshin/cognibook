"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import type { Chapter } from "../types";
import { extractTextFromHtml, getChapterWord } from "../utils";

interface UseChapterActionsOptions {
    selectedChapter: Chapter | null;
    orderedChapters: Chapter[];
    chapterContents: Record<string, string>;
    chapterLookup: Map<string, Chapter>;
    sourceTitle: string | undefined;
    fetchChapterContent: (chapterId: string) => Promise<string>;
    setChapterContents: React.Dispatch<React.SetStateAction<Record<string, string>>>;
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
    handleDownloadTxt: () => Promise<void>;
}

export function useChapterActions({
    selectedChapter,
    orderedChapters,
    chapterContents,
    chapterLookup,
    sourceTitle,
    fetchChapterContent,
    setChapterContents,
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

        // Load missing chapters if needed
        const notLoadedChapterIds = chapterIdsToCopy.filter(id => chapterContents[id] === undefined);
        let finalContents = chapterContents;

        if (notLoadedChapterIds.length > 0) {
            const loadingToast = toast.loading(`Загрузка ${notLoadedChapterIds.length} глав...`);
            try {
                const loadedEntries = await Promise.all(
                    notLoadedChapterIds.map(async (id) => {
                        const content = await fetchChapterContent(id);
                        return [id, content] as const;
                    })
                );

                // Update global chapter contents state
                const newContents = Object.fromEntries(loadedEntries);
                setChapterContents(prev => ({ ...prev, ...newContents }));

                // Merge with current contents for immediate use
                finalContents = { ...chapterContents, ...newContents };
                toast.dismiss(loadingToast);
            } catch (error) {
                toast.dismiss(loadingToast);
                toast.error("Не удалось загрузить содержимое глав");
                console.error("Failed to load chapters:", error);
                return;
            }
        }

        // Combine content from all selected chapters in order
        const combinedText = chapterIdsToCopy.map(id => {
            const chapter = chapterLookup.get(id);
            const chapterHtml = finalContents[id];
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
            if (chapterIdsToCopy.length === 1) {
                const chapterTitle =
                    chapterLookup.get(chapterIdsToCopy[0])?.title || "глава";
                toast.success(`Скопировано: ${chapterTitle}`);
            } else {
                const chapterWord = getChapterWord(chapterIdsToCopy.length);
                toast.success(
                    `Скопировано ${chapterIdsToCopy.length} ${chapterWord}`
                );
            }
        } catch {
            toast.error("Не удалось скопировать текст");
        }
    }, [isMultiSelectMode, selectedChapterIds, selectedChapter, orderedChapters, chapterContents, chapterLookup, fetchChapterContent, setChapterContents]);

    const handleDownloadTxt = useCallback(async () => {
        // Determine which chapters to download
        const chapterIdsToDownload = isMultiSelectMode && selectedChapterIds.size > 0
            ? orderedChapters.filter(c => selectedChapterIds.has(c.id)).map(c => c.id)
            : selectedChapter ? [selectedChapter.id] : [];

        if (chapterIdsToDownload.length === 0) {
            toast.error("Выберите главу для скачивания");
            return;
        }

        // Load missing chapters if needed
        const notLoadedChapterIds = chapterIdsToDownload.filter(id => chapterContents[id] === undefined);
        let finalContents = chapterContents;

        if (notLoadedChapterIds.length > 0) {
            const loadingToast = toast.loading(`Загрузка ${notLoadedChapterIds.length} глав...`);
            try {
                const loadedEntries = await Promise.all(
                    notLoadedChapterIds.map(async (id) => {
                        const content = await fetchChapterContent(id);
                        return [id, content] as const;
                    })
                );

                // Update global chapter contents state
                const newContents = Object.fromEntries(loadedEntries);
                setChapterContents(prev => ({ ...prev, ...newContents }));

                // Merge with current contents for immediate use
                finalContents = { ...chapterContents, ...newContents };
                toast.dismiss(loadingToast);
            } catch (error) {
                toast.dismiss(loadingToast);
                toast.error("Не удалось загрузить содержимое глав");
                console.error("Failed to load chapters:", error);
                return;
            }
        }

        // Combine content from all selected chapters in order
        const combinedText = chapterIdsToDownload.map(id => {
            const chapter = chapterLookup.get(id);
            const chapterHtml = finalContents[id];
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
    }, [isMultiSelectMode, selectedChapterIds, selectedChapter, orderedChapters, chapterContents, chapterLookup, sourceTitle, fetchChapterContent, setChapterContents]);

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
