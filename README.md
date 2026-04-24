# 新游产品库

这是一个可部署到 GitHub Pages / Vercel / Supabase 的新游产品库前台。

- 公开页：任何人都能访问和按时间筛选
- 后台：右上角齿轮登录，仅管理员可新增/编辑看板、产品、截图
- 云端数据：Supabase Postgres
- 云端图片：Supabase Storage
- 本地兜底：没有配置 Supabase 时，自动使用 `data/boards.json` 和 `public/uploads/`

## 本地启动

```powershell
cd "C:\Users\Administrator\Documents\New project"
$env:ADMIN_PASSWORD="newgame-admin"
npm start
```

打开：http://localhost:4173

## 飞书多维表格同步

项目已经补好第一版飞书同步脚本，目标是把飞书多维表格中的“可发布”记录同步成前台使用的 `data/boards.json`。

### 飞书侧需要准备

你需要在飞书开放平台创建一个**自建应用**，并准备：

- `App ID`
- `App Secret`
- 多维表格 `app_token`
- 数据表 `table_id`
- 可选的 `view_id`

推荐飞书字段名和你现在用的一致：

- `游戏名`
- `品类`
- `题材`
- `研发`
- `发行`
- `原始粘贴内容`
- `图片/截图`
- `状态`
- `平台`
- `月份`
- `是否重点`
- `来源链接`
- `发布状态`
- `关注理由`
- `趋势判断`
- `创建时间`

同步脚本默认只会拉取：

```text
发布状态 = 可发布
```

### 本地手动同步

先设置环境变量：

```powershell
$env:FEISHU_APP_ID="你的 App ID"
$env:FEISHU_APP_SECRET="你的 App Secret"
$env:FEISHU_BITABLE_APP_TOKEN="你的多维表格 app_token"
$env:FEISHU_TABLE_ID="你的 table_id"
$env:FEISHU_VIEW_ID="可选"
$env:FEISHU_PUBLISH_VALUE="可发布"
```

然后执行：

```powershell
npm run sync:feishu
```

执行成功后，会自动更新：

```text
data/boards.json
```

### GitHub 自动同步

仓库已经加好工作流：

```text
.github/workflows/sync-feishu.yml
```

你只需要去 GitHub 仓库里配置这些 Secrets：

- `FEISHU_APP_ID`
- `FEISHU_APP_SECRET`
- `FEISHU_BITABLE_APP_TOKEN`
- `FEISHU_TABLE_ID`
- `FEISHU_VIEW_ID`（可选）
- `FEISHU_PUBLISH_VALUE`（可选，默认 `可发布`）

配置位置：

```text
Settings
→ Secrets and variables
→ Actions
```

配置完成后，你可以在：

```text
Actions
→ Sync Feishu Data
```

里手动运行，也可以等它每 6 小时自动同步一次。

## Supabase 准备

1. 新建 Supabase 项目。
2. 打开 SQL Editor。
3. 执行 `supabase/schema.sql`。
4. 到 Project Settings -> API，复制：
   - Project URL
   - service_role key

注意：`service_role key` 只能放在 Vercel 环境变量里，不要写进前端代码，也不要公开。

## Vercel 环境变量

在 Vercel 项目的 Settings -> Environment Variables 里添加：

```text
ADMIN_PASSWORD=你的后台登录密码
ADMIN_TOKEN_SECRET=随便生成一串很长的随机字符
OPENAI_API_KEY=你的 OpenAI API Key（用于后台 AI 整理）
OPENAI_MODEL=gpt-5-mini
SUPABASE_URL=你的 Supabase Project URL
SUPABASE_SERVICE_ROLE_KEY=你的 Supabase service_role key
SUPABASE_BUCKET=game-assets
```

## 后台 AI 快速录入

后台登录后，可以在“AI 快速录入”里直接粘贴新游信息，也可以上传一张截图/图片。

- 点击 `AI整理` 后，系统会生成一条产品草稿并填入产品表单。
- AI 不知道的信息会标记为“待确认”，不会直接发布。
- 你检查字段后，点击 `保存更新` 才会写入看板。
- 未配置 `OPENAI_API_KEY` 时，会使用本地简易规则生成草稿，适合先验证录入流程。
- 第一版图片不强制必填；没有图片时前台会显示占位图。

## GitHub + Vercel 部署

1. 把这个目录推到 GitHub 仓库。
2. Vercel 选择 Import Git Repository。
3. Framework Preset 选 Other。
4. Build Command 留空或填 `npm run build` 前先不要用。
5. Output Directory 留空。
6. 填好上面的环境变量。
7. Deploy。

部署完成后，访问 Vercel 给你的域名即可。后台入口仍然是右上角齿轮。

## 文件说明

- `public/`：公开网页
- `api/index.js`：Vercel Serverless API 入口
- `src/api.js`：接口和鉴权
- `src/storage.js`：本地/Supabase 数据层
- `supabase/schema.sql`：Supabase 建表和初始数据
- `data/boards.json`：本地开发时的数据
- `public/uploads/`：本地开发时的图片
