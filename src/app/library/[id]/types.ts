import type { RefObject } from "react";

export interface Chapter {
    id: string;
    title: string;
    href: string;
    order: number;
    parentId: string | null;
    quizStatus?: "none" | "created" | "started" | "failed" | "perfect";
    children?: Chapter[];
}

export interface Source {
    id: string;
    title: string;
    author: string | null;
    filePath: string | null;
    sourceType: string | null;
    chapters: Chapter[];
}

export interface ValidationError {
    path: string;
    message: string;
}

export interface LinkedQuiz {
    id: string;
    title: string;
}

export type ChapterContentProps = {
    contentLoading: boolean;
    orderedChapters: Chapter[];
    chapterContents: Record<string, string>;
    contentRef: RefObject<HTMLDivElement | null>;
    isSearchOpen: boolean;
    pdfUrl: string | null;
    selectedChapter: Chapter | null;
    onPdfPageChange?: (pageNumber: number) => void;
};

export type QuizDialogProps = {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    source: Source | null;
    selectedChapter: Chapter | null;
    quizValidationErrors: ValidationError[];
    quizUploading: boolean;
    quizJsonText: string;
    setQuizJsonText: (text: string) => void;
    onQuizFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onQuizTextUpload: () => void;
};

export type SidebarProps = {
    source: Source;
    sidebarOpen: boolean;
    setSidebarOpen: (open: boolean) => void;
    selectedChapter: Chapter | null;
    expandedChapters: string[];
    setExpandedChapters: (chapters: string[]) => void;
    isMultiSelectMode: boolean;
    selectedChapterIds: Set<string>;
    orderedChapters: Chapter[];
    onChapterSelect: (chapter: Chapter) => void;
    onChapterCheckboxChange: (chapterId: string, checked: boolean) => void;
    toggleSelectAll: () => void;
};

export type ToolbarProps = {
    selectedChapter: Chapter | null;
    source: Source | null;
    linkedQuiz: LinkedQuiz | null;
    linkedQuizLoading: boolean;
    isQuizDialogOpen: boolean;
    setIsQuizDialogOpen: (open: boolean) => void;
    isSearchOpen: boolean;
    isMultiSelectMode: boolean;
    selectedChapterIds: Set<string>;
    returnToQuiz: string | null;
    sidebarOpen: boolean;
    setSidebarOpen: (open: boolean) => void;
    toggleSearch: () => void;
    toggleMultiSelect: () => void;
    handleCopyText: () => void;
    handleDownloadTxt: () => void;
    quizDialogProps: Omit<QuizDialogProps, "isOpen" | "onOpenChange" | "source" | "selectedChapter">;
};

export type SearchBarProps = {
    isSearchOpen: boolean;
    isSearchLoading: boolean;
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    searchResults: HTMLElement[];
    currentSearchIndex: number;
    searchInputRef: RefObject<HTMLInputElement | null>;
    handleSearchKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
    navigateSearch: (direction: "next" | "prev") => void;
    toggleSearch: () => void;
};
