"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, GraduationCap, ArrowRight, LogOut, Menu, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ActivityHeatmap } from "@/components/ui/activity-heatmap";
import { UserStats } from "@/components/ui/user-stats";

interface UserStatsData {
    stats: {
        totalBooks: number;
        completedBooks: number;
        totalQuizzes: number;
        totalAttempts: number;
        passedAttempts: number;
        averageScore: number;
        currentStreak: number;
        longestStreak: number;
    };
    activityData: { date: string; count: number }[];
}

export default function HomePage() {
    const router = useRouter();
    const [user, setUser] = useState<{ email: string } | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [userStats, setUserStats] = useState<UserStatsData | null>(null);
    const [isStatsLoading, setIsStatsLoading] = useState(false);

    useEffect(() => {
        fetch("/api/auth/me")
            .then((res) => (res.ok ? res.json() : null))
            .then((data) => {
                const userData = data?.user || null;
                setUser(userData);
                if (userData) {
                    setIsStatsLoading(true);
                    fetch("/api/user/stats")
                        .then((res) => (res.ok ? res.json() : null))
                        .then((statsData) => setUserStats(statsData))
                        .finally(() => setIsStatsLoading(false));
                }
            })
            .finally(() => setIsLoading(false));
    }, []);

    async function handleLogout() {
        if (!confirm("Вы действительно хотите выйти?")) {
            return;
        }
        await fetch("/api/auth/logout", { method: "POST" });
        setUser(null);
        setUserStats(null);
        toast.success("Вы вышли из аккаунта");
        router.refresh();
        setIsMenuOpen(false);
    }

    return (
        <div className="min-h-dvh bg-background text-foreground">
            {/* Navigation */}
            <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-background/85 backdrop-blur-xl">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                    <div className="flex h-14 items-center justify-between sm:h-16">
                        <div className="flex items-center gap-2">
                            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-foreground/10 text-foreground">
                                <BookOpen className="h-5 w-5" />
                            </div>
                            <span className="text-lg font-bold text-foreground sm:text-xl">
                                CogniBook
                            </span>
                        </div>
                        <div className="hidden items-center gap-2 sm:flex sm:gap-4">
                            <Link href="/library">
                                <Button
                                    variant="ghost"
                                    className="px-2 text-muted-foreground hover:text-foreground hover:bg-muted sm:px-4"
                                >
                                    Библиотека
                                </Button>
                            </Link>
                            <Link href="/quizzes">
                                <Button
                                    variant="ghost"
                                    className="px-2 text-muted-foreground hover:text-foreground hover:bg-muted sm:px-4"
                                >
                                    Тесты
                                </Button>
                            </Link>
                            {!isLoading && (
                                user ? (
                                    <Button
                                        variant="outline"
                                        onClick={handleLogout}
                                        className="gap-2 px-2 sm:px-4"
                                        aria-label="Выйти"
                                    >
                                        <LogOut className="h-4 w-4" />
                                        <span className="hidden sm:inline">Выйти</span>
                                    </Button>
                                ) : (
                                    <Link href="/login">
                                        <Button className="px-3 sm:px-4">Войти</Button>
                                    </Link>
                                )
                            )}
                        </div>
                        <div className="flex items-center sm:hidden">
                            <Button
                                variant="ghost"
                                size="icon"
                                aria-label={isMenuOpen ? "Закрыть меню" : "Открыть меню"}
                                aria-expanded={isMenuOpen}
                                aria-controls="mobile-nav"
                                onClick={() => setIsMenuOpen((open) => !open)}
                            >
                                {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                            </Button>
                        </div>
                    </div>
                </div>
                {isMenuOpen && (
                    <div
                        id="mobile-nav"
                        className="border-t border-border bg-background/95 backdrop-blur sm:hidden"
                    >
                        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-3">
                            <Button
                                variant="ghost"
                                className="w-full justify-start"
                                asChild
                            >
                                <Link href="/library" onClick={() => setIsMenuOpen(false)}>
                                    Библиотека
                                </Link>
                            </Button>
                            <Button
                                variant="ghost"
                                className="w-full justify-start"
                                asChild
                            >
                                <Link href="/quizzes" onClick={() => setIsMenuOpen(false)}>
                                    Тесты
                                </Link>
                            </Button>
                            {!isLoading && (
                                user ? (
                                    <Button
                                        variant="outline"
                                        className="w-full justify-start gap-2"
                                        onClick={handleLogout}
                                    >
                                        <LogOut className="h-4 w-4" />
                                        Выйти
                                    </Button>
                                ) : (
                                    <Button className="w-full justify-start" asChild>
                                        <Link href="/login" onClick={() => setIsMenuOpen(false)}>
                                            Войти
                                        </Link>
                                    </Button>
                                )
                            )}
                        </div>
                    </div>
                )}
            </nav>

            {/* Main Content */}
            <main className="mx-auto max-w-7xl px-4 pt-20 pb-12 sm:px-6 lg:px-8">
                {isLoading ? (
                    <div className="flex min-h-[60vh] items-center justify-center">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                ) : user ? (
                    /* Logged in - Show Dashboard */
                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
                                Добро пожаловать!
                            </h1>
                        </div>

                        {/* Stats */}
                        {isStatsLoading ? (
                            <div className="flex h-24 items-center justify-center">
                                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                            </div>
                        ) : userStats ? (
                            <UserStats stats={userStats.stats} />
                        ) : null}

                        {/* Activity Heatmap */}
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-lg">Активность за год</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {isStatsLoading ? (
                                    <div className="flex h-32 items-center justify-center">
                                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                                    </div>
                                ) : userStats ? (
                                    <ActivityHeatmap data={userStats.activityData} />
                                ) : (
                                    <p className="text-sm text-muted-foreground">
                                        Нет данных об активности
                                    </p>
                                )}
                            </CardContent>
                        </Card>

                        {/* Quick Actions */}
                        <div className="grid gap-4 sm:grid-cols-2">
                            <Link href="/library" className="block">
                                <Card className="group h-full cursor-pointer transition-all hover:border-foreground/30 hover:shadow-lg">
                                    <CardContent className="flex items-center gap-4 py-6">
                                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500">
                                            <BookOpen className="h-6 w-6" />
                                        </div>
                                        <div className="flex-1">
                                            <h3 className="font-semibold text-foreground">Библиотека</h3>
                                            <p className="text-sm text-muted-foreground">
                                                Читать книги и отслеживать прогресс
                                            </p>
                                        </div>
                                        <ArrowRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1" />
                                    </CardContent>
                                </Card>
                            </Link>
                            <Link href="/quizzes" className="block">
                                <Card className="group h-full cursor-pointer transition-all hover:border-foreground/30 hover:shadow-lg">
                                    <CardContent className="flex items-center gap-4 py-6">
                                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-500/10 text-purple-500">
                                            <GraduationCap className="h-6 w-6" />
                                        </div>
                                        <div className="flex-1">
                                            <h3 className="font-semibold text-foreground">Тесты</h3>
                                            <p className="text-sm text-muted-foreground">
                                                Проходить тесты и проверять знания
                                            </p>
                                        </div>
                                        <ArrowRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1" />
                                    </CardContent>
                                </Card>
                            </Link>
                        </div>
                    </div>
                ) : (
                    /* Not logged in - Show simple welcome */
                    <div className="flex min-h-[70vh] flex-col items-center justify-center text-center">
                        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-foreground/10 text-foreground">
                            <BookOpen className="h-8 w-8" />
                        </div>
                        <h1 className="mb-4 text-4xl font-bold text-foreground sm:text-5xl">
                            CogniBook
                        </h1>
                        <p className="mb-8 max-w-md text-lg text-muted-foreground">
                            Платформа для чтения книг и прохождения интерактивных тестов
                        </p>
                        <div className="flex flex-col gap-3 sm:flex-row">
                            <Link href="/login">
                                <Button size="lg" className="h-12 px-8">
                                    Войти
                                    <ArrowRight className="ml-2 h-4 w-4" />
                                </Button>
                            </Link>
                            <Link href="/register">
                                <Button size="lg" variant="outline" className="h-12 px-8">
                                    Регистрация
                                </Button>
                            </Link>
                        </div>
                    </div>
                )}
            </main>

            {/* Footer */}
            <footer className="border-t border-border bg-background/80 px-4 py-6 backdrop-blur">
                <div className="mx-auto max-w-7xl text-center text-sm text-muted-foreground">
                    © 2026 CogniBook
                </div>
            </footer>
        </div>
    );
}
