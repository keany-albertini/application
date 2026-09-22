export type EventCategory =
  | "sport"
  | "music"
  | "brand"
  | "culture"
  | "gaming"
  | "business"
  | "other";

export type AppEvent = {
  id: string;
  title: string;
  start: string;
  end?: string;
  venue?: string;
  city?: string;
  country?: string;
  category: EventCategory;
  source: string;
  url?: string;
  image?: string;
  entity?: string;
  description?: string;
};
