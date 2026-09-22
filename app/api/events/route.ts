import { NextRequest, NextResponse } from "next/server";
import { demoEvents } from "@/lib/demo-events";
import {
  fetchDataTourisme,
  fetchOfficialWebEvents,
  fetchOpenAgenda,
  fetchParisOpenData,
  getSourceCatalog,
} from "@/lib/sources";
import {
  eventMatchesDate,
  fetchUniversalWebEvents,
  parseSearchIntent,
  universalWebProvider,
} from "@/lib/universal-search";
import type { AppEvent, VerificationLevel } from "@/lib/types";

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
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function containsQuery(event: AppEvent, query: string) {
  if (!query) return true;

  const words = normalizeSearch(query)
    .split(" ")
    .filter((word) => word.length > 1);

  if (!words.length) return true;

  const haystack = normalizeSearch(
    [
      event.title,
      event.entity,
      event.city,
      event.country,
      event.venue,
      event.category,
      event.description,
      event.source,
    ]
      .filter(Boolean)
      .join(" ")
  );

  return words.every((word) => haystack.includes(word));
}

function normalizeDate(date?: string, time?: string) {
  if (!date) return new Date().toISOString();
  const safeTime = time && /^\d{2}:\d{2}/.test(time) ? time : "12:00:00";
  return `${date}T${safeTime}`;
}

