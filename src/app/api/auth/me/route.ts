import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";

export async function GET(request: NextRequest) {
    const authResult = await requireAuth(request);

    if ("error" in authResult) {
        return authResult.error;
    }

    return NextResponse.json({
        user: {
            id: authResult.user.userId,
            email: authResult.user.email,
        },
    });
}
