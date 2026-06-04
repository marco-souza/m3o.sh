/**
 * API endpoint to fetch fresh IPTV channel data.
 *
 * Bypasses the live-loader's in-memory cache so the client can
 * refresh the channel list on demand.
 */

import type { APIRoute } from "astro";

import { fetchAndEnrichChannels } from "@/lib/iptv/live-loader";

export const GET: APIRoute = async () => {
  try {
    const entries = await fetchAndEnrichChannels(undefined, true);
    const channels = entries.map((e) => e.data);

    return new Response(JSON.stringify({ channels }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to fetch channels";

    return new Response(JSON.stringify({ error: message }), {
      status: 502,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    });
  }
};
