"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FinancesPage } from "@/components/cards/FinancesPage";
import { CompanyBillingOverview } from "./CompanyBillingOverview";
import { CompanyInvoicesManager } from "./CompanyInvoicesManager";

interface Props {
  initialTab?: string;
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
 * Единая вкладка «Финансы» в кабинете компании: тариф и счета + монеты и подарки.
 */
export function CompanyFinancesTabs({ initialTab = "overview", ...finances }: Props) {
  return (
    <Tabs defaultValue={initialTab}>
      <TabsList className="mb-6 flex-wrap h-auto justify-start">
        <TabsTrigger value="overview">Обзор</TabsTrigger>
        <TabsTrigger value="invoices">Счета и акты</TabsTrigger>
        <TabsTrigger value="coins">Монеты и подарки</TabsTrigger>
      </TabsList>

      <TabsContent value="overview"><CompanyBillingOverview /></TabsContent>
      <TabsContent value="invoices"><CompanyInvoicesManager /></TabsContent>
      <TabsContent value="coins"><FinancesPage {...finances} /></TabsContent>
    </Tabs>
  );
}
