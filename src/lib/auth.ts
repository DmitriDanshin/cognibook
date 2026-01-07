import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { prisma } from "./db";
import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";

if (!process.env.JWT_SECRET) {
    throw new Error(
        "FATAL: JWT_SECRET environment variable is not set. " +
        "The application cannot start without a secure secret."
    );
}

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET);

const COOKIE_NAME = "auth-token";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

function isSecureRequest(request: NextRequest): boolean {
    const forwardedProto = request.headers.get("x-forwarded-proto");
    if (forwardedProto) {
        return forwardedProto.split(",")[0].trim() === "https";
    }
    return request.nextUrl.protocol === "https:";
}

export interface UserPayload {
    userId: string;
    email: string;
}

export async function hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 12);
}

export async function verifyPassword(
    password: string,
    hashedPassword: string
): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword);
}

export async function createToken(payload: UserPayload): Promise<string> {
    return new SignJWT({ ...payload })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("7d")
        .sign(JWT_SECRET);
}

export async function verifyToken(token: string): Promise<UserPayload | null> {
    try {
        const { payload } = await jwtVerify(token, JWT_SECRET);
        return payload as unknown as UserPayload;
    } catch {
        return null;
    }
}

export function setAuthCookie(
    response: NextResponse,
    token: string,
    request: NextRequest
): void {
    response.cookies.set(COOKIE_NAME, token, {
        httpOnly: true,
        secure: isSecureRequest(request),
        sameSite: "strict",
        maxAge: COOKIE_MAX_AGE,
        path: "/",
    });
}

export function removeAuthCookie(
    response: NextResponse,
    request: NextRequest
): void {
    response.cookies.set(COOKIE_NAME, "", {
        httpOnly: true,
        secure: isSecureRequest(request),
        sameSite: "lax",
        maxAge: 0,
        path: "/",
    });
}

export async function getCurrentUser(): Promise<UserPayload | null> {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;

    if (!token) {
        return null;
    }

    return verifyToken(token);
}

export async function requireAuth(
    request: NextRequest
): Promise<{ user: UserPayload } | { error: NextResponse }> {
    const token = request.cookies.get(COOKIE_NAME)?.value;

    if (!token) {
        return {
            error: NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            ),
        };
    }

    const user = await verifyToken(token);

    if (!user) {
        return {
            error: NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            ),
        };
    }

    // Verify user still exists in database
    const dbUser = await prisma.user.findUnique({
        where: { id: user.userId },
    });

    if (!dbUser) {
        return {
            error: NextResponse.json(
                { error: "User not found" },
                { status: 401 }
            ),
        };
    }

    return { user };
}
