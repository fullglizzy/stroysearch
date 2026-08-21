import { redirect } from "next/navigation";

// Раздел «Выплаты» упразднён: платформа ничего не выплачивает, биллинг
// переехал в единую вкладку «Финансы».
export default function AdminPayoutsRedirect() {
  redirect("/admin/finances?tab=invoices");
}
