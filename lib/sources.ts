import type { AppEvent, EventCategory, SourceStatus } from "./types";

const REQUEST_TIMEOUT = 7000;

type OfficialSource = {
  id: string;
  name: string;
  url: string;
  category: EventCategory;
  keywords: string[];
};

const OFFICIAL_SOURCES: OfficialSource[] = [
  {
    id: "redbull",
    name: "Red Bull Events",
    url: "https://www.redbull.com/int-en/events",
    category: "brand",
    keywords: ["red bull", "redbull"],
  },
  {
    id: "formula1",
    name: "Formula 1",
    url: `https://www.formula1.com/en/racing/${new Date().getFullYear()}`,
    category: "sport",
    keywords: ["f1", "formula 1", "formula one", "grand prix"],
  },
  {
    id: "psg",
    name: "Paris Saint-Germain",
    url: "https://www.psg.fr/en/mens-football/fixtures",
    category: "sport",
    keywords: ["psg", "paris saint germain", "paris saint-germain"],
  },
  {
    id: "barcelona",
    name: "FC Barcelona",
    url: "https://www.fcbarcelona.com/en/football/first-team/schedule",
    category: "sport",
    keywords: ["barcelona", "barcelone", "barça", "barca", "fc barcelona"],
  },
  {
    id: "mancity",
    name: "Manchester City",
    url: "https://www.mancity.com/fixtures",
    category: "sport",
    keywords: ["manchester city", "man city"],
  },
  {
    id: "liverpool",
    name: "Liverpool FC",
    url: "https://www.liverpoolfc.com/matches/mens-team/fixtures",
    category: "sport",
    keywords: ["liverpool", "lfc"],
  },
  {
    id: "uefa",
    name: "UEFA",
    url: "https://www.uefa.com/uefachampionsleague/fixtures-results/",
    category: "sport",
    keywords: ["uefa", "champions league", "ligue des champions", "ucl"],
  },
  {
    id: "ligue1",
    name: "Ligue 1",
    url: "https://ligue1.com/fr",
    category: "sport",
    keywords: ["ligue 1", "om", "olympique de marseille", "marseille", "monaco", "lyon", "lille", "lens"],
  },
  {
    id: "formulae",
    name: "Formula E",
    url: "https://www.fiaformulae.com/en/calendar",
    category: "sport",
    keywords: ["formula e", "formule e", "fia formula e", "e-prix", "eprix"],
  },
  {
    id: "nba",
    name: "NBA",
    url: "https://www.nba.com/schedule?cal=all&pd=false",
    category: "sport",
    keywords: ["nba", "basketball", "lakers", "celtics", "warriors", "knicks", "bulls", "spurs", "mavericks"],
  },
  {
    id: "nhl",
    name: "NHL",
    url: "https://www.nhl.com/schedule",
    category: "sport",
    keywords: ["nhl", "hockey", "canadiens", "maple leafs", "bruins", "rangers", "oilers"],
  },
  {
    id: "ufc",
    name: "UFC",
    url: "https://www.ufc.com/events",
    category: "sport",
    keywords: ["ufc", "mma", "fight night"],
  },
];

const MONTHS: Record<string, number> = {
  jan: 0, january: 0, janvier: 0,
  feb: 1, february: 1, fevrier: 1, février: 1,
  mar: 2, march: 2, mars: 2,
  apr: 3, april: 3, avril: 3,
  may: 4, mai: 4,
  jun: 5, june: 5, juin: 5,
  jul: 6, july: 6, juillet: 6,
  aug: 7, august: 7, aout: 7, août: 7,
  sep: 8, sept: 8, september: 8, septembre: 8,
  oct: 9, october: 9, octobre: 9,
  nov: 10, november: 10, novembre: 10,
  dec: 11, december: 11, decembre: 11, décembre: 11,
};

function clean(value: string) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function matchesQuery(query: string, source: OfficialSource) {
  if (!query) return source.id === "redbull" || source.id === "formula1";
  const needle = normalize(query);
  return source.keywords.some((keyword) => {
    const candidate = normalize(keyword);
    return needle.includes(candidate) || candidate.includes(needle);
  });
}

