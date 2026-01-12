"use client";

import { useState, useRef, useEffect, useCallback, memo } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { Loader2 } from "lucide-react";
import { Virtuoso, VirtuosoHandle } from "react-virtuoso";

import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url
).toString();

interface PdfViewerProps {
    url: string;
    className?: string;
    initialPage?: number;
    onPageChange?: (pageNumber: number) => void;
}

// Memoized page component with fixed height container to prevent scroll jumps
const PdfPage = memo(function PdfPage({
    pageNumber,
    width,
    height,
}: {
    pageNumber: number;
    width: number;
    height: number;
}) {
    return (
        <div
            className="flex items-start justify-center pb-4"
            style={{ minHeight: height }}
        >
            <Page
                pageNumber={pageNumber}
                width={width}
                renderTextLayer={true}
                renderAnnotationLayer={true}
                loading={
                    <div
                        className="bg-white dark:bg-zinc-900 shadow-sm"
                        style={{ width, height: height - 16 }}
                    />
                }
            />
        </div>
    );
});

export function PdfViewer({ url, className, initialPage = 1, onPageChange }: PdfViewerProps) {
    const [numPages, setNumPages] = useState<number>(0);
    const [currentPage, setCurrentPage] = useState<number>(initialPage);
    const [error, setError] = useState<string | null>(null);
    const [containerWidth, setContainerWidth] = useState<number>(0);
    const [containerHeight, setContainerHeight] = useState<number>(0);
    const [isDocumentLoaded, setIsDocumentLoaded] = useState(false);

    const containerRef = useRef<HTMLDivElement>(null);
    const virtuosoRef = useRef<VirtuosoHandle>(null);

    // Handle container dimensions for responsive PDF rendering
    useEffect(() => {
        function updateDimensions() {
            if (containerRef.current) {
                const width = Math.min(containerRef.current.clientWidth - 32, 768);
                const height = containerRef.current.clientHeight;
                setContainerWidth(width);
                setContainerHeight(height);
            }
        }
        updateDimensions();
        window.addEventListener("resize", updateDimensions);
        return () => window.removeEventListener("resize", updateDimensions);
    }, []);

    function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
        setNumPages(numPages);
        setError(null);
        setIsDocumentLoaded(true);
    }

    function onDocumentLoadError(err: Error) {
        setError(err.message);
        setIsDocumentLoaded(false);
    }

    // Track visible page range and update current page
    const currentPageRef = useRef(initialPage);
    const isScrollingRef = useRef(false);

    const handleRangeChange = useCallback(({ startIndex }: { startIndex: number }) => {
        const newPage = startIndex + 1;
        if (newPage !== currentPageRef.current) {
            isScrollingRef.current = true;
            currentPageRef.current = newPage;
            setCurrentPage(newPage);
            onPageChange?.(newPage);
            // Reset flag after state updates propagate
            requestAnimationFrame(() => {
                isScrollingRef.current = false;
            });
        }
    }, [onPageChange]);

    // Handle navigation from TOC (when initialPage prop changes after initial render)
    // Only scroll if the change came from TOC click, not from user scrolling
    const isFirstRender = useRef(true);
    const lastInitialPageRef = useRef(initialPage);
    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false;
            lastInitialPageRef.current = initialPage;
            return;
        }
        // Skip if the change was triggered by user scrolling
        if (isScrollingRef.current) {
            lastInitialPageRef.current = initialPage;
            return;
        }
        // Skip if initialPage didn't actually change (avoids unnecessary scrolls)
        if (initialPage === lastInitialPageRef.current) {
            return;
        }
        lastInitialPageRef.current = initialPage;

        if (isDocumentLoaded) {
            virtuosoRef.current?.scrollToIndex({
                index: initialPage - 1,
                behavior: "smooth",
            });
        }
    }, [initialPage, isDocumentLoaded]);

    // Calculate fixed item height (A4 ratio + padding)
    const itemHeight = containerWidth * 1.414 + 16;

    // Render individual page item
    const itemContent = useCallback((index: number) => {
        if (containerWidth === 0) return null;
        return <PdfPage pageNumber={index + 1} width={containerWidth} height={itemHeight} />;
    }, [containerWidth, itemHeight]);

    return (
        <div ref={containerRef} className={`relative flex flex-col ${className ?? ""}`}>
            <Document
                file={url}
                onLoadSuccess={onDocumentLoadSuccess}
                onLoadError={onDocumentLoadError}
                loading={
                    <div className="flex h-full items-center justify-center py-20">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                }
                error={
                    <div className="flex flex-col items-center justify-center py-20 text-destructive">
                        <p>Ошибка загрузки PDF</p>
                        {error && <p className="text-sm">{error}</p>}
                    </div>
                }
                className="flex-1 overflow-hidden"
            >
                {isDocumentLoaded && containerWidth > 0 && containerHeight > 0 && (
                    <Virtuoso
                        ref={virtuosoRef}
                        style={{ height: containerHeight }}
                        totalCount={numPages}
                        itemContent={itemContent}
                        rangeChanged={handleRangeChange}
                        overscan={5}
                        fixedItemHeight={itemHeight}
                        initialTopMostItemIndex={initialPage - 1}
                    />
                )}
            </Document>

            {/* Floating page indicator */}
            {numPages > 0 && (
                <div className="pointer-events-none absolute bottom-4 left-0 right-0 flex justify-center">
                    <div className="pointer-events-auto rounded-full bg-foreground/80 px-3 py-1 text-sm text-background shadow-lg backdrop-blur-sm">
                        {currentPage} / {numPages}
                    </div>
                </div>
            )}
        </div>
    );
}
