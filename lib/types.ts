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
  sourceUrl?: string;
  official?: boolean;
  url?: string;
  image?: string;
  entity?: string;
  description?: string;
};

export type SourceStatus = {
  id: string;
  name: string;
  kind: "official" | "open-data" | "community" | "optional";
  active: boolean;
  url?: string;
  note?: string;
};
