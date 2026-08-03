/**
 * Social publishing connectors — Sprint 6.
 *
 * Real API clients for LinkedIn, Facebook and X, each built with an
 * injectable fetcher so every integration is unit-tested without network.
 * `publishToPlatform` routes a post to the right API and returns the
 * external post URL (or null when the platform did not expose one).
 */

import type { SocialCredentialRow } from "@/types/supabase";

export type SocialCredential = Pick<
  SocialCredentialRow,
  "platform" | "access_token" | "account_id" | "account_name"
>;

export interface Fetcher {
  (url: string, init?: RequestInit): Promise<Response>;
}

export interface PublishResult {
  ok: boolean;
  externalUrl: string | null;
  platformPostId: string | null;
}

export class SocialApiError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = "SocialApiError";
  }
}

export const LINKEDIN_API_BASE = "https://api.linkedin.com/v2";
export const FACEBOOK_GRAPH_BASE = "https://graph.facebook.com/v21.0";
export const X_API_BASE = "https://api.x.com/2";

const jsonHeaders = (token: string): Record<string, string> => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${token}`,
});

/** LinkedIn: share a text post on the user's wall (UGC posts API). */
export async function publishLinkedIn(
  credential: SocialCredential,
  text: string,
  fetcher: Fetcher = (url: string, init?: RequestInit) => fetch(url, init)
): Promise<PublishResult> {
  const author = credential.account_id ?? "urn:li:person:me";
  const res = await fetcher(`${LINKEDIN_API_BASE}/ugcPosts`, {
    method: "POST",
    headers: jsonHeaders(credential.access_token),
    body: JSON.stringify({
      author,
      lifecycleState: "PUBLISHED",
      specificContent: {
        "com.linkedin.ugc.ShareContent": {
          shareCommentary: { text },
          shareMediaCategory: "NONE",
        },
      },
      visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new SocialApiError(res.status, `LinkedIn publish failed (${res.status}): ${detail.slice(0, 200)}`);
  }
  const payload = (await res.json()) as { id?: string };
  const id = payload.id?.replace("urn:li:share:", "") ?? null;
  return {
    ok: true,
    platformPostId: id,
    externalUrl: id ? `https://www.linkedin.com/feed/update/${payload.id}` : null,
  };
}

/** Facebook: publish a link post to a page (requires page access token). */
export async function publishFacebook(
  credential: SocialCredential,
  text: string,
  link: string | null,
  fetcher: Fetcher = (url: string, init?: RequestInit) => fetch(url, init)
): Promise<PublishResult> {
  const pageId = credential.account_id ?? "me";
  const params = new URLSearchParams({
    message: text,
    access_token: credential.access_token,
  });
  if (link) params.set("link", link);

  const res = await fetcher(`${FACEBOOK_GRAPH_BASE}/${pageId}/feed`, {
    method: "POST",
    body: params,
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new SocialApiError(res.status, `Facebook publish failed (${res.status}): ${detail.slice(0, 200)}`);
  }
  const payload = (await res.json()) as { id?: string };
  const id = payload.id ?? null;
  return {
    ok: true,
    platformPostId: id,
    externalUrl: id ? `https://www.facebook.com/${pageId}/posts/${id.split("_").pop()}` : null,
  };
}

/** X: publish a tweet (OAuth 2.0 Bearer token of the posting user). */
export async function publishX(
  credential: SocialCredential,
  text: string,
  fetcher: Fetcher = (url: string, init?: RequestInit) => fetch(url, init)
): Promise<PublishResult> {
  const res = await fetcher(`${X_API_BASE}/tweets`, {
    method: "POST",
    headers: jsonHeaders(credential.access_token),
    body: JSON.stringify({ text: text.slice(0, 280) }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new SocialApiError(res.status, `X publish failed (${res.status}): ${detail.slice(0, 200)}`);
  }
  const payload = (await res.json()) as { data?: { id?: string } };
  const id = payload.data?.id ?? null;
  return {
    ok: true,
    platformPostId: id,
    externalUrl: id ? `https://x.com/i/status/${id}` : null,
  };
}

/** Dispatch a post to the platform configured in the credential. */
export async function publishToPlatform(
  credential: SocialCredential,
  body: string,
  link: string | null,
  fetcher?: Fetcher
): Promise<PublishResult> {
  switch (credential.platform) {
    case "linkedin":
      return publishLinkedIn(credential, body, fetcher);
    case "facebook":
      return publishFacebook(credential, body, link, fetcher);
    case "x":
      return publishX(credential, body, fetcher);
  }
}
