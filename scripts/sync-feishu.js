const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const dataFile = path.join(root, "data", "boards.json");
const assetDir = path.join(root, "public", "feishu-assets");

const C = {
  gameName: "\u6e38\u620f\u540d",
  aiGameName: "AI: \u6e38\u620f\u540d",
  name: "\u540d\u79f0",
  genre: "\u54c1\u7c7b",
  type: "\u7c7b\u578b",
  topic: "\u9898\u6750",
  developer: "\u7814\u53d1",
  develop: "\u5f00\u53d1",
  publisher: "\u53d1\u884c",
  sourceText: "\u539f\u59cb\u7c98\u8d34\u5185\u5bb9",
  rawText: "\u539f\u59cb\u5185\u5bb9",
  icon: "\u6e38\u620ficon",
  iconCap: "\u6e38\u620fIcon",
  screenshots: "\u56fe\u7247/\u622a\u56fe",
  image: "\u56fe\u7247",
  screenshot: "\u622a\u56fe",
  status: "\u72b6\u6001",
  platform: "\u5e73\u53f0",
  month: "\u6708\u4efd",
  focus: "\u662f\u5426\u91cd\u70b9",
  focusShort: "\u91cd\u70b9",
  sourceUrl: "\u6765\u6e90\u94fe\u63a5",
  link: "\u94fe\u63a5",
  releaseStatus: "\u53d1\u5e03\u72b6\u6001",
  reason: "\u5173\u6ce8\u7406\u7531",
  judgement: "\u8d8b\u52bf\u5224\u65ad",
  createdAt: "\u521b\u5efa\u65f6\u95f4",
  updatedAt: "\u66f4\u65b0\u65f6\u95f4",
  firstTestTime: "\u9996\u6d4b\u65f6\u95f4",
  testTime: "\u6d4b\u8bd5\u65f6\u95f4",
  publicNode: "\u516c\u5f00\u8282\u70b9",
  node: "\u8282\u70b9",
  yes: "\u662f",
  keyProduct: "\u91cd\u70b9",
  monthSuffix: "\u6708",
  yearSuffix: "\u5e74",
  unpublished: "\u5f85\u786e\u8ba4",
  unnamed: "\u672a\u547d\u540d\u4ea7\u54c1",
  unpublishedBoardMonth: "\u672a\u5206\u6708",
  publishValue: "\u53ef\u53d1\u5e03",
  siteTitle: "\u65b0\u6e38\u4ea7\u54c1\u5e93",
  statusFallback: "\u5f85\u786e\u8ba4",
  summary: "\u6536\u5f55\u7684\u65b0\u6e38\u4ea7\u54c1\u5217\u8868\uff0c\u652f\u6301\u6301\u7eed\u5f55\u5165\u3001\u7b5b\u9009\u548c\u5bf9\u5916\u5c55\u793a\u3002"
};

const FIELD_ALIASES = {
  name: [C.gameName, C.aiGameName, C.name],
  genre: [C.genre, C.type],
  topic: [C.topic],
  developer: [C.developer, C.develop],
  publisher: [C.publisher],
  sourceText: [C.sourceText, C.rawText],
  icon: [C.icon, C.iconCap, "icon", "Icon", "ICON"],
  screenshots: [C.screenshots, C.image, C.screenshot],
  status: [C.status],
  platform: [C.platform],
  month: [C.month],
  focus: [C.focus, C.focusShort],
  sourceUrl: [C.sourceUrl, C.link],
  releaseStatus: [C.releaseStatus],
  reason: [C.reason],
  judgement: [C.judgement],
  createdAt: [C.createdAt, C.updatedAt],
  firstTestTime: [C.firstTestTime],
  testTime: [C.testTime],
  publicNode: [C.publicNode, C.node]
};

