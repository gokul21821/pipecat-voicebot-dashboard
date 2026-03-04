import { NextResponse } from "next/server";

// Server-side proxy to the session broker.
// BROKER_AUTH_SECRET is a server-only env var (no NEXT_PUBLIC_ prefix) — it is
// never exposed to the browser. The browser calls /api/start; this handler
// forwards the request to the broker with the secret in a header.
export async function POST() {
  const brokerUrl = process.env.SESSION_BROKER_URL || "http://localhost:3000";
  const secret = process.env.BROKER_AUTH_SECRET || "";

  try {
    const resp = await fetch(`${brokerUrl}/start`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(secret ? { "x-broker-auth": secret } : {}),
      },
      body: JSON.stringify({ createDailyRoom: true }),
    });

    const data = await resp.json();
    return NextResponse.json(data, { status: resp.status });
  } catch {
    return NextResponse.json(
      { error: "Failed to reach session broker" },
      { status: 502 }
    );
  }
}
