import type { Chapter } from "./types";

/**
 * Экранирует специальные символы для использования в регулярных выражениях
 */
export const escapeRegExp = (value: string): string =>
    value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Получает список ID глав, которые можно развернуть (имеют дочерние элементы)
 */
export const getExpandableChapterIds = (chapters: Chapter[]): string[] => {
    const parentIds = new Set<string>();
    chapters.forEach((chapter) => {
        if (chapter.parentId) {
            parentIds.add(chapter.parentId);
        }
    });
    return Array.from(parentIds);
};

/**
 * Строит дерево глав из плоского списка
 */
export const buildChapterTree = (chapters: Chapter[]): Chapter[] => {
    const chapterMap = new Map<string, Chapter>();
    const rootChapters: Chapter[] = [];

    chapters.forEach((chapter) => {
        chapterMap.set(chapter.id, { ...chapter, children: [] });
    });

    chapters.forEach((chapter) => {
        const mappedChapter = chapterMap.get(chapter.id)!;
        if (chapter.parentId) {
            const parent = chapterMap.get(chapter.parentId);
            if (parent) {
                parent.children = parent.children || [];
                parent.children.push(mappedChapter);
            }
        } else {
            rootChapters.push(mappedChapter);
        }
    });

    return rootChapters;
};

/**
 * Извлекает текст из HTML-строки
 */
export const extractTextFromHtml = (html: string): string => {
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = html;
    return tempDiv.textContent || tempDiv.innerText;
};

/**
 * Нормализует текст для поиска (приводит к нижнему регистру, объединяет пробелы)
 */
export const normalizeText = (text: string): string =>
    text.toLowerCase().replace(/\s+/g, " ").trim();

/**
 * Возвращает правильную форму слова "глава" для заданного количества
 */
export const getChapterWord = (count: number): string => {
    if (count === 1) return "глава";
    if (count >= 2 && count <= 4) return "главы";
    return "глав";
};
