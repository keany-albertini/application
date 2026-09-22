"use client";

import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Compass,
  Database,
  Heart,
  MapPin,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Trophy,
  X,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import type { AppEvent, SourceStatus } from "@/lib/types";

type ApiResponse = {
  events: AppEvent[];
  mode: "live" | "demo";
  sources: Record<string, boolean>;
  sourceCatalog?: SourceStatus[];
};

type View = "calendar" | "explore" | "favorites";

const QUICK_SEARCHES = [
  "Olympique de Marseille",
  "PSG",
  "Formula 1",
  "Red Bull",
  "NBA",
  "NHL",
  "UFC",
  "Formula E",
  "Barcelona",
  "Concert Paris",
];

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

function monthLabel(date: Date) {
  return new Intl.DateTimeFormat("fr-FR", {
    month: "long",
    year: "numeric",
  }).format(date);
}

export default function Home() {
  const [query, setQuery] = useState("");
  const [events, setEvents] = useState<AppEvent[]>([]);
  const [mode, setMode] = useState<"live" | "demo">("demo");
  const [sourceCatalog, setSourceCatalog] = useState<SourceStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
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
    void loadEvents("");
  }, []);

  async function loadEvents(term: string) {
    setLoading(true);
    try {
      const response = await fetch(`/api/events?q=${encodeURIComponent(term)}`, {
        cache: "no-store",
      });
      const payload: ApiResponse = await response.json();
      setEvents(payload.events ?? []);
      setMode(payload.mode ?? "demo");
      setSourceCatalog(payload.sourceCatalog ?? []);

      if (payload.events?.[0]) {
        const next = new Date(payload.events[0].start);
        if (!Number.isNaN(next.getTime())) setMonth(next);
      }
    } catch {
      setEvents([]);
      setMode("demo");
      setSourceCatalog([]);
    } finally {
      setLoading(false);
    }
  }

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    setSelectedDay(null);
    setView("explore");
    void loadEvents(query);
  }

  function quickSearch(term: string) {
    setQuery(term);
    setSelectedDay(null);
    setView("explore");
    void loadEvents(term);
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

  function resetDiscovery() {
    setQuery("");
    setSelectedDay(null);
    setView("calendar");
    void loadEvents("");
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

    if (selectedDay) {
      current = current.filter((event) =>
        sameDay(new Date(event.start), selectedDay)
      );
    }

    return current;
  }, [events, favorites, selectedDay, view]);

  const nextEvent = visibleEvents[0];
  const activeSources = sourceCatalog.filter((source) => source.active);
  const officialCount = events.filter((event) => event.official).length;

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

  return (
    <main className="app-shell">
      <header className="hero">
        <div className="brand-row">
          <div className="brand-mark">
            <CalendarDays size={18} />
          </div>
          <div className="brand-copy">
            <strong>Application</strong>
            <span>Tout ce qui arrive, au même endroit.</span>
          </div>
          <div className={`connection-badge ${mode === "live" ? "online" : ""}`}>
            <span />
            {mode === "live" ? "À jour" : "Démo"}
          </div>
        </div>

        <div className="hero-title">
          <p className="eyebrow">TON CALENDRIER GLOBAL</p>
          <h1>Ne rate plus rien.</h1>
          <p>
            Matchs, événements de marques, concerts, festivals et rendez-vous
            professionnels réunis dans un seul calendrier.
          </p>
        </div>

        <form className="search-box" onSubmit={submitSearch}>
          <Search size={20} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="OM, Red Bull, F1, concert, ville…"
            aria-label="Rechercher"
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

        <div className="quick-row">
          {QUICK_SEARCHES.map((item) => (
            <button
              key={item}
              className="chip"
              type="button"
              onClick={() => quickSearch(item)}
            >
              {item}
            </button>
          ))}
        </div>
      </header>

      <section className="overview-grid">
        <div className="overview-card">
          <span className="overview-icon">
            <Trophy size={18} />
          </span>
          <div>
            <strong>{events.length}</strong>
            <span>événements trouvés</span>
          </div>
        </div>
        <div className="overview-card">
          <span className="overview-icon">
            <ShieldCheck size={18} />
          </span>
          <div>
            <strong>{officialCount}</strong>
            <span>sources officielles</span>
          </div>
        </div>
      </section>

      <section className="sources-panel">
        <div className="sources-head">
          <div>
            <p className="section-kicker">SOURCES</p>
            <h2>Calendrier connecté</h2>
          </div>
          <span className="source-count">
            <Database size={14} />
            {activeSources.length} actives
          </span>
        </div>
        <div className="sources-scroll">
          {sourceCatalog.slice(0, 14).map((source) => (
            <a
              key={source.id}
              className={`source-chip ${source.active ? "active" : ""}`}
              href={source.url}
              target="_blank"
              rel="noreferrer"
              title={source.note}
            >
              {source.kind === "official" && <ShieldCheck size={12} />}
              <span>{source.name}</span>
              <i />
            </a>
          ))}
        </div>
      </section>

      {nextEvent && view !== "favorites" && !selectedDay && (
        <section
          className="spotlight"
          style={
            nextEvent.image
              ? {
                  backgroundImage: `linear-gradient(90deg, rgba(8,9,13,.96), rgba(8,9,13,.58)), url("${nextEvent.image}")`,
                }
              : undefined
          }
        >
          <div className="spotlight-top">
            <p className="section-kicker">PROCHAIN ÉVÉNEMENT</p>
            {nextEvent.official && (
              <span className="official-badge">
                <ShieldCheck size={12} />
                Officiel
              </span>
            )}
          </div>
          <h2>{nextEvent.title}</h2>
          <div className="spotlight-info">
            <span>
              <Clock3 size={15} />
              {formatEventDate(nextEvent.start)}
            </span>
            {(nextEvent.venue || nextEvent.city) && (
              <span>
                <MapPin size={15} />
                {[nextEvent.venue, nextEvent.city].filter(Boolean).join(" · ")}
              </span>
            )}
            <span className="spotlight-source">{nextEvent.source}</span>
          </div>
        </section>
      )}

      <section className="section-row">
        <div>
          <p className="section-kicker">CALENDRIER</p>
          <h2>{monthLabel(month)}</h2>
        </div>
        <div className="month-actions">
          <button
            className="mini-button"
            onClick={() =>
              setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))
            }
            aria-label="Mois précédent"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            className="mini-button"
            onClick={() => setMonth(new Date())}
            aria-label="Aujourd’hui"
          >
            <span className="today-label">Aujourd’hui</span>
          </button>
          <button
            className="mini-button"
            onClick={() =>
              setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))
            }
            aria-label="Mois suivant"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </section>

      <section className="calendar-card">
        <div className="weekdays">
          {["L", "M", "M", "J", "V", "S", "D"].map((day, index) => (
            <span key={`${day}-${index}`}>{day}</span>
          ))}
        </div>

        <div className="calendar-grid">
          {calendarDays.map((day, index) => {
            if (!day) return <span className="day empty" key={`e-${index}`} />;

            const dayEvents = events.filter((event) =>
              sameDay(new Date(event.start), day)
            );
            const active = selectedDay ? sameDay(selectedDay, day) : false;
            const today = sameDay(new Date(), day);

            return (
              <button
                key={day.toISOString()}
                className={`day ${active ? "active" : ""} ${today ? "today" : ""}`}
                onClick={() => setSelectedDay(active ? null : day)}
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
      </section>

      <section className="feed">
        <div className="feed-head">
          <div>
            <p className="section-kicker">
              {view === "favorites" ? "TES FAVORIS" : "À VENIR"}
            </p>
            <h2>
              {view === "favorites"
                ? "Événements enregistrés"
                : selectedDay
                  ? new Intl.DateTimeFormat("fr-FR", {
                      day: "numeric",
                      month: "long",
                    }).format(selectedDay)
                  : query
                    ? `Résultats pour “${query}”`
                    : "À découvrir"}
            </h2>
          </div>

          {(selectedDay || query || view === "favorites") && (
            <button className="text-button" onClick={resetDiscovery}>
              Réinitialiser
            </button>
          )}
        </div>

        {loading ? (
          <div className="loading-card">
            <Sparkles size={22} />
            Mise à jour depuis les sources…
          </div>
        ) : visibleEvents.length === 0 ? (
          <div className="empty-card">
            <CalendarDays size={28} />
            <strong>
              {view === "favorites"
                ? "Aucun favori pour l’instant"
                : "Aucun événement trouvé"}
            </strong>
            <span>
              {view === "favorites"
                ? "Ajoute un cœur à un événement pour le retrouver ici."
                : "Essaie une autre recherche."}
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
                      {event.official && (
                        <span className="official-badge compact">
                          <ShieldCheck size={10} />
                          Officiel
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

                    {event.description && <p>{event.description}</p>}

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
                    <Heart size={20} fill={isFavorite ? "currentColor" : "none"} />
                  </button>
                </article>
              );
            })}
          </div>
        )}
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
            setSelectedDay(null);
          }}
        >
          <CalendarDays size={20} />
          <span>Calendrier</span>
        </button>

        <button
          className={`nav-item ${view === "explore" ? "active" : ""}`}
          onClick={() => {
            setView("explore");
            document.querySelector<HTMLInputElement>(".search-box input")?.focus();
          }}
        >
          <Compass size={20} />
          <span>Explorer</span>
        </button>

        <button
          className={`nav-item ${view === "favorites" ? "active" : ""}`}
          onClick={() => {
            setView("favorites");
            setSelectedDay(null);
          }}
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
