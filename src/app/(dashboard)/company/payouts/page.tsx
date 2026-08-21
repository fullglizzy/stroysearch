import { redirect } from "next/navigation";

// Раздел «Выплаты» упразднён: счета и акты теперь в единой вкладке «Финансы».
export default function CompanyPayoutsRedirect() {
  redirect("/company/finances");
}
