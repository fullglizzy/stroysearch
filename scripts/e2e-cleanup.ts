// Очистка данных, созданных e2e-тестами (префикс E2E) и отладочных записей.
// Запуск: npx tsx scripts/e2e-cleanup.ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const petrov = await prisma.user.findUnique({ where: { username: "petrov_engineer" } });

  // Удаляем E2E-конференции и связанные участия
  const confs = await prisma.conference.findMany({ where: { title: { contains: "E2E" } } });
  for (const c of confs) {
    await prisma.conferenceParticipant.deleteMany({ where: { conferenceId: c.id } });
  }
  await prisma.conference.deleteMany({ where: { title: { contains: "E2E" } } });

  // E2E-товары (включая мягко удалённые)
  await prisma.product.deleteMany({ where: { name: { contains: "E2E" } } });

  // E2E-документы
  await prisma.libraryDocument.deleteMany({ where: { title: { contains: "E2E" } } });

  // E2E-отзывы
  await prisma.review.deleteMany({ where: { comment: { contains: "E2E" } } });

  // E2E-тикеты и их сообщения
  const tickets = await prisma.supportTicket.findMany({ where: { subject: { contains: "E2E" } } });
  for (const t of tickets) {
    await prisma.supportMessage.deleteMany({ where: { ticketId: t.id } });
  }
  await prisma.supportTicket.deleteMany({ where: { subject: { contains: "E2E" } } });

  // Уведомления тестового участника
  if (petrov) {
    await prisma.notification.deleteMany({ where: { userId: petrov.id } });
    // Счета и тикеты от тестовой покупки монет
    const invoices = await prisma.invoice.findMany({
      where: { userId: petrov.id, kind: "PURCHASE" },
      orderBy: { createdAt: "desc" },
      take: 5,
    });
    for (const inv of invoices) {
      if (inv.ticketId) {
        await prisma.supportMessage.deleteMany({ where: { ticketId: inv.ticketId } });
        await prisma.supportTicket.deleteMany({ where: { id: inv.ticketId } });
      }
      await prisma.invoice.deleteMany({ where: { id: inv.id } });
    }
  }

  // Баланс тестового участника не менялся тестами (начисление+списание),
  // но на всякий случай округлим до 2 знаков
  if (petrov) {
    const wallet = await prisma.wallet.findUnique({ where: { userId: petrov.id } });
    if (wallet) {
      await prisma.wallet.update({
        where: { userId: petrov.id },
        data: { balance: Math.round(wallet.balance.toNumber() * 100) / 100 },
      });
    }
  }

  console.log("E2E cleanup: done");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
