"use client";

import { useMemo, useRef, useState, useEffect, useCallback } from "react";
import HeatMap from "@uiw/react-heat-map";

interface ActivityData {
    date: string;
    count: number;
}

interface ActivityHeatmapProps {
    data: ActivityData[];
}

interface SelectedCell {
    date: string;
    count: number;
    x: number;
    y: number;
}

function pluralize(n: number): string {
    if (n === 1) return "тест";
    if (n >= 2 && n <= 4) return "теста";
    return "тестов";
}

function formatDateRu(dateStr: string): string {
    const [year, month, day] = dateStr.split("/").map(Number);
    const months = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
    return `${day} ${months[month - 1]} ${year}`;
}

function getDayOfWeek(dateStr: string): string {
    const [year, month, day] = dateStr.split("/").map(Number);
    const date = new Date(year, month - 1, day);
    const days = ["Воскресенье", "Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота"];
    return days[date.getDay()];
}

export function ActivityHeatmap({ data }: ActivityHeatmapProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [containerWidth, setContainerWidth] = useState(0);
    const [selectedCell, setSelectedCell] = useState<SelectedCell | null>(null);

    useEffect(() => {
        if (!containerRef.current) return;

        const updateWidth = () => {
            if (containerRef.current) {
                setContainerWidth(containerRef.current.offsetWidth);
            }
        };

        updateWidth();

        const resizeObserver = new ResizeObserver(updateWidth);
        resizeObserver.observe(containerRef.current);

        return () => resizeObserver.disconnect();
    }, []);

    // Close popup when clicking outside
    useEffect(() => {
        if (!selectedCell) return;

        const handleClickOutside = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (!target.closest(".activity-popup") && !target.closest("rect")) {
                setSelectedCell(null);
            }
        };

        document.addEventListener("click", handleClickOutside);
        return () => document.removeEventListener("click", handleClickOutside);
    }, [selectedCell]);

    const handleCellClick = useCallback((e: React.MouseEvent<SVGRectElement>, cellData: { date: string; count?: number }) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const containerRect = containerRef.current?.getBoundingClientRect();

        if (containerRect) {
            setSelectedCell({
                date: cellData.date,
                count: cellData.count || 0,
                x: rect.left - containerRect.left + rect.width / 2,
                y: rect.top - containerRect.top,
            });
        }
    }, []);

    const { startDate, endDate, formattedData, totalContributions, monthsToShow, maxCount } = useMemo(() => {
        const today = new Date();
        // Set end date to end of today to include current day
        const end = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);

        // Calculate how many months to show based on container width
        // Each week column = rectSize(14) + space(4) = 18px
        // ~4.3 weeks per month, so 1 month ≈ 77px
        // Add ~30px for week labels
        const weekColumnWidth = 18;
        const weekLabelsWidth = 30;
        const availableWidth = containerWidth - weekLabelsWidth;
        const weeksCanFit = Math.floor(availableWidth / weekColumnWidth);

        // Convert weeks to months (roughly 4.3 weeks per month)
        const months = Math.min(12, Math.max(2, Math.floor(weeksCanFit / 4.3)));

        const start = new Date(today);
        start.setMonth(start.getMonth() - months);
        start.setDate(1); // Start from 1st day of that month

        // Format dates for the library (YYYY/MM/DD) - only include days with activity
        const formatted = data
            .filter((d) => {
                const dateObj = new Date(d.date);
                return d.count > 0 && dateObj >= start && dateObj <= end;
            })
            .map((d) => ({
                date: d.date.replace(/-/g, "/"),
                count: d.count,
            }));

        const total = data.reduce((sum, d) => sum + d.count, 0);
        const max = Math.max(...data.map((d) => d.count), 1); // At least 1 to avoid division by zero

        return { startDate: start, endDate: end, formattedData: formatted, totalContributions: total, monthsToShow: months, maxCount: max };
    }, [data, containerWidth]);

    // Dynamic color based on count relative to max
    // Normal: darker = fewer tests, brighter = more tests
    const getColor = useCallback((count: number): string => {
        if (count === 0) return "#27272a"; // zinc-800 for empty cells

        // Calculate intensity (0 to 1) based on count relative to max
        const intensity = count / maxCount;

        // Emerald color scale
        // More tests = brighter, fewer tests = darker
        if (intensity <= 0.25) return "#064e3b"; // emerald-950 (darkest)
        if (intensity <= 0.5) return "#047857";  // emerald-700
        if (intensity <= 0.75) return "#10b981"; // emerald-500
        return "#34d399";                         // emerald-400 (brightest)
    }, [maxCount]);

    // Calculate heatmap width based on container
    const heatmapWidth = containerWidth > 0 ? Math.max(containerWidth - 8, 280) : 680;

    return (
        <div ref={containerRef} className="relative w-full">
            {containerWidth > 0 && (
                <>
                    <div className="overflow-x-auto">
                        <HeatMap
                            value={formattedData}
                            startDate={startDate}
                            endDate={endDate}
                            width={heatmapWidth}
                            rectSize={14}
                            space={4}
                            legendCellSize={0}
                            weekLabels={containerWidth < 400 ? ["", "", "", "", "", "", ""] : ["", "Пн", "", "Ср", "", "Пт", ""]}
                            monthLabels={["Янв", "Фев", "Мар", "Апр", "Май", "Июн", "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек"]}
                            panelColors={{
                                0: "#27272a",
                            }}
                            rectProps={{
                                rx: 3,
                            }}
                            style={{
                                color: "hsl(var(--muted-foreground))",
                            }}
                            rectRender={(props, data) => (
                                <rect
                                    {...props}
                                    fill={getColor(data.count || 0)}
                                    className="cursor-pointer transition-opacity hover:opacity-80"
                                    onClick={(e) => handleCellClick(e, data)}
                                />
                            )}
                        />
                    </div>
                    {/* Popup */}
                    {selectedCell && (
                        <div
                            className="activity-popup absolute z-50 rounded-lg border border-border bg-popover p-3 shadow-lg"
                            style={{
                                left: Math.min(Math.max(selectedCell.x - 80, 0), containerWidth - 160),
                                top: selectedCell.y - 80,
                            }}
                        >
                            <div className="text-sm font-medium text-foreground">
                                {formatDateRu(selectedCell.date)}
                            </div>
                            <div className="text-xs text-muted-foreground">
                                {getDayOfWeek(selectedCell.date)}
                            </div>
                            <div className="mt-2 text-sm">
                                {selectedCell.count > 0 ? (
                                    <span className="font-medium text-emerald-500">
                                        {selectedCell.count} {pluralize(selectedCell.count)}
                                    </span>
                                ) : (
                                    <span className="text-muted-foreground">Нет активности</span>
                                )}
                            </div>
                        </div>
                    )}
                    <div className="flex flex-col gap-2 mt-3 sm:flex-row sm:items-center sm:justify-between">
                        <span className="text-xs text-muted-foreground sm:text-sm">
                            {totalContributions} {pluralize(totalContributions)} за {monthsToShow === 12 ? "год" : `${monthsToShow} мес.`}
                        </span>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <span>Меньше</span>
                            <div className="h-2.5 w-2.5 rounded-sm bg-[#064e3b] sm:h-[10px] sm:w-[10px]" />
                            <div className="h-2.5 w-2.5 rounded-sm bg-[#047857] sm:h-[10px] sm:w-[10px]" />
                            <div className="h-2.5 w-2.5 rounded-sm bg-[#10b981] sm:h-[10px] sm:w-[10px]" />
                            <div className="h-2.5 w-2.5 rounded-sm bg-[#34d399] sm:h-[10px] sm:w-[10px]" />
                            <span>Больше</span>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
