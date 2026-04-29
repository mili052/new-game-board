const state = {
  boards: [],
  selectedBoardId: ""
};

const PUBLIC_GATE_PASSWORD = "mimi2026";
const PUBLIC_GATE_STORAGE_KEY = "ngb-public-access";

const $ = selector => document.querySelector(selector);

function joinUrl(...parts) {
  return parts
    .filter(Boolean)
    .map((part, index) => {
      if (index === 0) return String(part).replace(/\/+$/, "");
      return String(part).replace(/^\/+|\/+$/g, "");
    })
    .join("/");
}

function basePath() {
  const pathname = window.location.pathname.replace(/\/report\.html$/, "");
  return pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  }[char]));
}

function splitTags(value) {
  return String(value || "")
    .split("/")
    .map(item => item.trim())
    .filter(Boolean);
}

function hasPublicAccess() {
  return localStorage.getItem(PUBLIC_GATE_STORAGE_KEY) === PUBLIC_GATE_PASSWORD;
}

function unlockPublicAccess() {
  document.body.classList.remove("gate-locked");
}

function lockPublicAccess() {
  document.body.classList.add("gate-locked");
}

function initPublicGate(onUnlock) {
  const form = $("#publicGateForm");
  const input = $("#publicGateInput");
  const message = $("#publicGateMessage");

  if (!form || !input || !message) {
    onUnlock();
    return;
  }

  if (hasPublicAccess()) {
    unlockPublicAccess();
    onUnlock();
    return;
  }

  lockPublicAccess();
  input.focus();

  form.addEventListener("submit", event => {
    event.preventDefault();
    if (input.value !== PUBLIC_GATE_PASSWORD) {
      message.textContent = "密码不对，再试一下。";
      input.select();
      return;
    }

    localStorage.setItem(PUBLIC_GATE_STORAGE_KEY, PUBLIC_GATE_PASSWORD);
    message.textContent = "";
    unlockPublicAccess();
    onUnlock();
  });
}

initPublicGate(() => {});

function primaryCategory(product) {
  return splitTags(product.genre)[0] || "未分类";
}

function statusClass(status) {
  if (/(畅销|上榜|榜单|Top|TOP)/.test(String(status || ""))) return "spotlight";
  if (/(测试|首测|终测)/.test(String(status || ""))) return "test";
  if (/(上线|公测|首发)/.test(String(status || ""))) return "launch";
  return "";
}

function badge(text, extraClass = "") {
  if (!text) return "";
  return `<span class="report-badge ${extraClass}">${escapeHtml(text)}</span>`;
}

function loadStaticBoards() {
  return fetch(joinUrl(basePath(), "data", "boards.json"), { cache: "no-store" })
    .then(response => response.json());
}

async function loadBoards() {
  try {
    const response = await fetch(joinUrl(basePath(), "api", "boards"), { cache: "no-store" });
    if (response.ok) return response.json();
  } catch {}
  return loadStaticBoards();
}

function metricsForBoard(board) {
  const products = board.products || [];
  const metrics = [...(board.metrics || [])];
  const focusCount = products.filter(product => product.focus).length;
  const statusCount = new Set(products.map(product => product.status).filter(Boolean)).size;
  const platformCount = new Set(products.flatMap(product => splitTags(product.platform))).size;

  if (!metrics.length) metrics.push(`收录产品 ${products.length} 款`);
  if (!metrics.some(metric => /重点/.test(metric))) metrics.push(`重点产品 ${focusCount} 款`);
  if (!metrics.some(metric => /状态|阶段/.test(metric))) metrics.push(`覆盖状态 ${statusCount} 类`);
  if (!metrics.some(metric => /平台/.test(metric))) metrics.push(`覆盖平台 ${platformCount || 1} 个`);

  return metrics.slice(0, 6);
}

function focusProducts(board) {
  const products = [...(board.products || [])]
    .sort((a, b) => Number(a.rank || 999) - Number(b.rank || 999));
  const focused = products.filter(product => product.focus);
  return (focused.length ? focused : products).slice(0, 4);
}

function trendItems(board) {
  const fromBoard = Array.isArray(board.trends) ? board.trends : [];
  const normalized = fromBoard
    .map(item => {
      if (!item) return null;
      if (typeof item === "string") return { title: item, text: "" };
      return {
        title: item.title || item.name || "趋势观察",
        text: item.text || item.summary || item.description || ""
      };
    })
    .filter(Boolean);

  if (normalized.length) return normalized.slice(0, 4);

  return focusProducts(board)
    .map(product => ({
      title: product.name,
      text: product.judgement || product.reason || product.publicNode || product.sourceText || ""
    }))
    .filter(item => item.text)
    .slice(0, 4);
}

function groupedProducts(board) {
  const groups = new Map();
  (board.products || [])
    .slice()
    .sort((a, b) => Number(a.rank || 999) - Number(b.rank || 999))
    .forEach(product => {
      const key = primaryCategory(product);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(product);
    });

  return [...groups.entries()]
    .map(([name, items]) => ({ name, items }))
    .sort((a, b) => b.items.length - a.items.length);
}

function coverImage(product) {
  return product.cover || product.icon || product.screenshots?.[0] || "";
}

