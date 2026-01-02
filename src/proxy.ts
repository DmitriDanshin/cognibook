import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const JWT_SECRET = new TextEncoder().encode(
    process.env.JWT_SECRET || "your-super-secret-key-change-in-production"
);

const publicPaths = ["/", "/login", "/register"];
const publicApiPaths = ["/api/auth/login", "/api/auth/register"];

export async function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Allow public paths
    if (publicPaths.includes(pathname)) {
        return NextResponse.next();
    }

    // Allow public API paths
    if (publicApiPaths.some(path => pathname.startsWith(path))) {
        return NextResponse.next();
    }

    // Check for auth token
    const token = request.cookies.get("auth-token")?.value;

    if (!token) {
        // For API routes, return 401
        if (pathname.startsWith("/api/")) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }
        // For pages, redirect to login
        return NextResponse.redirect(new URL("/login", request.url));
    }

    // Verify token
    try {
        await jwtVerify(token, JWT_SECRET);
        return NextResponse.next();
    } catch {
        // Invalid token
        if (pathname.startsWith("/api/")) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }
        return NextResponse.redirect(new URL("/login", request.url));
    }
}

export const config = {
    matcher: [
        // Match all paths except static files and _next
        "/((?!_next/static|_next/image|favicon.ico|uploads/).*)",
    ],
};
