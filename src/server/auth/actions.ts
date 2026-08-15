"use server";

import { prisma } from "@/lib/prisma";
import * as argon2 from "@node-rs/argon2";
import { registerSchema, registerCompanySchema } from "@/lib/validators";
import { signIn } from "@/lib/auth";
import { AuthError } from "next-auth";

/**
 * Проверка доступности логина при регистрации (live-валидация формы).
 */
export async function checkUsernameAvailability(username: string) {
  const value = username.trim();
  if (!value) return { available: true };
  const existing = await prisma.user.findUnique({
    where: { username: value },
    select: { id: true },
  });
  return { available: !existing };
}

/**
 * Проверка доступности email при регистрации (live-валидация формы).
 */
export async function checkEmailAvailability(email: string) {
  const value = email.trim().toLowerCase();
  if (!value) return { available: true };
  const existing = await prisma.user.findUnique({
    where: { email: value },
    select: { id: true },
  });
  return { available: !existing };
}

/**
 * Проверка доступности ИНН при регистрации компании (live-валидация формы).
 * Занят, только если у компании уже есть владелец на платформе.
 */
export async function checkInnAvailability(inn: string) {
  const value = inn.replace(/\D/g, "");
  if (value.length !== 10 && value.length !== 12) return { available: true };
  const company = await prisma.company.findUnique({
    where: { inn: value },
    select: { ownerUserId: true },
  });
  return { available: !company?.ownerUserId };
}

export async function registerUser(formData: FormData) {
  const raw = {
    username: formData.get("username") as string,
    email: formData.get("email") as string,
    password: formData.get("password") as string,
    agreePersonalData: formData.get("agreePersonalData") === "on",
    agreeTerms: formData.get("agreeTerms") === "on",
  };

  const parsed = registerSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const { username, email, password } = parsed.data;

  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [{ username }, { email }],
    },
  });

  if (existingUser) {
    return {
      error:
        existingUser.username === username
          ? "Пользователь с таким логином уже существует"
          : "Пользователь с таким email уже существует",
    };
  }

  const pwdHash = await argon2.hash(password);

  const user = await prisma.user.create({
    data: {
      username,
      email,
      pwdHash,
      status: "ACTIVE",
      type: "COMMON",
      profile: {
        create: {
          nick: username,
        },
      },
      serviceFields: {
        create: {},
      },
      wallet: {
        create: {
          balance: 0,
        },
      },
    },
  });

  return { success: true, userId: user.id, displayName: username };
}

export async function registerCompany(formData: FormData) {
  const raw = {
    username: formData.get("username") as string,
    email: formData.get("email") as string,
    password: formData.get("password") as string,
    inn: formData.get("inn") as string,
    companyName: formData.get("companyName") as string,
    agreeTerms: formData.get("agreeTerms") === "on",
  };

  const parsed = registerCompanySchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const { username, email, password, inn, companyName } = parsed.data;

  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [{ username }, { email }],
    },
  });

  if (existingUser) {
    return {
      error:
        existingUser.username === username
          ? "Пользователь с таким логином уже существует"
          : "Пользователь с таким email уже существует",
    };
  }

  // Check if company with this INN already has an owner
  const existingCompany = await prisma.company.findUnique({
    where: { inn },
  });

  if (existingCompany?.ownerUserId) {
    return { error: "Компания с таким ИНН уже зарегистрирована на платформе" };
  }

  const pwdHash = await argon2.hash(password);

  const user = await prisma.user.create({
    data: {
      username,
      email,
      pwdHash,
      status: "ACTIVE",
      type: "COMPANY",
      profile: {
        create: {
          nick: username,
          inn,
        },
      },
      serviceFields: {
        create: {},
      },
      wallet: {
        create: {
          balance: 0,
        },
      },
    },
  });

  // Link existing company or create new one
  if (existingCompany) {
    await prisma.company.update({
      where: { inn },
      data: { ownerUserId: user.id },
    });
  } else {
    await prisma.company.create({
      data: {
        inn,
        name: companyName,
        email,
        ownerUserId: user.id,
        metrics: { create: {} },
      },
    });
  }

  // Для приветствия отдаём реальное название компании (в т.ч. при привязке к существующей)
  return {
    success: true,
    userId: user.id,
    displayName: existingCompany?.name || companyName || username,
  };
}

export async function authenticate(formData: FormData) {
  try {
    await signIn("credentials", {
      username: formData.get("username") as string,
      password: formData.get("password") as string,
      redirect: false,
    });
    return { success: true };
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Неверный логин или пароль" };
    }
    throw error;
  }
}
