"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { Loader2, ChevronLeft, ChevronRight } from "lucide-react";

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

export function PdfViewer({ url, className, initialPage = 1, onPageChange }: PdfViewerProps) {
    const [numPages, setNumPages] = useState<number>(0);
    const [pageNumber, setPageNumber] = useState<number>(initialPage);
    const [prevInitialPage, setPrevInitialPage] = useState<number>(initialPage);
    const [error, setError] = useState<string | null>(null);
    const [containerWidth, setContainerWidth] = useState<number>(0);
    const containerRef = useRef<HTMLDivElement>(null);

    // Reset page when initialPage changes (React-recommended pattern for adjusting state on prop change)
    if (prevInitialPage !== initialPage) {
        setPrevInitialPage(initialPage);
        setPageNumber(initialPage);
    }

    useEffect(() => {
        function updateWidth() {
            if (containerRef.current) {
                const width = Math.min(containerRef.current.clientWidth - 32, 768);
                setContainerWidth(width);
            }
        }
        updateWidth();
        window.addEventListener("resize", updateWidth);
        return () => window.removeEventListener("resize", updateWidth);
    }, []);

    function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
        setNumPages(numPages);
        setError(null);
    }

    function onDocumentLoadError(err: Error) {
        setError(err.message);
    }

    const goToPrevPage = useCallback(() => {
        setPageNumber(prev => Math.max(prev - 1, 1));
    }, []);

    const goToNextPage = useCallback(() => {
        setPageNumber(prev => Math.min(prev + 1, numPages));
    }, [numPages]);

    // Notify parent of page changes (deferred to avoid setState during render)
    const lastReportedPage = useRef(initialPage);

    useEffect(() => {
        // Only report if page changed due to user navigation, not from initialPage prop
        if (pageNumber !== lastReportedPage.current && pageNumber !== initialPage) {
            lastReportedPage.current = pageNumber;
            onPageChange?.(pageNumber);
        } else if (pageNumber === initialPage) {
            lastReportedPage.current = pageNumber;
        }
    }, [pageNumber, initialPage, onPageChange]);

    return (
        <div className={`flex flex-col overflow-hidden ${className ?? ""}`}>
            {/* Page navigation */}
            {numPages > 1 && (
                <div className="flex shrink-0 items-center justify-center gap-4 border-b bg-background py-2">
                    <button
                        onClick={goToPrevPage}
                        disabled={pageNumber <= 1}
                        className="rounded p-1 hover:bg-muted disabled:opacity-50"
                    >
                        <ChevronLeft className="h-5 w-5" />
                    </button>
                    <span className="text-sm">
                        {pageNumber} / {numPages}
                    </span>
                    <button
                        onClick={goToNextPage}
                        disabled={pageNumber >= numPages}
                        className="rounded p-1 hover:bg-muted disabled:opacity-50"
                    >
                        <ChevronRight className="h-5 w-5" />
                    </button>
                </div>
            )}

            {/* PDF content */}
            <div className="min-h-0 flex-1 overflow-auto">
                <div ref={containerRef} className="mx-auto max-w-3xl px-4 py-4">
                    <Document
                        file={url}
                        onLoadSuccess={onDocumentLoadSuccess}
                        onLoadError={onDocumentLoadError}
                        loading={
                            <div className="flex items-center justify-center py-20">
                                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                            </div>
                        }
                        error={
                            <div className="flex flex-col items-center justify-center py-20 text-destructive">
                                <p>Ошибка загрузки PDF</p>
                                {error && <p className="text-sm">{error}</p>}
                            </div>
                        }
                    >
                        {containerWidth > 0 && (
                            <Page
                                pageNumber={pageNumber}
                                width={containerWidth}
                                renderTextLayer={true}
                                renderAnnotationLayer={true}
                            />
                        )}
                    </Document>
                </div>
            </div>
        </div>
    );
}


