import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import * as argon2 from "@node-rs/argon2";
import { authConfig } from "./auth.config";

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        username: { label: "Логин", type: "text" },
        password: { label: "Пароль", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { username: credentials.username as string },
        });

        if (!user || user.status === "BANNED" || user.status === "DELETED") {
          return null;
        }

        const validPassword = await argon2.verify(
          user.pwdHash,
          credentials.password as string,
        );

        if (!validPassword) {
          return null;
        }

        return {
          id: user.id,
          username: user.username,
          email: user.email,
          type: user.type,
          status: user.status,
        };
      },
    }),
  ],
});
