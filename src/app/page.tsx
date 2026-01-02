"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, GraduationCap, ArrowRight, Sparkles } from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/10 bg-slate-900/80 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 shadow-lg shadow-violet-500/30">
                <BookOpen className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
                CogniBook
              </span>
            </div>
            <div className="flex items-center gap-4">
              <Link href="/library">
                <Button variant="ghost" className="text-slate-300 hover:text-white hover:bg-white/10">
                  Библиотека
                </Button>
              </Link>
              <Link href="/quizzes">
                <Button variant="ghost" className="text-slate-300 hover:text-white hover:bg-white/10">
                  Тесты
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative flex min-h-screen items-center justify-center px-4 pt-16">
        {/* Background decorations */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -left-40 top-20 h-96 w-96 rounded-full bg-violet-500/20 blur-3xl" />
          <div className="absolute -right-40 bottom-20 h-96 w-96 rounded-full bg-indigo-500/20 blur-3xl" />
          <div className="absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-500/10 blur-3xl" />
        </div>

        <div className="relative z-10 mx-auto max-w-5xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-4 py-2 text-sm text-violet-300">
            <Sparkles className="h-4 w-4" />
            Умное обучение нового поколения
          </div>

          <h1 className="mb-6 text-5xl font-bold leading-tight tracking-tight sm:text-6xl lg:text-7xl">
            <span className="bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
              Читайте, изучайте,
            </span>
            <br />
            <span className="bg-gradient-to-r from-violet-400 via-indigo-400 to-cyan-400 bg-clip-text text-transparent">
              проверяйте знания
            </span>
          </h1>

          <p className="mx-auto mb-10 max-w-2xl text-lg text-slate-400 sm:text-xl">
            CogniBook — современная платформа для чтения специализированной литературы
            и прохождения интерактивных тестов с детальной обратной связью
          </p>

          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link href="/library">
              <Button
                size="lg"
                className="group h-14 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-8 text-lg font-semibold shadow-lg shadow-violet-500/30 transition-all hover:shadow-xl hover:shadow-violet-500/40 hover:scale-105"
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
                className="h-14 rounded-xl border-slate-700 bg-slate-800/50 px-8 text-lg font-semibold text-slate-200 backdrop-blur transition-all hover:border-slate-600 hover:bg-slate-700/50 hover:scale-105"
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
            <Card className="group border-slate-800 bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur transition-all hover:border-violet-500/50 hover:shadow-lg hover:shadow-violet-500/10">
              <CardHeader>
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/20 to-indigo-500/20 text-violet-400 ring-1 ring-violet-500/30 transition-all group-hover:scale-110 group-hover:ring-violet-500/50">
                  <BookOpen className="h-7 w-7" />
                </div>
                <CardTitle className="text-xl text-white">
                  Epub Reader
                </CardTitle>
              </CardHeader>
              <CardContent className="text-slate-400">
                Загружайте и читайте книги в формате EPUB с удобной навигацией
                по оглавлению и сохранением прогресса чтения
              </CardContent>
            </Card>

            {/* Feature 2 */}
            <Card className="group border-slate-800 bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur transition-all hover:border-indigo-500/50 hover:shadow-lg hover:shadow-indigo-500/10">
              <CardHeader>
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500/20 to-cyan-500/20 text-indigo-400 ring-1 ring-indigo-500/30 transition-all group-hover:scale-110 group-hover:ring-indigo-500/50">
                  <GraduationCap className="h-7 w-7" />
                </div>
                <CardTitle className="text-xl text-white">
                  Интерактивные тесты
                </CardTitle>
              </CardHeader>
              <CardContent className="text-slate-400">
                Создавайте и проходите тесты с детальными пояснениями
                к каждому ответу для глубокого понимания материала
              </CardContent>
            </Card>

            {/* Feature 3 */}
            <Card className="group border-slate-800 bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur transition-all hover:border-cyan-500/50 hover:shadow-lg hover:shadow-cyan-500/10 md:col-span-2 lg:col-span-1">
              <CardHeader>
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500/20 to-teal-500/20 text-cyan-400 ring-1 ring-cyan-500/30 transition-all group-hover:scale-110 group-hover:ring-cyan-500/50">
                  <Sparkles className="h-7 w-7" />
                </div>
                <CardTitle className="text-xl text-white">
                  Отслеживание прогресса
                </CardTitle>
              </CardHeader>
              <CardContent className="text-slate-400">
                Просматривайте историю прохождения тестов и статистику
                результатов для оценки своих достижений
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-slate-900/50 px-4 py-8 backdrop-blur">
        <div className="mx-auto max-w-7xl text-center text-sm text-slate-500">
          © 2026 CogniBook. Умное чтение и обучение.
        </div>
      </footer>
    </div>
  );
}
