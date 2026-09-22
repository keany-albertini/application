import { NextRequest, NextResponse } from "next/server";
import { demoEvents } from "@/lib/demo-events";
import type { AppEvent, EventCategory } from "@/lib/types";

export const dynamic = "force-dynamic";

function containsQuery(event: AppEvent, query: string) {
  if (!query) return true;
  const haystack = [
    event.title,
    event.entity,
    event.city,
    event.country,
    event.venue,
    event.category,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(query.toLowerCase());
}

function normalizeDate(date?: string, time?: string) {
  if (!date) return new Date().toISOString();
  if (time) return `${date}T${time}`;
  return `${date}T12:00:00`;
}

async function fetchTicketmaster(query: string): Promise<AppEvent[]> {
  const apiKey = process.env.TICKETMASTER_API_KEY;
  if (!apiKey) return [];

  const params = new URLSearchParams({
    apikey: apiKey,
    size: "40",
    sort: "date,asc",
  });
  if (query) params.set("keyword", query);

  const response = await fetch(
    `https://app.ticketmaster.com/discovery/v2/events.json?${params.toString()}`,
    { cache: "no-store" }
  );
  if (!response.ok) return [];

  const payload = await response.json();
  const items = payload?._embedded?.events ?? [];

  return items.map((item: any): AppEvent => {
    const segment = item?.classifications?.[0]?.segment?.name?.toLowerCase() ?? "";
    let category: EventCategory = "other";
    if (segment.includes("sport")) category = "sport";
    else if (segment.includes("music")) category = "music";
    else if (segment.includes("art")) category = "culture";

    const venue = item?._embedded?.venues?.[0];

    return {
      id: `ticketmaster-${item.id}`,
      title: item.name,
      start: normalizeDate(item?.dates?.start?.localDate, item?.dates?.start?.localTime),
      venue: venue?.name,
      city: venue?.city?.name,
      country: venue?.country?.name,
      category,
      source: "Ticketmaster",
      url: item.url,
      image: item?.images?.find((image: any) => image.ratio === "16_9")?.url ?? item?.images?.[0]?.url,
      entity: item?.promoter?.name ?? item?.name,
    };
  });
}

async function fetchSportsDb(query: string): Promise<AppEvent[]> {
  const apiKey = process.env.THESPORTSDB_API_KEY;
  if (!apiKey || !query) return [];

  const teamResponse = await fetch(
    `https://www.thesportsdb.com/api/v1/json/${apiKey}/searchteams.php?t=${encodeURIComponent(query)}`,
    { cache: "no-store" }
  );
  if (!teamResponse.ok) return [];

  const teamPayload = await teamResponse.json();
  const teams = (teamPayload?.teams ?? []).slice(0, 3);

  const batches = await Promise.all(
    teams.map(async (team: any) => {
      const response = await fetch(
        `https://www.thesportsdb.com/api/v1/json/${apiKey}/eventsnext.php?id=${team.idTeam}`,
        { cache: "no-store" }
      );
      if (!response.ok) return [];
      const payload = await response.json();

      return (payload?.events ?? []).map((item: any): AppEvent => ({
        id: `sportsdb-${item.idEvent}`,
        title: item.strEvent,
        start: normalizeDate(item.dateEvent, item.strTime),
        venue: item.strVenue || undefined,
        city: item.strCity || undefined,
        country: item.strCountry || undefined,
        category: "sport",
        source: "TheSportsDB",
        entity: team.strTeam,
        description: item.strLeague,
      }));
    })
  );

  return batches.flat();
}

async function fetchProfessionalEvents(query: string): Promise<AppEvent[]> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return [];

  const params = new URLSearchParams({
    select: "*",
    order: "start.asc",
    limit: "100",
  });

  const response = await fetch(`${url}/rest/v1/pro_events?${params.toString()}`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
    cache: "no-store",
  });

  if (!response.ok) return [];

  const rows = await response.json();
  return rows
    .map((row: any): AppEvent => ({
      id: `pro-${row.id}`,
      title: row.title,
      start: row.start,
      end: row.end ?? undefined,
      venue: row.venue ?? undefined,
      city: row.city ?? undefined,
      country: row.country ?? undefined,
      category: row.category ?? "other",
      source: "Professionnel",
      url: row.url ?? undefined,
      image: row.image ?? undefined,
      entity: row.organizer ?? undefined,
      description: row.description ?? undefined,
    }))
    .filter((event: AppEvent) => containsQuery(event, query));
}

function dedupe(events: AppEvent[]) {
  const seen = new Set<string>();
  return events.filter((event) => {
    const key = [
      event.title.toLowerCase().replace(/\s+/g, " ").trim(),
      event.start.slice(0, 10),
      event.city?.toLowerCase() ?? "",
    ].join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";

  const [ticketmaster, sports, professional] = await Promise.all([
    fetchTicketmaster(query),
    fetchSportsDb(query),
    fetchProfessionalEvents(query),
  ]);

  const live = [...ticketmaster, ...sports, ...professional];
  const fallback = demoEvents.filter((event) => containsQuery(event, query));
  const events = dedupe(live.length ? [...live, ...professional] : fallback).sort(
    (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
  );

  return NextResponse.json({
    events,
    mode: live.length ? "live" : "demo",
    sources: {
      ticketmaster: ticketmaster.length > 0,
      sports: sports.length > 0,
      professional: professional.length > 0,
    },
  });
}
