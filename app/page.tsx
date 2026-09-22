"use client";

import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleUserRound,
  Clock3,
  Heart,
  MapPin,
  Plus,
  Search,
  Sparkles,
  Star,
  X,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import type { AppEvent } from "@/lib/types";

type ApiResponse = {
  events: AppEvent[];
  mode: "live" | "demo";
  sources: Record<string, boolean>;
};

const QUICK_SEARCHES = [
  "Olympique de Marseille",
  "Red Bull",
  "Concerts",
  "Formula 1",
  "NBA",
  "Gaming",
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
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [favorites, setFavorites] = useState<string[]>([]);
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
      const response = await fetch(`/api/events?q=${encodeURIComponent(term)}`);
      const payload: ApiResponse = await response.json();
      setEvents(payload.events ?? []);
      setMode(payload.mode ?? "demo");
      if (payload.events?.[0]) {
        const next = new Date(payload.events[0].start);
        if (!Number.isNaN(next.getTime())) setMonth(next);
      }
    } finally {
      setLoading(false);
    }
  }

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    setSelectedDay(null);
    void loadEvents(query);
  }

  function quickSearch(term: string) {
    setQuery(term);
    setSelectedDay(null);
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
    if (!selectedDay) return events;
    return events.filter((event) => sameDay(new Date(event.start), selectedDay));
  }, [events, selectedDay]);

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
      setPublishMessage(result.error ?? "Publication indisponible.");
      return;
    }

    setPublishMessage("Événement envoyé pour validation.");
    event.currentTarget.reset();
  }

  return (
    <main className="app-shell">
      <header className="hero">
        <div className="topline">
          <div>
            <p className="eyebrow">CALENDRIER MONDIAL</p>
            <h1>Application</h1>
          </div>
          <button className="icon-button" aria-label="Profil">
            <CircleUserRound size={23} />
          </button>
        </div>

        <p className="hero-copy">
          Un seul endroit pour suivre les matchs, concerts, marques, salons,
          festivals et événements qui comptent.
        </p>

        <form className="search-box" onSubmit={submitSearch}>
          <Search size={20} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="OM, Red Bull, artiste, événement…"
            aria-label="Rechercher des événements"
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
              onClick={() => quickSearch(item)}
            >
              {item}
            </button>
          ))}
        </div>
      </header>

      <section className="status-row">
        <div className={`live-pill ${mode === "live" ? "online" : ""}`}>
          <span className="pulse" />
          {mode === "live" ? "Sources Internet actives" : "Mode démo — sources à connecter"}
        </div>
        <button className="publish-link" onClick={() => setShowPublish(true)}>
          <Plus size={17} />
          Publier
        </button>
      </section>

      <section className="calendar-card">
        <div className="calendar-head">
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
              onClick={() =>
                setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))
              }
              aria-label="Mois suivant"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>

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
            <p className="section-kicker">À VENIR</p>
            <h2>
              {selectedDay
                ? new Intl.DateTimeFormat("fr-FR", {
                    day: "numeric",
                    month: "long",
                  }).format(selectedDay)
                : query
                  ? `Résultats pour “${query}”`
                  : "Événements populaires"}
            </h2>
          </div>
          {selectedDay && (
            <button className="text-button" onClick={() => setSelectedDay(null)}>
              Tout voir
            </button>
          )}
        </div>

        {loading ? (
          <div className="loading-card">
            <Sparkles size={22} />
            Recherche des événements…
          </div>
        ) : visibleEvents.length === 0 ? (
          <div className="empty-card">
            <CalendarDays size={28} />
            <strong>Aucun événement trouvé</strong>
            <span>Essaie une autre recherche ou une autre date.</span>
          </div>
        ) : (
          <div className="event-list">
            {visibleEvents.slice(0, 40).map((event) => {
              const isFavorite = favorites.includes(event.id);
              return (
                <article className="event-card" key={event.id}>
                  <div className={`category-mark category-${event.category}`} />
                  <div className="event-content">
                    <div className="event-meta-top">
                      <span className="category-pill">
                        {CATEGORY_LABELS[event.category] ?? "Événement"}
                      </span>
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
                    {event.url && (
                      <a href={event.url} target="_blank" rel="noreferrer">
                        Voir l’événement
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

      <nav className="bottom-nav" aria-label="Navigation principale">
        <button className="nav-item active">
          <CalendarDays size={20} />
          <span>Calendrier</span>
        </button>
        <button className="nav-item" onClick={() => document.querySelector("input")?.focus()}>
          <Search size={20} />
          <span>Explorer</span>
        </button>
        <button
          className="nav-item"
          onClick={() => {
            const saved = events.filter((event) => favorites.includes(event.id));
            setEvents(saved);
            setSelectedDay(null);
          }}
        >
          <Star size={20} />
          <span>Favoris</span>
        </button>
      </nav>

      {showPublish && (
        <div className="modal-backdrop" onClick={() => setShowPublish(false)}>
          <section className="publish-sheet" onClick={(event) => event.stopPropagation()}>
            <div className="sheet-handle" />
            <div className="sheet-head">
              <div>
                <p className="section-kicker">ESPACE PRO</p>
                <h2>Publier un événement</h2>
              </div>
              <button className="icon-button" onClick={() => setShowPublish(false)}>
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
                <textarea name="description" rows={3} placeholder="Informations utiles…" />
              </label>
              <button className="primary-button" type="submit">
                Envoyer l’événement
              </button>
              {publishMessage && <p className="publish-message">{publishMessage}</p>}
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
