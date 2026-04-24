const state = {
  boards: [],
  selectedBoardId: "",
  selectedProductId: "",
  token: localStorage.getItem("ngbToken") || "",
  draftProduct: null,
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
  return state.boards.find(board => board.id === state.selectedBoardId) || state.boards[0];
}

function currentProduct() {
  const board = currentBoard();
  return board?.products.find(product => product.id === state.selectedProductId) || board?.products[0];
}

function getInitial(name) {
  return escapeHtml(String(name || "游").slice(0, 1));
}

function media(src, name, className = "cover") {
  if (src) return `<img class="${className}" src="${escapeHtml(src)}" alt="${escapeHtml(name)}">`;
  return `<div class="${className} placeholder">${getInitial(name)}</div>`;
}

function productCard(product, lead = false) {
  const screenshots = (product.screenshots || []).map(src => `<img src="${escapeHtml(src)}" alt="${escapeHtml(product.name)} 截图">`).join("");
  const tags = [product.genre, product.topic, product.platform].filter(Boolean);
  return `
    <article class="${lead ? "lead-card" : "product-card"}">
      ${lead ? `<div class="rank">#${escapeHtml(product.rank || "")}</div>` : ""}
      <div class="product-top">
        ${media(product.cover, product.name)}
        <div>
          <h4 class="product-name">${escapeHtml(product.name)}</h4>
          <div class="meta">${escapeHtml(tags.join(" / ") || "未分类")}</div>
        </div>
      </div>
      <div class="badges">
        ${product.status ? `<span class="badge">${escapeHtml(product.status)}</span>` : ""}
        ${product.focus ? `<span class="badge focus">重点关注</span>` : ""}
        ${product.releaseStatus ? `<span class="badge subtle">${escapeHtml(product.releaseStatus)}</span>` : ""}
      </div>
      <div class="info">
        <b>研发</b><div>${escapeHtml(product.developer || "未填写")}</div>
        <b>发行</b><div>${escapeHtml(product.publisher || "未填写")}</div>
        ${product.month ? `<b>月份</b><div>${escapeHtml(product.month)}</div>` : ""}
        ${product.sourceUrl ? `<b>来源</b><div><a class="source-link" href="${escapeHtml(product.sourceUrl)}" target="_blank" rel="noreferrer">查看原文</a></div>` : ""}
      </div>
      ${product.reason ? `<div class="copybox"><span>关注理由</span><p>${escapeHtml(product.reason)}</p></div>` : ""}
      ${product.publicNode ? `<div class="copybox"><span>公开节点</span><p>${escapeHtml(product.publicNode)}</p></div>` : ""}
      ${product.judgement ? `<div class="copybox"><span>趋势判断</span><p>${escapeHtml(product.judgement)}</p></div>` : ""}
      ${screenshots ? `<div class="screenshots">${screenshots}</div>` : ""}
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
        product.judgement
      ]
        .some(value => String(value || "").toLowerCase().includes(q));
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
}

function renderBoard() {
  const root = $("#boardRoot");
  const selected = $("#periodFilter").value;
  const boards = selected && selected !== "all"
    ? state.boards.filter(board => board.id === selected)
    : state.boards;

  if (!boards.length) {
    root.innerHTML = `<div class="empty">还没有看板。登录后台后可以先新建一周。</div>`;
    return;
  }

  root.innerHTML = boards.map(board => {
    const products = filteredProducts(board);
    const leads = products.filter(product => product.focus).slice(0, 6);
    const normal = products.filter(product => !leads.includes(product));
    return `
      <section class="hero">
        <span class="kicker">${escapeHtml(board.period || "新游报告")}</span>
        <h2>${escapeHtml(board.title)}</h2>
        <p>${escapeHtml(board.summary)}</p>
        <div class="metric-row">${(board.metrics || []).map(metric => `<span class="metric">${escapeHtml(metric)}</span>`).join("")}</div>
      </section>
      ${(board.trends || []).length ? `
        <section class="section">
          <div class="section-head"><div><h3>趋势观察</h3><div class="sub">按本期报告维护</div></div></div>
          <div class="trend-grid">${board.trends.map(trend => `<article class="trend-card"><b>${escapeHtml(trend.title)}</b><p>${escapeHtml(trend.body)}</p></article>`).join("")}</div>
        </section>` : ""}
      ${leads.length ? `
        <section class="section">
          <div class="section-head"><div><h3>重点产品</h3><div class="sub">优先观察顺序</div></div></div>
          <div class="lead-grid">${leads.map(product => productCard(product, true)).join("")}</div>
        </section>` : ""}
      <section class="section">
        <div class="section-head"><div><h3>产品列表</h3><div class="sub">当前筛选 ${products.length} 款</div></div></div>
        ${products.length ? `<div class="cards-grid">${normal.concat(leads.filter(product => normal.length === 0 ? false : true)).map(product => productCard(product)).join("")}</div>` : `<div class="empty">当前筛选下没有产品。</div>`}
      </section>
    `;
  }).join("");
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
    ["productName", "productGenre", "productStatus", "productRank", "productDeveloper", "productPublisher", "productNode", "productJudgement"].forEach(id => $(`#${id}`).value = "");
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
  } catch (error) {
    data = await loadStaticBoards();
  }
  state.boards = data.boards || [];
  state.selectedBoardId = state.selectedBoardId || state.boards[0]?.id || "";
  syncAdminAvailability();
  renderFilters();
  renderBoard();
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
  $("#periodFilter").addEventListener("change", renderBoard);
  $("#statusFilter").addEventListener("change", renderBoard);
  $("#searchInput").addEventListener("input", renderBoard);

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
    renderBoard();
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
      const review = (data.draft?.needsReview || []).join("；");
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
    renderBoard();
    fillAdmin();
  });

  $("#deleteBoardButton").addEventListener("click", async () => {
    const board = currentBoard();
    if (!board || !confirm(`删除「${board.title}」？`)) return;
    await api(`/api/boards/${board.id}`, { method: "DELETE" });
    state.boards = state.boards.filter(item => item.id !== board.id);
    state.selectedBoardId = state.boards[0]?.id || "";
    state.selectedProductId = "";
    renderFilters();
    renderBoard();
    fillAdmin();
  });
}

wireEvents();
loadBoards().catch(error => {
  $("#boardRoot").innerHTML = `<div class="empty">${escapeHtml(error.message)}</div>`;
});
