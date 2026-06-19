from __future__ import annotations

import html
import json
import re
from html.parser import HTMLParser
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "index.html"
OUTPUT = ROOT / "data" / "gpu-catalog.json"
PRICES = ROOT / "data" / "market-prices.json"


def clean_text(value: str) -> str:
    value = re.sub(r"<br\s*/?>", "\n", value, flags=re.I)
    value = re.sub(r"<[^>]+>", "", value)
    value = html.unescape(value)
    value = value.replace("\xa0", " ")
    value = re.sub(r"[ \t\r\f\v]+", " ", value)
    value = re.sub(r"\n\s*", "\n", value)
    return value.strip()


def slugify(model: str) -> str:
    slug = model.lower().replace("+", " plus ")
    slug = re.sub(r"[^a-z0-9]+", "-", slug).strip("-")
    return slug


def first_match(pattern: str, text: str, default: str = "") -> str:
    match = re.search(pattern, text, re.S | re.I)
    return html.unescape(match.group(1)).strip() if match else default


def codec_parts(cell_html: str) -> dict[str, str]:
    return {
        "title": clean_text(first_match(r'<span class="codec-title">(.*?)</span>', cell_html)),
        "detail": clean_text(first_match(r'<span class="codec-detail">(.*?)</span>', cell_html)),
        "note": clean_text(first_match(r'<span class="codec-note">(.*?)</span>', cell_html)),
        "raw": clean_text(cell_html),
    }


def parse_generation(cell_html: str) -> tuple[str, str]:
    tag = clean_text(first_match(r'<span class="tag">(.*?)</span>', cell_html))
    text = clean_text(cell_html)
    year = text.replace(tag, "", 1).strip() if tag else text
    return tag or year, year


def parse_engine(value: str) -> dict[str, int]:
    return {
        "encode": int((re.search(r"(\d+)x\s*NVENC", value, re.I) or [0, 0])[1] or 0),
        "decode": int((re.search(r"(\d+)x\s*NVDEC", value, re.I) or [0, 0])[1] or 0),
        "jpeg": int((re.search(r"(\d+)x\s*JPEG", value, re.I) or [0, 0])[1] or 0),
    }


def parse_numeric(pattern: str, value: str) -> int:
    match = re.search(pattern, value, re.I)
    return int(match.group(1)) if match else 0


def brand_for(model: str) -> str:
    if "Radeon" in model or model.startswith("AMD"):
        return "AMD"
    return "NVIDIA"


def tier_for(level: str) -> str:
    return {
        "6000": "旗舰级",
        "5000": "高端级",
        "4000": "主流专业级",
        "2000": "入门到主流级",
        "1000": "轻量入门级",
        "turing": "上一代参考",
        "amd-high": "AMD 高端专业",
        "amd-mainstream": "AMD 主流专业",
        "legacy": "存量参考",
    }.get(level, level or "未分级")


def lifecycle_for(architecture: str, model: str) -> str:
    text = f"{architecture} {model}"
    if "Blackwell" in text or "RDNA 3" in text:
        return "current"
    if "Ada" in text or "RDNA 2" in text:
        return "active"
    if "Ampere" in text:
        return "mature"
    return "legacy"


def recommendation_type(advice: str, architecture: str, model: str) -> str:
    text = f"{advice} {architecture} {model}"
    if re.search(r"不建议|存量|上一代|老款|除非", text):
        return "库存或存量项目参考"
    if re.search(r"Blackwell|W7900|W7800|视频服务器|AV1|4:2:2", text):
        return "重点评估"
    if re.search(r"A1000|A400|W7500|W7600|轻量|多屏|CAD", text):
        return "轻量工作站"
    return "常规评估"


