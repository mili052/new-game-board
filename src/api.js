const crypto = require("crypto");
const { listBoards, createBoard, updateBoard, deleteBoard, uploadImage } = require("./storage");
const { parseGameDraft } = require("./ai");

const adminPassword = process.env.ADMIN_PASSWORD || "change-me-newgame";
const tokenSecret = process.env.ADMIN_TOKEN_SECRET || adminPassword;
const tokenTtlMs = 1000 * 60 * 60 * 24 * 7;

function send(res, status, body, contentType = "application/json; charset=utf-8") {
  const payload = typeof body === "string" ? body : JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": contentType,
    "Cache-Control": "no-store"
  });
  res.end(payload);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", chunk => {
      body += chunk;
      if (body.length > 25 * 1024 * 1024) {
        reject(new Error("请求体过大"));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("JSON 格式不正确"));
      }
    });
    req.on("error", reject);
  });
}

function signToken(exp, nonce) {
  return crypto
    .createHmac("sha256", tokenSecret)
    .update(`${exp}.${nonce}`)
    .digest("hex");
}

function createToken() {
  const exp = Date.now() + tokenTtlMs;
  const nonce = crypto.randomBytes(12).toString("hex");
  return `${exp}.${nonce}.${signToken(exp, nonce)}`;
}

function isAuthed(req) {
  const auth = req.headers.authorization || "";
  if (!auth.startsWith("Bearer ")) return false;

  const [exp, nonce, signature] = auth.slice(7).split(".");
  if (!exp || !nonce || !signature) return false;
  if (Number(exp) < Date.now()) return false;

  const expected = signToken(exp, nonce);
  if (signature.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

async function handleApi(req, res) {
  try {
    const url = new URL(req.url, "http://localhost");
    const boardMatch = url.pathname.match(/^\/api\/boards\/([a-zA-Z0-9_-]+)$/);

    if (req.method === "POST" && url.pathname === "/api/login") {
      const body = await readBody(req);
      if (body.password !== adminPassword) {
        send(res, 401, { error: "密码不正确" });
        return;
      }
      send(res, 200, { token: createToken() });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/boards") {
      send(res, 200, { boards: await listBoards() });
      return;
    }

    if (!isAuthed(req)) {
      send(res, 401, { error: "需要管理员登录" });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/boards") {
      send(res, 201, { board: await createBoard(await readBody(req)) });
      return;
    }

    if (boardMatch && req.method === "PUT") {
      send(res, 200, { board: await updateBoard(boardMatch[1], await readBody(req)) });
      return;
    }

    if (boardMatch && req.method === "DELETE") {
      await deleteBoard(boardMatch[1]);
      send(res, 200, { ok: true });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/upload") {
      const body = await readBody(req);
      send(res, 201, { url: await uploadImage(body.dataUrl) });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/ai/parse") {
      const body = await readBody(req);
      send(res, 200, { draft: await parseGameDraft(body.text) });
      return;
    }

    send(res, 404, { error: "接口不存在" });
  } catch (error) {
    send(res, error.status || 500, { error: error.message || "服务器错误" });
  }
}

module.exports = { handleApi, send };
