import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function config() {
  return {
    url: process.env.SUPABASE_URL,
    key: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
}

export async function GET() {
  const { url, key } = config();
  if (!url || !key) {
    return NextResponse.json({ events: [], configured: false });
  }

  const response = await fetch(
    `${url}/rest/v1/pro_events?select=*&order=start.asc&limit=100`,
    {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
      cache: "no-store",
    }
  );

  if (!response.ok) {
    return NextResponse.json({ events: [], configured: true }, { status: 502 });
  }

  return NextResponse.json({ events: await response.json(), configured: true });
}

export async function POST(request: NextRequest) {
  const { url, key } = config();
  if (!url || !key) {
    return NextResponse.json(
      {
        error:
          "La publication professionnelle sera active après configuration de Supabase.",
      },
      { status: 503 }
    );
  }

  const body = await request.json();
  if (!body?.title || !body?.start) {
    return NextResponse.json(
      { error: "Le titre et la date sont obligatoires." },
      { status: 400 }
    );
  }

  const payload = {
    title: String(body.title).slice(0, 180),
    start: body.start,
    end: body.end || null,
    venue: body.venue || null,
    city: body.city || null,
    country: body.country || null,
    category: body.category || "other",
    organizer: body.organizer || null,
    description: body.description || null,
    url: body.url || null,
    status: "pending",
  };

  const response = await fetch(`${url}/rest/v1/pro_events`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    return NextResponse.json(
      { error: "Impossible d’enregistrer l’événement." },
      { status: 502 }
    );
  }

  return NextResponse.json({ event: (await response.json())?.[0] }, { status: 201 });
}
