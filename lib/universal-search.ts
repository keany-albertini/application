import { tavily } from "@tavily/core";
import type {
  AppEvent,
  EventCategory,
  SearchIntent,
  VerificationLevel,
} from "./types";

const BRAVE_ENDPOINT = "https://api.search.brave.com/res/v1/web/search";
const REQUEST_TIMEOUT = 6500;

const BRAND_DOMAINS: Array<[string, string]> = [
  ["nike", "nike.com"],
  ["adidas", "adidas.com"],
  ["puma", "puma.com"],
  ["red bull", "redbull.com"],
  ["apple", "apple.com"],
  ["samsung", "samsung.com"],
  ["sony", "sony.com"],
  ["playstation", "playstation.com"],
  ["xbox", "xbox.com"],
  ["microsoft", "microsoft.com"],
  ["nintendo", "nintendo.com"],
  ["lego", "lego.com"],
  ["ikea", "ikea.com"],
  ["decathlon", "decathlon.com"],
  ["under armour", "underarmour.com"],
  ["new balance", "newbalance.com"],
  ["asics", "asics.com"],
  ["reebok", "reebok.com"],
  ["coca cola", "coca-cola.com"],
  ["pepsi", "pepsi.com"],
];

function preferredOfficialDomains(searchText: string) {
  const query = normalize(searchText);
  return BRAND_DOMAINS
    .filter(([brand]) => query.includes(normalize(brand)))
    .map(([, domain]) => domain)
    .slice(0, 3);
}

const TRUSTED_OFFICIAL_HOSTS = new Set([
  "redbull.com",
  "formula1.com",
  "fiaformulae.com",
  "psg.fr",
  "fcbarcelona.com",
  "mancity.com",
  "liverpoolfc.com",
  "uefa.com",
  "ligue1.com",
  "nba.com",
  "nhl.com",
  "ufc.com",
  "ol.fr",
  "om.fr",
  "fff.fr",
  "fft.fr",
  "fftt.com",
  "nike.com",
  "adidas.com",
  "puma.com",
  "underarmour.com",
  "apple.com",
  "google.com",
  "microsoft.com",
  "playstation.com",
  "xbox.com",
  "nintendo.com",
]);

const INSTITUTIONAL_SUFFIXES = [
  ".gouv.fr",
  ".gov",
  ".gov.uk",
  ".europa.eu",
  ".paris.fr",
  ".marseille.fr",
  ".lyon.fr",
  ".bordeaux.fr",
];

type SearchCandidate = {
  title: string;
  description: string;
  url: string;
};

const EVENT_WORDS = [
  "event",
  "events",
  "événement",
  "evenement",
  "agenda",
  "calendar",
  "calendrier",
  "schedule",
  "programme",
  "program",
  "festival",
  "tournament",
  "tournoi",
  "match",
  "concert",
  "race",
  "grand prix",
  "conference",
  "salon",
  "exhibition",
];

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function dateInTimeZone(date: Date, timeZone: string) {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);

    const year = parts.find((part) => part.type === "year")?.value;
    const month = parts.find((part) => part.type === "month")?.value;
    const day = parts.find((part) => part.type === "day")?.value;

    if (year && month && day) return `${year}-${month}-${day}`;
  } catch {}

  return date.toISOString().slice(0, 10);
}

function addDaysToLocalDate(localDate: string, days: number) {
  const [year, month, day] = localDate.split("-").map(Number);
  const value = new Date(Date.UTC(year, month - 1, day + days, 12));
  return value.toISOString().slice(0, 10);
}

