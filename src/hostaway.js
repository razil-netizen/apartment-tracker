const HOSTAWAY_BASE_URL = "https://api.hostaway.com/v1";

let cachedToken = null;
let cachedTokenExpiresAt = 0;

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

  const res = await fetch(`${HOSTAWAY_BASE_URL}/accessTokens`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Cache-control": "no-cache",
    },
    body,
  });

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

async function fetchAllReservations({ accountId, apiKey }, { limit = 100 } = {}) {
  const token = await getAccessToken({ accountId, apiKey });
  const reservations = [];
  let offset = 0;

  while (true) {
    const url = new URL(`${HOSTAWAY_BASE_URL}/reservations`);
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("offset", String(offset));

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Cache-control": "no-cache",
      },
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Hostaway reservations fetch failed (${res.status}): ${text}`);
    }

    const data = await res.json();
    const page = data.result || [];
    reservations.push(...page);

    if (page.length < limit) break;
    offset += limit;
  }

  return reservations;
}

module.exports = { fetchAllReservations };
