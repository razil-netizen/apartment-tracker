const HOSTAWAY_BASE_URL = "https://api.hostaway.com/v1";
const REQUEST_TIMEOUT_MS = 15000;

let cachedToken = null;
let cachedTokenExpiresAt = 0;

function withTimeout(options = {}) {
  return { ...options, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) };
}

async function getAccessToken({ accountId, apiKey }) {
  const now = Date.now();
  if (cachedToken && now < cachedTokenExpiresAt) {
    return cachedToken;
  }

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: accountId,
    client_secret: apiKey,
    scope: "general",
  });

  let res;
  try {
    res = await fetch(
      `${HOSTAWAY_BASE_URL}/accessTokens`,
      withTimeout({
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Cache-control": "no-cache",
        },
        body,
      })
    );
  } catch (err) {
    throw new Error(`Hostaway auth request failed: ${err.name === "TimeoutError" ? "timed out" : err.message}`);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Hostaway auth failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  cachedToken = data.access_token;
  // Refresh a bit early to avoid using an expired token.
  cachedTokenExpiresAt = now + Math.max((data.expires_in || 0) - 60, 60) * 1000;
  return cachedToken;
}

// Hard cap so a misbehaving API (ignoring offset, repeating pages, etc.)
// can never spin this loop into an out-of-memory crash.
const MAX_PAGES = 200;

async function fetchAllReservations({ accountId, apiKey }, { limit = 100 } = {}) {
  const token = await getAccessToken({ accountId, apiKey });
  const reservations = [];
  let offset = 0;
  let lastFirstId = null;

  for (let page = 0; page < MAX_PAGES; page++) {
    const url = new URL(`${HOSTAWAY_BASE_URL}/reservations`);
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("offset", String(offset));

    let res;
    try {
      res = await fetch(
        url,
        withTimeout({
          headers: {
            Authorization: `Bearer ${token}`,
            "Cache-control": "no-cache",
          },
        })
      );
    } catch (err) {
      throw new Error(
        `Hostaway reservations request failed: ${err.name === "TimeoutError" ? "timed out" : err.message}`
      );
    }

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Hostaway reservations fetch failed (${res.status}): ${text}`);
    }

    const data = await res.json();
    const items = Array.isArray(data.result) ? data.result : [];

    if (items.length === 0) break;

    // Some API responses ignore the offset param and just return the first
    // page again; detect that and stop instead of looping forever.
    const firstId = items[0] && items[0].id;
    if (firstId !== undefined && firstId === lastFirstId) break;
    lastFirstId = firstId;

    reservations.push(...items);

    const total = typeof data.count === "number" ? data.count : null;
    if (items.length < limit) break;
    if (total !== null && reservations.length >= total) break;

    offset += limit;
  }

  return reservations;
}

module.exports = { fetchAllReservations };
