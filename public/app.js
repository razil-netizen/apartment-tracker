let allReservations = [];

const rowsEl = document.getElementById("rows");
const emptyEl = document.getElementById("emptyState");
const errorEl = document.getElementById("errorState");
const statTotal = document.getElementById("statTotal");
const statAgoda = document.getElementById("statAgoda");
const lastUpdated = document.getElementById("lastUpdated");
const searchInput = document.getElementById("search");
const onlyAgodaInput = document.getElementById("onlyAgoda");

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}

function render() {
  const query = searchInput.value.trim().toLowerCase();
  const onlyAgoda = onlyAgodaInput.checked;

  const filtered = allReservations.filter((r) => {
    if (onlyAgoda && !r.isAgoda) return false;
    if (!query) return true;
    return (
      (r.guestName || "").toLowerCase().includes(query) ||
      (String(r.listingName) || "").toLowerCase().includes(query)
    );
  });

  rowsEl.innerHTML = filtered
    .map(
      (r) => `
    <tr class="${r.isAgoda ? "agoda" : ""}">
      <td>${escapeHtml(r.guestName)}</td>
      <td>${escapeHtml(r.listingName)}</td>
      <td><span class="badge channel">${escapeHtml(r.channelName)}</span></td>
      <td>${escapeHtml(r.arrivalDate)}</td>
      <td>${escapeHtml(r.departureDate)}</td>
      <td>${escapeHtml(r.status)}</td>
      <td>${escapeHtml(r.phone)}</td>
      <td>${r.isAgoda ? '<span class="badge">Agoda (phone match)</span>' : ""}</td>
    </tr>`
    )
    .join("");

  emptyEl.style.display = filtered.length ? "none" : "block";
}

async function loadReservations() {
  errorEl.style.display = "none";
  try {
    const res = await fetch("/api/reservations");
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to load reservations");

    allReservations = data.reservations;
    statTotal.textContent = data.total;
    statAgoda.textContent = data.agodaCount;
    lastUpdated.textContent = `Updated ${new Date().toLocaleTimeString()}${
      data.truncated ? " (list capped — very large account, showing a subset)" : ""
    }`;
    render();
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.style.display = "block";
  }
}

document.getElementById("refreshBtn").addEventListener("click", loadReservations);
searchInput.addEventListener("input", render);
onlyAgodaInput.addEventListener("change", render);

loadReservations();