function reportCard(product, rankText = "") {
  const cover = coverImage(product);
  const tags = [product.topic, product.platform].filter(Boolean);
  const summary = product.publicNode || product.reason || product.judgement || product.sourceText || "持续观察中。";

  return `
    <article class="report-card${product.focus ? " focus-card" : ""}">
      ${rankText ? `<div class="report-rank">${escapeHtml(rankText)}</div>` : ""}
      <div class="report-card-top">
        <div class="report-avatar">
          ${cover ? `<img src="${escapeHtml(cover)}" alt="${escapeHtml(product.name)}">` : `<span>${escapeHtml(String(product.name || "新游").slice(0, 2))}</span>`}
        </div>
        <div class="report-card-head">
          <h4>${escapeHtml(product.name || "未命名产品")}</h4>
          <p>${escapeHtml(product.genre || "未分类")}</p>
          <div class="report-badges">
            ${badge(product.status, statusClass(product.status))}
            ${product.focus ? badge("重点观察", "focus") : ""}
            ${tags.map(tag => badge(tag, "subtle")).join("")}
          </div>
        </div>
      </div>
      <div class="report-meta">
        <span><b>研发</b>${escapeHtml(product.developer || "待补充")}</span>
        <span><b>发行</b>${escapeHtml(product.publisher || "待补充")}</span>
      </div>
      <div class="report-copy">
        <span class="report-copy-label">公开节点</span>
        <p>${escapeHtml(product.publicNode || product.firstTestTime || product.launchTime || "待补充")}</p>
      </div>
      <div class="report-copy">
        <span class="report-copy-label">趋势判断</span>
        <p>${escapeHtml(summary)}</p>
      </div>
    </article>
  `;
}

function renderBoard(board) {
  const root = $("#reportRoot");
  if (!board) {
    root.innerHTML = `<div class="empty">还没有可生成的周报数据。</div>`;
    return;
  }

  const metrics = metricsForBoard(board);
  const trends = trendItems(board);
  const focuses = focusProducts(board);
  const groups = groupedProducts(board);

  root.innerHTML = `
    <section class="report-hero">
      <div class="report-kicker">产品分析报告</div>
      <div class="report-hero-top">
        <div>
          <h2>${escapeHtml(board.period || board.title || "新游周报")}</h2>
          <p>${escapeHtml(board.summary || "从飞书同步的新游数据自动生成，聚合重点产品、趋势判断与分类观察。")}</p>
        </div>
        <div class="report-date">${escapeHtml(board.date || "")}</div>
      </div>
      <div class="metric-row">
        ${metrics.map(metric => `<span class="metric">${escapeHtml(metric)}</span>`).join("")}
      </div>
    </section>

    ${trends.length ? `
      <section class="section">
        <div class="section-head">
          <div>
            <h3>本周趋势判断</h3>
            <div class="sub">优先展示重点产品中带有趋势判断或公开节点的内容</div>
          </div>
        </div>
        <div class="trend-grid report-trend-grid">
          ${trends.map(item => `
            <article class="trend-card">
              <b>${escapeHtml(item.title)}</b>
              <p>${escapeHtml(item.text || "待补充")}</p>
            </article>
          `).join("")}
        </div>
      </section>
    ` : ""}

    ${focuses.length ? `
      <section class="section">
        <div class="section-head">
          <div>
            <h3>本周重点产品</h3>
            <div class="sub">优先使用重点标记，其次按排序字段取前四</div>
          </div>
        </div>
        <div class="lead-grid report-focus-grid">
          ${focuses.map((product, index) => reportCard(product, `#${index + 1}`)).join("")}
        </div>
      </section>
    ` : ""}

    <section class="section report-groups">
      ${groups.map(group => `
        <section class="report-group">
          <div class="section-head">
            <div>
              <h3>${escapeHtml(group.name)}</h3>
              <div class="sub">${group.items.length} 款，按 rank 字段排序展示</div>
            </div>
          </div>
          <div class="cards-grid category-grid report-category-grid">
            ${group.items.map(product => reportCard(product)).join("")}
          </div>
        </section>
      `).join("")}
    </section>
  `;

  document.title = `${board.period || board.title || "新游周报"} - 新游周报`;
}

function syncSelect() {
  const select = $("#reportBoardSelect");
  select.innerHTML = state.boards
    .map(board => `<option value="${escapeHtml(board.id)}">${escapeHtml(board.period || board.title || board.id)}</option>`)
    .join("");
  if (state.selectedBoardId) select.value = state.selectedBoardId;
}

function syncRoute() {
  const url = new URL(window.location.href);
  url.searchParams.set("board", state.selectedBoardId);
  window.history.replaceState({}, "", `${url.pathname}${url.search}`);
}

async function boot() {
  const data = await loadBoards();
  state.boards = data.boards || [];
  const params = new URLSearchParams(window.location.search);
  state.selectedBoardId = params.get("board") || state.boards[0]?.id || "";
  syncSelect();
  renderBoard(state.boards.find(board => board.id === state.selectedBoardId) || state.boards[0]);

  $("#reportBoardSelect").addEventListener("change", event => {
    state.selectedBoardId = event.target.value;
    syncRoute();
    renderBoard(state.boards.find(board => board.id === state.selectedBoardId));
  });
}

boot().catch(error => {
  $("#reportRoot").innerHTML = `<div class="empty">${escapeHtml(error.message || "周报生成失败")}</div>`;
});