const assetCache = new Map();

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env: ${name}`);
  return value;
}

function ensureDir(filepath) {
  fs.mkdirSync(path.dirname(filepath), { recursive: true });
}

function ensureAssetDir() {
  fs.mkdirSync(assetDir, { recursive: true });
}

function sanitizeId(value) {
  return (
    String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "board"
  );
}

function normalizeKey(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[\s:/|_\-]+/g, "");
}

function toText(value) {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);

  if (Array.isArray(value)) {
    return value
      .map(item => {
        if (item == null) return "";
        if (typeof item === "string") return item.trim();
        if (typeof item === "object") {
          return item.text || item.name || item.value || item.label || item.url || "";
        }
        return String(item);
      })
      .filter(Boolean)
      .join(" / ");
  }

  if (typeof value === "object") {
    return value.text || value.name || value.value || value.label || value.url || "";
  }

  return String(value).trim();
}

function toArrayText(value) {
  if (value == null) return [];

  if (Array.isArray(value)) {
    return value
      .flatMap(item => {
        if (item == null) return [];
        if (typeof item === "string") return [item.trim()];
        if (typeof item === "object") return [item.text || item.name || item.value || item.label || ""];
        return [String(item)];
      })
      .map(item => item.trim())
      .filter(Boolean);
  }

  const text = toText(value);
  return text ? text.split("/").map(item => item.trim()).filter(Boolean) : [];
}

function toBool(value) {
  const text = toText(value).toLowerCase();
  return [C.yes, "true", "1", "yes", C.keyProduct].map(item => item.toLowerCase()).includes(text);
}

function parseDateValue(value) {
  if (value == null || value === "") return null;

  if (typeof value === "number") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  if (typeof value === "string") {
    const text = value.trim();
    if (!text) return null;

    if (/^\d{13}$/.test(text) || /^\d{10}$/.test(text)) {
      const num = Number(text);
      const date = new Date(text.length === 10 ? num * 1000 : num);
      return Number.isNaN(date.getTime()) ? null : date;
    }

    const normalized = text.replace(/\//g, "-");
    const date = new Date(normalized);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  if (typeof value === "object") {
    return parseDateValue(value.text || value.value || value.timestamp || value.time);
  }

  return null;
}

function normalizeMonth(monthValue, testTimeValue, createdAtValue) {
  const monthText = toText(monthValue);
  if (monthText) return monthText;

  const date = parseDateValue(testTimeValue) || parseDateValue(createdAtValue);
  if (!date) return "";
  return `${date.getMonth() + 1}${C.monthSuffix}`;
}

function normalizeDisplayDate(value) {
  const date = parseDateValue(value);
  if (!date) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function monthLabel(monthKey) {
  const text = toText(monthKey);
  if (!text) return C.unpublishedBoardMonth;
  if (/^\d{4}-\d{2}$/.test(text)) {
    const [year, month] = text.split("-");
    return `${year}${C.yearSuffix}${Number(month)}${C.monthSuffix}`;
  }
  return text;
}

function firstField(fields, aliases) {
  const entries = Object.entries(fields || {});

  for (const alias of aliases) {
    if (Object.prototype.hasOwnProperty.call(fields, alias)) return fields[alias];

    const target = normalizeKey(alias);
    const fuzzy = entries.find(([key]) => normalizeKey(key) === target);
    if (fuzzy) return fuzzy[1];
  }

  return undefined;
}

function pick(fields, key) {
  return firstField(fields, FIELD_ALIASES[key] || []);
}

function normalizeAttachments(value) {
  if (!Array.isArray(value)) return [];

  return value
    .map(item => {
      if (!item || typeof item !== "object") return null;

      const sourceUrl =
        item.tmp_url ||
        item.url ||
        item.download_url ||
        item.preview_url ||
        item.link ||
        "";

      let fileToken = item.file_token || item.token || item.fileToken || "";

      if (!fileToken && sourceUrl) {
        try {
          const parsed = new URL(sourceUrl);
          fileToken = parsed.searchParams.get("file_tokens") || "";
        } catch {}
      }

      return {
        fileToken,
        sourceUrl,
        name: item.name || item.file_name || item.filename || "",
        type: item.type || item.mime_type || item.mimeType || ""
      };
    })
    .filter(Boolean);
}

async function getTenantAccessToken() {
  const response = await fetch("https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      app_id: required("FEISHU_APP_ID"),
      app_secret: required("FEISHU_APP_SECRET")
    })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.code !== 0 || !data.tenant_access_token) {
    throw new Error(`Failed to get tenant token: ${data.msg || response.statusText}`);
  }

  return data.tenant_access_token;
}

async function listRecords(token) {
  const appToken = required("FEISHU_BITABLE_APP_TOKEN");
  const tableId = required("FEISHU_TABLE_ID");
  const viewId = process.env.FEISHU_VIEW_ID;
  const pageSize = Number(process.env.FEISHU_PAGE_SIZE || 200);

  const items = [];
  let pageToken = "";

  while (true) {
    const url = new URL(`https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/records`);
    url.searchParams.set("page_size", String(pageSize));
    if (viewId) url.searchParams.set("view_id", viewId);
    if (pageToken) url.searchParams.set("page_token", pageToken);

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json; charset=utf-8"
      }
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.code !== 0) {
      throw new Error(`Failed to list records: ${data.msg || response.statusText}`);
    }

    items.push(...(data.data?.items || []));
    if (!data.data?.has_more) break;

    pageToken = data.data?.page_token || "";
    if (!pageToken) break;
  }

  return items;
}

async function resolveTempDownloadUrl(sourceUrl, token) {
  const response = await fetch(sourceUrl, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.code !== 0) {
    throw new Error(`Failed to resolve temp url: ${data.msg || response.statusText}`);
  }

  const list = data.data?.tmp_download_urls || data.data?.download_urls || data.data?.urls || [];
  const first = Array.isArray(list) ? list[0] : null;
  return first?.tmp_download_url || first?.download_url || first?.url || "";
}

function extensionFromType(contentType = "", fallbackName = "") {
  const extByType = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif"
  };

  if (extByType[contentType]) return extByType[contentType];

  const ext = path.extname(fallbackName || "");
  if (ext) return ext;

  return ".jpg";
}

async function downloadAttachment(attachment, token, stem) {
  const cacheKey = attachment.fileToken || attachment.sourceUrl || stem;
  if (assetCache.has(cacheKey)) return assetCache.get(cacheKey);

  let finalUrl = "";

  if (attachment.sourceUrl && attachment.sourceUrl.includes("batch_get_tmp_download_url")) {
    finalUrl = await resolveTempDownloadUrl(attachment.sourceUrl, token);
  } else if (/^https?:\/\//i.test(attachment.sourceUrl || "")) {
    finalUrl = attachment.sourceUrl;
  }

  if (!finalUrl) return "";

  const response = await fetch(finalUrl);
  if (!response.ok) {
    console.warn(`Attachment download failed: ${response.status} ${response.statusText}`);
    return "";
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const ext = extensionFromType(response.headers.get("content-type") || attachment.type || "", attachment.name);
  const fileName = `${stem}${ext}`;
  const fullPath = path.join(assetDir, fileName);

  ensureDir(fullPath);
  fs.writeFileSync(fullPath, buffer);

  const publicPath = `feishu-assets/${fileName}`;
  assetCache.set(cacheKey, publicPath);
  return publicPath;
}

async function normalizeProduct(record, token) {
  const fields = record.fields || {};
  const iconAttachments = normalizeAttachments(pick(fields, "icon"));
  const screenshotAttachments = normalizeAttachments(pick(fields, "screenshots"));
  const createdAtValue = pick(fields, "createdAt");
  const firstTestTimeValue = pick(fields, "firstTestTime");
  const testTimeValue = pick(fields, "testTime");

  const icon = iconAttachments[0]
    ? await downloadAttachment(iconAttachments[0], token, `${record.record_id}-icon-1`)
    : "";

  const screenshots = [];
  for (let index = 0; index < screenshotAttachments.length; index += 1) {
    const asset = await downloadAttachment(
      screenshotAttachments[index],
      token,
      `${record.record_id}-shot-${index + 1}`
    );
    if (asset) screenshots.push(asset);
  }

  return {
    id: record.record_id,
    name: toText(pick(fields, "name")) || C.unnamed,
    genre: toArrayText(pick(fields, "genre")).join(" / "),
    topic: toArrayText(pick(fields, "topic")).join(" / "),
    platform: toArrayText(pick(fields, "platform")).join(" / "),
    developer: toText(pick(fields, "developer")),
    publisher: toText(pick(fields, "publisher")),
    sourceText: toText(pick(fields, "sourceText")),
    icon,
    screenshots,
    cover: icon || screenshots[0] || "",
    status: toText(pick(fields, "status")) || C.statusFallback,
    month: normalizeMonth(pick(fields, "month"), testTimeValue, createdAtValue),
    focus: toBool(pick(fields, "focus")),
    sourceUrl: toText(pick(fields, "sourceUrl")),
    releaseStatus: toText(pick(fields, "releaseStatus")),
    reason: toText(pick(fields, "reason")),
    judgement: toText(pick(fields, "judgement")),
    firstTestTime: normalizeDisplayDate(firstTestTimeValue),
    publicNode: toText(pick(fields, "publicNode")) || toText(testTimeValue),
    createdAt: toText(createdAtValue) || new Date().toISOString()
  };
}

function buildMetrics(products) {
  const platforms = new Set(products.map(item => item.platform).filter(Boolean));
  const statuses = [...new Set(products.map(item => item.status).filter(Boolean))];

  return [
    `\u6536\u5f55\u4ea7\u54c1${products.length}\u6b3e`,
    `${statuses.join(" / ") || C.statusFallback}`,
    `${platforms.size}\u4e2a\u5e73\u53f0`,
    `\u91cd\u70b9\u4ea7\u54c1${products.filter(item => item.focus).length}\u6b3e`
  ];
}

function buildBoards(products) {
  const groups = new Map();

  for (const product of products) {
    const key = product.month || C.unpublishedBoardMonth;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(product);
  }

  return [...groups.entries()]
    .sort((a, b) => String(b[0]).localeCompare(String(a[0]), "zh-CN"))
    .map(([month, items]) => {
      const period = monthLabel(month);
      const now = new Date().toISOString();
      return {
        id: sanitizeId(period),
        title: `${period}${process.env.FEISHU_SITE_TITLE || C.siteTitle}`,
        period,
        date: now.slice(0, 10),
        summary: `${period}${C.summary}`,
        metrics: buildMetrics(items),
        trends: [],
        products: items
          .sort((a, b) => Number(b.focus) - Number(a.focus) || String(a.name).localeCompare(String(b.name), "zh-CN"))
          .map((item, index) => ({ ...item, rank: index + 1 })),
        createdAt: now,
        updatedAt: now
      };
    });
}

function writeBoards(boards) {
  ensureDir(dataFile);
  fs.writeFileSync(dataFile, `${JSON.stringify({ boards }, null, 2)}\n`, "utf8");
}

async function main() {
  ensureAssetDir();

  const publishValue = process.env.FEISHU_PUBLISH_VALUE || C.publishValue;
  const token = await getTenantAccessToken();
  const records = await listRecords(token);

  const normalized = [];
  for (const record of records) {
    normalized.push(await normalizeProduct(record, token));
  }

  const products = normalized.filter(item => !publishValue || item.releaseStatus === publishValue);
  const boards = buildBoards(products);

  writeBoards(boards);
  console.log(`Synced ${products.length} products from Feishu into ${boards.length} board(s).`);
}

main().catch(error => {
  console.error(error.message || error);
  process.exit(1);
});
