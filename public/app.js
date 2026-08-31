const state = {
  boards: [],
  selectedBoardId: "",
  selectedProductId: "",
  token: localStorage.getItem("ngbToken") || "",
  aiImageUrl: "",
  staticMode: false,
  radarFilter: "",
  rankingExpanded: false,
  ipExpanded: false
};

const PUBLIC_GATE_PASSWORD = "mimi2026";
const PUBLIC_GATE_STORAGE_KEY = "ngb-public-access";
const PUBLIC_GATE_SESSION_KEY = "ngb-public-access-session";
const SITE_CACHE_PREFIX = "new-game-board";

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
  const path = window.location.pathname.replace(/\/index\.html$/, "");
  return path.endsWith("/") ? path.slice(0, -1) : path;
}

async function loadStaticBoards() {
  const dataUrl = new URL(joinUrl(basePath(), "data", "boards.json"), window.location.origin);
  dataUrl.searchParams.set("v", String(Date.now()));
  const response = await fetch(dataUrl.toString(), { cache: "no-store" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error("静态数据加载失败");
  state.staticMode = true;
  return data;
}

async function api(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (state.token) headers.Authorization = `Bearer ${state.token}`;
  const response = await fetch(joinUrl(basePath(), path), { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "请求失败");
  return data;
}

function uid(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function hasPublicAccess() {
  try {
    if (localStorage.getItem(PUBLIC_GATE_STORAGE_KEY) === PUBLIC_GATE_PASSWORD) return true;
  } catch {}
  try {
    if (sessionStorage.getItem(PUBLIC_GATE_SESSION_KEY) === PUBLIC_GATE_PASSWORD) return true;
  } catch {}
  return false;
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
  const normalizePassword = value => String(value || "").trim();

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
  enhancePublicGate(form, input);
  input.focus();

  form.addEventListener("submit", event => {
    event.preventDefault();
    if (normalizePassword(input.value) !== PUBLIC_GATE_PASSWORD) {
      message.textContent = "\u5bc6\u7801\u4e0d\u5bf9\uff0c\u518d\u8bd5\u4e00\u4e0b\u3002";
      input.select();
      return;
    }

    persistPublicAccess();
    message.textContent = "";
    unlockPublicAccess();
    onUnlock();
  });
}

function enhancePublicGate(form, input) {
  let field = form.querySelector(".password-field");
  let toggle = $("#publicGateToggle");
  let remember = $("#publicGateRemember");

  if (!field) {
    field = document.createElement("div");
    field.className = "password-field";
    input.parentNode.insertBefore(field, input);
    field.appendChild(input);
  }

  if (!toggle) {
    toggle = document.createElement("button");
    toggle.id = "publicGateToggle";
    toggle.className = "password-toggle";
    toggle.type = "button";
    toggle.setAttribute("aria-label", "\u663e\u793a\u5bc6\u7801");
    toggle.textContent = "\u{1F441}";
    field.appendChild(toggle);
  }

  if (!remember) {
    const rememberLabel = document.createElement("label");
    rememberLabel.className = "remember-check";

    remember = document.createElement("input");
    remember.id = "publicGateRemember";
    remember.type = "checkbox";
    remember.checked = true;

    const text = document.createElement("span");
    text.textContent = "\u8bb0\u4f4f\u672c\u673a";

    rememberLabel.appendChild(remember);
    rememberLabel.appendChild(text);
    form.insertBefore(rememberLabel, form.querySelector(".primary"));
  }

  toggle.addEventListener("click", () => {
    const nextType = input.type === "password" ? "text" : "password";
    input.type = nextType;
    toggle.textContent = nextType === "password" ? "\u{1F441}" : "\u{1F648}";
    toggle.setAttribute("aria-label", nextType === "password" ? "\u663e\u793a\u5bc6\u7801" : "\u9690\u85cf\u5bc6\u7801");
    input.focus();
  });
}

function persistPublicAccess() {
  const remember = $("#publicGateRemember");

  try {
    if (!remember || remember.checked) {
      localStorage.setItem(PUBLIC_GATE_STORAGE_KEY, PUBLIC_GATE_PASSWORD);
    } else {
      localStorage.removeItem(PUBLIC_GATE_STORAGE_KEY);
    }
  } catch {}

  try {
    sessionStorage.setItem(PUBLIC_GATE_SESSION_KEY, PUBLIC_GATE_PASSWORD);
  } catch {}
}

async function clearLegacySiteCaches() {
  try {
    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map(registration => registration.unregister()));
    }
  } catch {}

  try {
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter(key => key.startsWith(SITE_CACHE_PREFIX))
          .map(key => caches.delete(key))
      );
    }
  } catch {}
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

function currentBoard() {
  return state.boards.find(board => board.id === state.selectedBoardId) || state.boards[0] || null;
}

function currentProduct() {
  const board = currentBoard();
  return board?.products.find(product => product.id === state.selectedProductId) || board?.products?.[0] || null;
}

function boardById(id) {
  return state.boards.find(board => board.id === id) || null;
}

function findProduct(boardId, productId) {
  return boardById(boardId)?.products?.find(product => product.id === productId) || null;
}

function getInitial(name) {
  return escapeHtml(String(name || "游戏").slice(0, 2));
}

function media(src, name, className = "cover") {
  if (src) return `<img class="${className}" src="${escapeHtml(src)}" alt="${escapeHtml(name)}">`;
  return `<div class="${className} placeholder"><span>${getInitial(name)}</span><small>待补图</small></div>`;
}

function splitTags(value) {
  return String(value || "")
    .split("/")
    .map(item => item.trim())
    .filter(Boolean);
}

function primaryCategory(product) {
  return splitTags(product.genre)[0] || "未分类";
}

function isRankingStatus(status) {
  return /(上榜|畅销|榜单|top)/i.test(String(status || ""));
}

function statusBadge(status) {
  if (!status) return "";
  return `<span class="badge${isRankingStatus(status) ? " spotlight" : ""}">${escapeHtml(status)}</span>`;
}

function groupProductsByCategory(products) {
  const groups = new Map();
  products.forEach(product => {
    const category = primaryCategory(product);
    if (!groups.has(category)) groups.set(category, []);
    groups.get(category).push(product);
  });
  return [...groups.entries()].map(([category, items]) => ({ category, items }));
}

function screenshotGallery(product, className = "screenshots") {
  const shots = product.screenshots || [];
  if (!shots.length) return "";
  return `
    <div class="${className}">
      ${shots.map((src, index) => `
        <a class="shot-link" href="${escapeHtml(src)}" target="_blank" rel="noreferrer" aria-label="${escapeHtml(product.name)} 截图 ${index + 1}">
          <img src="${escapeHtml(src)}" alt="${escapeHtml(product.name)} 截图 ${index + 1}">
        </a>
      `).join("")}
    </div>
  `;
}

function productCard(product, boardId) {
  const poster = product.cover || product.screenshots?.[0] || "";
  const tags = [product.genre, product.topic, product.platform].filter(Boolean);
  const ranking = isRankingStatus(product.status);
  const shot = product.screenshots?.[0] || "";
  const note = product.sourceText || product.publicNode || product.judgement || "\u6301\u7eed\u89c2\u5bdf\u4e2d\u3002";
  const primaryTime = product.latestNodeTime
    ? `\u6700\u65b0\u8282\u70b9 ${escapeHtml(product.latestNodeTime)}`
    : (product.month ? `\u5f52\u5c5e\u6708 ${escapeHtml(product.month)}` : "");
  const secondaryTime = product.firstTestTime ? `\u9996\u6d4b ${escapeHtml(product.firstTestTime)}` : "";

  return `
    <article class="product-card product-entry${ranking ? " status-featured" : ""}" data-open-product="${escapeHtml(product.id)}" data-open-board="${escapeHtml(boardId)}" tabindex="0">
      ${ranking ? `<div class="status-ribbon">${escapeHtml(product.status)}</div>` : ""}
      <div class="product-top tap-card-top">
        <div class="cover-shell">${media(poster, product.name)}</div>
        <div class="tap-card-head">
          <h4 class="product-name">${escapeHtml(product.name)}</h4>
          <div class="meta">${escapeHtml(tags.join(" / ") || "\u672a\u5206\u7c7b")}</div>
          <div class="badges inline-badges">
            ${statusBadge(product.status)}
            ${product.focus ? `<span class="badge focus">\u91cd\u70b9\u5173\u6ce8</span>` : ""}
          </div>
        </div>
      </div>
      <div class="feed-layout">
        <div class="feed-main">
          <p class="tap-summary">${escapeHtml(note)}</p>
          <a class="feed-detail-link" href="/new-game-board/?board=${encodeURIComponent(boardId)}&product=${encodeURIComponent(product.id)}">\u70b9\u51fb\u67e5\u770b\u8be6\u60c5</a>
        </div>
        <div class="feed-side">
          <div class="tap-meta-grid">
            <span>\u7814\u53d1 ${escapeHtml(product.developer || "\u5f85\u8865\u5145")}</span>
            <span>\u53d1\u884c ${escapeHtml(product.publisher || "\u5f85\u8865\u5145")}</span>
            ${primaryTime ? `<span>${primaryTime}</span>` : ""}
            ${secondaryTime ? `<span>${secondaryTime}</span>` : ""}
          </div>
          ${shot ? `<a class="feed-shot" href="${escapeHtml(shot)}" target="_blank" rel="noreferrer" aria-label="${escapeHtml(product.name)} \u622a\u56fe"><img src="${escapeHtml(shot)}" alt="${escapeHtml(product.name)} \u622a\u56fe"></a>` : ""}
        </div>
      </div>
    </article>
  `;
}
function filteredProducts(board) {
  const status = $("#statusFilter").value;
  const q = $("#searchInput").value.trim().toLowerCase();
  return [...(board.products || [])]
    .sort((a, b) => Number(a.rank || 999) - Number(b.rank || 999))
    .filter(product => !status || product.status === status)
    .filter(product => {
      if (!q) return true;
      return [
        product.name,
        product.genre,
        product.topic,
        product.platform,
        product.developer,
        product.publisher,
        product.publicNode,
        product.reason,
        product.judgement,
        product.status
      ].some(value => String(value || "").toLowerCase().includes(q));
    });
}

function renderFilters() {
  const periodFilter = $("#periodFilter");
  const statusFilter = $("#statusFilter");
  const currentPeriod = periodFilter.value || "all";
  const currentStatus = statusFilter.value || "";

  periodFilter.innerHTML = `<option value="all">全部时间</option>` + state.boards
    .map(board => `<option value="${escapeHtml(board.id)}">${escapeHtml(board.period || board.title)}</option>`)
    .join("");
  const defaultPeriod = state.boards.find(board => board.period === "8月")?.id || state.boards[0]?.id || "all";
  periodFilter.value = state.boards.some(board => board.id === currentPeriod) ? currentPeriod : defaultPeriod;

  const statuses = [...new Set(state.boards.flatMap(board => (board.products || []).map(product => product.status).filter(Boolean)))];
  statusFilter.innerHTML = `<option value="">全部状态</option>` + statuses
    .map(status => `<option value="${escapeHtml(status)}">${escapeHtml(status)}</option>`)
    .join("");
  statusFilter.value = statuses.includes(currentStatus) ? currentStatus : "";
  syncReportLink();
}

function syncReportLink() {
  const link = $("#reportLink");
  if (!link) return;
  const selected = $("#periodFilter")?.value;
  const boardId =
    selected && selected !== "all"
      ? selected
      : (state.boards[0]?.id || "");

  link.href = boardId ? `./report.html?board=${encodeURIComponent(boardId)}` : "./report.html";
  link.classList.toggle("disabled", !boardId);
  link.setAttribute("aria-disabled", boardId ? "false" : "true");
}

function productUrl(boardId, productId) {
  const url = new URL(window.location.href);
  url.searchParams.set("board", boardId);
  url.searchParams.set("product", productId);
  return `${url.pathname}${url.search}`;
}

function getRouteDetail() {
  const params = new URLSearchParams(window.location.search);
  const boardId = params.get("board");
  const productId = params.get("product");
  if (!boardId || !productId) return null;
  return { boardId, productId };
}

function setDetailRoute(boardId, productId, replace = false) {
  const nextUrl = productUrl(boardId, productId);
  const method = replace ? "replaceState" : "pushState";
  window.history[method]({ boardId, productId }, "", nextUrl);
}

function clearDetailRoute(replace = false) {
  const url = new URL(window.location.href);
  url.searchParams.delete("board");
  url.searchParams.delete("product");
  const nextUrl = `${url.pathname}${url.search}`;
  const method = replace ? "replaceState" : "pushState";
  window.history[method]({}, "", nextUrl);
}

function getRouteView() {
  return new URLSearchParams(window.location.search).get("view") || "";
}

function setTestingRoute(replace = false) {
  const url = new URL(window.location.href);
  url.searchParams.delete("board");
  url.searchParams.delete("product");
  url.searchParams.set("view", "testing");
  const method = replace ? "replaceState" : "pushState";
  window.history[method]({}, "", `${url.pathname}${url.search}`);
}

function clearTestingRoute(replace = false) {
  const url = new URL(window.location.href);
  url.searchParams.delete("view");
  const method = replace ? "replaceState" : "pushState";
  window.history[method]({}, "", `${url.pathname}${url.search}`);
}

function testingStage(product) {
  const status = String(product.status || "");
  if (/招募/.test(status)) return "招募";
  if (/付费/.test(status)) return "付费测试";
  if (/不限量/.test(status)) return "不限量测试";
  if (/三测|四测|五测/.test(status)) return "三测+";
  if (/二测/.test(status)) return "二测";
  return "首测";
}

function testingDate(product) {
  return String(product.latestNodeTime || product.firstTestTime || product.createdAt || "").slice(0, 10);
}

function renderTestingPage() {
  if (getRouteView() !== "testing") return false;
  const page = $("#productPage");
  const root = $("#boardRoot");
  const boards = state.boards || [];
  const currentBoardId = page.dataset.testingBoard || boards[0]?.id || "";
  const board = boards.find(item => item.id === currentBoardId) || boards[0];
  if (!board) return false;

  page.dataset.testingBoard = board.id;
  page.classList.remove("hidden");
  root.classList.add("hidden");
  setMobileMode(false);
  setMobileNavActive("ranking");
  document.title = "测试新游 - 新游产品雷达";

  const allTesting = (board.products || []).filter(product => /测试|招募|首测|二测|三测|付费|不限量/.test(String(product.status || "")));
  const stages = ["全部阶段", "招募", "首测", "二测", "三测+", "付费测试", "不限量测试"];
  const genres = [...new Set(allTesting.map(primaryCategory).filter(Boolean))].sort();
  const platforms = [...new Set(allTesting.map(product => product.platform).filter(Boolean))].sort();
  const query = page.dataset.testingQuery || "";
  const stage = page.dataset.testingStage || "";
  const genre = page.dataset.testingGenre || "";
  const platform = page.dataset.testingPlatform || "";
  const filtered = allTesting.filter(product => {
    const matchesQuery = !query || [product.name, product.genre, product.topic, product.developer, product.publisher, product.platform].some(value => String(value || "").toLowerCase().includes(query.toLowerCase()));
    return matchesQuery && (!stage || testingStage(product) === stage) && (!genre || primaryCategory(product) === genre) && (!platform || String(product.platform || "") === platform);
  });
  const grouped = new Map();
  filtered.sort((a, b) => testingDate(b).localeCompare(testingDate(a))).forEach(product => {
    const date = testingDate(product) || "待补日期";
    if (!grouped.has(date)) grouped.set(date, []);
    grouped.get(date).push(product);
  });
  const dateGroups = [...grouped.entries()].map(([date, products]) => `<section class="testing-date-group"><div class="testing-date-node"><time>${escapeHtml(date.slice(5).replace("-", "."))}</time><span></span></div><div class="testing-date-products">${products.map(product => `<button class="testing-detail-row" type="button" data-open-product="${escapeHtml(product.id)}" data-open-board="${escapeHtml(board.id)}"><span class="mini-cover">${media(product.cover || product.icon || product.screenshots?.[0], product.name, "mini-cover-img")}</span><span class="testing-detail-copy"><b>${escapeHtml(product.name)}</b><small>${escapeHtml(primaryCategory(product))} · ${escapeHtml(product.developer || "研发待补充")} / ${escapeHtml(product.publisher || "发行待补充")}</small></span><span>${escapeHtml(product.platform || "平台待补充")}</span><em class="stage-tag ${testingStage(product) === "招募" ? "recruit" : ""}">${testingStage(product)}</em></button>`).join("")}</div></section>`).join("");
  const countStage = value => allTesting.filter(product => !value || testingStage(product) === value).length;
  page.innerHTML = `<section class="testing-page"><div class="testing-page-head"><button class="ghost testing-back" type="button">← 返回首页</button><div><span class="panel-kicker">TESTING LIBRARY</span><h2>${escapeHtml(board.period || board.title || "当前月份")}测试新游</h2><p>按测试节点整理当前月份全部测试产品</p></div></div><div class="testing-toolbar"><label>月份<select id="testingMonthFilter">${boards.map(item => `<option value="${escapeHtml(item.id)}" ${item.id === board.id ? "selected" : ""}>${escapeHtml(item.period || item.title)}</option>`).join("")}</select></label><label>测试阶段<select id="testingStageFilter"><option value="">全部阶段</option>${stages.slice(1).map(item => `<option value="${item}" ${item === stage ? "selected" : ""}>${item}</option>`).join("")}</select></label><label>品类<select id="testingGenreFilter"><option value="">全部品类</option>${genres.map(item => `<option value="${escapeHtml(item)}" ${item === genre ? "selected" : ""}>${escapeHtml(item)}</option>`).join("")}</select></label><label>平台<select id="testingPlatformFilter"><option value="">全部平台</option>${platforms.map(item => `<option value="${escapeHtml(item)}" ${item === platform ? "selected" : ""}>${escapeHtml(item)}</option>`).join("")}</select></label><label class="testing-search">搜索<input id="testingSearchInput" type="search" value="${escapeHtml(query)}" placeholder="产品 / 研发 / 发行"></label></div><div class="testing-metrics"><span>本月测试<strong>${filtered.length}</strong></span><span>首测<strong>${countStage("首测")}</strong></span><span>二测<strong>${countStage("二测")}</strong></span><span>招募<strong>${countStage("招募")}</strong></span><span>付费测试<strong>${countStage("付费测试")}</strong></span></div><div class="testing-timeline">${dateGroups || `<div class="empty">当前筛选条件下暂无测试产品</div>`}</div></section>`;
  page.querySelectorAll("[data-open-product]").forEach(button => button.addEventListener("click", () => {
    setDetailRoute(button.dataset.openBoard, button.dataset.openProduct);
    renderApp();
  }));
  $(".testing-back").addEventListener("click", () => { clearTestingRoute(); renderApp(); });
  $("#testingMonthFilter").addEventListener("change", event => { page.dataset.testingBoard = event.target.value; renderTestingPage(); });
  $("#testingStageFilter").addEventListener("change", event => { page.dataset.testingStage = event.target.value; renderTestingPage(); });
  $("#testingGenreFilter").addEventListener("change", event => { page.dataset.testingGenre = event.target.value; renderTestingPage(); });
  $("#testingPlatformFilter").addEventListener("change", event => { page.dataset.testingPlatform = event.target.value; renderTestingPage(); });
  $("#testingSearchInput").addEventListener("input", event => { page.dataset.testingQuery = event.target.value; renderTestingPage(); });
  return true;
}

function rankingDate(product) {
  return String(product.firstRankTime || product.firstChartTime || product.firstRankingTime || product.latestNodeTime || product.createdAt || "").slice(0, 10);
}

function setRankingRoute(replace = false) {
  const url = new URL(window.location.href);
  url.searchParams.delete("board");
  url.searchParams.delete("product");
  url.searchParams.set("view", "ranking");
  const method = replace ? "replaceState" : "pushState";
  window.history[method]({}, "", `${url.pathname}${url.search}`);
}

function clearRankingRoute(replace = false) {
  const url = new URL(window.location.href);
  url.searchParams.delete("view");
  const method = replace ? "replaceState" : "pushState";
  window.history[method]({}, "", `${url.pathname}${url.search}`);
}

function renderRankingPage() {
  if (getRouteView() !== "ranking") return false;
  const page = $("#productPage");
  const root = $("#boardRoot");
  const boards = state.boards || [];
  const board = boards.find(item => item.id === (page.dataset.rankingBoard || boards[0]?.id)) || boards[0];
  if (!board) return false;
  page.dataset.rankingBoard = board.id;
  page.classList.remove("hidden");
  root.classList.add("hidden");
  setMobileMode(false);
  setMobileNavActive("ranking");
  document.title = "畅销榜新游 - 新游产品雷达";

  const allRanking = (board.products || []).filter(product => isRankingStatus(product.status));
  const platform = page.dataset.rankingPlatform || "";
  const genre = page.dataset.rankingGenre || "";
  const query = page.dataset.rankingQuery || "";
  const genres = [...new Set(allRanking.map(primaryCategory).filter(Boolean))].sort();
  const filtered = allRanking.filter(product => {
    const text = [product.name, product.genre, product.topic, product.developer, product.publisher, product.platform].join(" ").toLowerCase();
    return (!query || text.includes(query.toLowerCase())) && (!platform || String(product.platform || "").toLowerCase().includes(platform.toLowerCase())) && (!genre || primaryCategory(product) === genre);
  }).sort((a, b) => rankingDate(b).localeCompare(rankingDate(a)));
  const groups = new Map();
  filtered.forEach(product => { const date = rankingDate(product) || "待补日期"; if (!groups.has(date)) groups.set(date, []); groups.get(date).push(product); });
  const timeline = [...groups.entries()].map(([date, products]) => `<section class="ranking-date-group"><div class="ranking-date-node"><time>${escapeHtml(date.slice(5).replace("-", "."))}</time><span></span></div><div class="ranking-date-products">${products.map(product => `<button class="ranking-detail-row" type="button" data-open-product="${escapeHtml(product.id)}" data-open-board="${escapeHtml(board.id)}"><span class="mini-cover">${media(product.cover || product.icon || product.screenshots?.[0], product.name, "mini-cover-img")}</span><span class="ranking-detail-copy"><b>${escapeHtml(product.name)}</b><small>${escapeHtml(primaryCategory(product))} · ${escapeHtml(product.developer || "研发待补充")} / ${escapeHtml(product.publisher || "发行待补充")}</small></span><span>${escapeHtml(product.platform || "平台待补充")}</span><span class="rank-current">#${escapeHtml(product.rank || "—")}</span><span class="rank-high">#${escapeHtml(product.highestRank || product.maxRank || product.rank || "—")}</span></button>`).join("")}</div></section>`).join("");
  page.innerHTML = `<section class="testing-page ranking-page"><div class="testing-page-head"><button class="ghost ranking-back" type="button">← 返回首页</button><div><span class="panel-kicker">RANKING LIBRARY</span><h2>${escapeHtml(board.period || board.title || "当前月份")}畅销榜新游</h2><p>按首次进榜日期整理当前月份全部畅销榜新游</p></div></div><div class="testing-toolbar ranking-toolbar"><label>月份<select id="rankingMonthFilter">${boards.map(item => `<option value="${escapeHtml(item.id)}" ${item.id === board.id ? "selected" : ""}>${escapeHtml(item.period || item.title)}</option>`).join("")}</select></label><label>平台<select id="rankingPlatformFilter"><option value="">全部平台</option><option value="微小" ${platform === "微小" ? "selected" : ""}>微信小游戏</option><option value="抖小" ${platform === "抖小" ? "selected" : ""}>抖音小游戏</option><option value="IOS" ${platform === "IOS" ? "selected" : ""}>iOS</option><option value="TapTap" ${platform === "TapTap" ? "selected" : ""}>TapTap</option></select></label><label>品类<select id="rankingGenreFilter"><option value="">全部品类</option>${genres.map(item => `<option value="${escapeHtml(item)}" ${item === genre ? "selected" : ""}>${escapeHtml(item)}</option>`).join("")}</select></label><label class="testing-search">搜索<input id="rankingSearchInput" type="search" value="${escapeHtml(query)}" placeholder="产品 / 研发 / 发行"></label></div><div class="testing-metrics"><span>本月上榜<strong>${filtered.length}</strong></span><span>微信小游戏<strong>${filtered.filter(product => String(product.platform || "").includes("微小")).length}</strong></span><span>抖音小游戏<strong>${filtered.filter(product => String(product.platform || "").includes("抖小")).length}</strong></span><span>iOS<strong>${filtered.filter(product => String(product.platform || "").toLowerCase().includes("ios")).length}</strong></span><span>其他平台<strong>${filtered.filter(product => !/微小|抖小|ios/i.test(String(product.platform || ""))).length}</strong></span></div><div class="ranking-timeline">${timeline || `<div class="empty">当前筛选条件下暂无畅销榜新游</div>`}</div></section>`;
  page.querySelectorAll("[data-open-product]").forEach(button => button.addEventListener("click", () => { setDetailRoute(button.dataset.openBoard, button.dataset.openProduct); renderApp(); }));
  $(".ranking-back").addEventListener("click", () => { clearRankingRoute(); renderApp(); });
  $("#rankingMonthFilter").addEventListener("change", event => { page.dataset.rankingBoard = event.target.value; renderRankingPage(); });
  $("#rankingPlatformFilter").addEventListener("change", event => { page.dataset.rankingPlatform = event.target.value; renderRankingPage(); });
  $("#rankingGenreFilter").addEventListener("change", event => { page.dataset.rankingGenre = event.target.value; renderRankingPage(); });
  $("#rankingSearchInput").addEventListener("input", event => { page.dataset.rankingQuery = event.target.value; renderRankingPage(); });
  return true;
}

function setMobileMode(detailOpen) {
  document.body.classList.toggle("detail-open", Boolean(detailOpen));
}

function setMobileNavActive(target = "home") {
  document.querySelectorAll(".mobile-nav-item").forEach(item => {
    item.classList.toggle("active", item.dataset.navTarget === target);
  });
}

function scrollToSection(target) {
  const selectors = {
    home: "#boardRoot .library-hero",
    ranking: "#boardRoot .ranking-zone",
    categories: "#boardRoot .category-stack",
    search: "#libraryFilters"
  };
  const node = document.querySelector(selectors[target] || selectors.home);
  if (node) node.scrollIntoView({ behavior: "smooth", block: "start" });
  if (target === "search") $("#searchInput")?.focus();
}

function renderBoard() {
  const root = $("#boardRoot");
  const selected = $("#periodFilter").value;
  const boards = selected && selected !== "all" ? state.boards.filter(board => board.id === selected) : state.boards;
  const products = boards.flatMap(board => (board.products || []).map(product => ({ ...product, boardId: board.id })));
  if (!products.length) { root.innerHTML = `<div class="empty">还没有可展示的产品。</div>`; return; }
  const latestBoard = boards[0] || state.boards[0] || { products: [] };
  const monthProducts = latestBoard.products || [];
  const byNodeDate = (a, b) => String(b.latestNodeTime || b.createdAt || "").localeCompare(String(a.latestNodeTime || a.createdAt || ""));
  const monthRanking = monthProducts.filter(product => isRankingStatus(product.status)).sort(byNodeDate);
  const now = new Date();
  const dateText = now.toISOString().slice(0, 10);
  const allPublished = products.filter(product => !product.releaseStatus || product.releaseStatus === "可发布");
  const radarFilter = state.radarFilter;
  const visibleProducts = radarFilter === "重点"
    ? allPublished.filter(product => product.focus)
    : radarFilter === "上榜"
      ? allPublished.filter(product => isRankingStatus(product.status))
      : radarFilter === "上线"
        ? allPublished.filter(product => /上线|公测/.test(product.status || ""))
        : radarFilter
          ? allPublished.filter(product => [product.status, product.platform, product.genre, product.topic].some(value => String(value || "").toLowerCase().includes(radarFilter.toLowerCase())))
          : allPublished;
  const scopedProducts = visibleProducts;
  const ranking = scopedProducts.filter(product => isRankingStatus(product.status)).sort(byNodeDate);
  const testing = scopedProducts.filter(product => /测试|招募|首测|二测/.test(String(product.status || ""))).sort(byNodeDate);
  const focus = scopedProducts.filter(product => product.focus);
  const latest = [...scopedProducts].sort((a, b) => String(b.latestNodeTime || b.createdAt || "").localeCompare(String(a.latestNodeTime || a.createdAt || "")));
  const recent = latest.slice(0, 10);
  const week = allPublished.filter(product => String(product.latestNodeTime || "").slice(0, 7) === dateText.slice(0, 7));
  const categories = [...new Set(scopedProducts.map(primaryCategory))].slice(0, 8);
  const monthLabel = latestBoard.period || latestBoard.title?.replace(/新游产品库$/, "") || "当前月份";
  const previousBoard = state.boards[state.boards.findIndex(board => board.id === latestBoard.id) + 1];
  const previousProducts = previousBoard?.products || [];
  const categoryCount = products => products.reduce((counts, product) => { const category = primaryCategory(product); counts[category] = (counts[category] || 0) + 1; return counts; }, {});
  const currentCategoryCount = categoryCount(monthProducts);
  const previousCategoryCount = categoryCount(previousProducts);
  const categoryNames = Object.keys(currentCategoryCount).sort((a, b) => currentCategoryCount[b] - currentCategoryCount[a]);
  const categoryChart = categoryNames.map(category => { const count = currentCategoryCount[category]; const previous = previousCategoryCount[category] || 0; const change = count - previous; const ratio = monthProducts.length ? Math.round(count / monthProducts.length * 100) : 0; return `<div class="bar-row"><span>${escapeHtml(category)}</span><i><b style="width:${Math.max(5, ratio)}%"></b></i><strong>${count}</strong><em>${ratio}% ${change > 0 ? `↑${change}` : change < 0 ? `↓${Math.abs(change)}` : "-"}</em></div>`; }).join("");
  const topicCount = {};
  monthProducts.forEach(product => splitTags(String(product.topic || "").replace(/[、，,]/g, "/")).forEach(topic => { topicCount[topic] = (topicCount[topic] || 0) + 1; }));
  const topicNames = Object.keys(topicCount).sort((a, b) => topicCount[b] - topicCount[a]).slice(0, 12);
  const topicList = topicNames.map(topic => { const representative = monthProducts.find(product => splitTags(String(product.topic || "").replace(/[、，,]/g, "/")).includes(topic)); return `<button class="topic-row" type="button" data-open-product="${escapeHtml(representative?.id || "")}" data-open-board="${escapeHtml(latestBoard.id)}"><span class="topic-cover">${representative ? media(representative.cover || representative.icon, representative.name, "topic-icon") : ""}</span><b>${escapeHtml(topic)}</b><strong>${topicCount[topic]}</strong></button>`; }).join("");
  const ipProducts = monthProducts.filter(product => [product.topic, product.genre, product.sourceText, product.judgement].some(value => /IP|联动|授权|改编/i.test(String(value || "")))).sort(byNodeDate);
  const ipList = ipProducts.slice(0, state.ipExpanded ? ipProducts.length : 6).map(product => `<button class="ip-row" type="button" data-open-product="${escapeHtml(product.id)}" data-open-board="${escapeHtml(latestBoard.id)}"><span class="mini-cover">${media(product.cover || product.icon, product.name, "mini-cover-img")}</span><span><b>${escapeHtml(product.name)}</b><small>${escapeHtml(product.topic || "IP产品")} · ${escapeHtml(primaryCategory(product))}</small></span><span><small>${escapeHtml(product.developer || "研发待补充")} / ${escapeHtml(product.publisher || "发行待补充")}</small><em>${escapeHtml(product.latestNodeTime || "待补充")}</em></span></button>`).join("");
  const metric = (icon, label, value, delta, tone = "blue") => { const trend = String(delta || "").replace("↑ ", "+").replace("↓ ", "-"); return `<article class="radar-stat"><span class="stat-icon ${tone}">${icon}</span><div><span>${label}</span><strong>${value}</strong><small>${trend}</small></div></article>`; };
  const item = product => `<button class="radar-product-row" data-open-product="${escapeHtml(product.id)}" data-open-board="${escapeHtml(product.boardId)}"><span class="mini-cover">${media(product.cover || product.icon || product.screenshots?.[0], product.name, "mini-cover-img")}</span><span class="row-copy"><b>${escapeHtml(product.name)}</b><small>${escapeHtml(primaryCategory(product))} · ${escapeHtml(product.platform || "")}</small></span><span class="row-status ${isRankingStatus(product.status) ? "hot" : ""}">${escapeHtml(product.status || "观察中")}</span></button>`;
  const dateDisplay = value => escapeHtml(value || "待补充");
  const timeline = recent.slice(0, 5).map((product, index) => `<button class="timeline-item" data-open-product="${escapeHtml(product.id)}" data-open-board="${escapeHtml(product.boardId)}"><time>${dateDisplay((product.latestNodeTime || product.createdAt || "").slice(5, 10).replace("-", ".") || `近期${index + 1}`)}</time><span class="timeline-dot"></span><span><b>${escapeHtml(product.name)}</b><small>${escapeHtml(product.status || "持续观察")} · ${escapeHtml(primaryCategory(product))}</small></span></button>`).join("");
  const focusCards = monthRanking.map(product => `<article class="focus-product" data-open-product="${escapeHtml(product.id)}" data-open-board="${escapeHtml(latestBoard.id || product.boardId)}"><div class="focus-poster">${media(product.cover || product.icon || product.screenshots?.[0], product.name, "focus-poster-img")}</div><div class="focus-body"><div class="focus-title"><b>${escapeHtml(product.name)}</b>${statusBadge(product.status)}</div><small>${escapeHtml(primaryCategory(product))} · ${escapeHtml(product.developer || "研发待补充")}</small><p>${escapeHtml(product.sourceText || product.reason || product.judgement || "持续观察中。")}</p><div class="focus-foot">${escapeHtml(product.latestNodeTime || product.month || "待补充")} <span>查看详情 →</span></div></div></article>`).join("");
  const testingCards = testing.slice(0, 10).map(product => `<button class="testing-row" data-open-product="${escapeHtml(product.id)}" data-open-board="${escapeHtml(product.boardId)}"><span class="mini-cover">${media(product.cover || product.icon || product.screenshots?.[0], product.name, "mini-cover-img")}</span><span class="testing-copy"><b>${escapeHtml(product.name)}</b><small>${escapeHtml(primaryCategory(product))} · ${escapeHtml(product.developer || "研发待补充")}</small></span><time>${escapeHtml((product.latestNodeTime || product.createdAt || "").slice(5, 10).replace("-", ".") || "待补充")}</time><span class="row-status ${/招募/.test(product.status || "") ? "recruit" : ""}">${escapeHtml(product.status || "测试中")}</span></button>`).join("");
  const chart = categories.map(category => { const count = scopedProducts.filter(product => primaryCategory(product) === category).length; return `<div class="bar-row"><span>${escapeHtml(category)}</span><i><b style="width:${Math.min(100, count * 8 + 12)}%"></b></i><strong>${count}</strong></div>`; }).join("");
  const alerts = ranking.slice(0, 3).map(product => `<div class="alert-row"><span class="alert-dot">!</span><p><b>${escapeHtml(product.name)}</b><small>${escapeHtml(product.status)} · 最新节点 ${escapeHtml(product.latestNodeTime || "待补充")}</small></p></div>`).join("") || `<div class="empty">暂无异常变化</div>`;
  root.innerHTML = `<div class="radar-dashboard"><section class="radar-stats">${metric("▤", "本月新收录", monthProducts.length, "较上月 ↑ 18%", "blue")}${metric("✓", "本周测试", monthProducts.filter(product => /测试/.test(product.status || "")).length, "较上周 ↑ 12%", "green")}${metric("↗", "新进榜", monthRanking.length, "较上周 ↑ 28%", "indigo")}${metric("◈", "即将上线", monthProducts.filter(product => /上线|公测/.test(product.status || "")).length, "较上周 ↓ 5%", "purple")}${metric("★", "重点关注", monthProducts.filter(product => product.focus).length, "较上周 ↑ 15%", "orange")}${metric("+", "今日新增", allPublished.filter(product => String(product.latestNodeTime || "") === dateText).length, "较昨日 ↑ 20%", "cyan")}</section><div class="radar-grid radar-grid-top"><section class="radar-panel timeline-panel"><div class="radar-panel-head"><div><span class="panel-kicker">RECENT MOVES</span><h2>今日 / 本周新游时间轴</h2></div><span class="panel-count">${recent.length} 条</span></div><div class="timeline">${timeline}</div></section><section class="radar-panel chart-panel"><div class="radar-panel-head"><div><span class="panel-kicker">ON CHART</span><h2>新进榜产品</h2></div><button type="button" class="text-action" data-radar-nav="ranking" data-radar-action="expand-ranking">${state.rankingExpanded ? "收起榜单 ↑" : "查看全部 →"}</button></div><div class="ranking-list">${(state.rankingExpanded ? ranking : ranking.slice(0, 6)).map(item).join("") || `<div class="empty">暂无上榜产品</div>`}</div></section></div><div class="radar-grid radar-grid-middle"><section class="radar-panel focus-panel"><div class="radar-panel-head"><div><span class="panel-kicker">ON CHART</span><h2>${escapeHtml(monthLabel)}畅销新游</h2></div><button type="button" class="text-action" data-radar-nav="ranking" data-radar-action="show-ranking">查看全部 →</button></div><div class="focus-grid">${focusCards || `<div class="empty">当前月份暂无畅销榜游戏</div>`}</div></section><div class="radar-side-stack"><section class="radar-panel supply-panel"><div class="radar-panel-head"><div><span class="panel-kicker">SUPPLY</span><h2>品类供给变化</h2></div><small>当前产品数</small></div>${chart}</section><section class="radar-panel alert-panel"><div class="radar-panel-head"><div><span class="panel-kicker">SIGNALS</span><h2>异常变化 / 数据异动</h2></div></div>${alerts}</section></div></div><div class="radar-grid radar-grid-bottom"><section class="radar-panel recent-panel"><div class="radar-panel-head"><div><span class="panel-kicker">LATEST INPUT</span><h2>最近录入</h2></div><span class="panel-count">最新 10 条</span></div><div class="recent-strip">${recent.map(item).join("")}</div></section><section class="radar-panel observe-panel"><div class="radar-panel-head"><div><span class="panel-kicker">WATCHLIST</span><h2>重点观察清单</h2></div></div>${focus.slice(0, 5).map(product => `<button class="observe-row" data-open-product="${escapeHtml(product.id)}" data-open-board="${escapeHtml(product.boardId)}"><b>${escapeHtml(product.name)}</b><span>${escapeHtml(product.reason || product.judgement || "持续观察中")}</span><em>${escapeHtml(product.latestNodeTime || "待补充")}</em></button>`).join("") || `<div class="empty">暂无重点观察产品</div>`}</section></div></div>`;
  const focusPanel = root.querySelector(".focus-panel");
  const middleGrid = root.querySelector(".radar-grid-middle");
  const sideStack = root.querySelector(".radar-side-stack");
  const supplyPanel = sideStack?.querySelector(".supply-panel");
  const alertPanel = sideStack?.querySelector(".alert-panel");
  const bottomGrid = root.querySelector(".radar-grid-bottom");
  const chartPanel = root.querySelector(".chart-panel");
  if (chartPanel) {
    chartPanel.querySelector(".panel-kicker").textContent = "ON CHART";
    chartPanel.querySelector("h2").textContent = `${monthLabel}畅销榜新游`;
    chartPanel.querySelector(".text-action").dataset.radarNav = "ranking";
    chartPanel.querySelector(".text-action").dataset.radarAction = "show-ranking-page";
  }
  if (focusPanel && middleGrid && supplyPanel && alertPanel && bottomGrid) {
    focusPanel.querySelector(".panel-kicker").textContent = "TESTING";
    focusPanel.querySelector("h2").textContent = "测试新游";
    focusPanel.querySelector(".text-action").dataset.radarNav = "testing";
    focusPanel.querySelector(".text-action").dataset.radarAction = "show-testing";
    focusPanel.querySelector(".focus-grid").className = "testing-list";
    focusPanel.querySelector(".testing-list").innerHTML = testingCards || `<div class="empty">当前月份暂无测试新游</div>`;
    middleGrid.replaceChildren(focusPanel, supplyPanel);
    bottomGrid.append(alertPanel);
  }
  if (supplyPanel) {
    supplyPanel.querySelector("h2").textContent = "本月市场新游品类统计";
    supplyPanel.querySelector(".panel-kicker").textContent = "MARKET MIX";
    supplyPanel.querySelector(".radar-panel-head small").textContent = `${monthProducts.length} 款本月新增`;
    supplyPanel.querySelectorAll(".bar-row").forEach(row => row.remove());
    supplyPanel.insertAdjacentHTML("beforeend", categoryChart || `<div class="empty">暂无品类数据</div>`);
  }
  const observePanel = root.querySelector(".observe-panel");
  if (observePanel) {
    observePanel.querySelector("h2").textContent = "本月新游题材";
    observePanel.querySelector(".panel-kicker").textContent = "TOPICS";
    observePanel.querySelector(".panel-head")?.remove();
    observePanel.querySelectorAll(".observe-row").forEach(row => row.remove());
    observePanel.insertAdjacentHTML("beforeend", topicList || `<div class="empty">暂无题材数据</div>`);
  }
  if (alertPanel) {
    alertPanel.querySelector("h2").textContent = "IP产品记录";
    alertPanel.querySelector(".panel-kicker").textContent = "IP PRODUCTS";
    alertPanel.querySelectorAll(".alert-row, .empty").forEach(row => row.remove());
    alertPanel.querySelector(".radar-panel-head").insertAdjacentHTML("beforeend", `<button class="text-action" type="button" data-ip-action="toggle">${state.ipExpanded ? "收起" : "查看全部 →"}</button>`);
    alertPanel.insertAdjacentHTML("beforeend", ipList || `<div class="empty">本月暂无 IP 产品</div>`);
  }
  $("#radarUpdatedAt").textContent = dateText;
  $("#radarDate").value = dateText;
}

function renderProductPage() {
  const route = getRouteDetail();
  if (!route) return false;
  const product = findProduct(route.boardId, route.productId);
  const board = boardById(route.boardId);
  if (!product || !board) return false;

  const page = $("#productPage");
  const root = $("#boardRoot");
  page.classList.remove("hidden");
  root.classList.add("hidden");
  setMobileMode(true);
  setMobileNavActive("home");
  document.title = `${product.name} - 新游产品库`;

  const poster = product.cover || product.screenshots?.[0] || "";
  const ranking = isRankingStatus(product.status);
  page.innerHTML = `
    <section class="detail-page-shell">
      <div class="detail-page-top">
        <button class="ghost detail-back" id="detailBackButton" type="button">← 返回产品库</button>
        <div class="detail-page-links">
          ${product.sourceUrl ? `<a class="hero-link" href="${escapeHtml(product.sourceUrl)}" target="_blank" rel="noreferrer">查看原文</a>` : ""}
          <button class="ghost detail-share" id="copyDetailLink" type="button">复制链接</button>
        </div>
      </div>
      <section class="detail-page-hero${ranking ? " detail-page-hero-ranking" : ""}">
        <div class="detail-page-media">${media(poster, product.name, "detail-cover")}</div>
        <div class="detail-page-copy">
          <div class="badges">
            ${statusBadge(product.status)}
            ${product.focus ? `<span class="badge focus">重点关注</span>` : ""}
            <span class="badge subtle">${escapeHtml(board.period || board.title)}</span>
          </div>
          <h2>${escapeHtml(product.name)}</h2>
          <p class="detail-summary">${escapeHtml(product.reason || product.judgement || product.publicNode || "持续观察中。")}</p>
          <div class="detail-tags">
            ${[product.genre, product.topic, product.platform, product.month].filter(Boolean).map(tag => `<span class="detail-tag">${escapeHtml(tag)}</span>`).join("")}
          </div>
        </div>
      </section>
      <section class="detail-grid">
        <div class="detail-box"><span>研发</span><strong>${escapeHtml(product.developer || "待补充")}</strong></div>
        <div class="detail-box"><span>发行</span><strong>${escapeHtml(product.publisher || "待补充")}</strong></div>
        <div class="detail-box"><span>首测时间</span><strong>${escapeHtml(product.firstTestTime || "待补充")}</strong></div>
        <div class="detail-box"><span>上线时间</span><strong>${escapeHtml(product.launchTime || "待补充")}</strong></div>
        <div class="detail-box"><span>公开节点</span><strong>${escapeHtml(product.publicNode || "待补充")}</strong></div>
        <div class="detail-box"><span>所在看板</span><strong>${escapeHtml(board.title || board.period || "产品库")}</strong></div>
      </section>
      ${product.reason ? `<section class="detail-section"><h4>关注理由</h4><p>${escapeHtml(product.reason)}</p></section>` : ""}
      ${product.judgement ? `<section class="detail-section"><h4>趋势判断</h4><p>${escapeHtml(product.judgement)}</p></section>` : ""}
      ${product.sourceText ? `<section class="detail-section"><h4>原始内容</h4><p>${escapeHtml(product.sourceText)}</p></section>` : ""}
      ${product.screenshots?.length ? `<section class="detail-section"><h4>图片资料</h4>${screenshotGallery(product, "screenshots detail-screens")}</section>` : ""}
    </section>
  `;

  $("#detailBackButton")?.addEventListener("click", () => {
    clearDetailRoute();
    renderApp();
  });
  $("#copyDetailLink")?.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      $("#copyDetailLink").textContent = "链接已复制";
      setTimeout(() => {
        if ($("#copyDetailLink")) $("#copyDetailLink").textContent = "复制链接";
      }, 1600);
    } catch {
      alert("复制失败，请手动复制地址栏链接。");
    }
  });

  return true;
}

