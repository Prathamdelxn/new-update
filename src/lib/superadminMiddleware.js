import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyAccessToken } from "./auth";

/**
 * Protects SuperAdmin API routes.
 * Reads the sa_token httpOnly cookie and verifies isSuperAdmin flag.
 */
export const withSuperAdmin = (handler) => {
  return async (req, ...args) => {
    try {
      // Cookie-based (web) — try first
      const cookieStore = await cookies();
      let token = cookieStore.get("sa_token")?.value;

      // Bearer token fallback for React Native clients
      if (!token) {
        const authHeader = req.headers.get("authorization");
        if (authHeader?.startsWith("Bearer ")) {
          token = authHeader.split(" ")[1];
        }
      }

      if (!token) {
        return NextResponse.json({ message: "Unauthorized: No session" }, { status: 401 });
      }

      const decoded = verifyAccessToken(token);
      if (!decoded || !decoded.isSuperAdmin) {
        return NextResponse.json({ message: "Forbidden: SuperAdmin access only" }, { status: 403 });
      }

      req.superAdmin = decoded;
      return handler(req, ...args);
    } catch (error) {
      return NextResponse.json({ message: "Authentication error" }, { status: 500 });
    }
  };
};
