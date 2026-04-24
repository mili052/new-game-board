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
  screenshots: ["图片/截图", "图片", "截图"],
  status: ["状态"],
  platform: ["平台"],
  month: ["月份"],
  focus: ["是否重点", "重点"],
  sourceUrl: ["来源链接", "链接"],
  releaseStatus: ["发布状态"],
  reason: ["关注理由"],
  judgement: ["趋势判断"],
  createdAt: ["创建时间"]
};

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`缺少环境变量 ${name}`);
  }
  return value;
}

function ensureDir(filepath) {
  fs.mkdirSync(path.dirname(filepath), { recursive: true });
}

function sanitizeId(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "board";
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
        if (typeof item === "object") return item.text || item.name || item.url || item.link || item.token || "";
        return String(item);
      })
      .filter(Boolean)
      .join(" / ");
  }
  if (typeof value === "object") {
    return value.text || value.name || value.url || value.link || value.value || "";
  }
  return String(value).trim();
}

function toBool(value) {
  const text = toText(value);
  return ["是", "true", "1", "yes", "重点"].includes(text.toLowerCase());
}

function toArrayText(value) {
  if (value == null) return [];
  if (Array.isArray(value)) {
    return value
      .flatMap(item => {
        if (item == null) return [];
        if (typeof item === "string") return [item.trim()];
        if (typeof item === "object") return [item.text || item.name || item.value || ""];
        return [String(item)];
      })
      .map(item => item.trim())
      .filter(Boolean);
  }
  const text = toText(value);
  return text ? text.split("/").map(item => item.trim()).filter(Boolean) : [];
}

function attachmentUrls(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map(item => {
      if (!item || typeof item !== "object") return "";
      return item.tmp_url || item.url || item.download_url || item.preview_url || "";
    })
    .filter(Boolean);
}

function firstField(fields, aliases) {
  for (const alias of aliases) {
    if (Object.prototype.hasOwnProperty.call(fields, alias)) return fields[alias];
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
  let pageToken = "";
  const items = [];

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
    pageToken = data.data.page_token;
    if (!pageToken) break;
  }

  return items;
}

function normalizeMonth(month, createdAt) {
  const text = toText(month);
  if (text) return text;
  const date = createdAt ? new Date(createdAt) : new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(monthKey) {
  if (/^\d{4}-\d{2}$/.test(monthKey)) {
    const [year, month] = monthKey.split("-");
    return `${year}年${Number(month)}月`;
  }
  return monthKey;
}

function normalizeProduct(record) {
  const fields = record.fields || {};
  const screenshots = attachmentUrls(pick(fields, "screenshots"));
  const genre = toArrayText(pick(fields, "genre")).join(" / ");
  const topic = toArrayText(pick(fields, "topic")).join(" / ");
  const platform = toArrayText(pick(fields, "platform")).join(" / ");
  const month = normalizeMonth(pick(fields, "month"), toText(pick(fields, "createdAt")));

  return {
    id: record.record_id,
    name: toText(pick(fields, "name")) || "未命名产品",
    genre,
    topic,
    platform,
    developer: toText(pick(fields, "developer")),
    publisher: toText(pick(fields, "publisher")),
    sourceText: toText(pick(fields, "sourceText")),
    screenshots,
    cover: screenshots[0] || "",
    status: toText(pick(fields, "status")) || "待确认",
    month,
    focus: toBool(pick(fields, "focus")),
    sourceUrl: toText(pick(fields, "sourceUrl")),
    releaseStatus: toText(pick(fields, "releaseStatus")),
    reason: toText(pick(fields, "reason")),
    judgement: toText(pick(fields, "judgement")),
    publicNode: toText(pick(fields, "reason")),
    createdAt: toText(pick(fields, "createdAt")) || new Date().toISOString()
  };
}

function buildMetrics(products) {
  const countBy = key => new Set(products.map(item => item[key]).filter(Boolean)).size;
  return [
    `收录产品${products.length}款`,
    `${[...new Set(products.map(item => item.status).filter(Boolean))].join(" / ") || "待确认"}`,
    `${countBy("platform")}个平台`,
    `${products.filter(item => item.focus).length}款重点关注`
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
      return {
        id: sanitizeId(period),
        title: `${period}${titlePrefix}`,
        period,
        date: new Date().toISOString().slice(0, 10),
        summary: `${period}收录的新游产品列表，按当前飞书后台“可发布”记录同步生成，可用于公开检索和对外展示。`,
        metrics: buildMetrics(items),
        trends: [],
        products: items
          .sort((a, b) => Number(b.focus) - Number(a.focus) || String(a.name).localeCompare(String(b.name), "zh-CN"))
          .map((item, index) => ({ ...item, rank: index + 1 })),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
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