async function fetchHtml(url: string) {
  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; ApplicationCalendar/0.3; +https://github.com/keany-albertini/application)",
      Accept: "text/html,application/xhtml+xml",
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT),
  });

  if (!response.ok) return "";
  return response.text();
}

function asText(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (value && typeof value === "object") {
    const candidate = value as Record<string, unknown>;
    return asText(candidate.name) || asText(candidate.addressLocality);
  }
  return undefined;
}

function walkJson(value: unknown, output: Record<string, unknown>[] = []) {
  if (!value) return output;
  if (Array.isArray(value)) {
    value.forEach((item) => walkJson(item, output));
    return output;
  }
  if (typeof value !== "object") return output;

  const object = value as Record<string, unknown>;
  const type = object["@type"];
  const types = Array.isArray(type) ? type.map(String) : [String(type ?? "")];

  if (types.some((item) => /event/i.test(item))) {
    output.push(object);
  }

  Object.values(object).forEach((item) => walkJson(item, output));
  return output;
}

function extractJsonLdEvents(
  html: string,
  source: OfficialSource
): AppEvent[] {
  const scripts = html.match(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi
  ) ?? [];

  const events: AppEvent[] = [];

  scripts.forEach((script, scriptIndex) => {
    const json = script
      .replace(/^<script[^>]*>/i, "")
      .replace(/<\/script>$/i, "")
      .trim();

    try {
      const parsed = JSON.parse(json);
      const candidates = walkJson(parsed);

      candidates.forEach((event, index) => {
        const start = asText(event.startDate);
        const title = asText(event.name);
        if (!start || !title) return;

        const location =
          event.location && typeof event.location === "object"
            ? (event.location as Record<string, unknown>)
            : undefined;
        const address =
          location?.address && typeof location.address === "object"
            ? (location.address as Record<string, unknown>)
            : undefined;

        events.push({
          id: `official-${source.id}-${scriptIndex}-${index}-${start}`,
          title,
          start,
          end: asText(event.endDate),
          venue: asText(location?.name),
          city: asText(address?.addressLocality),
          country: asText(address?.addressCountry),
          category: source.category,
          source: source.name,
          sourceUrl: source.url,
          official: true,
          url: asText(event.url) || source.url,
          image:
            Array.isArray(event.image)
              ? asText(event.image[0])
              : asText(event.image),
          entity: source.name,
          description: asText(event.description),
        });
      });
    } catch {
      // Ignore malformed structured data and continue with source-specific fallbacks.
    }
  });

  return events;
}

function parseDate(day: string, month: string, year: string, time?: string) {
  const monthNumber = MONTHS[normalize(month)];
  if (monthNumber === undefined) return undefined;

  const date = new Date(
    Number(year),
    monthNumber,
    Number(day),
    time ? Number(time.slice(0, 2)) : 12,
    time ? Number(time.slice(3, 5)) : 0
  );

  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function extractBarcelonaFallback(html: string): AppEvent[] {
  const text = clean(html);
  const yearBase = new Date().getFullYear();
  const pattern =
    /(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(?:(\d{2}:\d{2})|KO:\s*TBA)\s+(?:Matchday\s+\d+\s+|Final\s+)?(.{0,90}?)([A-ZÀ-ÖØ-Ý][A-Za-zÀ-ÿ0-9 .'-]{2,45}\s+vs\.\s+[A-ZÀ-ÖØ-Ý][A-Za-zÀ-ÿ0-9 .'-]{2,45})(?=\s+(?:Tickets|Groups|Date and time|Mon|Tue|Wed|Thu|Fri|Sat|Sun|January|February|March|April|May|June|July|August|September|October|November|December))/g;

  const results: AppEvent[] = [];
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) && results.length < 60) {
    const [, day, month, time, venueChunk, title] = match;
    let year = yearBase;
    const monthNumber = MONTHS[normalize(month)] ?? 0;
    if (monthNumber < new Date().getMonth() - 4) year += 1;
    const start = parseDate(day, month, String(year), time);
    if (!start) continue;

    results.push({
      id: `official-barcelona-${start}-${results.length}`,
      title: title.replace(/\s+/g, " ").trim(),
      start,
      venue: venueChunk.replace(/Matchday\s+\d+/i, "").trim() || undefined,
      category: "sport",
      source: "FC Barcelona",
      sourceUrl: "https://www.fcbarcelona.com/en/football/first-team/schedule",
      official: true,
      url: "https://www.fcbarcelona.com/en/football/first-team/schedule",
      entity: "FC Barcelona",
    });
  }

  return results;
}

