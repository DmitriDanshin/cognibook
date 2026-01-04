"use client";

import { BookOpen, GraduationCap, Target, Flame, Trophy, TrendingUp } from "lucide-react";

interface UserStatsProps {
    stats: {
        totalSources: number;
        completedSources: number;
        totalQuizzes: number;
        totalAttempts: number;
        passedAttempts: number;
        averageScore: number;
        currentStreak: number;
        longestStreak: number;
    };
}

export function UserStats({ stats }: UserStatsProps) {
    const statItems = [
        {
            label: "Источников",
            value: stats.totalSources,
            icon: BookOpen,
            color: "text-blue-500",
        },
        {
            label: "Прочитано",
            value: stats.completedSources,
            icon: Trophy,
            color: "text-amber-500",
        },
        {
            label: "Тестов создано",
            value: stats.totalQuizzes,
            icon: GraduationCap,
            color: "text-purple-500",
        },
        {
            label: "Попыток всего",
            value: stats.totalAttempts,
            icon: Target,
            color: "text-green-500",
        },
        {
            label: "Средний балл",
            value: `${stats.averageScore}%`,
            icon: TrendingUp,
            color: "text-cyan-500",
        },
        {
            label: "Текущая серия",
            value: `${stats.currentStreak} дн.`,
            icon: Flame,
            color: stats.currentStreak > 0 ? "text-orange-500" : "text-muted-foreground",
        },
    ];

    return (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {statItems.map((item) => (
                <div
                    key={item.label}
                    className="flex flex-col items-center rounded-lg border border-border bg-card p-3 text-center"
                >
                    <item.icon className={`mb-2 h-5 w-5 ${item.color}`} />
                    <span className="text-xl font-bold text-foreground">{item.value}</span>
                    <span className="text-xs text-muted-foreground">{item.label}</span>
                </div>
            ))}
        </div>
    );
}
