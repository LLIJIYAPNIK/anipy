# /// script
# requires-python = ">=3.11"
# dependencies = ["ranobelib-python-sdk"]
# ///
"""Фразы для строки чтения в панели «Ранобэ» на главной: через ranobelib-python-sdk.

    uv run scripts/prepare-phrases.py

Берёт из High School DxD абзацы по списку PHRASES (том, глава, номер абзаца) и пишет их
дословно в src/data/ranobe-phrases.json — в порядке списка, так они и идут в ленте.
Реплики отобраны вручную: короткие, по сюжету первого тома и без откровенных сцен —
у тайтла рейтинг 16+; между ними — крики «Усиливающего механизма» из томов 1, 4 и 6.
"""

import asyncio
import json
import os
import tempfile
from pathlib import Path

from ranobelib import RanobeLib, chapter_paragraphs

BOOK = "https://ranobelib.me/ru/book/6712--high-school-dxd-novel"
PHRASES = [
    # (том, глава, номер абзаца — индекс chapter_paragraphs())
    (1, "1", 13),
    (1, "1", 33),
    (1, "1", 45),
    (1, "1", 49),
    (1, "1", 62),
    (1, "2", 72),
    (1, "2", 100),
    (1, "2", 153),
    (1, "2", 164),
    (1, "2", 167),
    (1, "2", 311),
    (1, "2", 335),
    (1, "5", 158),  # [УСИЛЕНИЕ!]
    (1, "2", 355),
    (1, "2", 370),
    (1, "3", 27),
    (1, "3", 32),
    (4, "38", 470),  # «Усиление!» ×6
    (1, "3", 81),
    (1, "3", 139),
    (1, "5", 289),  # [ДРАКОНИЙ БУСТЕР!]
    (6, "56", 108),  # «Усиление!» ×15
]


async def main() -> None:
    out = Path(__file__).resolve().parent.parent / "src" / "data" / "ranobe-phrases.json"
    # Кэш SDK — во временной папке: на Windows длинный путь к проекту не даёт его записать.
    os.chdir(tempfile.gettempdir())

    phrases = []
    async with RanobeLib(BOOK) as lib:
        chapters = {}
        for volume, number, index in PHRASES:
            if (volume, number) not in chapters:
                chapters[volume, number] = chapter_paragraphs(await lib.get_chapter(volume=volume, number=number))
            text = chapters[volume, number][index]
            if not text:
                raise SystemExit(f"Пустой абзац: том {volume}, глава {number}, #{index}")
            phrases.append({"text": text, "volume": volume, "chapter": number})
            print(f"{volume}:{number}:{index:<4} {text}")

    out.write_text(json.dumps(phrases, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"{len(phrases)} фраз -> {out}")


asyncio.run(main())