function findCuratedTeams(query: string) {
  const needle = normalizeSearch(query);

  if (!needle) return CURATED_TEAMS.slice(0, 6);

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
      sourceUrl: "https://www.thesportsdb.com",
      official: false,
      verification: "community",
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

async function searchSportsDbTeams(query: string): Promise<CuratedTeam[]> {
  if (!query) return [];

  try {
    const response = await fetch(
      `https://www.thesportsdb.com/api/v1/json/${SPORTS_API_KEY}/searchteams.php?t=${encodeURIComponent(query)}`,
      {
        cache: "no-store",
        signal: AbortSignal.timeout(6500),
      }
    );

    if (!response.ok) return [];
    const payload = await response.json();

    return (payload?.teams ?? []).slice(0, 3).map((team: any) => ({
      idTeam: String(team.idTeam),
      strTeam: String(team.strTeam),
      aliases: [String(team.strTeam)],
    }));
  } catch {
    return [];
  }
}

async function fetchSportsDb(query: string): Promise<AppEvent[]> {
  let teams = findCuratedTeams(query);

  if (!teams.length && query) {
    teams = await searchSportsDbTeams(query);
  }

  if (!teams.length) return [];

  const batches = await Promise.all(teams.map(nextEventsForTeam));
  return batches.flat();
}

async function fetchProfessionalEvents(query: string): Promise<AppEvent[]> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return [];

  try {
    const params = new URLSearchParams({
      select: "*",
      order: "start.asc",
      limit: "150",
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
        source: "Professionnel vérifié",
        sourceUrl: row.url ?? undefined,
        official: false,
        verification: "professional",
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

function verificationRank(level?: VerificationLevel) {
  switch (level) {
    case "official":
      return 5;
    case "institutional":
      return 4;
    case "professional":
      return 3;
    case "verified-web":
      return 2;
    case "community":
      return 1;
    default:
      return 0;
  }
}

function dedupe(events: AppEvent[]) {
  const winners = new Map<string, AppEvent>();

  for (const event of events) {
    if (!event?.title || !event?.start) continue;

    const key = [
      normalizeSearch(event.title),
      event.start.slice(0, 10),
      normalizeSearch(event.city ?? ""),
    ].join("|");

    const current = winners.get(key);
    if (
      !current ||
      verificationRank(event.verification) >
        verificationRank(current.verification)
    ) {
      winners.set(key, event);
    }
  }

  return [...winners.values()];
}

function futureOnly(events: AppEvent[]) {
  const yesterday = Date.now() - 24 * 60 * 60 * 1000;

  return events.filter((event) => {
    const value = new Date(event.start).getTime();
    return Number.isNaN(value) || value >= yesterday;
  });
}

function sourceActivation(events: AppEvent[]) {
  const names = new Set(events.map((event) => normalizeSearch(event.source)));

  return {
    redbull: names.has("red bull events"),
    formula1: names.has("formula 1"),
    psg: names.has("paris saint germain"),
    barcelona: names.has("fc barcelona"),
    mancity: names.has("manchester city"),
    liverpool: names.has("liverpool fc"),
    uefa: names.has("uefa"),
    ligue1: names.has("ligue 1"),
    formulae: names.has("formula e"),
    nba: names.has("nba"),
    nhl: names.has("nhl"),
    ufc: names.has("ufc"),
    "paris-open-data": names.has("ville de paris open data"),
    thesportsdb: names.has("thesportsdb"),
    openagenda: [...names].some((name) => name.includes("openagenda")),
    datatourisme: names.has("datatourisme"),
    "tavily-search":
      universalWebProvider()?.startsWith("Tavily") === true &&
      events.some((event) => event.id.startsWith("web-")),
    "brave-search":
      universalWebProvider() === "Brave Search" &&
      events.some((event) => event.id.startsWith("web-")),
  };
}

export async function GET(request: NextRequest) {
  const rawQuery = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  const date = request.nextUrl.searchParams.get("date")?.trim() || undefined;
  const timezone =
    request.nextUrl.searchParams.get("tz")?.trim() || "Europe/Paris";

  const intent = parseSearchIntent(rawQuery, date, timezone);
  const query = intent.text;

  const [
    official,
    sports,
    paris,
    openAgenda,
    dataTourisme,
    professional,
    universalWeb,
  ] = await Promise.all([
    fetchOfficialWebEvents(query),
    fetchSportsDb(query),
    fetchParisOpenData(query),
    fetchOpenAgenda(query, intent.targetDate),
    fetchDataTourisme(query, intent.targetDate),
    fetchProfessionalEvents(query),
    fetchUniversalWebEvents(intent),
  ]);

  let liveEvents = futureOnly(
    dedupe([
      ...official.map((event) => ({
        ...event,
        verification: event.verification ?? ("official" as const),
      })),
      ...professional,
      ...paris.map((event) => ({
        ...event,
        verification: event.verification ?? ("institutional" as const),
      })),
      ...openAgenda,
      ...dataTourisme,
      ...universalWeb,
      ...sports,
    ])
  );

  if (intent.targetDate) {
    liveEvents = liveEvents.filter((event) =>
      eventMatchesDate(event, intent.targetDate, intent.timezone)
    );
  }

  liveEvents.sort((a, b) => {
    const verificationDelta =
      verificationRank(b.verification) - verificationRank(a.verification);

    if (intent.targetDate && verificationDelta !== 0) {
      return verificationDelta;
    }

    return new Date(a.start).getTime() - new Date(b.start).getTime();
  });

  let fallback = futureOnly(
    demoEvents.filter((event) => containsQuery(event, query))
  );

  if (intent.targetDate) {
    fallback = fallback.filter((event) =>
      eventMatchesDate(event, intent.targetDate, intent.timezone)
    );
  }

  fallback.sort(
    (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
  );

  const events = liveEvents.length ? liveEvents : fallback;
  const activation = sourceActivation(liveEvents);

  return NextResponse.json({
    events,
    mode: liveEvents.length ? "live" : "demo",
    intent,
    sources: activation,
    sourceCatalog: getSourceCatalog(activation),
    coverage: {
      official: official.length,
      professional: professional.length,
      openData: paris.length + openAgenda.length + dataTourisme.length,
      universalWeb: universalWeb.length,
      sportsBackup: sports.length,
    },
    universalSearch: {
      enabled: true,
      webDiscoveryConfigured: true,
      webProvider: universalWebProvider(),
      webDiscoveryMode: process.env.TAVILY_API_KEY
        ? "tavily-key"
        : process.env.BRAVE_SEARCH_API_KEY
          ? "brave-key"
          : "tavily-keyless",
      openAgendaConfigured: Boolean(process.env.OPENAGENDA_API_KEY),
      dataTourismeConfigured: Boolean(process.env.DATATOURISME_API_KEY),
    },
  });
}
