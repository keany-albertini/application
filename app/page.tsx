"use client";

import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Compass,
  Heart,
  MapPin,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Wifi,
  X,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import type { AppEvent, SourceStatus } from "@/lib/types";

type ApiResponse = {
  events: AppEvent[];
  mode: "live" | "demo";
  sources: Record<string, boolean>;
  sourceCatalog?: SourceStatus[];
  intent?: {
    raw: string;
    text: string;
    targetDate?: string;
    city?: string;
    timezone?: string;
  };
  universalSearch?: {
    enabled: boolean;
    webDiscoveryConfigured: boolean;
    webProvider?: string | null;
    webDiscoveryMode?: string;
    openAgendaConfigured: boolean;
    dataTourismeConfigured: boolean;
  };
};

type LocalContext = {
  city?: string;
  region?: string;
  country?: string;
  timezone?: string;
  postalCode?: string;
  precise: boolean;
  source: string;
};

type View = "calendar" | "explore" | "favorites";

const LOCAL_CATEGORIES = ["Sport", "Concerts", "Culture", "Famille"];

const CATEGORY_LABELS: Record<string, string> = {
  sport: "Sport",
  music: "Musique",
  brand: "Marque",
  culture: "Culture",
  gaming: "Gaming",
  business: "Pro",
  other: "Événement",
};

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatEventDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date à confirmer";

  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatFullDay(value: Date) {
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(value);
}

function monthLabel(date: Date) {
  return new Intl.DateTimeFormat("fr-FR", {
    month: "long",
    year: "numeric",
  }).format(date);
}

