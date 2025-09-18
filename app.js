// public/app.js
async function fetchClients() {
  try {
    const res = await fetch("/clients");
    const data = await res.json();
    const tbody = document.querySelector("#clientsTable tbody");
    tbody.innerHTML = "";
    data.forEach(c => {
      const tr = document.createElement("tr");
      const last = c.lastSeen ? new Date(c.lastSeen).toLocaleString() : "-";
      const cpu = c.info && c.info.cpuPercent ? (c.info.cpuPercent*100).toFixed(1) : "-";
      const memFree = c.info && c.info.memFree ? c.info.memFree : "-";
      const uptime = c.info && c.info.uptimeSeconds ? Math.round(c.info.uptimeSeconds) : "-";
      tr.innerHTML = `<td>${c.id}</td><td>${c.username}</td><td>${last}</td><td>${cpu}</td><td>${memFree}</td><td>${uptime}</td>`;
      tbody.appendChild(tr);
    });
  } catch (e) {
    console.error("failed fetch clients", e);
  }
}

fetchClients();
setInterval(fetchClients, 5000);