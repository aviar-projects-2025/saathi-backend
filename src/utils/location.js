// utils/location.js
import axios from "axios";

/* ═════════════════════════════════════════════════════════════
   PUBLIC LOCATION LABEL (TC-1 / BRD 6.3)
   Public card shows city, airport, or named landmark — NEVER the
   exact street address.
   ═════════════════════════════════════════════════════════════ */

export function buildPublicLocationLabel({
  addressComponents = [],
  name = "",
  types = [],
} = {}) {
  const comp = (type) =>
    addressComponents.find((c) => (c.types || []).includes(type)) || {};

  const getLong = (c) => c.long_name || c.longText || "";
  const getShort = (c) => c.short_name || c.shortText || "";

  const city =
    getLong(comp("locality")) ||
    getLong(comp("postal_town")) ||
    getLong(comp("administrative_area_level_3")) ||
    "";
  const stateAbbr =
    getShort(comp("administrative_area_level_1")) ||
    getLong(comp("administrative_area_level_1")) ||
    "";
  const iata =
    getShort(comp("airport")) ||
    (addressComponents.find((c) => (c.types || []).includes("airport"))
      ?.short_name ||
      addressComponents.find((c) => (c.types || []).includes("airport"))
        ?.shortText ||
      "");

  const isAirport = types.includes("airport") || /airport/i.test(name);
  const isNamedLandmark =
    name &&
    name.trim() &&
    !isAirport &&
    types.some((t) =>
      [
        "point_of_interest",
        "establishment",
        "place_of_worship",
        "tourist_attraction",
        "hospital",
        "school",
        "university",
        "stadium",
        "shopping_mall",
      ].includes(t)
    );

  if (isAirport) {
    const label = name || getLong(comp("airport")) || "Airport";
    return iata ? `${label} (${iata})` : label;
  }
  if (isNamedLandmark) return name;
  if (city && stateAbbr) return `${city}, ${stateAbbr}`;
  if (city) return city;

  const raw = addressComponents.map(getLong).filter(Boolean);
  if (raw.length >= 2) return `${raw[raw.length - 2]}, ${raw[raw.length - 1]}`;
  return "";
}

export function derivePublicLocationLabel(addressString) {
  if (!addressString) return "";
  const parts = String(addressString)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length === 0) return "";
  const looksLikeStreet = /^\d/.test(parts[0]);
  const cityParts = looksLikeStreet ? parts.slice(1) : parts;
  return cityParts.slice(0, 2).join(", ") || addressString;
}

/* ═════════════════════════════════════════════════════════════
   US GEO-FENCE (TC-4 / BRD 6.3 "US only")
   ═════════════════════════════════════════════════════════════ */

const US_BOUNDS = {
  minLat: 24.0,
  maxLat: 49.5,
  minLng: -125.0,
  maxLng: -66.5,
};

// Fast client-side check (no network). Use to reject obvious foreign pins.
export function isInUSBox(lat, lng) {
  if (typeof lat !== "number" || typeof lng !== "number") return false;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  return (
    lat >= US_BOUNDS.minLat &&
    lat <= US_BOUNDS.maxLat &&
    lng >= US_BOUNDS.minLng &&
    lng <= US_BOUNDS.maxLng
  );
}

// Authoritative server-side check via geocoder. Fails CLOSED.
export async function isInUS(lat, lng) {
  if (typeof lat !== "number" || typeof lng !== "number") return false;
  if (!isInUSBox(lat, lng)) return false;

  try {
    const res = await axios.get(
      "https://maps.googleapis.com/maps/api/geocode/json",
      { params: { latlng: `${lat},${lng}`, key: process.env.GOOGLE_MAPS_KEY } }
    );
    const country = res.data?.results?.[0]?.address_components?.find((c) =>
      (c.types || []).includes("country")
    )?.short_name;
    return country === "US";
  } catch (err) {
    console.error("[isInUS] geocoder error — failing closed:", err.message);
    return false;
  }
}