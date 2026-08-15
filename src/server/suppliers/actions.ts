"use server";

import { prisma } from "@/lib/prisma";

/**
 * Проверка доступности ИНН при добавлении компании в базу (live-валидация формы).
 * В отличие от checkInnAvailability при регистрации, занят любой существующий
 * ИНН: /api/suppliers отклоняет добавление компании с уже внесённым ИНН.
 */
export async function checkCompanyInnAvailability(inn: string) {
  const value = inn.replace(/\D/g, "");
  if (value.length !== 10 && value.length !== 12) return { available: true };
  const existing = await prisma.company.findUnique({
    where: { inn: value },
    select: { id: true },
  });
  return { available: !existing };
}
