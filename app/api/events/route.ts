import { NextRequest, NextResponse } from "next/server";
import { demoEvents } from "@/lib/demo-events";
import type { AppEvent } from "@/lib/types";

export const dynamic = "force-dynamic";

const SPORTS_API_KEY = process.env.THESPORTSDB_API_KEY || "123";

type CuratedTeam = {
  idTeam: string;
  strTeam: string;
  aliases: string[];
};

const CURATED_TEAMS: CuratedTeam[] = [
  {
    idTeam: "133707",
    strTeam: "Marseille",
    aliases: ["om", "olympique de marseille", "olympique marseille", "marseille"],
  },
  {
    idTeam: "133714",
    strTeam: "Paris Saint-Germain",
    aliases: ["psg", "paris sg", "paris saint germain", "paris saint-germain"],
  },
  {
    idTeam: "133738",
    strTeam: "Real Madrid",
    aliases: ["real", "real madrid"],
  },
  {
    idTeam: "133739",
    strTeam: "Barcelona",
    aliases: ["barca", "barça", "barcelona", "fc barcelona", "barcelone"],
  },
  {
    idTeam: "133613",
    strTeam: "Manchester City",
    aliases: ["man city", "manchester city", "city"],
  },
  {
    idTeam: "133602",
    strTeam: "Liverpool",
    aliases: ["liverpool", "lfc"],
  },
  {
    idTeam: "133604",
    strTeam: "Arsenal",
    aliases: ["arsenal", "afc"],
  },
];

function normalizeSearch(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function containsQuery(event: AppEvent, query: string) {
  if (!query) return true;

  const needle = normalizeSearch(query);
  const haystack = normalizeSearch(
    [
      event.title,
      event.entity,
      event.city,
      event.country,
      event.venue,
      event.category,
      event.description,
    ]
      .filter(Boolean)
      .join(" ")
  );

  return haystack.includes(needle);
}

function normalizeDate(date?: string, time?: string) {
  if (!date) return new Date().toISOString();
  const safeTime = time && /^\d{2}:\d{2}/.test(time) ? time : "12:00:00";
  return `${date}T${safeTime}`;
}

function findCuratedTeams(query: string) {
  const needle = normalizeSearch(query);

  if (!needle) {
    return CURATED_TEAMS.slice(0, 6);
  }

  return CURATED_TEAMS.filter((team) => {
    const names = [team.strTeam, ...team.aliases].map(normalizeSearch);
    return names.some(
      (name) => name === needle || name.includes(needle) || needle.includes(name)
    );
  }).slice(0, 3);
}

async function nextEventsForTeam(team: CuratedTeam): Promise<AppEvent[]> {
  try {
    const response = await fetch(
      `https://www.thesportsdb.com/api/v1/json/${SPORTS_API_KEY}/eventsnext.php?id=${team.idTeam}`,
      {
        cache: "no-store",
        signal: AbortSignal.timeout(6500),
      }
    );

    if (!response.ok) return [];
    const payload = await response.json();

    return (payload?.events ?? []).map((item: any): AppEvent => ({
      id: `sportsdb-${item.idEvent}`,
      title: item.strEvent || `${item.strHomeTeam} - ${item.strAwayTeam}`,
      start: normalizeDate(item.dateEvent, item.strTime),
      venue: item.strVenue || undefined,
      city: item.strCity || undefined,
      country: item.strCountry || undefined,
      category: "sport",
      source: "TheSportsDB",
      entity: team.strTeam,
      description: [item.strLeague, item.strSeason].filter(Boolean).join(" · "),
      image:
        item.strThumb ||
        item.strPoster ||
        item.strHomeTeamBadge ||
        item.strAwayTeamBadge ||
        undefined,
    }));
  } catch {
    return [];
  }
}

async function fallbackArsenalSearch(query: string): Promise<AppEvent[]> {
  if (normalizeSearch(query) !== "arsenal") return [];

  try {
    const response = await fetch(
      `https://www.thesportsdb.com/api/v1/json/${SPORTS_API_KEY}/searchteams.php?t=Arsenal`,
      {
        cache: "no-store",
        signal: AbortSignal.timeout(6500),
      }
    );

    if (!response.ok) return [];

    const payload = await response.json();
    const team = payload?.teams?.[0];

    if (!team?.idTeam) return [];

    return nextEventsForTeam({
      idTeam: team.idTeam,
      strTeam: team.strTeam || "Arsenal",
      aliases: ["arsenal"],
    });
  } catch {
    return [];
  }
}

async function fetchSportsDb(query: string): Promise<AppEvent[]> {
  const teams = findCuratedTeams(query);

  if (teams.length > 0) {
    const batches = await Promise.all(teams.map(nextEventsForTeam));
    return batches.flat();
  }

  return fallbackArsenalSearch(query);
}

async function fetchProfessionalEvents(query: string): Promise<AppEvent[]> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) return [];

  try {
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
      signal: AbortSignal.timeout(6500),
    });

    if (!response.ok) return [];

    const rows = await response.json();

    return rows
      .filter((row: any) => row.status === "approved" || !row.status)
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
  } catch {
    return [];
  }
}

function dedupe(events: AppEvent[]) {
  const seen = new Set<string>();

  return events.filter((event) => {
    const key = [
      normalizeSearch(event.title),
      event.start.slice(0, 10),
      normalizeSearch(event.city ?? ""),
    ].join("|");

    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function futureOnly(events: AppEvent[]) {
  const yesterday = Date.now() - 24 * 60 * 60 * 1000;

  return events.filter((event) => {
    const value = new Date(event.start).getTime();
    return Number.isNaN(value) || value >= yesterday;
  });
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";

  const [sports, professional] = await Promise.all([
    fetchSportsDb(query),
    fetchProfessionalEvents(query),
  ]);

  const live = futureOnly(dedupe([...sports, ...professional])).sort(
    (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
  );

  const fallback = futureOnly(
    demoEvents.filter((event) => containsQuery(event, query))
  ).sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

  return NextResponse.json({
    events: live.length ? live : fallback,
    mode: live.length ? "live" : "demo",
    sources: {
      sports: sports.length > 0,
      professional: professional.length > 0,
    },
    sportsProvider: "TheSportsDB",
  });
}
