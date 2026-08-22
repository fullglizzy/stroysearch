import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { CredentialsSignin } from "next-auth";
import { prisma } from "@/lib/prisma";
import * as argon2 from "@node-rs/argon2";
import { authConfig } from "./auth.config";
import type { UserType, UserStatus } from "@/types";

/** Ошибка входа: аккаунт забанен. Код «banned» уходит на клиент в result.code */
class BannedUserError extends CredentialsSignin {
  code = "banned";
}

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

        if (!user || user.status === "DELETED") {
          return null;
        }

        // Сначала проверяем пароль — статус бана не раскрываем при неверном пароле
        const validPassword = await argon2.verify(
          user.pwdHash,
          credentials.password as string,
        );

        if (!validPassword) {
          return null;
        }

        if (user.status === "BANNED") {
          throw new BannedUserError();
        }

        return {
          id: user.id,
          username: user.username,
          email: user.email,
          type: user.type as UserType,
          status: user.status as UserStatus,
        };
      },
    }),
  ],
});