def parse_existing_cards(index_html: str) -> list[dict[str, Any]]:
    table_match = re.search(r'<table id="gpuTable">(.*?)</table>', index_html, re.S | re.I)
    if not table_match:
        raise RuntimeError("gpuTable not found")
    table_html = table_match.group(1)
    body = first_match(r"<tbody>(.*?)</tbody>", table_html)
    rows = re.findall(r'<tr([^>]*)>(.*?)</tr>', body, re.S | re.I)
    cards: list[dict[str, Any]] = []
    for attrs, row_html in rows:
        level = first_match(r'data-level="(.*?)"', attrs)
        cells = re.findall(r'<td[^>]*>(.*?)</td>', row_html, re.S | re.I)
        if len(cells) < 17:
            continue
        image = first_match(r'<img[^>]+src="(.*?)"', cells[1])
        image_alt = first_match(r'<img[^>]+alt="(.*?)"', cells[1])
        model = clean_text(cells[2])
        generation, release = parse_generation(cells[3])
        architecture = clean_text(cells[4])
        compute = clean_text(cells[5])
        memory = clean_text(cells[6])
        bus = clean_text(cells[7])
        power = clean_text(cells[8])
        video_engine = clean_text(cells[9])
        official = first_match(r'<a[^>]+href="(.*?)"', cells[14])
        price = clean_text(cells[15])
        advice = clean_text(cells[16])
        cards.append({
            "id": slugify(model),
            "brand": brand_for(model),
            "model": model,
            "level": level,
            "tier": tier_for(level),
            "generation": generation,
            "release": release,
            "architecture": architecture,
            "lifecycle": lifecycle_for(architecture, model),
            "compute": compute,
            "memory": memory,
            "memoryGb": parse_numeric(r"(\d+)\s*GB", memory),
            "busBandwidth": bus,
            "bandwidthGBs": parse_numeric(r"(\d+)\s*GB/s", bus),
            "power": power,
            "powerW": parse_numeric(r"(\d+)W", power),
            "videoEngine": video_engine,
            "engine": parse_engine(video_engine),
            "h265": codec_parts(cells[10]),
            "av1": codec_parts(cells[11]),
            "interface": clean_text(cells[12]),
            "formFactor": clean_text(cells[13]),
            "officialUrl": official,
            "image": image,
            "imageAlt": image_alt or model,
            "price": {
                "domestic": price,
                "us": "待补充",
                "reference": price,
                "status": "现有公开价样本，待补充美国市场价",
                "confidence": "medium" if "约" in price else "low",
            },
            "recommendation": advice,
            "recommendationType": recommendation_type(advice, architecture, model),
            "source": "existing-html",
        })
    return cards


def nvidia_legacy_cards() -> list[dict[str, Any]]:
    h265 = {
        "title": "H.265 硬解：Turing NVDEC，适合存量 4:2:0 工作流",
        "detail": "支持常规 H.264/H.265 硬件编解码；AV1 不作为硬件编码能力。专业 4:2:2 素材建议以软件链路实测为准。",
        "note": "定位为上一代/存量项目参考，新采购需重点比较 Ada、Blackwell 与实际报价。",
        "raw": "Turing 专业卡视频能力参考",
    }
    av1 = {
        "title": "AV1 输出：不支持",
        "detail": "不具备 AV1 硬件编码输出能力。",
        "note": "需要 AV1 转码输出时优先选择 Ada、Blackwell 或较新 AMD RDNA 3 专业卡。",
        "raw": "AV1 硬件编码不支持",
    }
    base = {
        "brand": "NVIDIA",
        "generation": "Turing",
        "release": "2018-2019",
        "architecture": "NVIDIA Turing",
        "lifecycle": "legacy",
        "h265": h265,
        "av1": av1,
        "interface": "PCIe 3.0 x16\nDP 1.4 / VirtualLink 视型号而定",
        "image": "",
        "price": {"domestic": "待补充", "us": "待补充", "reference": "待补充", "status": "价格待手工核验", "confidence": "pending"},
        "source": "manual-catalog-extension",
    }
    specs = [
        ("Quadro RTX 8000", "6000", "旗舰级", "4608 / 576 / 72", "48GB GDDR6 ECC", "384-bit / 672GB/s", "295W", "1x NVENC / 1x NVDEC", "上一代 48GB 旗舰专业卡，适合存量渲染和认证延续；新采购需与 RTX 6000 Ada、RTX PRO 5000/6000 比较。"),
        ("Quadro RTX 6000", "6000", "旗舰级", "4608 / 576 / 72", "24GB GDDR6 ECC", "384-bit / 672GB/s", "295W", "1x NVENC / 1x NVDEC", "Turing 旗舰级 24GB 专业卡，适合存量项目替换；若价格接近 Ada/Blackwell，不建议优先新购。"),
        ("Quadro RTX 5000", "5000", "高端级", "3072 / 384 / 48", "16GB GDDR6", "256-bit / 448GB/s", "265W", "1x NVENC / 1x NVDEC", "上一代高端专业卡，适合预算敏感的图形工作站；视频服务器新建项目优先评估更新架构。"),
        ("Quadro RTX 4000", "4000", "主流专业级", "2304 / 288 / 36", "8GB GDDR6", "256-bit / 416GB/s", "160W", "1x NVENC / 1x NVDEC", "单槽 Turing 专业卡，适合存量显示/CAD 场景；多路视频与新采购场景建议看 RTX 4000 Ada 或 RTX PRO 4000。"),
    ]
    cards = []
    for model, level, tier, compute, memory, bus, power, engine, advice in specs:
        cards.append({
            **base,
            "id": slugify(model),
            "model": model,
            "level": level,
            "tier": tier,
            "compute": compute,
            "memory": memory,
            "memoryGb": parse_numeric(r"(\d+)\s*GB", memory),
            "busBandwidth": bus,
            "bandwidthGBs": parse_numeric(r"(\d+)\s*GB/s", bus),
            "power": power,
            "powerW": parse_numeric(r"(\d+)W", power),
            "videoEngine": engine,
            "engine": parse_engine(engine),
            "formFactor": "全高专业卡，外形依厂商版本确认",
            "officialUrl": "https://www.nvidia.com/en-us/design-visualization/desktop-graphics/",
            "imageAlt": model,
            "recommendation": advice,
            "recommendationType": "库存或存量项目参考",
        })
    return cards


