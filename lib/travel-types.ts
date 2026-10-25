export type TripKind = "destination" | "stay" | "poi" | "transit";

export type TripPlace = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  kind: TripKind;
  day: number | null;
  note: string;
};

export type TripLeg = {
  fromId: string;
  toId: string;
  fromName: string;
  toName: string;
  day: number | null;
  km: number;
  roadKm: number | null;
  minutes: number | null;
};

export type FareQuote = {
  mode: "flight" | "train" | "bus";
  from: string;
  to: string;
  date: string | null;
  price: number;
  currency: string;
  carrier: string | null;
  link: string | null;
  live: boolean;
  note: string;
};

export type GeoHit = {
  name: string;
  label: string;
  lat: number;
  lng: number;
  country: string | null;
};

export type TravelPublicSettings = {
  priceUrl: string;
  priceKeySet: boolean;
  priceKeyHint: string | null;
  provider: "illustrative" | "custom";
};
