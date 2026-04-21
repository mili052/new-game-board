const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const root = path.join(__dirname, "..");
const dataFile = path.join(root, "data", "boards.json");
const uploadDir = path.join(root, "public", "uploads");
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseBucket = process.env.SUPABASE_BUCKET || "game-assets";
const useSupabase = Boolean(supabaseUrl && supabaseKey);

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function ensureLocalStore() {
  fs.mkdirSync(path.dirname(dataFile), { recursive: true });
  fs.mkdirSync(uploadDir, { recursive: true });
  if (!fs.existsSync(dataFile)) {
    fs.writeFileSync(dataFile, JSON.stringify({ boards: [] }, null, 2), "utf8");
  }
}

function readLocalStore() {
  ensureLocalStore();
  return JSON.parse(fs.readFileSync(dataFile, "utf8"));
}

function writeLocalStore(store) {
  fs.writeFileSync(dataFile, JSON.stringify(store, null, 2), "utf8");
}

function safeId(value) {
  return String(value || "").replace(/[^a-zA-Z0-9_-]/g, "");
}

function normalizeBoard(input, existing = {}) {
  const now = new Date().toISOString();
  const id = safeId(input.id) || existing.id || crypto.randomUUID();
  return {
    id,
    title: String(input.title || existing.title || "未命名看板").trim(),
    period: String(input.period || existing.period || "").trim(),
    date: String(input.date || existing.date || new Date().toISOString().slice(0, 10)),
    summary: String(input.summary || existing.summary || "").trim(),
    metrics: Array.isArray(input.metrics) ? input.metrics.map(String).filter(Boolean) : existing.metrics || [],
    trends: Array.isArray(input.trends) ? input.trends : existing.trends || [],
    products: Array.isArray(input.products) ? input.products : existing.products || [],
    createdAt: existing.createdAt || existing.created_at || now,
    updatedAt: now
  };
}

function toDb(board) {
  return {
    id: board.id,
    title: board.title,
    period: board.period,
    date: board.date,
    summary: board.summary,
    metrics: board.metrics,
    trends: board.trends,
    products: board.products,
    created_at: board.createdAt,
    updated_at: board.updatedAt
  };
}

function fromDb(row) {
  return {
    id: row.id,
    title: row.title,
    period: row.period,
    date: row.date,
    summary: row.summary,
    metrics: row.metrics || [],
    trends: row.trends || [],
    products: row.products || [],
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function supabaseRest(pathname, options = {}) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${pathname}`, {
    ...options,
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(options.headers || {})
    }
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw httpError(response.status, data?.message || "Supabase 请求失败");
  }
  return data;
}

async function listBoards() {
  if (useSupabase) {
    const rows = await supabaseRest("boards?select=*&order=date.desc");
    return rows.map(fromDb);
  }

  const store = readLocalStore();
  return store.boards.sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

async function createBoard(input) {
  const board = normalizeBoard(input);
  if (useSupabase) {
    const rows = await supabaseRest("boards", {
      method: "POST",
      body: JSON.stringify(toDb(board))
    });
    return fromDb(rows[0]);
  }

  const store = readLocalStore();
  store.boards.push(board);
  writeLocalStore(store);
  return board;
}

async function updateBoard(id, input) {
  if (useSupabase) {
    const existingRows = await supabaseRest(`boards?id=eq.${encodeURIComponent(id)}&select=*`);
    if (!existingRows.length) throw httpError(404, "看板不存在");
    const board = normalizeBoard(input, fromDb(existingRows[0]));
    const rows = await supabaseRest(`boards?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(toDb(board))
    });
    return fromDb(rows[0]);
  }

  const store = readLocalStore();
  const index = store.boards.findIndex(board => board.id === id);
  if (index === -1) throw httpError(404, "看板不存在");
  store.boards[index] = normalizeBoard(input, store.boards[index]);
  writeLocalStore(store);
  return store.boards[index];
}

async function deleteBoard(id) {
  if (useSupabase) {
    await supabaseRest(`boards?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
    return;
  }

  const store = readLocalStore();
  const next = store.boards.filter(board => board.id !== id);
  if (next.length === store.boards.length) throw httpError(404, "看板不存在");
  store.boards = next;
  writeLocalStore(store);
}

function parseImage(dataUrl) {
  const match = String(dataUrl || "").match(/^data:(image\/(?:png|jpeg|jpg|webp|gif));base64,(.+)$/);
  if (!match) throw httpError(400, "只支持 png/jpg/webp/gif 图片");
  const ext = match[1].split("/")[1].replace("jpeg", "jpg");
  return {
    mime: match[1],
    ext,
    buffer: Buffer.from(match[2], "base64")
  };
}

async function uploadImage(dataUrl) {
  const image = parseImage(dataUrl);
  const filename = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}.${image.ext}`;

  if (useSupabase) {
    const objectPath = `uploads/${filename}`;
    const response = await fetch(`${supabaseUrl}/storage/v1/object/${supabaseBucket}/${objectPath}`, {
      method: "POST",
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        "Content-Type": image.mime,
        "x-upsert": "false"
      },
      body: image.buffer
    });

    if (!response.ok) {
      const text = await response.text();
      throw httpError(response.status, text || "图片上传失败");
    }

    return `${supabaseUrl}/storage/v1/object/public/${supabaseBucket}/${objectPath}`;
  }

  ensureLocalStore();
  fs.writeFileSync(path.join(uploadDir, filename), image.buffer);
  return `/uploads/${filename}`;
}

module.exports = {
  listBoards,
  createBoard,
  updateBoard,
  deleteBoard,
  uploadImage
};
