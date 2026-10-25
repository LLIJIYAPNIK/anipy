# /// script
# requires-python = ">=3.11"
# dependencies = ["griffe==2.3.2", "pyyaml==6.0.3"]
# ///
"""Справочник API для страниц документации: директивы mkdocstrings → JSON для сайта.

    uv run scripts/api-reference.py

Запускается из `npm run sync` после клонирования. Для каждого репозитория в .sdk/ с mkdocs.yml
находит в docs/*.md директивы `::: путь.к.объекту` (с их `options:`), загружает пакеты тем же
griffe, что и mkdocstrings у SDK, и пишет в .sdk/api/<репозиторий>.json готовые к отрисовке
объекты: сигнатуры, разобранные docstring-и (Google style), члены классов и модулей — по тем же
правилам отбора, что у mkdocstrings (опции из mkdocs.yml и самой директивы). Объект, который не
нашёлся, роняет скрипт — как `mkdocs build --strict`.
"""

import json
import re
import sys
from pathlib import Path

import griffe
import yaml

SDK = Path(".sdk")
OUT = SDK / "api"

# Значения по умолчанию mkdocstrings-python, которые влияют на состав и порядок.
DEFAULTS = {
    "members": None,
    "inherited_members": False,
    "members_order": "alphabetical",
    "merge_init_into_class": False,
    "show_root_heading": False,
    "show_root_toc_entry": True,
    "show_bases": True,
    "show_if_no_docstring": False,
    "group_by_category": True,
}
DIRECTIVE = re.compile(r"^:::\s+(\S+)\s*$")
CATEGORY = {"attribute": 0, "class": 1, "function": 2, "module": 3}


def load_yaml(text):
    # В mkdocs.yml бывают python-теги (!!python/name:...) — для справочника они не нужны.
    class Loader(yaml.SafeLoader):
        pass

    Loader.add_multi_constructor("", lambda loader, suffix, node: None)
    return yaml.load(text, Loader=Loader) or {}


def directives(docs: Path):
    """Директивы `:::` всех страниц: путь объекта → опции из блока `options:` под ней."""
    found = {}
    for md in sorted(docs.rglob("*.md")):
        lines = md.read_text(encoding="utf-8").replace("\r\n", "\n").split("\n")
        for i, line in enumerate(lines):
            m = DIRECTIVE.match(line)
            if not m:
                continue
            block = []
            for nxt in lines[i + 1 :]:
                if nxt.strip() and not nxt.startswith("    "):
                    break
                block.append(nxt[4:])
            config = load_yaml("\n".join(block)) if any(s.strip() for s in block) else {}
            found[m.group(1)] = (config or {}).get("options", {}) or {}
    return found


def segments(expr):
    """Аннотация/выражение как список: строки и имена со ссылкой на канонический путь."""
    if expr is None:
        return None
    if isinstance(expr, str):
        return [expr]
    out = []
    for part in expr.iterate(flat=True):
        if isinstance(part, str):
            out.append(part)
        else:
            try:
                ref = part.canonical_path
            except Exception:  # noqa: BLE001 — имя, которое griffe не разрешил: без ссылки
                ref = None
            out.append({"t": part.name, "ref": ref} if ref else part.name)
    return out


def text_of(value):
    return None if value is None else str(value)


def docstring(obj):
    if not obj.docstring:
        return []
    out = []
    for section in obj.docstring.parsed:
        kind = section.kind.value
        if kind == "text":
            out.append({"kind": "text", "text": section.value})
        elif kind == "examples":
            out.append({"kind": "examples", "items": [[k.value, v] for k, v in section.value]})
        elif kind == "admonition":
            out.append({"kind": "admonition", "title": section.title, "text": section.value.description})
        elif kind == "deprecated":
            out.append({"kind": "deprecated", "text": section.value.description})
        else:
            items = section.value if isinstance(section.value, list) else [section.value]
            out.append(
                {
                    "kind": kind,
                    "items": [
                        {
                            "name": getattr(it, "name", None) or None,
                            "annotation": segments(getattr(it, "annotation", None)),
                            "description": getattr(it, "description", "") or "",
                            "default": text_of(getattr(it, "value", None)),
                        }
                        for it in items
                    ],
                }
            )
    return out


def parameters(obj):
    """Параметры функции или класса (его __init__), без self/cls."""
    try:
        params = list(obj.parameters)
    except Exception:  # noqa: BLE001 — у класса без своего/известного __init__ сигнатуры нет
        return None
    if params and params[0].name in ("self", "cls"):
        params = params[1:]
    return [
        {
            "name": p.name,
            "kind": p.kind.value if p.kind else "positional or keyword",
            "annotation": segments(p.annotation),
            "default": text_of(p.default),
        }
        for p in params
    ]


