import { state } from "./state.js";

let timer = null;

export function renderClocks(container) {
  if (!container) return;
  container.innerHTML = "";
  state.timezones.forEach(tz => {
    const div = document.createElement("div");
    div.className = "clock";
    div.dataset.tz = tz;
    container.appendChild(div);
  });
  updateClocks(container);
}

export function updateClocks(container) {
  const now = new Date();
  container.querySelectorAll(".clock").forEach(el => {
    const tz = el.dataset.tz;
    try {
      const t = new Intl.DateTimeFormat("en-GB",{ timeZone: tz, hour:"2-digit", minute:"2-digit", second:"2-digit" }).format(now);
      el.textContent = `${tz}: ${t}`;
    } catch { el.textContent = `${tz}: [invalid tz]`; }
  });
}

export function startClockTicker(container) {
  if (timer) clearInterval(timer);
  timer = setInterval(() => updateClocks(container), 1000);
}
