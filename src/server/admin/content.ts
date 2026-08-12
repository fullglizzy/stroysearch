"use server";

import { prisma } from "@/lib/prisma";

export async function getPageContent(pageKey: string) {
  return prisma.pageContent.findUnique({
    where: { pageKey },
  });
}

export async function updatePageContent(
  pageKey: string,
  title: string,
  content: string,
  bannerUrl?: string | null,
) {
  return prisma.pageContent.upsert({
    where: { pageKey },
    update: { title, content, bannerUrl },
    create: { pageKey, title, content, bannerUrl },
  });
}
