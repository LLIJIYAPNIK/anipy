# /// script
# requires-python = ">=3.11"
# dependencies = ["mangalib-python-sdk", "pillow"]
# ///
"""Обложки для стены в панели «Манга» на главной: через mangalib-python-sdk.

    uv run scripts/prepare-covers.py [<имя>] [--count 50]

Берёт самые просматриваемые японские тайтлы MangaLib без 18+ и кладёт обложки
в public/media/<имя>/ (по умолчанию manga): 1.webp … N.webp (240×336) и sources.json —
откуда каждая обложка. Ч/б делает CSS-фильтр, сами файлы цветные.
"""

import argparse
import asyncio
import io
import json
import os
import tempfile
from pathlib import Path

import httpx
from mangalib import Catalog, RateLimitError
from PIL import Image

SIZE = (240, 336)
"""Ширина × высота файла: обложки MangaLib — 5:7; хватает для колонки 7.5rem на 2560px."""
COUNTRY = "Манга"
"""Только японская манга: тип тайтла в каталоге MangaLib, рядом — манхва и маньхуа."""
ADULT = "18+"
HEADERS = {"Referer": "https://mangalib.me/"}
"""Без Referer CDN обложек отвечает 403 (libsocial-sdk, docs/api-notes.md)."""


async def popular(count: int) -> list:
    titles = []
    # Кэш SDK — во временной папке: на Windows длинный путь к проекту не даёт его записать.
    os.chdir(tempfile.gettempdir())
    async with Catalog() as catalog:
        page = 1
        while len(titles) < count:
            try:
                result = await catalog.list_titles(sort="views", per_page=60, page=page)
            except RateLimitError as error:
                # 429 при подряд идущих страницах: ждём, сколько сказал API, и повторяем.
                await asyncio.sleep(error.retry_after or 10)
                continue
            for title in result.items:
                origin = title.country.name if title.country else None
                if origin == COUNTRY and title.age_restriction.label != ADULT and title.cover.default:
                    titles.append(title)
            if not result.has_next_page:
                break
            page += 1
    return titles[:count]


def to_webp(data: bytes, path: Path) -> None:
    image = Image.open(io.BytesIO(data)).convert("RGB")
    # Обрезка по центру до 5:7, если обложка другой пропорции.
    width, height = image.size
    target = SIZE[0] / SIZE[1]
    if width / height > target:
        crop = round(height * target)
        image = image.crop(((width - crop) // 2, 0, (width + crop) // 2, height))
    elif width / height < target:
        crop = round(width / target)
        image = image.crop((0, (height - crop) // 2, width, (height + crop) // 2))
    image.resize(SIZE, Image.Resampling.LANCZOS).save(path, "WEBP", quality=72, method=6)


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("name", nargs="?", default="manga")
    parser.add_argument("--count", type=int, default=50)
    args = parser.parse_args()

    out = (Path(__file__).resolve().parent.parent / "public" / "media" / args.name)
    titles = await popular(args.count)
    out.mkdir(parents=True, exist_ok=True)
    for old in out.glob("*.webp"):
        old.unlink()

    sources = []
    async with httpx.AsyncClient(headers=HEADERS, timeout=30, follow_redirects=True) as client:
        for number, title in enumerate(titles, 1):
            response = await client.get(title.cover.default)
            response.raise_for_status()
            to_webp(response.content, out / f"{number}.webp")
            sources.append({"file": f"{number}.webp", "title": title.rus_name or title.name, "url": f"https://mangalib.me/ru/manga/{title.slug_url}"})
            print(f"{number:>2}  {title.slug_url}")

    (out / "sources.json").write_text(json.dumps(sources, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    size = sum(file.stat().st_size for file in out.glob("*.webp"))
    print(f"{len(sources)} обложек, {size / 1024:.0f} КБ → {out}")


asyncio.run(main())
