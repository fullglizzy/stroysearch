"use server";

import { prisma } from "@/lib/prisma";
import * as argon2 from "@node-rs/argon2";
import { registerSchema, registerCompanySchema } from "@/lib/validators";
import { signIn } from "@/lib/auth";
import { AuthError } from "next-auth";
import { companySearchText } from "@/lib/company";
import { sendMail, buildRegistrationEmail } from "@/lib/mailer";

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

/**
 * Сведения о приглашении для регистрации компании по ссылке от администратора.
 * Отдаёт ИНН и название карточки, к которой будет привязан аккаунт.
 */
export async function getInviteInfo(token: string) {
  const invite = await prisma.companyInvite.findUnique({
    where: { token },
    select: {
      usedAt: true,
      expiresAt: true,
      company: { select: { inn: true, name: true, ownerUserId: true } },
    },
  });
  if (!invite) return { error: "Приглашение не найдено" };
  if (invite.usedAt) return { error: "Приглашение уже использовано" };
  if (invite.expiresAt.getTime() < Date.now()) return { error: "Срок действия приглашения истёк" };
  if (invite.company.ownerUserId) return { error: "У компании уже есть владелец" };
  return { inn: invite.company.inn, companyName: invite.company.name };
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

  // Приветственное письмо (отключено без POSTAL_API_URL/POSTAL_API_KEY)
  await sendMail(buildRegistrationEmail(email, { username, company: false }));

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
  const inviteToken = ((formData.get("invite") as string | null) ?? "").trim() || null;

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

  // Регистрация по приглашению: карточка компании привязывается к создаваемому аккаунту
  let invite: { id: string; expiresAt: Date; usedAt: Date | null; company: { inn: string; ownerUserId: string | null } } | null = null;
  if (inviteToken) {
    const found = await prisma.companyInvite.findUnique({
      where: { token: inviteToken },
      select: {
        id: true,
        expiresAt: true,
        usedAt: true,
        company: { select: { inn: true, ownerUserId: true } },
      },
    });
    if (!found || found.usedAt || found.expiresAt.getTime() < Date.now()) {
      return { error: "Приглашение недействительно или истекло" };
    }
    if (found.company.ownerUserId) {
      return { error: "У компании уже есть владелец" };
    }
    if (found.company.inn !== inn) {
      return { error: `По приглашению нужно регистрироваться с ИНН ${found.company.inn}` };
    }
    invite = found;
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

  // Link existing company or create new one. Передача карточки владельцу
  // (в т.ч. по ссылке-приглашению) включает биллинг — так же, как выдача
  // доступа в админке; иначе компания навсегда останется «Без владельца».
  if (existingCompany) {
    await prisma.company.update({
      where: { inn },
      data: { ownerUserId: user.id },
    });
    await prisma.companyBilling.upsert({
      where: { companyId: existingCompany.id },
      update: { status: "ACTIVE" },
      create: { companyId: existingCompany.id, status: "ACTIVE", billingStartedAt: new Date() },
    });
  } else {
    await prisma.company.create({
      data: {
        inn,
        name: companyName,
        searchText: companySearchText(companyName, inn),
        email,
        ownerUserId: user.id,
        metrics: { create: {} },
        billing: { create: { status: "ACTIVE", billingStartedAt: new Date() } },
      },
    });
  }

  if (invite) {
    await prisma.companyInvite.update({ where: { id: invite.id }, data: { usedAt: new Date() } });
  }

  // Приветственное письмо (отключено без POSTAL_API_URL/POSTAL_API_KEY)
  await sendMail(buildRegistrationEmail(email, { username, company: true }));

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
