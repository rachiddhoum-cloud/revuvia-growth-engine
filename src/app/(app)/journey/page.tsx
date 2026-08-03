import { JourneyClient } from "@/components/acquisition/journey-client";
import { loadJourneyFunnel } from "@/lib/acquisition/journey";

export const metadata = { title: "Customer Journey" };

export default async function JourneyPage() {
  const model = await loadJourneyFunnel();
  return <JourneyClient model={model} />;
}