function extractPsgFallback(html: string): AppEvent[] {
  const text = clean(html);
  const pattern =
    /([A-ZÀ-ÖØ-Ý][A-Za-zÀ-ÿ0-9 .'-]{2,55}\s+vs\s+[A-ZÀ-ÖØ-Ý][A-Za-zÀ-ÿ0-9 .'-]{2,55})\s+-\s+(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})(?:\s+-\s+(\d{2}:\d{2}))?/g;

  const results: AppEvent[] = [];
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) && results.length < 60) {
    const [, title, day, month, year, time] = match;
    const start = parseDate(day, month, year, time);
    if (!start) continue;

    results.push({
      id: `official-psg-${start}-${results.length}`,
      title: title.trim(),
      start,
      category: "sport",
      source: "Paris Saint-Germain",
      sourceUrl: "https://www.psg.fr/en/mens-football/fixtures",
      official: true,
      url: "https://www.psg.fr/en/mens-football/fixtures",
      entity: "Paris Saint-Germain",
    });
  }

  return results;
}

const F1_2026_REMAINING: Array<[string, string, string]> = [
  ["2026-09-26T12:00:00Z", "Formula 1 Azerbaijan Grand Prix", "Baku"],
  ["2026-10-04T12:00:00Z", "Formula 1 Bahrain Grand Prix", "Bahrain"],
  ["2026-10-11T12:00:00Z", "Formula 1 Singapore Grand Prix", "Singapore"],
  ["2026-10-25T12:00:00Z", "Formula 1 United States Grand Prix", "Austin"],
  ["2026-11-01T12:00:00Z", "Formula 1 Mexico City Grand Prix", "Mexico City"],
  ["2026-11-08T12:00:00Z", "Formula 1 São Paulo Grand Prix", "São Paulo"],
  ["2026-11-21T12:00:00Z", "Formula 1 Las Vegas Grand Prix", "Las Vegas"],
  ["2026-11-29T12:00:00Z", "Formula 1 Qatar Grand Prix", "Lusail"],
  ["2026-12-06T12:00:00Z", "Formula 1 Abu Dhabi Grand Prix", "Abu Dhabi"],
];


