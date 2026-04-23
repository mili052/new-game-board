function clean(value) {
  return String(value || "").trim();
}

function firstMatch(text, patterns) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return clean(match[1]);
  }
  return "";
}

function detectStatus(text) {
  const rules = [
    ["畅销观察", /(畅销|Top\s*\d+|榜单|流水)/i],
    ["买量观察", /(买量|投放|素材|广告)/i],
    ["已上线", /(已上线|上线后|正式上线|公测)/i],
    ["即将上线", /(即将上线|将上线|定档|预约开启)/i],
    ["测试中", /(测试|首测|删档|内测|将测|限量测试)/i],
    ["预约中", /(预约|预注册)/i]
  ];
  return rules.find(([, pattern]) => pattern.test(text))?.[0] || "待确认";
}

function detectGenre(text) {
  const genres = [
    "MMORPG",
    "开放世界",
    "ACT",
    "SLG",
    "卡牌",
    "小游戏",
    "模拟经营",
    "肉鸽",
    "放置",
    "塔防",
    "射击",
    "二次元",
    "三国",
    "休闲",
    "RPG"
  ];
  return genres.filter(item => text.toLowerCase().includes(item.toLowerCase())).join(" / ") || "待确认";
}

function inferGameName(text) {
  return firstMatch(text, [
    /游戏名[:：]\s*([^\n]+)/i,
    /名称[:：]\s*([^\n]+)/i,
    /产品[:：]\s*([^\n]+)/i,
    /《([^》]{2,40})》/
  ]);
}

function heuristicParse(rawText) {
  const text = clean(rawText);
  const name = inferGameName(text) || text.split(/\s+/).find(Boolean) || "未命名产品";
  const genre = detectGenre(text);
  const status = detectStatus(text);
  const developer = firstMatch(text, [/研发[:：]\s*([^\n]+)/i, /开发[:：]\s*([^\n]+)/i]) || "待确认";
  const publisher = firstMatch(text, [/发行[:：]\s*([^\n]+)/i, /发行商[:：]\s*([^\n]+)/i]) || "待确认";

  return {
    name,
    genre,
    status,
    developer,
    publisher,
    publicNode: firstMatch(text, [/公开节点[:：]\s*([^\n]+)/i, /节点[:：]\s*([^\n]+)/i]) || "根据录入内容待确认公开节点。",
    judgement: `${name} 当前可先放入${status}池，重点补充平台、时间节点、研发发行和核心玩法信息。`,
    focus: /重点|头部|高关注|Top|爆款|腾讯|网易|米哈游|莉莉丝/.test(text),
    tags: [genre, status].filter(Boolean),
    needsReview: ["AI 未联网核验，以下字段请人工确认：平台、时间节点、研发发行、图片来源。"],
    sourceText: text
  };
}

function extractJson(text) {
  const trimmed = clean(text);
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch {}

  const match = trimmed.match(/\{[\s\S]*\}/);
  if (!match) return null;
  return JSON.parse(match[0]);
}

function normalizeDraft(input, rawText) {
  const fallback = heuristicParse(rawText);
  return {
    name: clean(input.name) || fallback.name,
    genre: clean(input.genre) || fallback.genre,
    status: clean(input.status) || fallback.status,
    developer: clean(input.developer) || fallback.developer,
    publisher: clean(input.publisher) || fallback.publisher,
    publicNode: clean(input.publicNode) || fallback.publicNode,
    judgement: clean(input.judgement) || fallback.judgement,
    focus: Boolean(input.focus),
    tags: Array.isArray(input.tags) ? input.tags.map(clean).filter(Boolean) : fallback.tags,
    needsReview: Array.isArray(input.needsReview) ? input.needsReview.map(clean).filter(Boolean) : fallback.needsReview,
    sourceText: clean(rawText)
  };
}

async function parseWithOpenAI(rawText) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return heuristicParse(rawText);

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-5-mini",
      input: [
        {
          role: "system",
          content: [
            "你是游戏行业资料库录入助手。",
            "把用户粘贴的新游信息整理成 JSON。",
            "不知道的信息必须写“待确认”，不要编造。",
            "输出字段只包含：name, genre, status, developer, publisher, publicNode, judgement, focus, tags, needsReview。",
            "status 优先使用：预约中、测试中、即将上线、已上线、畅销观察、买量观察、待确认。",
            "judgement 用中文，控制在 80 字以内。"
          ].join("\n")
        },
        {
          role: "user",
          content: rawText
        }
      ],
      text: {
        format: {
          type: "json_object"
        }
      }
    })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error?.message || "AI 整理失败");
  }

  const content = data.output_text || data.output?.flatMap(item => item.content || []).map(item => item.text || "").join("\n");
  return normalizeDraft(extractJson(content) || {}, rawText);
}

async function parseGameDraft(rawText) {
  const text = clean(rawText);
  if (!text) {
    const error = new Error("请先粘贴游戏信息");
    error.status = 400;
    throw error;
  }
  return parseWithOpenAI(text);
}

module.exports = { parseGameDraft };