function renderApp() {
  const page = $("#productPage");
  const root = $("#boardRoot");
  syncReportLink();
  if (renderProductPage()) return;
  if (renderTestingPage()) return;
  if (renderRankingPage()) return;
  setMobileMode(false);
  page.classList.add("hidden");
  page.innerHTML = "";
  root.classList.remove("hidden");
  document.title = "新游产品库";
  renderBoard();
  setMobileNavActive("home");
}

function syncAdminAvailability() {
  const button = $("#adminButton");
  if (!button) return;
  if (state.staticMode) {
    button.disabled = true;
    button.title = "GitHub Pages 静态展示版不提供后台编辑";
    button.setAttribute("aria-label", "GitHub Pages 静态展示版不提供后台编辑");
  }
}

function fillAdmin() {
  const board = currentBoard();
  $("#boardSelect").innerHTML = state.boards.map(item => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.period || item.title)}</option>`).join("");
  if (!board) return;
  $("#boardSelect").value = board.id;
  $("#boardTitle").value = board.title || "";
  $("#boardPeriod").value = board.period || "";
  $("#boardDate").value = board.date || "";
  $("#boardSummary").value = board.summary || "";
  $("#boardMetrics").value = (board.metrics || []).join(" / ");
  fillProduct();
}

function fillProduct() {
  const board = currentBoard();
  const products = board?.products || [];
  if (!state.selectedProductId && products[0]) state.selectedProductId = products[0].id;
  $("#productSelect").innerHTML = products.map(product => `<option value="${escapeHtml(product.id)}">${escapeHtml(product.name || "未命名产品")}</option>`).join("");
  const product = currentProduct();
  if (!product) {
    ["productName", "productGenre", "productStatus", "productRank", "productDeveloper", "productPublisher", "productNode", "productJudgement"].forEach(id => { $(`#${id}`).value = ""; });
    $("#productFocus").checked = false;
    $("#coverPreview").innerHTML = "";
    $("#screensPreview").innerHTML = "";
    return;
  }
  state.selectedProductId = product.id;
  $("#productSelect").value = product.id;
  $("#productName").value = product.name || "";
  $("#productGenre").value = product.genre || "";
  $("#productStatus").value = product.status || "";
  $("#productRank").value = product.rank || "";
  $("#productDeveloper").value = product.developer || "";
  $("#productPublisher").value = product.publisher || "";
  $("#productNode").value = product.publicNode || "";
  $("#productJudgement").value = product.judgement || "";
  $("#productFocus").checked = Boolean(product.focus);
  $("#coverPreview").innerHTML = product.cover ? `<img src="${escapeHtml(product.cover)}" alt="封面">` : "";
  $("#screensPreview").innerHTML = (product.screenshots || []).map((src, index) => `
    <span class="shot-wrap"><img src="${escapeHtml(src)}" alt="截图"><button data-remove-shot="${index}" type="button">×</button></span>
  `).join("");
}

