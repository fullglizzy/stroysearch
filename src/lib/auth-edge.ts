import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

// Edge-compatible auth (no Credentials provider, no argon2)
export const { auth: authEdge } = NextAuth(authConfig);