export function parseSearchIntent(
  raw: string,
  explicitDate?: string,
  timezone = "Europe/Paris"
): SearchIntent {
  let text = raw.trim();
  let targetDate = explicitDate || undefined;
  const normalized = normalize(text);
  const today = dateInTimeZone(new Date(), timezone);

  if (!targetDate && /\b(aujourd hui|today|ce jour)\b/.test(normalized)) {
    targetDate = today;
    text = text.replace(/\b(aujourd['’]?hui|today|ce jour)\b/gi, " ").trim();
  }

  if (!targetDate && /\b(demain|tomorrow)\b/.test(normalized)) {
    targetDate = addDaysToLocalDate(today, 1);
    text = text.replace(/\b(demain|tomorrow)\b/gi, " ").trim();
  }

  const cityMatch = text.match(
    /(?:\b(?:à|a|in|near|sur|vers)\s+)([A-ZÀ-ÖØ-Ý][\p{L}'’.-]+(?:\s+[A-ZÀ-ÖØ-Ý][\p{L}'’.-]+){0,3})\s*$/u
  );

  return {
    raw,
    text: text.replace(/\s+/g, " ").trim(),
    targetDate,
    city: cityMatch?.[1]?.trim(),
    timezone,
  };
}

export function eventMatchesDate(
  event: AppEvent,
  targetDate: string | undefined,
  timezone = "Europe/Paris"
) {
  if (!targetDate) return true;

  const parsed = new Date(event.start);
  const startDate = Number.isNaN(parsed.getTime())
    ? event.start.slice(0, 10)
    : dateInTimeZone(parsed, timezone);

  if (!event.end) return startDate === targetDate;

  const parsedEnd = new Date(event.end);
  const endDate = Number.isNaN(parsedEnd.getTime())
    ? event.end.slice(0, 10)
    : dateInTimeZone(parsedEnd, timezone);

  return targetDate >= startDate && targetDate <= endDate;
}

function asText(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (value && typeof value === "object") {
    const object = value as Record<string, unknown>;
    return asText(object.name) || asText(object.addressLocality);
  }
  return undefined;
}

function walkEventNodes(
  value: unknown,
  output: Record<string, unknown>[] = []
): Record<string, unknown>[] {
  if (!value) return output;

  if (Array.isArray(value)) {
    value.forEach((item) => walkEventNodes(item, output));
    return output;
  }

  if (typeof value !== "object") return output;

  const object = value as Record<string, unknown>;
  const type = object["@type"];
  const types = Array.isArray(type) ? type.map(String) : [String(type ?? "")];

  if (types.some((item) => /event/i.test(item))) {
    output.push(object);
  }

  Object.values(object).forEach((item) => walkEventNodes(item, output));
  return output;
}

function categoryFromText(value: string): EventCategory {
  const text = normalize(value);

  if (
    /\b(match|sport|football|soccer|basket|basketball|tennis|ping pong|table tennis|mma|ufc|race|racing|grand prix|hockey)\b/.test(
      text
    )
  ) {
    return "sport";
  }

  if (/\b(concert|music|musique|dj|tour|festival musical)\b/.test(text)) {
    return "music";
  }

  if (/\b(gaming|esport|video game|jeu video)\b/.test(text)) {
    return "gaming";
  }

  if (/\b(conference|business|salon|trade show|expo pro|summit)\b/.test(text)) {
    return "business";
  }

  if (/\b(nike|adidas|puma|brand|marque|launch|lancement|pop up|popup)\b/.test(text)) {
    return "brand";
  }

  if (/\b(exhibition|exposition|museum|musee|theatre|culture|art|festival)\b/.test(text)) {
    return "culture";
  }

  return "other";
}

function rootHost(url: string) {
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    const parts = host.split(".");
    if (parts.length <= 2) return host;
    return parts.slice(-2).join(".");
  } catch {
    return "";
  }
}

function verificationForUrl(
  url: string,
  searchText = ""
): VerificationLevel {
  const host = rootHost(url);
  if (TRUSTED_OFFICIAL_HOSTS.has(host)) return "official";
  if (INSTITUTIONAL_SUFFIXES.some((suffix) => host.endsWith(suffix))) {
    return "institutional";
  }

  const domainLabel = normalize(host.split(".")[0] ?? "");
  const query = normalize(searchText);
  if (
    domainLabel.length >= 3 &&
    query.split(" ").some((token) => token === domainLabel)
  ) {
    return "official";
  }

  return "verified-web";
}

function sourceNameFromUrl(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "Source web";
  }
}