def amd_cards() -> list[dict[str, Any]]:
    def card(model: str, level: str, gen: str, release: str, compute: str, memory: str, bus: str, power: str, engine: str, advice: str, av1_encode: bool, lifecycle: str) -> dict[str, Any]:
        h265 = {
            "title": "H.265/HEVC：支持硬件编解码，专业素材需结合软件链路实测",
            "detail": "AMD Radeon PRO 适合 OpenCL、专业图形和多屏场景；视频服务器选型应结合具体软件对 AMF/DirectX/驱动路径的支持。",
            "note": "与 NVIDIA NVENC/NVDEC 不能按数量直接等价比较，建议用现场素材做并发实测。",
            "raw": "AMD HEVC 能力参考",
        }
        av1 = {
            "title": "AV1 输出：支持" if av1_encode else "AV1 输出：不支持或仅解码",
            "detail": "RDNA 3 专业卡支持 AV1 编码与解码。" if av1_encode else "上一代 AMD 专业卡通常不作为 AV1 硬件编码输出选择。",
            "note": "需要 AV1 输出时优先评估 W7000 系列或 NVIDIA Ada/Blackwell。" if av1_encode else "AV1 转码输出建议选择更新架构。",
            "raw": "AMD AV1 能力参考",
        }
        return {
            "id": slugify(model),
            "brand": "AMD",
            "model": model,
            "level": level,
            "tier": tier_for(level),
            "generation": gen,
            "release": release,
            "architecture": f"AMD {gen}",
            "lifecycle": lifecycle,
            "compute": compute,
            "memory": memory,
            "memoryGb": parse_numeric(r"(\d+)\s*GB", memory),
            "busBandwidth": bus,
            "bandwidthGBs": parse_numeric(r"(\d+)\s*GB/s", bus),
            "power": power,
            "powerW": parse_numeric(r"(\d+)W", power),
            "videoEngine": engine,
            "engine": {"encode": 0, "decode": 0, "jpeg": 0},
            "h265": h265,
            "av1": av1,
            "interface": "PCIe x16\nDisplayPort 2.1/1.4 视型号而定",
            "formFactor": "专业工作站卡，外形依型号确认",
            "officialUrl": "https://www.amd.com/en/products/graphics/workstations.html",
            "image": "",
            "imageAlt": model,
            "price": {"domestic": "待补充", "us": "待补充", "reference": "待补充", "status": "价格待手工核验", "confidence": "pending"},
            "recommendation": advice,
            "recommendationType": recommendation_type(advice, gen, model),
            "source": "manual-catalog-extension",
        }

    return [
        card("Radeon PRO W7900", "amd-high", "RDNA 3", "2023", "12288 SP / AI 加速 / RT 加速", "48GB GDDR6 ECC", "384-bit / 864GB/s", "295W", "AMD 视频编解码引擎 / AV1 Encode-Decode", "AMD 当前高端 48GB 专业卡，适合大显存图形、渲染和多屏场景；视频服务器需结合软件链路验证。", True, "current"),
        card("Radeon PRO W7800", "amd-high", "RDNA 3", "2023", "4480 SP / AI 加速 / RT 加速", "32GB GDDR6 ECC", "256-bit / 576GB/s", "260W", "AMD 视频编解码引擎 / AV1 Encode-Decode", "AMD 32GB 主力专业卡，适合预算低于 W7900 但仍需要较大显存的工作站。", True, "current"),
        card("Radeon PRO W7700", "amd-mainstream", "RDNA 3", "2023", "3072 SP / AI 加速 / RT 加速", "16GB GDDR6 ECC", "256-bit / 576GB/s", "190W", "AMD 视频编解码引擎 / AV1 Encode-Decode", "AMD 主流专业卡，适合图形工作站和多屏输出；作为视频节点需重点验证软件兼容性。", True, "current"),
        card("Radeon PRO W7600", "amd-mainstream", "RDNA 3", "2023", "2048 SP / AI 加速 / RT 加速", "8GB GDDR6", "128-bit / 288GB/s", "130W", "AMD 视频编解码引擎 / AV1 Encode-Decode", "低功耗主流专业卡，适合 CAD、多屏和轻量图形任务。", True, "current"),
        card("Radeon PRO W7500", "amd-mainstream", "RDNA 3", "2023", "1792 SP / AI 加速 / RT 加速", "8GB GDDR6", "128-bit / 224GB/s", "70W", "AMD 视频编解码引擎 / AV1 Encode-Decode", "低功耗入门专业卡，适合显示、多屏和轻量专业应用，不建议作为高并发视频主力。", True, "current"),
        card("Radeon PRO W6800", "amd-high", "RDNA 2", "2021", "3840 SP / RT 加速", "32GB GDDR6 ECC", "256-bit / 512GB/s", "250W", "AMD 视频编解码引擎", "上一代 32GB AMD 专业卡，适合存量图形项目；新采购需比较 W7800/W7900。", False, "active"),
        card("Radeon PRO W6600", "amd-mainstream", "RDNA 2", "2021", "1792 SP / RT 加速", "8GB GDDR6", "128-bit / 224GB/s", "100W", "AMD 视频编解码引擎", "上一代主流 AMD 专业卡，适合预算敏感的 CAD/多屏场景。", False, "active"),
        card("Radeon Pro VII", "legacy", "Vega / CDNA 过渡", "2020", "3840 SP", "16GB HBM2 ECC", "4096-bit / 1024GB/s", "250W", "AMD 视频编解码引擎", "现场测试表中出现过的 AMD 专业卡，可作为历史实测和存量兼容参考，不建议作为新购主力。", False, "legacy"),
        card("Radeon Pro WX 9100", "legacy", "Vega", "2017", "4096 SP", "16GB HBM2 ECC", "2048-bit / 484GB/s", "230W", "AMD 视频编解码引擎", "更早一代 AMD 专业卡，主要用于历史项目和存量替换参考。", False, "legacy"),
    ]


