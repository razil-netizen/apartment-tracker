// Hostaway's reservation object field name for the guest contact number has
// varied across API versions/integrations, so we check every field that has
// been seen carrying it rather than betting on one.
const PHONE_FIELD_CANDIDATES = ["phone", "guestPhone", "guestPhoneNumber", "phoneNumber"];

function normalizePhone(value) {
  if (!value) return "";
  return String(value).replace(/[^0-9]/g, "");
}

function extractPhone(reservation) {
  for (const field of PHONE_FIELD_CANDIDATES) {
    if (reservation[field]) return reservation[field];
  }
  return "";
}

function buildAgodaDetector(placeholderPhonesCsv) {
  const normalizedPlaceholders = (placeholderPhonesCsv || "")
    .split(",")
    .map((p) => normalizePhone(p))
    .filter(Boolean);

  return function isAgodaBooking(reservation) {
    const rawPhone = extractPhone(reservation);
    const normalized = normalizePhone(rawPhone);
    if (!normalized) return { isAgoda: false, phone: rawPhone };
    const isAgoda = normalizedPlaceholders.some((p) => normalized === p || normalized.endsWith(p));
    return { isAgoda, phone: rawPhone };
  };
}

module.exports = { buildAgodaDetector, normalizePhone, extractPhone };
