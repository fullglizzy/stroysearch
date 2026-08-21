import { NextResponse } from "next/server";
import { markOverdueWithNotifications } from "@/lib/billing";

/**
 * Ежемесячная пометка просроченных счетов.
 * Вызывается планировщиком (Vercel cron / cron в docker) с заголовком
 * x-cron-secret: <CRON_SECRET> (или ?secret=... для ручного запуска).
 *
 * Счета НЕ формируются автоматически — их создаёт только администратор
 * вручную. Cron отвечает только за просрочку, и то при желании можно
 * обойтись кнопкой «Пометить просроченными» в админке.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET не настроен" }, { status: 503 });
  }
  const headerSecret = request.headers.get("x-cron-secret");
  const { searchParams } = new URL(request.url);
  const querySecret = searchParams.get("secret");
  if (headerSecret !== secret && querySecret !== secret) {
    return NextResponse.json({ error: "Нет доступа" }, { status: 401 });
  }

  const overdueMarked = await markOverdueWithNotifications();

  return NextResponse.json({ success: true, overdueMarked });
}
