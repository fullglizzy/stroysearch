"use client";

import { FinancesPage } from "@/components/cards/FinancesPage";
import { CompanyBillingOverview } from "./CompanyBillingOverview";
import { CompanyInvoicesManager } from "./CompanyInvoicesManager";

interface Props {
  balance: number;
  transactions: {
    id: string;
    type: string;
    amount: number;
    description: string | null;
    createdAt: Date;
  }[];
  gifts: {
    id: string;
    name: string;
    coinPrice: number;
    limit: number;
    imageUrl: string | null;
  }[];
  userId: string;
  coinPriceRub: number;
  missingInvoiceFields: string[];
  profileHref: string;
  supportHref: string;
}

/**
 * Страница «Финансы» в кабинете компании одной лентой:
 * счета и акты → обзор тарифа → монеты и подарки.
 */
export function CompanyFinancesContent({ ...finances }: Props) {
  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Счета и акты</h2>
        <CompanyInvoicesManager />
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Обзор</h2>
        <CompanyBillingOverview />
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Монеты и подарки</h2>
        <FinancesPage {...finances} />
      </section>
    </div>
  );
}