function toDateParam(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isEventOnDay(event: AppEvent, day: Date) {
  const start = new Date(event.start);
  const end = event.end ? new Date(event.end) : start;

  if (Number.isNaN(start.getTime())) return event.start.slice(0, 10) === toDateParam(day);

  const target = new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime();
  const startDay = new Date(
    start.getFullYear(),
    start.getMonth(),
    start.getDate()
  ).getTime();
  const endDay = Number.isNaN(end.getTime())
    ? startDay
    : new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime();

  return target >= startDay && target <= endDay;
}

function compactDescription(value?: string) {
  if (!value) return "";
  const cleaned = value.replace(/\s+/g, " ").trim();
  return cleaned.length > 220 ? `${cleaned.slice(0, 217)}…` : cleaned;
}

function verificationLabel(event: AppEvent) {
  switch (event.verification) {
    case "official":
      return "Officiel";
    case "institutional":
      return "Institutionnel";
    case "professional":
      return "Pro vérifié";
    case "verified-web":
      return "Web vérifié";
    case "community":
      return "Communauté";
    default:
      return event.official ? "Officiel" : "";
  }
}

export default function Home() {
  const [query, setQuery] = useState("");
  const [events, setEvents] = useState<AppEvent[]>([]);
  const [mode, setMode] = useState<"live" | "demo">("demo");
  const [sourceCatalog, setSourceCatalog] = useState<SourceStatus[]>([]);
  const [universalSearch, setUniversalSearch] =
    useState<ApiResponse["universalSearch"]>();
  const [localContext, setLocalContext] = useState<LocalContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date>(new Date());
  const [favorites, setFavorites] = useState<string[]>([]);
  const [view, setView] = useState<View>("calendar");
  const [showPublish, setShowPublish] = useState(false);
  const [publishMessage, setPublishMessage] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem("application:favorites");
    if (saved) {
      try {
        setFavorites(JSON.parse(saved));
      } catch {}
    }

    const today = new Date();
    setMonth(today);
    setSelectedDay(today);

    void (async () => {
      let context: LocalContext | null = null;

      try {
        const response = await fetch("/api/context", { cache: "no-store" });
        if (response.ok) {
          context = await response.json();
          setLocalContext(context);
        }
      } catch {}

      const localTerm = context?.city?.trim() ?? "";
      await loadEvents(
        localTerm,
        today,
        context?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone
      );
    })();
  }, []);

  async function loadEvents(
    term: string,
    targetDate?: Date | null,
    timezone?: string
  ) {
    setLoading(true);

    try {
      const params = new URLSearchParams();
      if (term.trim()) params.set("q", term.trim());
      if (targetDate) params.set("date", toDateParam(targetDate));
      params.set(
        "tz",
        timezone ||
          localContext?.timezone ||
          Intl.DateTimeFormat().resolvedOptions().timeZone ||
          "Europe/Paris"
      );

      const response = await fetch(`/api/events?${params.toString()}`, {
        cache: "no-store",
      });
      const payload: ApiResponse = await response.json();

      setEvents(payload.events ?? []);
      setMode(payload.mode ?? "demo");
      setSourceCatalog(payload.sourceCatalog ?? []);
      setUniversalSearch(payload.universalSearch);
    } catch {
      setEvents([]);
      setMode("demo");
      setSourceCatalog([]);
    } finally {
      setLoading(false);
    }
  }

  function currentSearchTerm() {
    return query.trim() || localContext?.city?.trim() || "";
  }

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    const term = query.trim() || localContext?.city || "";
    setView("explore");
    setSelectedDay(new Date());
    setMonth(new Date());
    void loadEvents(term);
  }

  function localSearch(category?: string) {
    const city = localContext?.city?.trim() || "";
    const term = [category, city].filter(Boolean).join(" ").trim();

    setQuery(category ? term : "");
    setView("calendar");
    void loadEvents(term || city, selectedDay);
  }

  function toggleFavorite(id: string) {
    setFavorites((current) => {
      const next = current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id];

      localStorage.setItem("application:favorites", JSON.stringify(next));
      return next;
    });
  }

  function goToToday() {
    const today = new Date();
    setMonth(today);
    setSelectedDay(today);
    setView("calendar");
    void loadEvents(currentSearchTerm(), today);
  }

  function resetDiscovery() {
    const today = new Date();
    setQuery("");
    setMonth(today);
    setSelectedDay(today);
    setView("calendar");
    void loadEvents(localContext?.city || "", today);
  }

  const calendarDays = useMemo(() => {
    const year = month.getFullYear();
    const monthIndex = month.getMonth();
    const first = new Date(year, monthIndex, 1);
    const last = new Date(year, monthIndex + 1, 0);
    const mondayOffset = (first.getDay() + 6) % 7;
    const days: Array<Date | null> = Array(mondayOffset).fill(null);

    for (let day = 1; day <= last.getDate(); day++) {
      days.push(new Date(year, monthIndex, day));
    }

    while (days.length % 7) days.push(null);
    return days;
  }, [month]);

  const visibleEvents = useMemo(() => {
    let current = events;

    if (view === "favorites") {
      current = current.filter((event) => favorites.includes(event.id));
    }

    if (view !== "favorites") {
      current = current.filter((event) => isEventOnDay(event, selectedDay));
    }

    return current;
  }, [events, favorites, selectedDay, view]);

  async function publish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPublishMessage("Envoi…");

    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(form.entries());

    const response = await fetch("/api/pro-events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const result = await response.json();

    if (!response.ok) {
      setPublishMessage(
        result.error ??
          "La publication pro sera disponible dès que la base sera connectée."
      );
      return;
    }

    setPublishMessage("Événement envoyé pour validation.");
    event.currentTarget.reset();
  }

  const placeLabel = localContext?.city
    ? localContext.city
    : localContext?.country
      ? localContext.country
      : "votre zone";

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-mark">
          <CalendarDays size={18} />
        </div>
        <div className="brand-copy">
          <strong>Application</strong>
          <span>Le calendrier de ce qui se passe autour de vous.</span>
        </div>
        <div
          className={`connection-badge ${
            universalSearch?.webDiscoveryConfigured ? "online" : ""
          }`}
        >
          <span />
          {universalSearch?.webDiscoveryConfigured ? "En ligne" : "Connexion…"}
        </div>
      </header>

      <section className="calendar-hero">
        <div className="calendar-heading">
          <div>
            <p className="section-kicker">AUJOURD’HUI</p>
            <h1>{formatFullDay(new Date())}</h1>
            <span className="local-line">
              <MapPin size={14} />
              {localContext?.city
                ? `Événements près de ${localContext.city}`
                : "Recherche locale automatique"}
            </span>
          </div>

          <button className="today-main-button" type="button" onClick={goToToday}>
            Aujourd’hui
          </button>
        </div>

        <div className="calendar-toolbar">
          <button
            className="mini-button"
            type="button"
            onClick={() =>
              setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))
            }
            aria-label="Mois précédent"
          >
            <ChevronLeft size={18} />
          </button>

          <strong>{monthLabel(month)}</strong>

          <button
            className="mini-button"
            type="button"
            onClick={() =>
              setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))
            }
            aria-label="Mois suivant"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        <div className="calendar-card calendar-card-main">
          <div className="weekdays">
            {["L", "M", "M", "J", "V", "S", "D"].map((day, index) => (
              <span key={`${day}-${index}`}>{day}</span>
            ))}
          </div>

          <div className="calendar-grid">
            {calendarDays.map((day, index) => {
              if (!day) {
                return <span className="day empty" key={`e-${index}`} />;
              }

              const dayEvents = events.filter((event) => isEventOnDay(event, day));
              const active = sameDay(selectedDay, day);
              const today = sameDay(new Date(), day);

              return (
                <button
                  key={day.toISOString()}
                  className={`day ${active ? "active" : ""} ${
                    today ? "today" : ""
                  }`}
                  onClick={() => {
                    setSelectedDay(day);
                    setView("calendar");
                    void loadEvents(currentSearchTerm(), day);
                  }}
                >
                  <span>{day.getDate()}</span>
                  {dayEvents.length > 0 && (
                    <span className="event-dots">
                      {dayEvents.slice(0, 3).map((event) => (
                        <i key={event.id} />
                      ))}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section className="local-discovery">
        <div className="local-discovery-head">
          <div>
            <p className="section-kicker">PRÈS DE VOUS</p>
            <h2>{placeLabel}</h2>
          </div>
          <span className="internet-live">
            <Wifi size={13} />
            Internet
          </span>
        </div>

        <div className="local-chips">
          <button type="button" onClick={() => localSearch()}>
            Tout
          </button>
          {LOCAL_CATEGORIES.map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => localSearch(category)}
            >
              {category}
            </button>
          ))}
        </div>
      </section>

      <form className="search-box search-box-secondary" onSubmit={submitSearch}>
        <Search size={20} />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Nike Marseille demain, ping-pong Lyon…"
          aria-label="Rechercher partout"
        />
        {query && (
          <button
            type="button"
            className="clear-search"
            onClick={() => setQuery("")}
            aria-label="Effacer"
          >
            <X size={17} />
          </button>
        )}
      </form>

      <section className="feed">
        <div className="feed-head">
          <div>
            <p className="section-kicker">
              {view === "favorites" ? "TES FAVORIS" : "PROGRAMME"}
            </p>
            <h2>
              {view === "favorites"
                ? "Événements enregistrés"
                : `${formatFullDay(selectedDay)} · ${placeLabel}`}
            </h2>
          </div>

          {(query || view === "favorites") && (
            <button className="text-button" onClick={resetDiscovery}>
              Accueil
            </button>
          )}
        </div>

        {loading ? (
          <div className="loading-card">
            <Sparkles size={22} />
            Recherche des événements en ligne…
          </div>
        ) : visibleEvents.length === 0 ? (
          <div className="empty-card">
            <CalendarDays size={28} />
            <strong>
              {view === "favorites"
                ? "Aucun favori pour l’instant"
                : "Aucun événement fiable trouvé"}
            </strong>
            <span>
              {view === "favorites"
                ? "Ajoute un cœur à un événement pour le retrouver ici."
                : `Rien de suffisamment fiable trouvé pour ${placeLabel} à cette date.`}
            </span>
          </div>
        ) : (
          <div className="event-list">
            {visibleEvents.slice(0, 50).map((event) => {
              const isFavorite = favorites.includes(event.id);

              return (
                <article className="event-card" key={event.id}>
                  <div className={`category-mark category-${event.category}`} />

                  <div className="event-content">
                    <div className="event-meta-top">
                      <span className="category-pill">
                        {CATEGORY_LABELS[event.category] ?? "Événement"}
                      </span>

                      {verificationLabel(event) && (
                        <span
                          className={`official-badge compact verification-${
                            event.verification || "official"
                          }`}
                        >
                          <ShieldCheck size={10} />
                          {verificationLabel(event)}
                        </span>
                      )}

                      <span className="source">{event.source}</span>
                    </div>

                    <h3>{event.title}</h3>

                    <div className="event-info">
                      <span>
                        <Clock3 size={15} />
                        {formatEventDate(event.start)}
                      </span>

                      {(event.venue || event.city) && (
                        <span>
                          <MapPin size={15} />
                          {[event.venue, event.city].filter(Boolean).join(" · ")}
                        </span>
                      )}
                    </div>

                    {event.description && (
                      <p>{compactDescription(event.description)}</p>
                    )}

                    {(event.url || event.sourceUrl) && (
                      <a
                        href={event.url || event.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Voir la source
                      </a>
                    )}
                  </div>

                  <button
                    className={`favorite-button ${isFavorite ? "saved" : ""}`}
                    onClick={() => toggleFavorite(event.id)}
                    aria-label="Ajouter aux favoris"
                  >
                    <Heart
                      size={20}
                      fill={isFavorite ? "currentColor" : "none"}
                    />
                  </button>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="source-summary">
        <ShieldCheck size={15} />
        <span>
          {sourceCatalog.filter((source) => source.active).length} sources actives
          · résultats classés par fiabilité
        </span>
      </section>

      <button className="floating-publish" onClick={() => setShowPublish(true)}>
        <Plus size={19} />
        Publier un événement
      </button>

      <nav className="bottom-nav" aria-label="Navigation principale">
        <button
          className={`nav-item ${view === "calendar" ? "active" : ""}`}
          onClick={() => {
            setView("calendar");
            goToToday();
          }}
        >
          <CalendarDays size={20} />
          <span>Calendrier</span>
        </button>

        <button
          className={`nav-item ${view === "explore" ? "active" : ""}`}
          onClick={() => {
            setView("explore");
            document
              .querySelector<HTMLInputElement>(".search-box input")
              ?.focus();
          }}
        >
          <Compass size={20} />
          <span>Explorer</span>
        </button>

        <button
          className={`nav-item ${view === "favorites" ? "active" : ""}`}
          onClick={() => setView("favorites")}
        >
          <Star size={20} />
          <span>Favoris</span>
        </button>
      </nav>

      {showPublish && (
        <div className="modal-backdrop" onClick={() => setShowPublish(false)}>
          <section
            className="publish-sheet"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="sheet-handle" />

            <div className="sheet-head">
              <div>
                <p className="section-kicker">ESPACE PRO</p>
                <h2>Publier un événement</h2>
              </div>
              <button
                className="icon-button"
                onClick={() => setShowPublish(false)}
              >
                <X size={20} />
              </button>
            </div>

            <form className="publish-form" onSubmit={publish}>
              <label>
                Organisateur
                <input name="organizer" placeholder="Nom de l’organisation" />
              </label>

              <label>
                Titre
                <input name="title" required placeholder="Nom de l’événement" />
              </label>

              <div className="form-row">
                <label>
                  Date et heure
                  <input name="start" type="datetime-local" required />
                </label>

                <label>
                  Catégorie
                  <select name="category" defaultValue="other">
                    <option value="sport">Sport</option>
                    <option value="music">Musique</option>
                    <option value="brand">Marque</option>
                    <option value="culture">Culture</option>
                    <option value="gaming">Gaming</option>
                    <option value="business">Professionnel</option>
                    <option value="other">Autre</option>
                  </select>
                </label>
              </div>

              <label>
                Lieu
                <input name="venue" placeholder="Stade, salle, circuit…" />
              </label>

              <div className="form-row">
                <label>
                  Ville
                  <input name="city" placeholder="Marseille" />
                </label>
                <label>
                  Pays
                  <input name="country" placeholder="France" />
                </label>
              </div>

              <label>
                Lien officiel
                <input name="url" type="url" placeholder="https://…" />
              </label>

              <label>
                Description
                <textarea
                  name="description"
                  rows={3}
                  placeholder="Informations utiles…"
                />
              </label>

              <button className="primary-button" type="submit">
                Envoyer l’événement
              </button>

              {publishMessage && (
                <p className="publish-message">{publishMessage}</p>
              )}
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