function extractJsonLdEventsFromHtml(
  html: string,
  pageUrl: string,
  searchText: string
): AppEvent[] {
  const scripts =
    html.match(
      /<script[^>]+type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi
    ) ?? [];

  const verification = verificationForUrl(pageUrl, searchText);
  const source = sourceNameFromUrl(pageUrl);
  const events: AppEvent[] = [];

  scripts.forEach((script, scriptIndex) => {
    const raw = script
      .replace(/^<script[^>]*>/i, "")
      .replace(/<\/script>$/i, "")
      .trim();

    try {
      const parsed = JSON.parse(raw);
      const nodes = walkEventNodes(parsed);

      nodes.forEach((node, index) => {
        const start = asText(node.startDate);
        const title = asText(node.name);
        if (!start || !title) return;

        const location =
          node.location && typeof node.location === "object"
            ? (node.location as Record<string, unknown>)
            : undefined;
        const address =
          location?.address && typeof location.address === "object"
            ? (location.address as Record<string, unknown>)
            : undefined;

        const eventUrl = asText(node.url) || pageUrl;
        const image = Array.isArray(node.image)
          ? asText(node.image[0])
          : asText(node.image);

        events.push({
          id: `web-${rootHost(pageUrl)}-${scriptIndex}-${index}-${start}`,
          title,
          start,
          end: asText(node.endDate),
          venue: asText(location?.name),
          city: asText(address?.addressLocality),
          country: asText(address?.addressCountry),
          category: categoryFromText(
            [title, searchText, asText(node.description)].filter(Boolean).join(" ")
          ),
          source,
          sourceUrl: pageUrl,
          official: verification === "official" || verification === "institutional",
          verification,
          url: eventUrl,
          image,
          entity: source,
          description: asText(node.description),
        });
      });
    } catch {}
  });

  return events;
}

