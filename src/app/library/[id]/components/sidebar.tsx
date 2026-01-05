"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import {
    ArrowLeft,
    ChevronRight,
    Clock,
    FileText,
    Trophy,
    X,
    XCircle,
} from "lucide-react";
import type { Chapter, SidebarProps } from "../types";
import { buildChapterTree, getExpandableChapterIds } from "../utils";

function renderQuizStatusIcon(status: Chapter["quizStatus"]) {
    switch (status) {
        case "perfect":
            return <span title="Пройден на 100%"><Trophy className="h-3.5 w-3.5 flex-shrink-0 text-amber-400" /></span>;
        case "started":
            return <span title="В процессе"><Clock className="h-3.5 w-3.5 flex-shrink-0 text-orange-400" /></span>;
        case "failed":
            return <span title="Провален (<50%)"><XCircle className="h-3.5 w-3.5 flex-shrink-0 text-red-400" /></span>;
        case "created":
            return <span title="Тест создан"><FileText className="h-3.5 w-3.5 flex-shrink-0 text-blue-400" /></span>;
        default:
            return null;
    }
}

export function Sidebar({
    source,
    sidebarOpen,
    setSidebarOpen,
    selectedChapter,
    expandedChapters,
    setExpandedChapters,
    isMultiSelectMode,
    selectedChapterIds,
    orderedChapters,
    onChapterSelect,
    onChapterCheckboxChange,
    toggleSelectAll,
}: SidebarProps) {
    const chapterTree = buildChapterTree(source.chapters);
    const expandableChapterIds = getExpandableChapterIds(source.chapters);
    const expandedSet = new Set(expandedChapters);
    const isAllExpanded =
        expandableChapterIds.length > 0 &&
        expandableChapterIds.every((id) => expandedSet.has(id));

    const renderChapterItem = (chapter: Chapter, level: number = 0) => {
        const hasChildren = chapter.children && chapter.children.length > 0;
        const isSelected = selectedChapter?.id === chapter.id;
        const isChecked = selectedChapterIds.has(chapter.id);

        if (hasChildren) {
            return (
                <AccordionItem key={chapter.id} value={chapter.id} className="border-0">
                    <AccordionTrigger
                        className={`px-4 py-2 text-sm hover:bg-foreground/5 hover:no-underline ${isSelected ? "bg-foreground/10 text-foreground" : "text-muted-foreground"
                            }`}
                        style={{ paddingLeft: `${level * 16 + 16}px` }}
                    >
                        <span
                            className="flex flex-1 items-center gap-2"
                            onClick={(event) => {
                                event.stopPropagation();
                                if (isMultiSelectMode) {
                                    onChapterCheckboxChange(chapter.id, !isChecked);
                                } else {
                                    onChapterSelect(chapter);
                                }
                            }}
                        >
                            {isMultiSelectMode && (
                                <Checkbox
                                    checked={isChecked}
                                    onClick={(e) => e.stopPropagation()}
                                    onCheckedChange={(checked) => onChapterCheckboxChange(chapter.id, checked === true)}
                                    className="h-4 w-4 flex-shrink-0"
                                />
                            )}
                            {chapter.title}
                            {renderQuizStatusIcon(chapter.quizStatus)}
                        </span>
                    </AccordionTrigger>
                    <AccordionContent className="pb-0">
                        {chapter.children!.map((child) =>
                            renderChapterItem(child, level + 1)
                        )}
                    </AccordionContent>
                </AccordionItem>
            );
        }

        return (
            <button
                key={chapter.id}
                onClick={() => {
                    if (isMultiSelectMode) {
                        onChapterCheckboxChange(chapter.id, !isChecked);
                    } else {
                        onChapterSelect(chapter);
                    }
                }}
                className={`flex w-full items-center gap-2 px-4 py-2 text-left text-sm transition-colors hover:bg-foreground/5 ${isSelected
                    ? "bg-foreground/10 text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                    } ${isChecked ? "bg-primary/10" : ""}`}
                style={{ paddingLeft: `${level * 16 + 16}px` }}
            >
                {isMultiSelectMode ? (
                    <Checkbox
                        checked={isChecked}
                        onClick={(e) => e.stopPropagation()}
                        onCheckedChange={(checked) => onChapterCheckboxChange(chapter.id, checked === true)}
                        className="h-4 w-4 flex-shrink-0"
                    />
                ) : (
                    <ChevronRight className="h-3 w-3 flex-shrink-0" />
                )}
                <span className="line-clamp-1 flex-1">{chapter.title}</span>
                {renderQuizStatusIcon(chapter.quizStatus)}
            </button>
        );
    };

    return (
        <>
            {/* Sidebar */}
            <aside
                className={`fixed inset-y-0 left-0 z-40 w-[85vw] max-w-sm transform border-r border-border bg-background transition-transform duration-300 sm:w-80 lg:relative lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"
                    }`}
            >
                {/* Sidebar Header */}
                <div className="flex h-14 items-center justify-between border-b border-border px-4 sm:h-16">
                    <Link href="/library" className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="text-muted-foreground hover:text-foreground"
                        >
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                    </Link>
                    <span className="line-clamp-1 min-w-0 flex-1 px-2 text-sm font-medium text-foreground">
                        {source.title}
                    </span>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-foreground lg:hidden"
                        onClick={() => setSidebarOpen(false)}
                    >
                        <X className="h-5 w-5" />
                    </Button>
                </div>

                {/* Table of Contents */}
                <div className="flex items-center justify-between px-4 py-3">
                    <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Оглавление
                    </h2>
                    <div className="flex items-center gap-2">
                        {isMultiSelectMode && (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                                onClick={toggleSelectAll}
                            >
                                {selectedChapterIds.size === orderedChapters.length ? "Снять всё" : "Выбрать всё"}
                            </Button>
                        )}
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                            onClick={() =>
                                setExpandedChapters(
                                    isAllExpanded ? [] : expandableChapterIds
                                )
                            }
                            disabled={expandableChapterIds.length === 0}
                        >
                            {isAllExpanded ? "Свернуть" : "Раскрыть"}
                        </Button>
                    </div>
                </div>
                <ScrollArea className="h-[calc(100dvh-8rem)]">
                    {chapterTree.length > 0 ? (
                        <Accordion
                            type="multiple"
                            className="w-full"
                            value={expandedChapters}
                            onValueChange={setExpandedChapters}
                        >
                            {chapterTree.map((chapter) => renderChapterItem(chapter))}
                        </Accordion>
                    ) : (
                        <div className="px-4 py-8 text-center text-muted-foreground">
                            <p>Оглавление не найдено</p>
                        </div>
                    )}
                </ScrollArea>
            </aside>

            {/* Mobile sidebar overlay */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 z-30 bg-black/50 lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}
        </>
    );
}
