import { CasDashboardClient } from "@/components/acquisition/cas-dashboard-client";
import { loadAcquisitionDashboard } from "@/lib/acquisition/dashboard";

export const metadata = { title: "Customer Acquisition" };

export default async function AcquisitionPage() {
  const model = await loadAcquisitionDashboard();
  return <CasDashboardClient model={model} />;
}
