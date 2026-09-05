# Apartment Tracker — Agoda Booking Detector

A small dashboard that pulls reservations from Hostaway and flags the ones that
are actually **Agoda** bookings, even when Hostaway shows a different channel.
Agoda masks the guest's real phone number with an OTA placeholder number when
calling/texting through Hostaway; this app detects that placeholder and marks
the reservation as an Agoda booking.

## How detection works

Hostaway's own `channelName` field is trusted for every channel except Agoda
bookings that get miscategorized. This app instead checks the guest's phone
number on each reservation against a configurable list of known Agoda
placeholder numbers (default: `+9712035640799`). If it matches, the
reservation is flagged as Agoda regardless of what channel Hostaway reports.

If you spot another Agoda placeholder number, add it to
`AGODA_PLACEHOLDER_PHONES` (comma-separated) — no code changes needed.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy `.env.example` to `.env` and fill in your Hostaway credentials:
   ```bash
   cp .env.example .env
   ```
   ```
   HOSTAWAY_ACCOUNT_ID=your_account_id
   HOSTAWAY_API_KEY=your_api_key
   AGODA_PLACEHOLDER_PHONES=+9712035640799
   ```
   **Never commit `.env`** — it's gitignored. Treat the API key as a secret;
   if it has ever been pasted somewhere outside your own systems, rotate it
   in Hostaway.
3. Run the dashboard:
   ```bash
   npm start
   ```
4. Open http://localhost:3000

## API

`GET /api/reservations` returns:
```json
{
  "total": 42,
  "agodaCount": 5,
  "reservations": [
    {
      "id": 123,
      "guestName": "Jane Doe",
      "listingName": "Paramount Tower 5007",
      "channelName": "Booking.com",
      "arrivalDate": "2026-09-05",
      "departureDate": "2026-09-06",
      "status": "new",
      "phone": "+9712035640799",
      "isAgoda": true
    }
  ]
}
```

## Notes / assumptions

- Hostaway's reservation phone field name has varied across accounts; the
  server checks `phone`, `guestPhone`, `guestPhoneNumber`, and
  `phoneNumber` and uses whichever is present. If your account uses a
  different field, add it to `PHONE_FIELD_CANDIDATES` in `src/agoda.js`.
- Phone comparison strips all non-digit characters before matching, so
  formatting differences (spaces, dashes, `+`) don't matter.
- This environment's outbound network access is restricted, so the Hostaway
  API calls could not be live-tested from here. Test against your real
  Hostaway account after deploying.
