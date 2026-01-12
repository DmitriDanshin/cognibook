"use client";

import { memo, useMemo } from "react";
import dynamic from "next/dynamic";
import { ScrollArea } from "@/components/ui/scroll-area";
import { BookOpen, Loader2 } from "lucide-react";
import type { ChapterContentProps } from "../types";

const PdfViewer = dynamic(() => import("./pdf-viewer").then(mod => mod.PdfViewer), {
    ssr: false,
    loading: () => (
        <div className="flex h-full items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
    ),
});

export const ChapterContent = memo(function ChapterContent({
    contentLoading,
    orderedChapters,
    chapterContents,
    contentRef,
    isSearchOpen,
    pdfUrl,
    selectedChapter,
    onPdfPageChange,
}: ChapterContentProps) {
    // Extract page number from selected chapter href (format: "page-N")
    const initialPage = useMemo(() => {
        if (!selectedChapter) return 1;
        const match = selectedChapter.href.match(/page-(\d+)/);
        return match ? parseInt(match[1], 10) : 1;
    }, [selectedChapter]);

    // If this is a PDF source, render PDF viewer
    if (pdfUrl) {
        return (
            <PdfViewer
                url={`/api${pdfUrl}`}
                className={isSearchOpen ? "h-[calc(100dvh-6.5rem)] sm:h-[calc(100dvh-7rem)]" : "h-[calc(100dvh-3.5rem)] sm:h-[calc(100dvh-4rem)]"}
                initialPage={initialPage}
                onPageChange={onPdfPageChange}
            />
        );
    }

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
                                    <h2
                                        className={`${index === 0 ? "mt-0" : "mt-8"} chapter-title`}
                                    >
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
