import { SalesClient } from "@/components/acquisition/sales-client";
import { loadSalesPriorities } from "@/lib/acquisition/sales-priority";

export const metadata = { title: "Sales Intelligence" };

export default async function SalesPage() {
  const rows = await loadSalesPriorities();
  return <SalesClient rows={rows} />;
}
