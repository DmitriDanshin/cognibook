"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Search, ChevronUp, ChevronDown, X } from "lucide-react";
import type { SearchBarProps } from "../types";

export function SearchBar({
    isSearchOpen,
    isSearchLoading,
    searchQuery,
    setSearchQuery,
    searchResults,
    currentSearchIndex,
    searchInputRef,
    handleSearchKeyDown,
    navigateSearch,
    toggleSearch,
}: SearchBarProps) {
    if (!isSearchOpen) return null;

    return (
        <div className="flex items-center gap-2 border-b border-border bg-background/95 px-4 py-2 backdrop-blur sm:px-6">
            {isSearchLoading ? (
                <Loader2 className="h-4 w-4 flex-shrink-0 animate-spin text-muted-foreground" />
            ) : (
                <Search className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
            )}
            <Input
                ref={searchInputRef}
                type="text"
                placeholder="Введите минимум 3 символа..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                className="h-8 flex-1"
                disabled={isSearchLoading}
            />
            {isSearchLoading ? (
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                    Загрузка...
                </span>
            ) : searchResults.length > 0 ? (
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {currentSearchIndex + 1} / {searchResults.length}
                </span>
            ) : searchQuery.trim().length >= 3 ? (
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                    Не найдено
                </span>
            ) : null}
            <div className="flex items-center gap-1">
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => navigateSearch("prev")}
                    disabled={searchResults.length === 0 || isSearchLoading}
                    title="Предыдущий (Shift+Enter)"
                >
                    <ChevronUp className="h-4 w-4" />
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => navigateSearch("next")}
                    disabled={searchResults.length === 0 || isSearchLoading}
                    title="Следующий (Enter)"
                >
                    <ChevronDown className="h-4 w-4" />
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={toggleSearch}
                    title="Закрыть (Esc)"
                >
                    <X className="h-4 w-4" />
                </Button>
            </div>
        </div>
    );
}