function extractMetaEvent(html: string, pageUrl: string, searchText: string) {
  const start =
    html.match(
      /<meta[^>]+(?:property|name)=["'](?:event:start_time|event:start|startDate)["'][^>]+content=["']([^"']+)["'][^>]*>/i
    )?.[1] ??
    html.match(
      /<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["'](?:event:start_time|event:start|startDate)["'][^>]*>/i
    )?.[1];

  if (!start) return [];

  const title =
    html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1] ??
    html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1];

  if (!title) return [];

  const verification = verificationForUrl(pageUrl, searchText);

  return [
    {
      id: `web-meta-${rootHost(pageUrl)}-${start}`,
      title: title.replace(/&amp;/g, "&").trim(),
      start,
      category: categoryFromText(`${title} ${searchText}`),
      source: sourceNameFromUrl(pageUrl),
      sourceUrl: pageUrl,
      official: verification === "official" || verification === "institutional",
      verification,
      url: pageUrl,
      entity: sourceNameFromUrl(pageUrl),
    } satisfies AppEvent,
  ];
}

function likelyEventResult(title: string, description: string, url: string) {
  const haystack = normalize(`${title} ${description} ${url}`);
  return EVENT_WORDS.some((word) => haystack.includes(normalize(word)));
}


const MONTH_NUMBER: Record<string, number> = {
  january: 1, jan: 1, janvier: 1,
  february: 2, feb: 2, fevrier: 2, février: 2,
  march: 3, mar: 3, mars: 3,
  april: 4, apr: 4, avril: 4,
  may: 5, mai: 5,
  june: 6, jun: 6, juin: 6,
  july: 7, jul: 7, juillet: 7,
  august: 8, aug: 8, aout: 8, août: 8,
  september: 9, sep: 9, sept: 9, septembre: 9,
  october: 10, oct: 10, octobre: 10,
  november: 11, nov: 11, novembre: 11,
  december: 12, dec: 12, decembre: 12, décembre: 12,
};

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function isoLocal(
  year: number,
  month: number,
  day: number,
  hour = 12,
  minute = 0
) {
  return `${year}-${pad2(month)}-${pad2(day)}T${pad2(hour)}:${pad2(minute)}:00`;
}

function parseClock(
  hourText?: string,
  minuteText?: string,
  meridiem?: string
): [number, number] {
  let hour = Number(hourText || 12);
  const minute = Number(minuteText || 0);
  const marker = (meridiem || "").toUpperCase();

  if (marker === "PM" && hour < 12) hour += 12;
  if (marker === "AM" && hour === 12) hour = 0;

  return [hour, minute];
}

function chooseTextTitle(raw: string, fallback: string) {
  const generic = [
    "know before you go",
    "location",
    "details",
    "event details",
    "important information",
  ];

  const headings = raw
    .split(/\r?\n/)
    .map((line) => line.match(/^#{1,4}\s+(.{3,140})$/)?.[1]?.trim())
    .filter((value): value is string => Boolean(value));

  return (
    headings.find(
      (heading) =>
        !generic.some((item) => normalize(heading).includes(normalize(item)))
    ) ||
    fallback ||
    "Événement"
  );
}

function cityFromText(raw: string) {
  const us = raw.match(
    /,\s*([A-Z][A-Za-z .'-]{2,40}),\s*[A-Z]{2}\s+\d{5}(?:-\d{4})?(?:,\s*USA)?/
  );
  if (us?.[1]) return us[1].trim();

  const fr = raw.match(/\b\d{5}\s+([A-ZÀ-ÖØ-Ý][A-Za-zÀ-ÿ .'-]{2,40})(?:,\s*France)?/);
  if (fr?.[1]) return fr[1].trim();

  return undefined;
}

function parsePlainTextEvent(
  raw: string,
  candidate: SearchCandidate,
  searchText: string
): AppEvent[] {
  if (!raw || raw.length < 30) return [];

  const candidateLabel = normalize(candidate.title);
  const dateMentions =
    raw.match(
      /(?:January|February|March|April|May|June|July|August|September|October|November|December|janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre)\s+\d{1,2}|\d{1,2}\s+(?:janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre)/gi
    ) ?? [];

  if (
    dateMentions.length > 4 &&
    /\b(calendar|calendrier|schedule|agenda|fixtures?)\b/.test(candidateLabel)
  ) {
    return [];
  }

  const verification = verificationForUrl(candidate.url, searchText);
  const now = new Date();
  const currentYear = now.getFullYear();

  const english =
    raw.match(
      /(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)?[,]?\s*(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s*(?:–|-|—|to)\s*(?:(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)?[,]?\s*)?(?:(January|February|March|April|May|June|July|August|September|October|November|December)\s+)?(\d{1,2})(?:st|nd|rd|th)?)?(?:[,]?\s*(20\d{2}))?/i
    );

  const french =
    raw.match(
      /(?:lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)?\s*(\d{1,2})(?:er)?\s+(janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre)(?:\s*(?:–|-|—|au|à)\s*(?:lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)?\s*(\d{1,2})(?:er)?(?:\s+(janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre))?)?(?:\s+(20\d{2}))?/i
    );

  let startMonth: number | undefined;
  let startDay: number | undefined;
  let endMonth: number | undefined;
  let endDay: number | undefined;
  let year = currentYear;
  let matchIndex = -1;
  let matchedText = "";

  if (english) {
    startMonth = MONTH_NUMBER[normalize(english[1])];
    startDay = Number(english[2]);
    endMonth = english[3]
      ? MONTH_NUMBER[normalize(english[3])]
      : startMonth;
    endDay = english[4] ? Number(english[4]) : undefined;
    if (english[5]) year = Number(english[5]);
    matchIndex = english.index ?? -1;
    matchedText = english[0];
  } else if (french) {
    startDay = Number(french[1]);
    startMonth = MONTH_NUMBER[normalize(french[2])];
    endDay = french[3] ? Number(french[3]) : undefined;
    endMonth = french[4]
      ? MONTH_NUMBER[normalize(french[4])]
      : startMonth;
    if (french[5]) year = Number(french[5]);
    matchIndex = french.index ?? -1;
    matchedText = french[0];
  }

  if (!startMonth || !startDay) return [];

  const nearby =
    matchIndex >= 0
      ? raw.slice(matchIndex + matchedText.length, matchIndex + matchedText.length + 240)
      : raw.slice(0, 240);

  const time = nearby.match(
    /(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?\s*(?:–|-|—|to|à)\s*(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?/i
  );

  const [startHour, startMinute] = parseClock(
    time?.[1],
    time?.[2],
    time?.[3]
  );
  const [endHour, endMinute] = parseClock(
    time?.[4] || time?.[1],
    time?.[5] || time?.[2],
    time?.[6] || time?.[3]
  );

  const start = isoLocal(year, startMonth, startDay, startHour, startMinute);
  const end = endDay
    ? isoLocal(
        endMonth === 1 && startMonth === 12 ? year + 1 : year,
        endMonth || startMonth,
        endDay,
        endHour,
        endMinute
      )
    : time
      ? isoLocal(year, startMonth, startDay, endHour, endMinute)
      : undefined;

  const title = chooseTextTitle(raw, candidate.title);
  const city = cityFromText(raw);

  return [
    {
      id: `web-text-${rootHost(candidate.url)}-${normalize(title).replace(/\s+/g, "-").slice(0, 70)}-${start.slice(0, 10)}`,
      title,
      start,
      end,
      city,
      category: categoryFromText(
        [title, searchText, candidate.description].join(" ")
      ),
      source: sourceNameFromUrl(candidate.url),
      sourceUrl: candidate.url,
      official:
        verification === "official" || verification === "institutional",
      verification,
      url: candidate.url,
      entity: sourceNameFromUrl(candidate.url),
      description: candidate.description || undefined,
    },
  ];
}

async function extractCandidateText(
  candidates: SearchCandidate[],
  searchText: string
): Promise<AppEvent[]> {
  if (!candidates.length) return [];

  try {
    const client = process.env.TAVILY_API_KEY
      ? tavily({ apiKey: process.env.TAVILY_API_KEY })
      : tavily();

    const response = await client.extract(
      candidates.slice(0, 6).map((candidate) => candidate.url)
    );

    const byUrl = new Map(
      candidates.map((candidate) => [candidate.url, candidate])
    );

    return (response.results ?? []).flatMap((result) => {
      const candidate =
        byUrl.get(String(result.url)) ||
        candidates.find(
          (item) => rootHost(item.url) === rootHost(String(result.url))
        );

      if (!candidate) return [];

      return parsePlainTextEvent(
        String(result.rawContent ?? ""),
        candidate,
        searchText
      );
    });
  } catch {
    return [];
  }
}

async function fetchEventPage(url: string, searchText: string) {
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) return [];

    const response = await fetch(url, {
      cache: "no-store",
      redirect: "follow",
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "ApplicationCalendar/0.4 (+https://application-blue-eta.vercel.app)",
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT),
    });

    if (!response.ok) return [];
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) return [];

    const html = await response.text();
    const jsonLd = extractJsonLdEventsFromHtml(html, response.url || url, searchText);
    if (jsonLd.length) return jsonLd;

    return extractMetaEvent(html, response.url || url, searchText);
  } catch {
    return [];
  }
}


const QUERY_SYNONYMS: Array<string[]> = [
  ["ping pong", "table tennis", "tennis de table", "fftt"],
  ["football", "soccer", "foot"],
  ["basket", "basketball", "nba"],
  ["running", "run", "course", "running club"],
  ["concert", "music", "musique", "live"],
  ["gaming", "esport", "e sport", "jeu video", "video game"],
];

function eventMatchesSearch(event: AppEvent, rawQuery: string) {
  const query = normalize(rawQuery);
  if (!query) return true;

  const haystack = normalize(
    [
      event.title,
      event.entity,
      event.city,
      event.country,
      event.venue,
      event.category,
      event.description,
      event.source,
      event.sourceUrl,
      event.url,
    ]
      .filter(Boolean)
      .join(" ")
  );

  const queryWords = query
    .split(" ")
    .filter(
      (word) =>
        word.length > 1 &&
        !["event", "events", "agenda", "calendar", "calendrier", "official", "officiel"].includes(word)
    );

  const coveredBySynonym = (word: string) => {
    const group = QUERY_SYNONYMS.find((items) =>
      items.some((item) => normalize(item).split(" ").includes(word))
    );
    if (!group) return haystack.includes(word);
    return group.some((item) => haystack.includes(normalize(item)));
  };

  return queryWords.every(coveredBySynonym);
}

function dedupe(events: AppEvent[]) {
  const seen = new Set<string>();
  return events.filter((event) => {
    const key = `${normalize(event.title)}|${event.start.slice(0, 10)}|${normalize(
      event.city ?? ""
    )}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function tavilyCandidates(
  intent: SearchIntent
): Promise<SearchCandidate[]> {
  if (!intent.text) return [];

  const query = [
    intent.text,
    intent.city,
    intent.targetDate,
    "event agenda calendar official date venue",
  ]
    .filter(Boolean)
    .join(" ");

  try {
    const client = process.env.TAVILY_API_KEY
      ? tavily({ apiKey: process.env.TAVILY_API_KEY })
      : tavily();

    const officialDomains = preferredOfficialDomains(intent.text);

    const search = async (includeDomains?: string[]) => {
      const response = await client.search(query, {
        searchDepth: "basic",
        maxResults: includeDomains?.length ? 8 : 12,
        includeAnswer: false,
        includeRawContent: false,
        topic: "general",
        ...(includeDomains?.length ? { includeDomains } : {}),
      });

      return (response.results ?? [])
        .map((result): SearchCandidate => ({
          title: String(result.title ?? ""),
          description: String(result.content ?? ""),
          url: String(result.url ?? ""),
        }))
        .filter((result) =>
          likelyEventResult(result.title, result.description, result.url)
        );
    };

    const official = officialDomains.length
      ? await search(officialDomains)
      : [];

    if (official.length >= 3) return official.slice(0, 8);

    const general = await search();
    const seen = new Set<string>();
    return [...official, ...general]
      .filter((result) => {
        if (!result.url || seen.has(result.url)) return false;
        seen.add(result.url);
        return true;
      })
      .slice(0, 8);
  } catch {
    return [];
  }
}

async function braveCandidates(intent: SearchIntent): Promise<SearchCandidate[]> {
  const apiKey = process.env.BRAVE_SEARCH_API_KEY;
  if (!apiKey || !intent.text) return [];

  const queryParts = [intent.text, "event OR events OR agenda OR calendrier"];
  if (intent.city && !normalize(intent.text).includes(normalize(intent.city))) {
    queryParts.push(intent.city);
  }
  if (intent.targetDate) queryParts.push(intent.targetDate);

  const params = new URLSearchParams({
    q: queryParts.join(" "),
    count: "20",
    safesearch: "moderate",
    search_lang: "fr",
  });

  try {
    const response = await fetch(`${BRAVE_ENDPOINT}?${params.toString()}`, {
      headers: {
        Accept: "application/json",
        "X-Subscription-Token": apiKey,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT),
    });

    if (!response.ok) return [];
    const payload = await response.json();

    return (payload?.web?.results ?? [])
      .map((result: any) => ({
        title: String(result.title ?? ""),
        description: String(result.description ?? ""),
        url: String(result.url ?? ""),
      }))
      .filter((result: any) =>
        likelyEventResult(result.title, result.description, result.url)
      )
      .slice(0, 8);
  } catch {
    return [];
  }
}

export function universalWebProvider() {
  if (process.env.TAVILY_API_KEY) return "Tavily";
  if (process.env.BRAVE_SEARCH_API_KEY) return "Brave Search";
  return "Tavily keyless";
}

export async function fetchUniversalWebEvents(
  intent: SearchIntent
): Promise<AppEvent[]> {
  if (!intent.text) return [];

  let candidates = await tavilyCandidates(intent);

  if (!candidates.length && process.env.BRAVE_SEARCH_API_KEY) {
    candidates = await braveCandidates(intent);
  }

  if (!candidates.length) return [];

  const batches = await Promise.all(
    candidates.map((result: SearchCandidate) =>
      fetchEventPage(result.url, intent.text)
    )
  );

  const structuredEvents = batches.flat();
  const structuredUrls = new Set(
    structuredEvents.map((event) => event.sourceUrl || event.url).filter(Boolean)
  );
  const missingCandidates = candidates.filter(
    (candidate) => !structuredUrls.has(candidate.url)
  );

  const extractedEvents = await extractCandidateText(
    missingCandidates,
    intent.text
  );

  return dedupe([...structuredEvents, ...extractedEvents]).filter(
    (event) =>
      eventMatchesSearch(event, intent.text) &&
      eventMatchesDate(event, intent.targetDate, intent.timezone)
  );
}