def build_market_prices(cards: list[dict[str, Any]]) -> dict[str, Any]:
    return {
        "updatedAt": "2026-06-19",
        "fx": {"usdCny": 7.25, "note": "结构预留。美国市场价格补充后按固定汇率折算，仅作预算参考。"},
        "policy": {
            "display": "页面仅展示后台计算后的国内、美国与综合参考区间，不展示逐来源价格。",
            "method": "剔除二手/翻新/无库存/异常低价样本后，按可信渠道样本给出合理区间。",
        },
        "items": {
            card["id"]: {
                "domestic": card["price"]["domestic"],
                "us": card["price"]["us"],
                "reference": card["price"]["reference"],
                "status": card["price"]["status"],
                "confidence": card["price"]["confidence"],
            }
            for card in cards
        },
    }


def main() -> None:
    index_html = INDEX.read_text(encoding="utf-8")
    cards = parse_existing_cards(index_html)
    cards.extend(nvidia_legacy_cards())
    cards.extend(amd_cards())
    payload = {
        "schemaVersion": 1,
        "updatedAt": "2026-06-19",
        "title": "专业图形卡选型与视频编解码能力对比",
        "subtitle": "覆盖 NVIDIA RTX / Quadro RTX 与 AMD Radeon PRO，结合规格、价格区间和视频任务适配度进行采购参考。",
        "pricingPolicy": "价格由后台按国内外公开样本计算为参考区间；页面不展示逐来源明细。",
        "cards": cards,
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    PRICES.write_text(json.dumps(build_market_prices(cards), ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"cards": len(cards), "output": str(OUTPUT), "prices": str(PRICES)}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
