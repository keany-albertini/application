import { tavily } from "@tavily/core";
import type {
  AppEvent,
  EventCategory,
  SearchIntent,
  VerificationLevel,
} from "./types";

const BRAVE_ENDPOINT = "https://api.search.brave.com/res/v1/web/search";
const REQUEST_TIMEOUT = 6500;

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
  if (Number.isNaN(parsed.getTime())) {
    return event.start.slice(0, 10) === targetDate;
  }

  return dateInTimeZone(parsed, timezone) === targetDate;
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

function verificationForUrl(url: string): VerificationLevel {
  const host = rootHost(url);
  if (TRUSTED_OFFICIAL_HOSTS.has(host)) return "official";
  if (INSTITUTIONAL_SUFFIXES.some((suffix) => host.endsWith(suffix))) {
    return "institutional";
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

  const verification = verificationForUrl(pageUrl);
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

  const verification = verificationForUrl(pageUrl);

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

    const response = await client.search(query, {
      searchDepth: "basic",
      maxResults: 12,
      includeAnswer: false,
      includeRawContent: false,
      topic: "general",
    });

    return (response.results ?? [])
      .map((result): SearchCandidate => ({
        title: String(result.title ?? ""),
        description: String(result.content ?? ""),
        url: String(result.url ?? ""),
      }))
      .filter((result) =>
        likelyEventResult(result.title, result.description, result.url)
      )
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

  return dedupe(batches.flat()).filter((event) =>
    eventMatchesDate(event, intent.targetDate, intent.timezone)
  );
}
