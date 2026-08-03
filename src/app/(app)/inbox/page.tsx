import { InboxClient } from "@/components/acquisition/inbox-client";
import { loadFounderBriefing } from "@/lib/acquisition/founder-briefing";

export const metadata = { title: "Founder Inbox" };

export default async function InboxPage() {
  const briefing = await loadFounderBriefing();
  return <InboxClient briefing={briefing} />;
}