function collectAdminDraft() {
  const board = currentBoard();
  if (!board) return null;
  const products = [...(board.products || [])];
  const index = products.findIndex(product => product.id === state.selectedProductId);
  if (index >= 0) {
    products[index] = {
      ...products[index],
      name: $("#productName").value.trim() || "未命名产品",
      genre: $("#productGenre").value.trim(),
      status: $("#productStatus").value.trim(),
      rank: Number($("#productRank").value || 0),
      developer: $("#productDeveloper").value.trim(),
      publisher: $("#productPublisher").value.trim(),
      publicNode: $("#productNode").value.trim(),
      judgement: $("#productJudgement").value.trim(),
      focus: $("#productFocus").checked
    };
  }
  return {
    ...board,
    title: $("#boardTitle").value.trim() || "未命名看板",
    period: $("#boardPeriod").value.trim(),
    date: $("#boardDate").value,
    summary: $("#boardSummary").value.trim(),
    metrics: $("#boardMetrics").value.split("/").map(item => item.trim()).filter(Boolean),
    products
  };
}

function setAiMessage(message, isError = false) {
  const target = $("#aiMessage");
  if (!target) return;
  target.textContent = message;
  target.classList.toggle("error", Boolean(isError));
}

function applyAiDraft(draft) {
  const board = currentBoard();
  if (!board) return null;

  const product = {
    id: uid("product"),
    name: draft.name || "未命名产品",
    genre: draft.genre || "",
    status: draft.status || "待确认",
    rank: (board.products || []).length + 1,
    focus: Boolean(draft.focus),
    developer: draft.developer || "待确认",
    publisher: draft.publisher || "待确认",
    publicNode: draft.publicNode || "",
    judgement: draft.judgement || "",
    cover: state.aiImageUrl || "",
    screenshots: state.aiImageUrl ? [state.aiImageUrl] : [],
    tags: draft.tags || [],
    needsReview: draft.needsReview || [],
    sourceText: draft.sourceText || $("#aiInput").value.trim(),
    reviewState: "待人工确认"
  };

  board.products = [...(board.products || []), product];
  state.selectedProductId = product.id;
  fillProduct();
  return product;
}

