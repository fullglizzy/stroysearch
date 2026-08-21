"use client";

import { useState } from "react";
import type { ComponentProps } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BillingOverview } from "./BillingOverview";
import { CompanyTariffsManager } from "./CompanyTariffsManager";
import { BillingInvoicesManager } from "./BillingInvoicesManager";
import { DocTemplatesManager } from "./DocTemplatesManager";
import { RequisitesEditor } from "./RequisitesEditor";
import { FinancesManager } from "@/components/forms/FinancesManager";
import { GiftsManager } from "@/components/forms/GiftsManager";

interface Props {
  initialTab?: string;
  config: ComponentProps<typeof FinancesManager>["config"];
  gifts: ComponentProps<typeof GiftsManager>["gifts"];
  claims: ComponentProps<typeof GiftsManager>["claims"];
}

/**
 * Единая вкладка «Финансы» админки.
 * Главный экран — «Компании»: KPI-карточки и сводная таблица по компаниям,
 * остальное — по потребности.
 */
export function AdminFinancesTabs({ initialTab = "companies", config, gifts, claims }: Props) {
  const [tab, setTab] = useState(initialTab);
  const [settingsTab, setSettingsTab] = useState("general");

  return (
    <Tabs value={tab} onValueChange={(v) => setTab(String(v ?? "companies"))}>
      <TabsList className="mb-6 flex-wrap h-auto justify-start">
        <TabsTrigger value="companies">Компании</TabsTrigger>
        <TabsTrigger value="invoices">Счета и акты</TabsTrigger>
        <TabsTrigger value="gifts">Подарки</TabsTrigger>
        <TabsTrigger value="settings">Настройки</TabsTrigger>
      </TabsList>

      <TabsContent value="companies">
        <div className="space-y-6">
          <BillingOverview />
          <CompanyTariffsManager />
        </div>
      </TabsContent>
      <TabsContent value="invoices"><BillingInvoicesManager /></TabsContent>
      <TabsContent value="gifts"><GiftsManager gifts={gifts} claims={claims} /></TabsContent>
      <TabsContent value="settings">
        <Tabs value={settingsTab} onValueChange={(v) => setSettingsTab(String(v ?? "general"))}>
          <TabsList className="mb-6 flex-wrap h-auto justify-start">
            <TabsTrigger value="general">Экономика</TabsTrigger>
            <TabsTrigger value="templates">Шаблоны счетов и актов</TabsTrigger>
          </TabsList>
          <TabsContent value="general">
            <FinancesManager config={config} />
          </TabsContent>
          <TabsContent value="templates">
            <div className="space-y-6">
              <RequisitesEditor config={config} />
              <DocTemplatesManager />
            </div>
          </TabsContent>
        </Tabs>
      </TabsContent>
    </Tabs>
  );
}
