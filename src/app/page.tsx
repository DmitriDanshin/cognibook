"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, GraduationCap, ArrowRight, Sparkles, LogOut } from "lucide-react";
import { toast } from "sonner";

export default function HomePage() {
  const router = useRouter();
  const [user, setUser] = useState<{ email: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setUser(data?.user || null))
      .finally(() => setIsLoading(false));
  }, []);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    toast.success("Вы вышли из аккаунта");
    router.refresh();
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
            <div className="flex items-center gap-4">
              <Link href="/library">
                <Button
                  variant="ghost"
                  className="text-muted-foreground hover:text-foreground hover:bg-muted"
                >
                  Библиотека
                </Button>
              </Link>
              <Link href="/quizzes">
                <Button
                  variant="ghost"
                  className="text-muted-foreground hover:text-foreground hover:bg-muted"
                >
                  Тесты
                </Button>
              </Link>
              {!isLoading && (
                user ? (
                  <Button
                    variant="outline"
                    onClick={handleLogout}
                    className="gap-2"
                  >
                    <LogOut className="h-4 w-4" />
                    Выйти
                  </Button>
                ) : (
                  <Link href="/login">
                    <Button>Войти</Button>
                  </Link>
                )
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative flex min-h-dvh items-center justify-center px-4 pt-16">
        {/* Background decorations */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -left-40 top-20 h-96 w-96 rounded-full bg-foreground/5 blur-3xl" />
          <div className="absolute -right-40 bottom-20 h-96 w-96 rounded-full bg-foreground/5 blur-3xl" />
          <div className="absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground/10 blur-3xl" />
        </div>

        <div className="relative z-10 mx-auto max-w-5xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-muted/60 px-4 py-2 text-sm text-muted-foreground">
            <Sparkles className="h-4 w-4" />
            Умное обучение нового поколения
          </div>

          <h1 className="mb-6 text-5xl font-bold leading-tight tracking-tight sm:text-6xl lg:text-7xl">
            <span className="text-foreground">
              Читайте, изучайте,
            </span>
            <br />
            <span className="text-muted-foreground">
              проверяйте знания
            </span>
          </h1>

          <p className="mx-auto mb-10 max-w-2xl text-lg text-muted-foreground sm:text-xl">
            CogniBook - современная платформа для чтения специализированной литературы
            и прохождения интерактивных тестов с детальной обратной связью
          </p>

          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link href="/library">
              <Button
                size="lg"
                className="group h-14 rounded-xl px-8 text-lg font-semibold shadow-sm transition-all hover:scale-105"
              >
                <BookOpen className="mr-2 h-5 w-5" />
                Открыть библиотеку
                <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
              </Button>
            </Link>
            <Link href="/quizzes">
              <Button
                size="lg"
                variant="outline"
                className="h-14 rounded-xl px-8 text-lg font-semibold transition-all hover:scale-105"
              >
                <GraduationCap className="mr-2 h-5 w-5" />
                Пройти тесты
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="relative z-10 px-4 pb-24">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {/* Feature 1 */}
            <Card className="group border-border bg-card transition-all hover:border-foreground/30 hover:shadow-lg hover:shadow-black/5">
              <CardHeader>
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-foreground/10 text-foreground ring-1 ring-border/70 transition-all group-hover:scale-110 group-hover:ring-foreground/30">
                  <BookOpen className="h-7 w-7" />
                </div>
                <CardTitle className="text-xl text-foreground">
                  Epub Reader
                </CardTitle>
              </CardHeader>
              <CardContent className="text-muted-foreground">
                Загружайте и читайте книги в формате EPUB с удобной навигацией
                по оглавлению и сохранением прогресса чтения
              </CardContent>
            </Card>

            {/* Feature 2 */}
            <Card className="group border-border bg-card transition-all hover:border-foreground/30 hover:shadow-lg hover:shadow-black/5">
              <CardHeader>
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-foreground/10 text-foreground ring-1 ring-border/70 transition-all group-hover:scale-110 group-hover:ring-foreground/30">
                  <GraduationCap className="h-7 w-7" />
                </div>
                <CardTitle className="text-xl text-foreground">
                  Интерактивные тесты
                </CardTitle>
              </CardHeader>
              <CardContent className="text-muted-foreground">
                Создавайте и проходите тесты с детальными пояснениями
                к каждому ответу для глубокого понимания материала
              </CardContent>
            </Card>

            {/* Feature 3 */}
            <Card className="group border-border bg-card transition-all hover:border-foreground/30 hover:shadow-lg hover:shadow-black/5 md:col-span-2 lg:col-span-1">
              <CardHeader>
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-foreground/10 text-foreground ring-1 ring-border/70 transition-all group-hover:scale-110 group-hover:ring-foreground/30">
                  <Sparkles className="h-7 w-7" />
                </div>
                <CardTitle className="text-xl text-foreground">
                  Отслеживание прогресса
                </CardTitle>
              </CardHeader>
              <CardContent className="text-muted-foreground">
                Просматривайте историю прохождения тестов и статистику
                результатов для оценки своих достижений
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-background/80 px-4 py-8 backdrop-blur">
        <div className="mx-auto max-w-7xl text-center text-sm text-muted-foreground">
          © 2026 CogniBook. Умное чтение и обучение.
        </div>
      </footer>
    </div>
  );
}
