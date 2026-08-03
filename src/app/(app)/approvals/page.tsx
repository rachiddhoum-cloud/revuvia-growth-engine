import { ApprovalQueueClient } from "@/components/approval/approval-queue-client";
import { createServiceRoleClient } from "@/lib/supabase";
import { listPendingApprovals } from "@/lib/pipeline/pending";
import { resolveOwnerId } from "@/lib/owner";

export const metadata = {
  title: "Approvals",
};

export const dynamic = "force-dynamic";

export default async function ApprovalsPage() {
  const ownerId = resolveOwnerId(null);
  let items: Awaited<ReturnType<typeof listPendingApprovals>> = [];

  try {
    const sb = createServiceRoleClient();
    items = await listPendingApprovals(sb, ownerId);
  } catch {
    items = [];
  }

  return <ApprovalQueueClient initialItems={items} ownerId={ownerId} />;
}