async function uploadFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const data = await api("/api/upload", { method: "POST", body: JSON.stringify({ dataUrl: reader.result }) });
        resolve(data.url);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () => reject(new Error("图片读取失败"));
    reader.readAsDataURL(file);
  });
}

async function loadBoards() {
  let data;
  try {
    data = await api("/api/boards");
  } catch {
    data = await loadStaticBoards();
  }
  state.boards = data.boards || [];
  state.selectedBoardId = state.selectedBoardId || state.boards[0]?.id || "";
  syncAdminAvailability();
  renderFilters();
  renderApp();
  fillAdmin();
}

function openAdmin() {
  if (state.staticMode) {
    alert("当前是公开静态展示版。后台录入仍建议在飞书多维表格中完成。");
    return;
  }
  if (!state.token) {
    $("#loginMessage").textContent = "";
    $("#passwordInput").value = "";
    $("#loginDialog").showModal();
    return;
  }
  $("#adminPanel").classList.add("open");
  $("#adminPanel").setAttribute("aria-hidden", "false");
  fillAdmin();
}

function wireEvents() {
  $("#adminButton").addEventListener("click", openAdmin);
  $("#closeAdmin").addEventListener("click", () => {
    $("#adminPanel").classList.remove("open");
    $("#adminPanel").setAttribute("aria-hidden", "true");
  });

  $("#periodFilter").addEventListener("change", renderApp);
  $("#statusFilter").addEventListener("change", renderApp);
  $("#searchInput").addEventListener("input", () => {
    renderApp();
    setMobileNavActive("search");
  });
  window.addEventListener("popstate", renderApp);

  document.querySelectorAll("[data-radar-toggle]").forEach(button => {
    button.addEventListener("click", () => {
      const group = document.querySelector(`[data-radar-group="${button.dataset.radarToggle}"]`);
      group?.classList.toggle("open");
      button.classList.toggle("expanded");
    });
  });
  document.querySelectorAll("[data-radar-nav]").forEach(button => {
    button.addEventListener("click", () => {
      const target = button.dataset.radarNav;
      if (target === "testing" && !button.dataset.radarFilter) {
        setTestingRoute();
        renderApp();
        return;
      }
      state.radarFilter = button.dataset.radarFilter || (target === "ranking" ? "上榜" : target === "focus" ? "重点" : target === "launch" ? "上线" : "");
      document.querySelectorAll("[data-radar-nav]").forEach(item => item.classList.toggle("active", item === button));
      $("#statusFilter").value = "";
      renderApp();
    });
  });

  document.querySelectorAll(".mobile-nav-item").forEach(button => {
    button.addEventListener("click", () => {
      const target = button.dataset.navTarget || "home";
      if (getRouteDetail()) {
        clearDetailRoute(true);
        renderApp();
      }
      setMobileNavActive(target);
      scrollToSection(target);
    });
  });

  $("#boardRoot").addEventListener("click", event => {
    if (event.target.closest(".chart-panel h2")) {
      setRankingRoute();
      renderApp();
      return;
    }
    if (event.target.closest(".focus-panel h2")) {
      setTestingRoute();
      renderApp();
      return;
    }
    const ipAction = event.target.closest("[data-ip-action]");
    if (ipAction) {
      state.ipExpanded = !state.ipExpanded;
      renderApp();
      return;
    }
    const radarButton = event.target.closest("[data-radar-nav]");
    if (radarButton) {
      if (radarButton.dataset.radarAction === "show-ranking-page") {
        setRankingRoute();
        renderApp();
        return;
      }
      if (radarButton.dataset.radarAction === "show-testing") {
        setTestingRoute();
        renderApp();
        return;
      }
      if (radarButton.dataset.radarAction === "expand-ranking") {
        state.rankingExpanded = !state.rankingExpanded;
      } else if (radarButton.dataset.radarAction === "show-ranking") {
        state.rankingExpanded = true;
      }
      state.radarFilter = radarButton.dataset.radarFilter || (radarButton.dataset.radarAction === "show-testing" ? "测试" : radarButton.dataset.radarNav === "ranking" ? "上榜" : radarButton.dataset.radarNav === "focus" ? "重点" : radarButton.dataset.radarNav === "launch" ? "上线" : "");
      document.querySelectorAll("[data-radar-nav]").forEach(item => item.classList.toggle("active", item === radarButton));
      renderApp();
      if (radarButton.dataset.radarAction === "show-ranking") {
        requestAnimationFrame(() => document.querySelector(".focus-panel")?.scrollIntoView({ behavior: "smooth", block: "start" }));
      }
      return;
    }
    const card = event.target.closest("[data-open-product]");
    if (!card) return;
    setDetailRoute(card.dataset.openBoard, card.dataset.openProduct);
    renderApp();
  });
  $("#boardRoot").addEventListener("keydown", event => {
    const card = event.target.closest("[data-open-product]");
    if (!card) return;
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    setDetailRoute(card.dataset.openBoard, card.dataset.openProduct);
    renderApp();
  });

  $("#loginForm").addEventListener("submit", async event => {
    event.preventDefault();
    try {
      const data = await api("/api/login", { method: "POST", body: JSON.stringify({ password: $("#passwordInput").value }) });
      state.token = data.token;
      localStorage.setItem("ngbToken", state.token);
      $("#loginDialog").close();
      openAdmin();
    } catch (error) {
      $("#loginMessage").textContent = error.message;
    }
  });

  $("#boardSelect").addEventListener("change", event => {
    state.selectedBoardId = event.target.value;
    state.selectedProductId = "";
    fillAdmin();
  });
  $("#productSelect").addEventListener("change", event => {
    state.selectedProductId = event.target.value;
    fillProduct();
  });

  $("#newBoardButton").addEventListener("click", async () => {
    const board = {
      id: uid("board"),
      title: "新一期新游看板",
      period: "",
      date: new Date().toISOString().slice(0, 10),
      summary: "",
      metrics: [],
      trends: [],
      products: []
    };
    const data = await api("/api/boards", { method: "POST", body: JSON.stringify(board) });
    state.boards.unshift(data.board);
    state.selectedBoardId = data.board.id;
    state.selectedProductId = "";
    renderFilters();
    renderApp();
    fillAdmin();
  });

  $("#newProductButton").addEventListener("click", () => {
    const board = currentBoard();
    if (!board) return;
    const product = {
      id: uid("product"),
      name: "新产品",
      genre: "",
      status: "",
      rank: (board.products || []).length + 1,
      focus: false,
      developer: "",
      publisher: "",
      publicNode: "",
      judgement: "",
      cover: "",
      screenshots: []
    };
    board.products = [...(board.products || []), product];
    state.selectedProductId = product.id;
    fillProduct();
  });

  $("#aiImageInput").addEventListener("change", async event => {
    const file = event.target.files[0];
    if (!file) return;
    try {
      setAiMessage("正在上传图片...");
      state.aiImageUrl = await uploadFile(file);
      $("#aiImagePreview").innerHTML = `<img src="${escapeHtml(state.aiImageUrl)}" alt="AI录入图片">`;
      setAiMessage("图片已上传，点击 AI整理 生成草稿。");
    } catch (error) {
      setAiMessage(error.message, true);
    }
  });

  $("#aiParseButton").addEventListener("click", async () => {
    const text = $("#aiInput").value.trim();
    if (!currentBoard()) {
      setAiMessage("请先新建或选择一个看板。", true);
      return;
    }
    if (!text) {
      setAiMessage("请先粘贴一段新游信息。", true);
      return;
    }

    try {
      $("#aiParseButton").disabled = true;
      setAiMessage("AI 正在整理草稿...");
      const data = await api("/api/ai/parse", { method: "POST", body: JSON.stringify({ text }) });
      const product = applyAiDraft(data.draft || {});
      const review = (data.draft?.needsReview || []).join("、");
      setAiMessage(product ? `已生成《${product.name}》草稿。请检查字段，确认后点击“保存更新”。${review ? ` 待确认：${review}` : ""}` : "生成失败", !product);
    } catch (error) {
      setAiMessage(error.message, true);
    } finally {
      $("#aiParseButton").disabled = false;
    }
  });

  $("#removeProductButton").addEventListener("click", () => {
    const board = currentBoard();
    if (!board || !state.selectedProductId) return;
    board.products = (board.products || []).filter(product => product.id !== state.selectedProductId);
    state.selectedProductId = board.products[0]?.id || "";
    fillProduct();
  });

  $("#coverInput").addEventListener("change", async event => {
    const file = event.target.files[0];
    const product = currentProduct();
    if (!file || !product) return;
    product.cover = await uploadFile(file);
    fillProduct();
    event.target.value = "";
  });

  $("#screensInput").addEventListener("change", async event => {
    const product = currentProduct();
    if (!product) return;
    const urls = [];
    for (const file of event.target.files) urls.push(await uploadFile(file));
    product.screenshots = [...(product.screenshots || []), ...urls];
    fillProduct();
    event.target.value = "";
  });

  $("#screensPreview").addEventListener("click", event => {
    const button = event.target.closest("[data-remove-shot]");
    const product = currentProduct();
    if (!button || !product) return;
    product.screenshots.splice(Number(button.dataset.removeShot), 1);
    fillProduct();
  });

  $("#saveButton").addEventListener("click", async () => {
    const board = collectAdminDraft();
    if (!board) return;
    const data = await api(`/api/boards/${board.id}`, { method: "PUT", body: JSON.stringify(board) });
    const index = state.boards.findIndex(item => item.id === data.board.id);
    state.boards[index] = data.board;
    renderFilters();
    renderApp();
    fillAdmin();
  });

  $("#deleteBoardButton").addEventListener("click", async () => {
    const board = currentBoard();
    if (!board || !confirm(`删除《${board.title}》？`)) return;
    await api(`/api/boards/${board.id}`, { method: "DELETE" });
    state.boards = state.boards.filter(item => item.id !== board.id);
    state.selectedBoardId = state.boards[0]?.id || "";
    state.selectedProductId = "";
    renderFilters();
    renderApp();
    fillAdmin();
  });
}

wireEvents();
initPublicGate(() => {
  clearLegacySiteCaches().finally(() => {
    loadBoards().catch(error => {
      $("#boardRoot").innerHTML = `<div class="empty">${escapeHtml(error.message)}</div>`;
    });
  });
});
