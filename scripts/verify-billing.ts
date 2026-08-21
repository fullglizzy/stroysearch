import { prisma } from "../src/lib/prisma";
import { generateBillingInvoices } from "../src/lib/billing";

async function main() {
  const billings = await prisma.companyBilling.findMany({
    include: { company: { select: { name: true, ownerUserId: true } } },
  });
  console.log("Тарифы биллинга:", billings.map((b) => `${b.company.name} → ${b.status}`).join("; "));

  const result = await generateBillingInvoices({});
  console.log("Сформировано:", result.created.map((c) => `${c.invoiceNumber} (${c.companyName}) ${c.total}₽`).join("; ") || "нет");
  console.log("Пропущено:", result.skipped.map((s) => `${s.companyName}: ${s.reason}`).join("; ") || "нет");

  const invoices = await prisma.invoice.findMany({
    where: { kind: "BILLING" },
    include: { items: true, act: true },
    orderBy: { createdAt: "desc" },
  });
  console.log(`\nСчетов BILLING в базе: ${invoices.length}`);
  for (const i of invoices) {
    console.log(`- ${i.number} [${i.status}] ${i.total.toNumber()}₽, период ${i.periodFrom?.toISOString().slice(0, 10)} — ${i.periodTo?.toISOString().slice(0, 10)}`);
    for (const it of i.items) console.log(`    • ${it.description} = ${it.total.toNumber()}₽`);
  }
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
