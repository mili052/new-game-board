const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const dataFile = path.join(root, "data", "boards.json");

const FIELD_ALIASES = {
  name: ["游戏名", "AI: 游戏名", "名称"],
  genre: ["品类", "类型"],
  topic: ["题材"],
  developer: ["研发", "开发"],
  publisher: ["发行"],
  sourceText: ["原始粘贴内容", "原始内容"],
  icon: ["游戏icon", "游戏Icon", "icon", "Icon", "ICON"],
  screenshots: ["图片/截图", "图片", "截图"],
  status: ["状态"],
  platform: ["平台"],
  month: ["月份"],
  focus: ["是否重点", "重点"],
  sourceUrl: ["来源链接", "链接"],
  releaseStatus: ["发布状态"],
  reason: ["关注理由"],
  judgement: ["趋势判断"],
  createdAt: ["创建时间", "更新时间", "测试时间"],
  testTime: ["测试时间"],
  publicNode: ["公开节点", "节点", "测试时间"]
};

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`缺少环境变量 ${name}`);
  return value;
}

function ensureDir(filepath) {
  fs.mkdirSync(path.dirname(filepath), { recursive: true });
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
    .replace(/[\s:/|_-]+/g, "");
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
  return ["是", "true", "1", "yes", "重点"].includes(text);
}

function collectHttpUrls(value, bucket = []) {
  if (value == null) return bucket;

  if (typeof value === "string") {
    if (/^https?:\/\//i.test(value)) bucket.push(value);
    return bucket;
  }

  if (Array.isArray(value)) {
    value.forEach(item => collectHttpUrls(item, bucket));
    return bucket;
  }

  if (typeof value === "object") {
    ["tmp_url", "url", "download_url", "preview_url", "link", "src"].forEach(key => {
      if (value[key]) collectHttpUrls(value[key], bucket);
    });
  }

  return bucket;
}

function attachmentUrls(value) {
  return [...new Set(collectHttpUrls(value).filter(Boolean))];
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
    throw new Error(`获取飞书 tenant_access_token 失败：${data.msg || response.statusText}`);
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
      throw new Error(`读取飞书多维表格失败：${data.msg || response.statusText}`);
    }

    items.push(...(data.data?.items || []));
    if (!data.data?.has_more) break;

    pageToken = data.data?.page_token || "";
    if (!pageToken) break;
  }

  return items;
}

function normalizeMonth(month, createdAt) {
  const text = toText(month);
  if (text) return text;

  const date = createdAt ? new Date(createdAt) : new Date();
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getMonth() + 1}月`;
}

function monthLabel(monthKey) {
  const text = toText(monthKey);
  if (!text) return "未分月";
  if (/^\d{4}-\d{2}$/.test(text)) {
    const [year, month] = text.split("-");
    return `${year}年${Number(month)}月`;
  }
  return text;
}

function normalizeProduct(record) {
  const fields = record.fields || {};
  const iconUrls = attachmentUrls(pick(fields, "icon"));
  const screenshotUrls = attachmentUrls(pick(fields, "screenshots"));
  const createdAt = toText(pick(fields, "createdAt"));

  return {
    id: record.record_id,
    name: toText(pick(fields, "name")) || "未命名产品",
    genre: toArrayText(pick(fields, "genre")).join(" / "),
    topic: toArrayText(pick(fields, "topic")).join(" / "),
    platform: toArrayText(pick(fields, "platform")).join(" / "),
    developer: toText(pick(fields, "developer")),
    publisher: toText(pick(fields, "publisher")),
    sourceText: toText(pick(fields, "sourceText")),
    icon: iconUrls[0] || "",
    screenshots: screenshotUrls,
    cover: iconUrls[0] || screenshotUrls[0] || "",
    status: toText(pick(fields, "status")) || "待确认",
    month: normalizeMonth(pick(fields, "month"), createdAt),
    focus: toBool(pick(fields, "focus")),
    sourceUrl: toText(pick(fields, "sourceUrl")),
    releaseStatus: toText(pick(fields, "releaseStatus")),
    reason: toText(pick(fields, "reason")),
    judgement: toText(pick(fields, "judgement")),
    publicNode: toText(pick(fields, "publicNode")),
    createdAt: createdAt || new Date().toISOString()
  };
}

function buildMetrics(products) {
  const platformCount = new Set(products.map(item => item.platform).filter(Boolean)).size;
  const focusCount = products.filter(item => item.focus).length;
  const statuses = [...new Set(products.map(item => item.status).filter(Boolean))];

  return [
    `收录产品${products.length}款`,
    `${statuses.join(" / ") || "待确认"}`,
    `${platformCount}个平台`,
    `重点产品${focusCount}款`
  ];
}

function buildBoards(products) {
  const groups = new Map();

  for (const product of products) {
    const key = product.month || "未分月";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(product);
  }

  return [...groups.entries()]
    .sort((a, b) => String(b[0]).localeCompare(String(a[0]), "zh-CN"))
    .map(([month, items]) => {
      const period = monthLabel(month);
      const titlePrefix = process.env.FEISHU_SITE_TITLE || "新游产品库";
      const now = new Date().toISOString();

      return {
        id: sanitizeId(period),
        title: `${period}${titlePrefix}`,
        period,
        date: now.slice(0, 10),
        summary: `${period}收录的新游产品列表，支持持续录入、筛选和对外展示。`,
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
  const publishValue = process.env.FEISHU_PUBLISH_VALUE || "可发布";
  const token = await getTenantAccessToken();
  const records = await listRecords(token);
  const products = records
    .map(normalizeProduct)
    .filter(item => !publishValue || item.releaseStatus === publishValue);

  const boards = buildBoards(products);
  writeBoards(boards);
  console.log(`Synced ${products.length} products from Feishu into ${boards.length} board(s).`);
}

main().catch(error => {
  console.error(error.message || error);
  process.exit(1);
});
