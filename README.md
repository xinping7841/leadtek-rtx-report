# 专业图形卡选型与视频编解码能力对比

静态报告页面，用于比较 NVIDIA RTX / Quadro RTX 与 AMD Radeon PRO 专业图形卡。页面重点展示规格、视频编解码能力、价格参考区间和采购建议。

## 结构

```text
index.html                         # 轻量入口页
assets/css/report.css              # 页面样式
assets/js/app.js                   # 数据加载、筛选、排序、对比渲染逻辑
data/gpu-catalog.json              # 显卡规格、文案、分类和推荐口径
data/market-prices.json            # 国内/美国/综合参考价区间，前台只展示计算结果
data/gpu-test-results.json         # 腾讯文档同步的企业实测结果
scripts/extract-gpu-catalog-from-html.py # 从旧 HTML 表格迁移生成数据文件
scripts/sync-tencent-docs-via-chrome.mjs # 企业文档实测同步脚本
```

## 维护原则

- 新增或修改显卡型号，优先编辑 `data/gpu-catalog.json`。
- 价格只写入 `data/market-prices.json`，页面不展示逐来源报价。
- 美国市场价格结构已预留，可后续由后台脚本采集 Amazon、B&H、Best Buy、Newegg、CDW/Provantage 等渠道并计算区间。
- 页面会自动读取 `data/gpu-test-results.json`，把企业实测条目合并到对应型号卡片。
- `index.html` 不再维护静态 GPU 表格，避免后续改动越来越重。

## 价格口径

价格数据建议按后台计算后的结果写入：

```json
{
  "domestic": "约 ￥11000-15000",
  "us": "$1199-1499",
  "reference": "约 ￥9000-13000",
  "status": "公开样本较充足，库存价波动中",
  "confidence": "medium"
}
```

计算时应剔除二手、翻新、无库存、明显异常低价和错误型号样本。美国价格和国内价格分开计算，再给出综合参考区间。

## 本地预览

静态文件需要通过 HTTP 服务访问，避免浏览器拦截本地 JSON：

```powershell
python -m http.server 18080
```

然后访问：

```text
http://127.0.0.1:18080/
```

## 部署

当前项目运行在 node-121 的 `/opt/leadtek-rtx-report`，站点地址：

```text
https://nvidia.gaoxinping.top/
```

部署前确认分支、diff 和静态页面预览均正常，再同步到服务器。
