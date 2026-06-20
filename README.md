# 丽台 NVIDIA RTX 专业图形卡近五年对比

静态 Web 报告页面，用于对比 NVIDIA RTX 专业图形卡（Ampere / Ada / Blackwell）的规格、采购定位、视频编解码能力和企业实测结果。

当前正式部署在 node-121 的 `/opt/leadtek-rtx-report`，通过 18080 端口提供访问。

## 项目结构

```text
??? index.html                    # Page skeleton, controls, table header, render containers
??? assets/
?   ??? app.css                   # All page styles
?   ??? app.js                    # ES module entry point
?   ??? images/                   # Locally cached product images
?   ??? js/
?       ??? app-controller.js     # State, events, filtering, sorting, comparison, external result merge
?       ??? elements.js           # DOM lookup and required container checks
?       ??? renderers.js          # Table, cards, comparison table, and error-state HTML rendering
?       ??? schema.js             # Browser-side JSON validation
?       ??? utils.js              # escapeHtml, loadJson, and small shared helpers
?       ??? view-model.js         # GPU normalization, derived fields, score, price sort value
??? data/
?   ??? gpu-catalog.json          # GPU catalog data
?   ??? market-prices.json        # Market prices keyed by gpuId
?   ??? gpu-test-results.json     # Enterprise test results synced from Tencent Docs
??? scripts/
?   ??? validate-static.mjs       # Static structure and data integrity validation
?   ??? serve-static.mjs          # Local static preview server
?   ??? edit-lock.sh / .ps1       # Multi-agent edit lock
?   ??? sync-tencent-docs-via-chrome.mjs
??? tests/
?   ??? smoke.spec.mjs            # Playwright smoke tests
??? package.json
??? playwright.config.mjs
```

## 本地启动

首次拉取后安装测试依赖：

```bash
npm install
```

启动本地静态预览：

```bash
npm start
```

默认访问：

```text
http://127.0.0.1:18080/
```

如需换端口：

```bash
node scripts/serve-static.mjs 18180
```

## 数据维护

GPU 主体数据维护在：

```text
data/gpu-catalog.json
```

每个 GPU 必须有稳定唯一的 `id`，并包含型号、级别、架构、图片、计算核心、显存、带宽、功耗、编解码、接口、外形、官网链接和定位建议等字段。

市场价格维护在：

```text
data/market-prices.json
```

价格通过 `gpuId` 关联 `gpu-catalog.json`。如果公开价格不足，可保留 `status: "quote"`，并将 `minCny` / `maxCny` 设为 `null`。

企业实测数据来自腾讯文档同步：

```text
data/gpu-test-results.json
```

同步流程：

```bash
# 在 node-121 保持腾讯文档登录态
bash scripts/start-121-doc-chromium.sh
node scripts/sync-tencent-docs-via-chrome.mjs
```

默认同步会枚举腾讯文档工作簿里的全部 sheet，并将符合“显卡/GPU + 编码格式/素材/测试结果”结构的测试行汇总到同一个 JSON。若腾讯文档内部 API 无法枚举全部 sheet，可用 `--sub-ids=<tab1,tab2>` 或环境变量 `TENCENT_DOC_SUB_IDS` 指定多个 tab。

## 验证命令

静态结构和数据校验：

```bash
npm run validate
```

该命令会检查：

- `index.html` 是否引用 `assets/app.css` / `assets/app.js`
- JSON 是否可解析
- GPU `id` 是否唯一
- GPU 必填字段是否存在
- `market-prices.json` 的 `gpuId` 是否都能匹配 GPU 主数据
- `assets/app.js` 是否通过语法检查

Playwright 冒烟测试：

```bash
npm run test:e2e
```

测试覆盖首页加载、24 条 GPU 数据渲染、搜索筛选、型号对比和移动端主流程。

如果当前环境没有 Playwright 自带 Chromium，但安装了系统 Chrome，可指定：

```powershell
$env:PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH='C:\Program Files\Google\Chrome\Application\chrome.exe'
npm run test:e2e
```

Linux 可按实际路径指定，例如：

```bash
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/google-chrome npm run test:e2e
```

## node-121 部署

正式目录：

```bash
cd /opt/leadtek-rtx-report
```

开始修改前获取编辑锁：

```bash
bash scripts/edit-lock.sh acquire "修改原因"
```

部署 GitHub master：

```bash
git pull --ff-only
npm install
npm run validate
```

18080 服务由 systemd 管理：

```bash
systemctl status leadtek-report.service --no-pager
```

当前服务仍使用 Python 静态服务器：

```bash
python3 -m http.server 18080 --bind 0.0.0.0
```

静态文件更新后通常不需要重启；如需确认：

```bash
curl -I http://127.0.0.1:18080/
curl -I http://127.0.0.1:18080/data/gpu-catalog.json
curl -I http://127.0.0.1:18080/assets/app.js
```

完成修改并提交后释放编辑锁：

```bash
bash scripts/edit-lock.sh release
```

## 功能

- GPU 规格表：由 `data/gpu-catalog.json` 动态渲染
- 市场参考价：由 `data/market-prices.json` 合并到 GPU 数据
- 视频服务器专项筛选：功耗、显存、NVDEC、4:2:2、AV1、低功耗等维度
- 型号对比：勾选 2 款及以上 GPU 生成并排对比表
- 企业实测合并：自动读取 `data/gpu-test-results.json` 并合并到表格和卡片
- 完整/紧凑视图：适配大屏展示、小窗口和移动端

## 安全渲染约定

`assets/app.js` 对来自 JSON 或企业文档的数据统一先通过 `escapeHtml` 再拼接渲染。维护数据时不要在 JSON 中写 HTML 片段；如需换行，使用普通文本换行符。


## Static Data Maintenance Notes

Product images are cached locally under `assets/images/` so the report does not depend on Leadtek image hotlinks at runtime. In `data/gpu-catalog.json`, `image.src` must point to the local cached file and `image.sourceUrl` should keep the original Leadtek URL for traceability.

All JSON or external document values must be escaped before rendering. Runtime data validation lives in `assets/js/schema.js`, GPU derived fields live in `assets/js/view-model.js`, and HTML string rendering lives in `assets/js/renderers.js`.

`npm run validate` checks HTML references, module syntax for `assets/app.js` and `assets/js/*.js`, JSON validity, unique GPU ids, required fields, local image file existence, and market price id matching.

On node-121, install the Playwright browser once when e2e testing is needed. This only writes Playwright browser binaries and does not affect the 18080 service:

```bash
npx playwright install chromium
```

After deployment, a quick static check should include a cached image URL:

```bash
curl -I http://127.0.0.1:18080/assets/images/rtx-pro-4000-blackwell.jpg
```