function extractFormulaEFallback(html: string): AppEvent[] {
  const text = clean(html);
  const pattern = /R(\d{2})\s*[·-]\s*(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})/g;
  const results: AppEvent[] = [];
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) && results.length < 40) {
    const [full, round, day, month, year] = match;
    const before = text.slice(Math.max(0, match.index - 80), match.index);
    const cityMatch = before.match(/([A-ZÀ-ÖØ-Ý][A-Za-zÀ-ÿ .'-]{2,35})\s*$/);
    const city = cityMatch?.[1]?.trim() || "Formula E";
    const start = parseDate(day, month, year);
    if (!start) continue;

    results.push({
      id: `official-formulae-${year}-${round}`,
      title: `Formula E — ${city} E-Prix`,
      start,
      city: city === "Formula E" ? undefined : city,
      category: "sport",
      source: "Formula E",
      sourceUrl: "https://www.fiaformulae.com/en/calendar",
      official: true,
      url: "https://www.fiaformulae.com/en/calendar",
      entity: "Formula E",
      description: `Round ${Number(round)} · Calendrier officiel Formula E`,
    });
  }

  return dedupe(results);
}

function parseEmbeddedJsonScripts(html: string) {
  const scripts = html.match(/<script[^>]*>[\s\S]*?<\/script>/gi) ?? [];
  const parsed: unknown[] = [];

  for (const script of scripts) {
    const body = script
      .replace(/^<script[^>]*>/i, "")
      .replace(/<\/script>$/i, "")
      .trim();

    if (!body || (!body.startsWith("{") && !body.startsWith("["))) continue;
    try {
      parsed.push(JSON.parse(body));
    } catch {}
  }

  return parsed;
}

function walkObjects(value: unknown, out: Record<string, any>[] = []) {
  if (!value) return out;
  if (Array.isArray(value)) {
    value.forEach((item) => walkObjects(item, out));
    return out;
  }
  if (typeof value !== "object") return out;
  const object = value as Record<string, any>;
  out.push(object);
  Object.values(object).forEach((item) => walkObjects(item, out));
  return out;
}

function extractNbaFallback(html: string): AppEvent[] {
  const results: AppEvent[] = [];

  for (const root of parseEmbeddedJsonScripts(html)) {
    for (const row of walkObjects(root)) {
      const home = row.homeTeam;
      const away = row.awayTeam;
      const start =
        row.gameDateTimeUTC ||
        row.gameDateTimeEst ||
        row.gameDateTime ||
        row.gameDateUTC;

      if (!start || !home || !away) continue;

      const homeName =
        home.teamName ||
        [home.teamCity, home.teamName].filter(Boolean).join(" ") ||
        home.teamTricode;
      const awayName =
        away.teamName ||
        [away.teamCity, away.teamName].filter(Boolean).join(" ") ||
        away.teamTricode;

      if (!homeName || !awayName) continue;

      results.push({
        id: `official-nba-${row.gameId || results.length}-${String(start)}`,
        title: `${awayName} @ ${homeName}`,
        start: String(start),
        venue: row.arenaName || row.arena?.arenaName,
        city: row.arenaCity || row.arena?.arenaCity,
        category: "sport",
        source: "NBA",
        sourceUrl: "https://www.nba.com/schedule?cal=all&pd=false",
        official: true,
        url: "https://www.nba.com/schedule?cal=all&pd=false",
        entity: "NBA",
        description: row.gameLabel || row.gameSubtype || "NBA",
      });
    }
  }

  return dedupe(results);
}

function extractNhlFallback(html: string): AppEvent[] {
  const results: AppEvent[] = [];

  for (const root of parseEmbeddedJsonScripts(html)) {
    for (const row of walkObjects(root)) {
      const home = row.homeTeam;
      const away = row.awayTeam;
      const start = row.startTimeUTC || row.startTimeUtc;
      if (!start || !home || !away) continue;

      const homeName = home.name?.default || home.commonName?.default || home.abbrev;
      const awayName = away.name?.default || away.commonName?.default || away.abbrev;
      if (!homeName || !awayName) continue;

      results.push({
        id: `official-nhl-${row.id || results.length}-${String(start)}`,
        title: `${awayName} @ ${homeName}`,
        start: String(start),
        venue: row.venue?.default,
        category: "sport",
        source: "NHL",
        sourceUrl: "https://www.nhl.com/schedule",
        official: true,
        url: row.gameCenterLink
          ? `https://www.nhl.com${row.gameCenterLink}`
          : "https://www.nhl.com/schedule",
        entity: "NHL",
        description: row.gameType ? `NHL · type ${row.gameType}` : "NHL",
      });
    }
  }

  return dedupe(results);
}

function f1Fallback(): AppEvent[] {
  if (new Date().getFullYear() !== 2026) return [];

  return F1_2026_REMAINING.map(([start, title, city], index) => ({
    id: `official-formula1-2026-${index}`,
    title,
    start,
    city,
    category: "sport",
    source: "Formula 1",
    sourceUrl: "https://www.formula1.com/en/racing/2026",
    official: true,
    url: "https://www.formula1.com/en/racing/2026",
    entity: "Formula 1",
    description: "Calendrier officiel Formula 1 2026.",
  }));
}

function dedupe(events: AppEvent[]) {
  const seen = new Set<string>();
  return events.filter((event) => {
    const key = `${normalize(event.title)}|${event.start.slice(0, 10)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function fetchOneOfficialSource(source: OfficialSource) {
  try {
    const html = await fetchHtml(source.url);
    if (!html) return [];

    let events = extractJsonLdEvents(html, source);

    if (!events.length && source.id === "barcelona") {
      events = extractBarcelonaFallback(html);
    }

    if (!events.length && source.id === "psg") {
      events = extractPsgFallback(html);
    }

    if (!events.length && source.id === "formula1") {
      events = f1Fallback();
    }

    if (!events.length && source.id === "formulae") {
      events = extractFormulaEFallback(html);
    }

    if (!events.length && source.id === "nba") {
      events = extractNbaFallback(html);
    }

    if (!events.length && source.id === "nhl") {
      events = extractNhlFallback(html);
    }

    return events;
  } catch {
    return source.id === "formula1" ? f1Fallback() : [];
  }
}

export async function fetchOfficialWebEvents(query: string) {
  const selected = OFFICIAL_SOURCES.filter((source) =>
    matchesQuery(query, source)
  );

  const batches = await Promise.all(selected.map(fetchOneOfficialSource));
  return dedupe(batches.flat());
}

export async function fetchParisOpenData(query: string): Promise<AppEvent[]> {
  const params = new URLSearchParams({
    limit: "80",
    order_by: "date_start",
    where: "date_end >= now()",
  });

  try {
    const response = await fetch(
      `https://opendata.paris.fr/api/explore/v2.1/catalog/datasets/que-faire-a-paris-/records?${params.toString()}`,
      {
        cache: "no-store",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT),
      }
    );

    if (!response.ok) return [];
    const payload = await response.json();

    const events = (payload?.results ?? []).map((row: any): AppEvent => ({
      id: `paris-${row.id || row.event_id || row.recordid || row.title}`,
      title: row.title || "Événement à Paris",
      start: row.date_start || row.date_start_new || row.date_begin,
      end: row.date_end || row.date_end_new,
      venue: row.address_name || row.location_name,
      city: row.address_city || "Paris",
      country: "France",
      category:
        String(row.tags ?? row.category ?? "").toLowerCase().includes("concert")
          ? "music"
          : "culture",
      source: "Ville de Paris Open Data",
      sourceUrl:
        "https://opendata.paris.fr/explore/dataset/que-faire-a-paris-/",
      official: true,
      url: row.url || row.event_url,
      image: row.cover_url || row.cover,
      entity: row.address_name || "Ville de Paris",
      description: row.lead_text || row.description,
    }));

    if (!query) return events.filter((event: AppEvent) => event.start);

    const needle = normalize(query);
    return events.filter((event: AppEvent) => {
      const haystack = normalize(
        [event.title, event.venue, event.city, event.description]
          .filter(Boolean)
          .join(" ")
      );
      return event.start && haystack.includes(needle);
    });
  } catch {
    return [];
  }
}

export async function fetchOpenAgenda(query: string): Promise<AppEvent[]> {
  const key = process.env.OPENAGENDA_API_KEY;
  if (!key) return [];

  try {
    const params = new URLSearchParams({
      size: "80",
    });
    params.append("relative[]", "current");
    params.append("relative[]", "upcoming");

    const response = await fetch(
      `https://api.openagenda.com/v2/events?${params.toString()}`,
      {
        headers: { key },
        cache: "no-store",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT),
      }
    );

    if (!response.ok) return [];
    const payload = await response.json();
    const rows = payload?.events ?? [];

    return rows
      .map((row: any): AppEvent | null => {
        const firstTiming = row?.timings?.[0];
        const title =
          typeof row.title === "string"
            ? row.title
            : row.title?.fr || row.title?.en;

        if (!title || !firstTiming?.begin) return null;

        return {
          id: `openagenda-${row.uid}`,
          title,
          start: firstTiming.begin,
          end: firstTiming.end,
          venue: row.location?.name,
          city: row.location?.city,
          country: row.location?.countryCode || "France",
          category: "culture",
          source: "OpenAgenda",
          sourceUrl: "https://openagenda.com",
          official: Boolean(row?.agenda?.official),
          url: row.canonicalUrl || row.registrationUrl,
          image: row.image?.base,
          entity: row?.agenda?.title,
          description:
            typeof row.description === "string"
              ? row.description
              : row.description?.fr || row.description?.en,
        };
      })
      .filter((event: AppEvent | null): event is AppEvent => Boolean(event))
      .filter((event: AppEvent) => {
        if (!query) return true;
        return normalize(
          [event.title, event.venue, event.city, event.description]
            .filter(Boolean)
            .join(" ")
        ).includes(normalize(query));
      }) as AppEvent[];
  } catch {
    return [];
  }
}

