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
// Overall wall-clock budget: return whatever we have rather than hang the
// request indefinitely if Hostaway has an unexpectedly large data set.
const MAX_TOTAL_MS = 45000;
// Hard cap on total records held in memory. Hostaway reservation objects can
// carry large nested fields (messages, documents, etc.); accumulating tens
// of thousands of raw objects is what previously crashed the process with
// an out-of-memory error. `mapItem` lets the caller slim each record down
// to only the fields it needs *before* it's added to the accumulator.
const MAX_RECORDS = 5000;

async function fetchAllReservations({ accountId, apiKey }, { limit = 100, mapItem = (x) => x } = {}) {
  const startedAt = Date.now();
  console.log("[hostaway] requesting access token...");
  const token = await getAccessToken({ accountId, apiKey });
  console.log("[hostaway] got access token, fetching reservations...");

  const reservations = [];
  let offset = 0;
  let lastFirstId = null;
  let truncated = false;

  for (let page = 0; page < MAX_PAGES; page++) {
    if (Date.now() - startedAt > MAX_TOTAL_MS) {
      console.log(`[hostaway] hit time budget after ${page} pages, ${reservations.length} reservations`);
      truncated = true;
      break;
    }

    const url = new URL(`${HOSTAWAY_BASE_URL}/reservations`);
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("offset", String(offset));

    console.log(`[hostaway] fetching page ${page} (offset ${offset})`);
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
    console.log(`[hostaway] page ${page} returned ${items.length} items`);

    if (items.length === 0) break;

    // Some API responses ignore the offset param and just return the first
    // page again; detect that and stop instead of looping forever.
    const firstId = items[0] && items[0].id;
    if (firstId !== undefined && firstId === lastFirstId) break;
    lastFirstId = firstId;

    for (const item of items) {
      reservations.push(mapItem(item));
    }

    if (reservations.length >= MAX_RECORDS) {
      console.log(`[hostaway] hit record cap (${MAX_RECORDS}), stopping`);
      truncated = true;
      break;
    }

    const total = typeof data.count === "number" ? data.count : null;
    if (items.length < limit) break;
    if (total !== null && reservations.length >= total) break;

    offset += limit;
  }

  console.log(`[hostaway] done: ${reservations.length} reservations, truncated=${truncated}`);
  return { reservations, truncated };
}

module.exports = { fetchAllReservations };
