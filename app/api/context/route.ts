import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function decodeHeader(value: string | null) {
  if (!value) return undefined;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function GET(request: NextRequest) {
  const city = decodeHeader(request.headers.get("x-vercel-ip-city"));
  const region = decodeHeader(request.headers.get("x-vercel-ip-country-region"));
  const country = request.headers.get("x-vercel-ip-country") || undefined;
  const timezone =
    decodeHeader(request.headers.get("x-vercel-ip-timezone")) ||
    "Europe/Paris";
  const postalCode =
    decodeHeader(request.headers.get("x-vercel-ip-postal-code")) || undefined;

  return NextResponse.json(
    {
      city,
      region,
      country,
      timezone,
      postalCode,
      precise: false,
      source: city ? "vercel-ip" : "unknown",
    },
    {
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
      },
    }
  );
}
