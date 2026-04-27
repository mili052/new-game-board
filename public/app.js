const state = {
  boards: [],
  selectedBoardId: "",
  selectedProductId: "",
  token: localStorage.getItem("ngbToken") || "",
  aiImageUrl: "",
  staticMode: false
};

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
  const response = await fetch(joinUrl(basePath(), "data", "boards.json"), { cache: "no-store" });
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
  const note = product.sourceText || product.publicNode || product.judgement || "持续观察中。";

  return `
    <article class="product-card product-entry${ranking ? " status-featured" : ""}" data-open-product="${escapeHtml(product.id)}" data-open-board="${escapeHtml(boardId)}" tabindex="0">
      ${ranking ? `<div class="status-ribbon">${escapeHtml(product.status)}</div>` : ""}
      <div class="product-top tap-card-top">
        <div class="cover-shell">${media(poster, product.name)}</div>
        <div class="tap-card-head">
          <h4 class="product-name">${escapeHtml(product.name)}</h4>
          <div class="meta">${escapeHtml(tags.join(" / ") || "未分类")}</div>
          <div class="badges inline-badges">
            ${statusBadge(product.status)}
            ${product.focus ? `<span class="badge focus">重点关注</span>` : ""}
          </div>
        </div>
      </div>
      <p class="tap-summary">${escapeHtml(note)}</p>
      <div class="tap-meta-grid">
        <span>研发 ${escapeHtml(product.developer || "待补充")}</span>
        <span>发行 ${escapeHtml(product.publisher || "待补充")}</span>
        ${product.month ? `<span>月份 ${escapeHtml(product.month)}</span>` : ""}
        ${product.firstTestTime ? `<span>首测 ${escapeHtml(product.firstTestTime)}</span>` : ""}
      </div>
      <div class="card-footer">
        <span class="micro-note muted">点击查看详情</span>
        ${shot ? `<a class="thumb-inline large" href="${escapeHtml(shot)}" target="_blank" rel="noreferrer" aria-label="${escapeHtml(product.name)} 截图"><img src="${escapeHtml(shot)}" alt="${escapeHtml(product.name)} 截图"></a>` : ""}
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
  periodFilter.value = state.boards.some(board => board.id === currentPeriod) ? currentPeriod : "all";

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

function renderBoard() {
  const root = $("#boardRoot");
  const selected = $("#periodFilter").value;
  const boards = selected && selected !== "all"
    ? state.boards.filter(board => board.id === selected)
    : state.boards;

  if (!boards.length) {
    root.innerHTML = `<div class="empty">还没有可展示的看板，录入并发布后这里会自动出现。</div>`;
    return;
  }

  root.innerHTML = boards.map(board => {
    const products = filteredProducts(board);
    const rankingProducts = products.filter(product => isRankingStatus(product.status));
    const categories = groupProductsByCategory(products);
    const rankingCount = rankingProducts.length;
    const focusCount = products.filter(product => product.focus).length;
    const metrics = [...(board.metrics || [])];

    if (rankingCount && !metrics.some(metric => /(上榜|畅销|榜单)/.test(metric))) {
      metrics.push(`上榜产品${rankingCount}款`);
    }
    if (!metrics.some(metric => /重点/.test(metric))) {
      metrics.push(`重点产品${focusCount}款`);
    }

    return `
      <section class="hero library-hero">
        <div class="hero-copy library-copy compact-copy">
          <div class="hero-headline">
            <div>
              <div class="hero-eyebrow">
                <span class="kicker">${escapeHtml(board.period || "最新一批")}</span>
                <span class="hero-note">按品类浏览、按状态追踪、按节点观察</span>
              </div>
              <h2>${escapeHtml(board.title)}</h2>
            </div>
          </div>
          <p>${escapeHtml(board.summary || "按品类整理的新游产品库，方便浏览重点产品、上榜信号和阶段变化。")}</p>
        </div>
        <div class="metric-row metric-grid">${metrics.map(metric => `<span class="metric">${escapeHtml(metric)}</span>`).join("")}</div>
      </section>
      ${rankingProducts.length ? `
        <section class="section ranking-zone">
          <div class="ranking-hero">
            <div>
              <div class="ranking-kicker">New on Chart</div>
              <h3>新上榜专区</h3>
              <p>自动聚合状态中包含“上榜 / 畅销 / 榜单”的产品，单独高亮最近冲榜的新游。</p>
            </div>
            <div class="ranking-hero-metrics">
              <span class="metric glow">新上榜 ${rankingCount} 款</span>
              <span class="metric dark">重点关注 ${rankingProducts.filter(product => product.focus).length} 款</span>
            </div>
          </div>
          <div class="cards-grid ranking-grid">${rankingProducts.map(product => productCard(product, board.id)).join("")}</div>
        </section>
      ` : ""}
      <section class="section">
        <div class="section-head">
          <div>
            <h3>产品列表</h3>
            <div class="sub">当前筛选 ${products.length} 款，按品类分组浏览；上榜 / 畅销状态会保持高亮。</div>
          </div>
        </div>
        ${products.length ? `
          <div class="category-stack">
            ${categories.map(group => `
              <section class="category-group">
                <div class="category-head">
                  <div>
                    <h4>${escapeHtml(group.category)}</h4>
                    <div class="sub">本类共 ${group.items.length} 款</div>
                  </div>
                  <span class="category-count">${group.items.length}</span>
                </div>
                <div class="cards-grid category-grid">${group.items.map(product => productCard(product, board.id)).join("")}</div>
              </section>
            `).join("")}
          </div>
        ` : `<div class="empty">当前筛选下没有产品。</div>`}
      </section>
      ${(board.trends || []).length ? `
        <section class="section">
          <div class="section-head">
            <div>
              <h3>趋势观察</h3>
              <div class="sub">按本期报告维护</div>
            </div>
          </div>
          <div class="trend-grid">${board.trends.map(trend => `<article class="trend-card"><b>${escapeHtml(trend.title)}</b><p>${escapeHtml(trend.body)}</p></article>`).join("")}</div>
        </section>` : ""}
    `;
  }).join("");
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
  page.classList.add("hidden");
  page.innerHTML = "";
  root.classList.remove("hidden");
  document.title = "新游产品库";
  renderBoard();
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
  $("#searchInput").addEventListener("input", renderApp);
  window.addEventListener("popstate", renderApp);

  $("#boardRoot").addEventListener("click", event => {
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
loadBoards().catch(error => {
  $("#boardRoot").innerHTML = `<div class="empty">${escapeHtml(error.message)}</div>`;
});
