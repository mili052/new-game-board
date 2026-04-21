const http = require("http");
const fs = require("fs");
const path = require("path");
const { handleApi, send } = require("./src/api");

const root = __dirname;
const publicDir = path.join(root, "public");
const port = Number(process.env.PORT || 4173);

const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml"
};

function serveStatic(req, res) {
  const pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  const target = pathname === "/" ? path.join(publicDir, "index.html") : path.join(publicDir, pathname);
  const resolved = path.resolve(target);

  if (!resolved.startsWith(publicDir)) {
    send(res, 403, "Forbidden", "text/plain; charset=utf-8");
    return;
  }

  fs.readFile(resolved, (error, data) => {
    if (error) {
      send(res, 404, "Not Found", "text/plain; charset=utf-8");
      return;
    }

    res.writeHead(200, {
      "Content-Type": mime[path.extname(resolved).toLowerCase()] || "application/octet-stream"
    });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  if (new URL(req.url, "http://localhost").pathname.startsWith("/api/")) {
    await handleApi(req, res);
    return;
  }

  serveStatic(req, res);
});

server.listen(port, () => {
  console.log(`New game board running: http://localhost:${port}`);
  if (!process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD === "change-me-newgame") {
    console.log("Admin password is the default. Set ADMIN_PASSWORD before public deployment.");
  }
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.log("Supabase env is not set. Using local data/boards.json and public/uploads.");
  }
});
