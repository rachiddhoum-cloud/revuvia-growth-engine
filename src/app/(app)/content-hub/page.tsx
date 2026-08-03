import { ContentHubClient } from "@/components/acquisition/content-hub-client";
import { loadContentHub } from "@/lib/acquisition/content-hub";

export const metadata = { title: "Content Hub" };

export default async function ContentHubPage() {
  const model = await loadContentHub();
  return <ContentHubClient model={model} />;
}
