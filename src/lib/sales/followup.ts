/**
 * Commercialization OS — Phase 6: follow-up engine.
 *
 * Decides today's follow-up actions per prospect from the outbound message
 * log: first contact for never-touched leads, cadence follow-ups (d+2 / d+5
 * / d+9) that escalate across channels, and stop rules (replied, won/lost,
 * max touches reached). Pure and deterministic.
 */

import type { ProspectRow } from "@/types/supabase";
import { buildFollowUps, buildFirstTouchEmail, FOLLOW_UP_CADENCE_DAYS } from "@/lib/sales/outreach";
import type { FollowUpAction, MessageRecord } from "@/lib/sales/types";

export interface FollowUpInput {
  prospects: ProspectRow[];
  messages: MessageRecord[];
  now?: Date;
  maxTouches?: number;
}

const TERMINAL = ["won", "lost", "archived", "closed"];

function sentMessagesOf(messages: MessageRecord[], prospectId: string): MessageRecord[] {
  return messages
    .filter((m) => m.prospectId === prospectId && m.status === "sent" && m.sentAt)
    .sort((a, b) => new Date(a.sentAt as string).getTime() - new Date(b.sentAt as string).getTime());
}

/** Follow-up actions due on or before `now`. */
export function followUpActions(input: FollowUpInput): FollowUpAction[] {
  const now = input.now ?? new Date();
  const maxTouches = input.maxTouches ?? 5;
  const actions: FollowUpAction[] = [];

  for (const p of input.prospects) {
    if (TERMINAL.includes(p.status)) continue;
    const kit = { firstTouch: buildFirstTouchEmail(p), followUps: buildFollowUps(p) };
    const allMessages = input.messages.filter((m) => m.prospectId === p.id);
    const sent = sentMessagesOf(allMessages, p.id);

    if (allMessages.some((m) => m.status === "replied")) {
      actions.push({
        prospectId: p.id,
        company: p.company,
        action: "stop",
        channel: allMessages.find((m) => m.status === "replied")?.channel ?? "email",
        reason: "prospect replied",
        dueAt: now.toISOString(),
        message: null,
      });
      continue;
    }

    if (sent.length === 0) {
      if (p.status === "new" || p.status === "new_lead") {
        actions.push({
          prospectId: p.id,
          company: p.company,
          action: "first_contact",
          channel: kit.firstTouch.channel,
          reason: "never contacted",
          dueAt: now.toISOString(),
          message: kit.firstTouch,
        });
      }
      continue;
    }

    const touches = sent.length;
    if (touches >= maxTouches) {
      actions.push({
        prospectId: p.id,
        company: p.company,
        action: "stop",
        channel: "call",
        reason: `reached ${maxTouches} touches without a reply`,
        dueAt: now.toISOString(),
        message: null,
      });
      continue;
    }

    const lastSentAt = new Date(sent[sent.length - 1].sentAt as string).getTime();
    const followUps = kit.followUps;
    const touchIndex = touches - 1;

    const message = followUps[Math.min(touchIndex, followUps.length - 1)];
    let actionKind: FollowUpAction["action"] = "follow_up";
    let reason = `day ${message.delayDays} follow-up after ${touches} touch(es)`;

    if (touchIndex >= followUps.length) {
      actionKind = "escalate";
      reason = `no response after ${touches} touches — escalate to phone`;
    }

    const dueAt = lastSentAt + message.delayDays * 86_400_000;
    if (dueAt <= now.getTime()) {
      actions.push({
        prospectId: p.id,
        company: p.company,
        action: actionKind,
        channel: message.channel,
        reason,
        dueAt: new Date(dueAt).toISOString(),
        message,
      });
    }
  }

  return actions;
}

export { FOLLOW_UP_CADENCE_DAYS };