def has_docs(obj):
    try:
        return obj.has_docstrings
    except Exception:  # noqa: BLE001
        return bool(obj.docstring)


def source(obj, repo: Path):
    try:
        path = Path(obj.filepath).resolve().relative_to(repo.resolve())
    except Exception:  # noqa: BLE001 — объект не из этого репозитория (например, из ядра в другом клоне)
        return None
    return {"file": path.as_posix(), "start": obj.lineno, "end": obj.endlineno}


def select(obj, opts, explicit=None):
    """Члены объекта по правилам mkdocstrings: фильтр `_приватных`, без docstring — не показывать,
    __init__ — в класс, порядок и группировка — по опциям."""
    inherited = opts["inherited_members"] and obj.kind.value == "class"
    pool = dict(obj.members)
    if inherited:
        for name, member in obj.inherited_members.items():
            pool.setdefault(name, member)
    chosen = []
    for name, member in pool.items():
        if explicit is not None:
            if name not in explicit:
                continue
        else:
            if name.startswith("_") and not (name.startswith("__") and name.endswith("__")):
                continue
            if name == "__init__" and opts["merge_init_into_class"]:
                continue
            # В модуле импортированное показывается, только если перечислено явно.
            if obj.kind.value == "module" and member.is_alias:
                continue
            try:
                target = member.final_target if member.is_alias else member
            except Exception:  # noqa: BLE001 — алиас наружу (на стороннюю библиотеку)
                continue
            if not opts["show_if_no_docstring"] and not has_docs(target):
                continue
        chosen.append(member)

    def key(member):
        target = member.final_target if member.is_alias else member
        order = (getattr(member, "inherited", False), target.lineno or 0) if opts["members_order"] == "source" else (0, member.name)
        category = CATEGORY.get(target.kind.value, 9) if opts["group_by_category"] else 0
        return (category, *order)

    return sorted(chosen, key=key)


def dump(obj, opts, repo: Path, ident: str, explicit=None, depth=0):
    target = obj.final_target if obj.is_alias else obj
    kind = target.kind.value
    item = {
        "id": ident,
        "name": obj.name,
        "path": target.path,
        "kind": kind,
        "labels": sorted(target.labels),
        "inherited": bool(getattr(obj, "inherited", False)),
        "docstring": docstring(target),
        "source": source(target, repo),
    }
    if kind == "function":
        item["parameters"] = parameters(target)
        item["returns"] = segments(target.returns)
    elif kind == "class":
        item["parameters"] = parameters(target) if opts["merge_init_into_class"] else None
        item["bases"] = [segments(b) for b in target.bases] if opts["show_bases"] else []
    elif kind == "attribute":
        item["annotation"] = segments(target.annotation)
        item["value"] = text_of(target.value)
    if kind in ("class", "module") and depth < 3:
        item["members"] = [
            dump(m, opts, repo, f"{ident}.{m.name}", None, depth + 1) for m in select(target, opts, explicit)
        ]
    return item


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for config_path in sorted(SDK.glob("*/mkdocs.yml")):
        repo = config_path.parent
        config = load_yaml(config_path.read_text(encoding="utf-8"))
        handler = {}
        for plugin in config.get("plugins", []):
            if isinstance(plugin, dict) and "mkdocstrings" in plugin:
                handler = ((plugin["mkdocstrings"] or {}).get("handlers") or {}).get("python") or {}
        base = {**DEFAULTS, **(handler.get("options") or {})}
        found = directives(repo / "docs")
        if not found:
            continue
        # Пути поиска — как у mkdocstrings (от mkdocs.yml); без них — src-раскладка или корень.
        paths = [repo / p for p in handler.get("paths", [])] or [repo / "src", repo]
        loader = griffe.GriffeLoader(search_paths=[str(p) for p in paths], docstring_parser=griffe.Parser.google)
        packages = {ident.split(".")[0] for ident in found} | set(base.get("preload_modules") or [])
        for package in sorted(packages):
            loader.load(package)
        loader.resolve_aliases(implicit=False, external=None)

        objects = {}
        for ident, local in found.items():
            opts = {**base, **local}
            try:
                obj = loader.modules_collection[ident]
            except KeyError:
                sys.exit(f"{repo.name}: ::: {ident} — object not found")
            explicit = opts["members"] if isinstance(opts["members"], list) else None
            item = dump(obj, opts, repo, ident, explicit)
            item["heading"] = bool(opts["show_root_heading"])
            item["toc"] = bool(opts["show_root_toc_entry"])
            item["showBases"] = bool(opts["show_bases"])
            objects[ident] = item

        out = OUT / f"{repo.name}.json"
        out.write_text(json.dumps({"directives": objects}, ensure_ascii=False), encoding="utf-8")
        print(f"api    {repo.name}: {len(objects)} objects -> {out}")


if __name__ == "__main__":
    main()
