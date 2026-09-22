import type { AppEvent } from "./types";

const now = new Date();
const year = now.getFullYear();
const month = now.getMonth();

function iso(dayOffset: number, hour = 20) {
  const date = new Date(year, month, now.getDate() + dayOffset, hour, 0, 0);
  return date.toISOString();
}

export const demoEvents: AppEvent[] = [
  {
    id: "demo-om-1",
    title: "Olympique de Marseille — prochain match",
    start: iso(2, 20),
    venue: "Orange Vélodrome",
    city: "Marseille",
    country: "France",
    category: "sport",
    source: "Démo",
    entity: "Olympique de Marseille",
    description: "Exemple de match. Une source sportive configurée remplace automatiquement cette donnée."
  },
  {
    id: "demo-redbull-1",
    title: "Red Bull — événement à la une",
    start: iso(5, 18),
    city: "Paris",
    country: "France",
    category: "brand",
    source: "Démo",
    entity: "Red Bull",
    description: "Exemple d’événement de marque. Ticketmaster et d’autres sources peuvent alimenter ce flux."
  },
  {
    id: "demo-concert-1",
    title: "Grand concert international",
    start: iso(8, 21),
    venue: "Accor Arena",
    city: "Paris",
    country: "France",
    category: "music",
    source: "Démo",
    entity: "Concerts"
  },
  {
    id: "demo-gaming-1",
    title: "Festival gaming & esport",
    start: iso(12, 10),
    city: "Lyon",
    country: "France",
    category: "gaming",
    source: "Démo",
    entity: "Gaming"
  },
  {
    id: "demo-business-1",
    title: "Salon professionnel international",
    start: iso(15, 9),
    city: "Paris",
    country: "France",
    category: "business",
    source: "Démo",
    entity: "Business"
  }
];
