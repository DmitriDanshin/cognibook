import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
    const authResult = await requireAuth(request);

    if ("error" in authResult) {
        return authResult.error;
    }

    const userId = authResult.user.userId;

    // Get all quiz attempts with dates
    const quizAttempts = await prisma.quizAttempt.findMany({
        where: { userId },
        select: {
            completedAt: true,
            score: true,
            totalQuestions: true,
        },
        orderBy: { completedAt: "desc" },
    });

    // Get reading progress updates
    const readingProgress = await prisma.readingProgress.findMany({
        where: { userId },
        select: {
            updatedAt: true,
            progress: true,
        },
    });

    // Get total books count
    const booksCount = await prisma.book.count({
        where: { userId },
    });

    // Get books with 100% progress
    const completedBooks = await prisma.readingProgress.count({
        where: {
            userId,
            progress: 100,
        },
    });

    // Get total quizzes count for user
    const quizzesCount = await prisma.quiz.count({
        where: { userId },
    });

    // Calculate activity data for heatmap (last 365 days)
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    oneYearAgo.setHours(0, 0, 0, 0);

    // Helper to format date as YYYY-MM-DD in local timezone
    const formatLocalDate = (date: Date): string => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
    };

    // Group quiz attempts by date (using local timezone)
    const activityMap = new Map<string, number>();

    for (const attempt of quizAttempts) {
        const date = formatLocalDate(new Date(attempt.completedAt));
        activityMap.set(date, (activityMap.get(date) || 0) + 1);
    }

    // Convert to array format for heatmap
    const activityData: { date: string; count: number }[] = [];
    const today = new Date();
    today.setHours(23, 59, 59, 999); // Include full day

    for (let d = new Date(oneYearAgo); d <= today; d.setDate(d.getDate() + 1)) {
        const dateStr = formatLocalDate(d);
        activityData.push({
            date: dateStr,
            count: activityMap.get(dateStr) || 0,
        });
    }

    // Calculate stats
    const totalAttempts = quizAttempts.length;
    const passedAttempts = quizAttempts.filter(
        (a) => a.score / a.totalQuestions >= 0.7
    ).length;
    const averageScore =
        totalAttempts > 0
            ? quizAttempts.reduce((sum, a) => sum + a.score / a.totalQuestions, 0) /
              totalAttempts
            : 0;

    // Calculate current streak
    let currentStreak = 0;
    const todayStr = formatLocalDate(new Date());
    const yesterdayDate = new Date();
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterdayStr = formatLocalDate(yesterdayDate);

    // Check if there's activity today or yesterday to start counting
    if (activityMap.has(todayStr) || activityMap.has(yesterdayStr)) {
        const startDate = activityMap.has(todayStr) ? new Date() : yesterdayDate;

        for (let d = new Date(startDate); d >= oneYearAgo; d.setDate(d.getDate() - 1)) {
            const dateStr = formatLocalDate(d);
            if (activityMap.has(dateStr)) {
                currentStreak++;
            } else {
                break;
            }
        }
    }

    // Calculate longest streak
    let longestStreak = 0;
    let tempStreak = 0;
    let prevDate: Date | null = null;

    const sortedDates = Array.from(activityMap.keys()).sort();
    for (const dateStr of sortedDates) {
        const currentDate = new Date(dateStr);
        if (prevDate) {
            const diffDays = Math.floor(
                (currentDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24)
            );
            if (diffDays === 1) {
                tempStreak++;
            } else {
                longestStreak = Math.max(longestStreak, tempStreak);
                tempStreak = 1;
            }
        } else {
            tempStreak = 1;
        }
        prevDate = currentDate;
    }
    longestStreak = Math.max(longestStreak, tempStreak);

    return NextResponse.json({
        stats: {
            totalBooks: booksCount,
            completedBooks,
            totalQuizzes: quizzesCount,
            totalAttempts,
            passedAttempts,
            averageScore: Math.round(averageScore * 100),
            currentStreak,
            longestStreak,
        },
        activityData,
    });
}
