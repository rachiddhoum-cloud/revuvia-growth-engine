import { SeoDashboardClient } from "@/components/dashboard/seo-dashboard-client";
import { loadAnalyticsModel } from "@/lib/analytics/load";

export const metadata = {
  title: "SEO Dashboard",
};

export default async function AnalyticsPage() {
  const model = await loadAnalyticsModel();
  return <SeoDashboardClient model={model} />;
}
