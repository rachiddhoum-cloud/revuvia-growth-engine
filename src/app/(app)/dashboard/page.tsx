import { CeoDashboardClient } from "@/components/dashboard/ceo-dashboard-client";
import { loadCeoDashboard } from "@/lib/ops/dashboard-loader";

export const metadata = {
  title: "CEO Dashboard",
};

export default async function DashboardPage() {
  const model = await loadCeoDashboard();
  return <CeoDashboardClient model={model} />;
}
