require("dotenv").config();
const path = require("path");
const express = require("express");
const { fetchAllReservations } = require("./hostaway");
const { buildAgodaDetector } = require("./agoda");

const PORT = process.env.PORT || 3000;
const HOSTAWAY_ACCOUNT_ID = process.env.HOSTAWAY_ACCOUNT_ID;
const HOSTAWAY_API_KEY = process.env.HOSTAWAY_API_KEY;
const isAgodaBooking = buildAgodaDetector(process.env.AGODA_PLACEHOLDER_PHONES);

if (!HOSTAWAY_ACCOUNT_ID || !HOSTAWAY_API_KEY) {
  console.warn(
    "HOSTAWAY_ACCOUNT_ID / HOSTAWAY_API_KEY are not set. Copy .env.example to .env and fill them in."
  );
}

const app = express();
app.use(express.static(path.join(__dirname, "..", "public")));

app.get("/api/reservations", async (req, res) => {
  if (!HOSTAWAY_ACCOUNT_ID || !HOSTAWAY_API_KEY) {
    return res.status(500).json({ error: "Hostaway credentials are not configured on the server." });
  }

  try {
    const { reservations: enriched, truncated } = await fetchAllReservations(
      { accountId: HOSTAWAY_ACCOUNT_ID, apiKey: HOSTAWAY_API_KEY },
      {
        mapItem: (r) => {
          const { isAgoda, phone } = isAgodaBooking(r);
          const listingName = r.listingName || r.listingMapId;
          // Hostaway reservation objects don't consistently carry a plain
          // "city" field across accounts, so fall back to matching the city
          // name inside whatever address/listing text is present.
          const city =
            r.listingCity ||
            r.city ||
            r.listingAddressCity ||
            r.propertyCity ||
            [listingName, r.listingAddress, r.address].filter(Boolean).join(" ");
          return {
            id: r.id,
            guestName: r.guestName || [r.guestFirstName, r.guestLastName].filter(Boolean).join(" "),
            listingName,
            city,
            channelName: r.channelName || r.channelId,
            arrivalDate: r.arrivalDate,
            departureDate: r.departureDate,
            status: r.status,
            reservationDate: r.reservationDate,
            phone,
            isAgoda,
          };
        },
      }
    );

    const agodaCount = enriched.filter((r) => r.isAgoda).length;

    res.json({
      total: enriched.length,
      agodaCount,
      truncated,
      reservations: enriched,
    });
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Apartment tracker dashboard running on http://localhost:${PORT}`);
});