export async function fetchDataTourisme(query: string): Promise<AppEvent[]> {
  const apiKey = process.env.DATATOURISME_API_KEY;
  if (!apiKey) return [];

  try {
    const params = new URLSearchParams({
      page_size: "100",
      lang: "fr",
      sort: "lastUpdate[desc]",
    });
    if (query) params.set("search", query);

    const response = await fetch(
      `https://api.datatourisme.fr/v1/entertainmentAndEvent?${params.toString()}`,
      {
        headers: { "X-API-Key": apiKey },
        cache: "no-store",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT),
      }
    );

    if (!response.ok) return [];
    const payload = await response.json();

    return (payload?.objects ?? [])
      .map((row: any): AppEvent | null => {
        const title =
          row.name?.fr ||
          row.name?.en ||
          row.name ||
          row.label?.fr ||
          row.label;
        const period =
          row.periods?.[0] ||
          row.openingDetails?.periods?.[0] ||
          row.openingPeriods?.[0];
        const start =
          row.startDate ||
          period?.startDate ||
          period?.start ||
          row.temporalCoverage?.startDate;
        const end =
          row.endDate ||
          period?.endDate ||
          period?.end ||
          row.temporalCoverage?.endDate;

        if (!title || !start) return null;

        const city =
          row.address?.city ||
          row.location?.address?.city ||
          row.city ||
          row.inseePlace?.label?.fr;
        const venue =
          row.location?.name?.fr ||
          row.location?.name ||
          row.place?.name?.fr;
        const url =
          row.contact?.website ||
          row.website ||
          row.uri ||
          row["@id"];

        return {
          id: `datatourisme-${row.uuid || row.id || row["@id"] || resultsSafeId(title, start)}`,
          title: String(title),
          start: String(start).length === 10 ? `${start}T12:00:00` : String(start),
          end: end ? String(end) : undefined,
          venue: venue ? String(venue) : undefined,
          city: city ? String(city) : undefined,
          country: "France",
          category: "culture",
          source: "DATAtourisme",
          sourceUrl: "https://www.datatourisme.fr/",
          official: true,
          url: url ? String(url) : "https://explore.datatourisme.fr",
          entity: "DATAtourisme",
          description:
            row.description?.fr ||
            row.description?.en ||
            row.description ||
            row.shortDescription?.fr,
        };
      })
      .filter((event: AppEvent | null): event is AppEvent => Boolean(event));
  } catch {
    return [];
  }
}

