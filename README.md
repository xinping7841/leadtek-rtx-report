# 丽台 NVIDIA RTX 专业图形卡近五年对比

静态 HTML 报告页面，提供 NVIDIA RTX 专业图形卡（Ampere / Ada / Blackwell）近五年的规格对比、采购判断和视频编解码能力评估。

## 项目结构

```
├── index.html              # 主页面：GPU 对比表 + 筛选/排序/对比功能
├── data/
│   └── gpu-test-results.json   # 腾讯文档同步的 GPU 实测数据
└── scripts/
    ├── sync-tencent-docs-via-chrome.mjs   # 通过 Chrome DevTools 协议抓取腾讯文档表格
    ├── start-121-doc-chromium.sh          # 在 node-121 上启动 Chromium（debug 端口 9222）
    ├── watch-tencent-docs-sync-linux.sh   # Linux 环境同步守护脚本
    └── watch-tencent-docs-sync.ps1        # Windows 环境同步守护脚本
```

## 部署

当前运行在 node-121（`/opt/leadtek-rtx-report`），通过 Python HTTP 服务器暴露：

```bash
cd /opt/leadtek-rtx-report
python3 -m http.server 18080 --bind 0.0.0.0
```

访问：`http://node-121:18080/`

## 数据同步

页面内置的 GPU 测试数据来自腾讯文档在线表格 `C5&hecoos 硬件测试报告`。

同步流程：
1. 在 node-121 上启动 Chromium debug 模式（见 `scripts/start-121-doc-chromium.sh`）
2. 运行 `scripts/sync-tencent-docs-via-chrome.mjs` 抓取数据到 `data/gpu-test-results.json`
3. 页面启动时自动加载该 JSON 文件，展示企业文档同步状态

## 功能

- **GPU 规格对比表**：涵盖 Blackwell、Ada、Ampere 三代架构的全部 RTX 专业卡
- **筛选器**：按功耗、显存、NVDEC 数量、4:2:2 支持、AV1 能力等多维筛选
- **多款对比**：勾选 2 款及以上 GPU 生成并排对比表
- **视频服务器能力评分**：综合 4:2:2、AV1、NVENC/NVDEC、显存、带宽、功耗等维度
- **全屏/紧凑双视图**：适配大屏展示和小窗口操作
