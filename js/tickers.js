// Drop Меню
document.querySelectorAll(".cex i, .cex-type i").forEach(el => {
  el.addEventListener("click", function (event) {
    event.stopPropagation();
    this.classList.toggle("on");
    this.nextElementSibling.classList.toggle("show");
  });
});
document.addEventListener("click", (event) => {
  document.querySelectorAll(".drop").forEach(menu => {
    if (!menu.closest(".cex, .cex-type").contains(event.target)) {
      menu.classList.remove("show");
      menu.previousElementSibling.classList.remove("on");
    }
  });
});

// Filter state
const filterState = {
  exchange: "binance",
  marketType: "spot",
};

// Drop selection handlers
document.querySelectorAll(".cex .drop a").forEach(el => {
  el.addEventListener("click", () => {
    filterState.exchange = el.getAttribute("rel");
    document.querySelectorAll(".cex .drop a").forEach(item => item.classList.remove("on"));
    el.classList.add("on");
    updateDropdownLabel(".cex", el.textContent);
    render();
  });
});

document.querySelectorAll(".cex-type .drop a").forEach(el => {
  el.addEventListener("click", () => {
    filterState.marketType = el.getAttribute("rel");
    document.querySelectorAll(".cex-type .drop a").forEach(item => item.classList.remove("on"));
    el.classList.add("on");
    updateDropdownLabel(".cex-type", el.textContent);
    render();
  });
});

function updateDropdownLabel(containerSelector, labelText) {
  const labelEl = document.querySelector(`${containerSelector} > i`);
  if (labelEl) {
    const b = labelEl.querySelector("b");
    if (b) b.textContent = labelText;
    labelEl.childNodes.forEach(node => {
      if (node.nodeType === Node.TEXT_NODE && node.textContent.trim() !== "") {
        node.remove();
      }
    });
  }
}

// Init
window.addEventListener("DOMContentLoaded", async () => {
  const savedHideSmall = localStorage.getItem("hideSmallVol") === "true";
  document.getElementById("hide-small").checked = savedHideSmall;

  const activeExchange = document.querySelector(`.cex .drop a[rel='${filterState.exchange}']`);
  if (activeExchange) {
    activeExchange.classList.add("on");
    updateDropdownLabel(".cex", activeExchange.textContent);
  }

  document.querySelectorAll(".cex-type .drop a").forEach(a => {
    if (a.getAttribute("rel") === filterState.marketType) {
      a.classList.add("on");
      updateDropdownLabel(".cex-type", a.textContent);
    }
  });

  await fetchTickers();
});

let tickers = [];
let autoUpdate = true;

const state = {
  sortBy: localStorage.getItem("sortBy") || "market_cap",
  ascending: localStorage.getItem("ascending") === "true" || false,
};

document.getElementById("toggle-update").addEventListener("click", () => {
  autoUpdate = !autoUpdate;
  const el = document.getElementById("toggle-update");
  el.classList.toggle("on", autoUpdate);
  el.querySelector("b").className = autoUpdate ? "icon-on" : "icon-off";
});

document.getElementById("hide-small").addEventListener("change", () => {
  const isChecked = document.getElementById("hide-small").checked;
  localStorage.setItem("hideSmallVol", isChecked);
  render();
});

document.querySelectorAll(".sortable").forEach(el => {
  el.addEventListener("click", () => {
    const col = el.dataset.col;
    if (state.sortBy === col) {
      state.ascending = !state.ascending;
    } else {
      state.sortBy = col;
      state.ascending = true;
    }
    saveSortState();
    render();
  });
});

function saveSortState() {
  localStorage.setItem("sortBy", state.sortBy);
  localStorage.setItem("ascending", state.ascending);
}

function getSortValue(ticker, key) {
  if (key === "symbol") return ticker.symbol?.toUpperCase() || "";
  const value = ticker[key];
  if (value === null || value === undefined || value === "—") return -Infinity;
  const num = parseFloat(value);
  return isNaN(num) ? -Infinity : num;
}

function formatPrice(price) {
  const num = parseFloat(price);
  if (num < 1) return num.toFixed(6);
  return num.toFixed(2);
}

function formatNumber(val) {
  const num = parseFloat(val);
  if (num >= 1e9) return (num / 1e9).toFixed(2) + "b";
  if (num >= 1e6) return (num / 1e6).toFixed(2) + "m";
  if (num >= 1e3) return (num / 1e3).toFixed(2) + "k";
  return num.toFixed(2);
}

function render() {
  const hideSmall = document.getElementById("hide-small").checked;

  const sorted = [...tickers].sort((a, b) => {
    const valA = getSortValue(a, state.sortBy);
    const valB = getSortValue(b, state.sortBy);

    if (state.sortBy === "symbol") {
      return state.ascending
        ? valA.localeCompare(valB)
        : valB.localeCompare(valA);
    }

    return state.ascending ? valA - valB : valB - valA;
  });

  const filtered = sorted.filter(t =>
    (!filterState.exchange || t.exchange === filterState.exchange) &&
    (!filterState.marketType || t.market_type === filterState.marketType)
  );

  const container = document.getElementById("ticker-list");
  container.innerHTML = "";

  let shown = 0;

  filtered.forEach(t => {
    if (hideSmall && t.volume_24h < 10_000_000) return;

    const changeClass = t.price_change > 0 ? "positive" : "negative";
    const changeColor = t.price_change > 0 ? "#0f0" : "#f55";
    const tickerUrl = `/${t.exchange}/${t.market_type}/${t.symbol}`;
    const displaySymbol = t.symbol.includes("PERP") ? t.symbol.replace("PERP", ".P") : t.symbol;
    const row = document.createElement("div");
    row.className = `ticker-row ${changeClass}`;
    row.innerHTML = `
      <div class="col"><a href="${tickerUrl}">${displaySymbol.toUpperCase()}</a></div>
      <div class="col">$${formatPrice(t.price)}</div>
      <div class="col" style="color:${changeColor}">${t.price_change.toFixed(2)}%</div>
      <div class="col">${formatNumber(t.volume_24h)}</div>
      <div class="col">${formatNumber(t.market_vol)}</div>
      <div class="col">${t.market_cap != null ? t.market_cap.toLocaleString("en-US", { maximumFractionDigits: 2 }) : "—"}</div>
    `;

    container.appendChild(row);
    shown++;
  });

  document.getElementById("ticker-count").innerText = shown;

  document.querySelectorAll(".sortable").forEach(el => {
    el.classList.remove("active", "asc", "desc");
    if (el.dataset.col === state.sortBy) {
      el.classList.add("active", state.ascending ? "asc" : "desc");
    }
  });
}

async function fetchTickers() {
  if (!autoUpdate) return;

  try {
    const res = await fetch("/tickers/json");
    const data = await res.json();
    tickers = data.map(t => ({
      ...t,
      exchange: t.exchange || "unknown",
      market_type: t.market_type || "spot"
    }));
    render();
  } catch (e) {
    console.error("Fetch error", e);
  }
}

setInterval(fetchTickers, 3000);

document.getElementById("clearStorage").addEventListener("click", () => {
  localStorage.removeItem("sortBy");
  localStorage.removeItem("ascending");
  localStorage.removeItem("hideSmallVol");
  location.reload();
});