function resultsSafeId(title: unknown, start: unknown) {
  return normalize(`${String(title)}-${String(start)}`).replace(/\s+/g, "-");
}

export function getSourceCatalog(active: Record<string, boolean>): SourceStatus[] {
  return [
    ...OFFICIAL_SOURCES.map((source) => ({
      id: source.id,
      name: source.name,
      kind: "official" as const,
      active: Boolean(active[source.id]),
      url: source.url,
      note: "Source officielle publique",
    })),
    {
      id: "paris-open-data",
      name: "Ville de Paris Open Data",
      kind: "open-data",
      active: Boolean(active["paris-open-data"]),
      url: "https://opendata.paris.fr",
      note: "Agenda officiel open data",
    },
    {
      id: "thesportsdb",
      name: "TheSportsDB",
      kind: "community",
      active: Boolean(active.thesportsdb),
      url: "https://www.thesportsdb.com",
      note: "Source sportive gratuite de secours",
    },
    {
      id: "openagenda",
      name: "OpenAgenda",
      kind: "optional",
      active: Boolean(active.openagenda),
      url: "https://openagenda.com",
      note: process.env.OPENAGENDA_API_KEY
        ? "API gratuite connectée"
        : "Clé gratuite optionnelle à ajouter",
    },
    {
      id: "datatourisme",
      name: "DATAtourisme",
      kind: "open-data",
      active: Boolean(active.datatourisme),
      url: "https://www.datatourisme.fr/",
      note: process.env.DATATOURISME_API_KEY
        ? "API nationale open data connectée"
        : "Clé API gratuite disponible sur demande",
    },
  ];
}
