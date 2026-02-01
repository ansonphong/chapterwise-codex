# Scrivener Import - Unified Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a unified Scrivener import feature that works both as a Claude Code skill and VS Code extension command, sharing the same Python core scripts.

**Architecture:** Python scripts are the canonical source (in `chapterwise-claude-plugins`), called by both the Claude skill (via Bash) and VS Code extension (via child_process). A sync script keeps the VS Code copy updated.

**Tech Stack:** Python 3.8+ (PyYAML, striprtf), TypeScript (VS Code extension), XML parsing (ElementTree), RTF conversion

---

## Project Paths

| Component | Path |
|-----------|------|
| Claude Plugin | `/Users/phong/Projects/chapterwise-claude-plugins` |
| VS Code Extension | `/Users/phong/Projects/chapterwise-codex` |
| Python Scripts (canonical) | `/Users/phong/Projects/chapterwise-claude-plugins/plugins/chapterwise-codex/scripts/` |
| Python Scripts (synced) | `/Users/phong/Projects/chapterwise-codex/scripts/scrivener/` |
| Claude Skill | `/Users/phong/Projects/chapterwise-claude-plugins/plugins/chapterwise-codex/commands/import-scrivener.md` |
| TS Wrapper | `/Users/phong/Projects/chapterwise-codex/src/scrivenerImport.ts` |

---

## Task 1: Create Scrivener Parser (Python)

**Files:**
- Create: `/Users/phong/Projects/chapterwise-claude-plugins/plugins/chapterwise-codex/scripts/scrivener_parser.py`
- Test: Manual testing with sample .scriv project

**Step 1: Create the scrivener_parser.py file**

```python
#!/usr/bin/env python3
"""
Scrivener Parser - XML/.scrivx Parsing

Parses Scrivener project structure from .scrivx XML files.
Builds BinderItem tree with metadata resolution.
"""

import xml.etree.ElementTree as ET
from dataclasses import dataclass, field
from pathlib import Path
from typing import List, Optional, Dict
import logging

logger = logging.getLogger(__name__)


@dataclass
class LabelDefinition:
    """Label definition from LabelSettings."""
    id: int
    name: str
    color: Optional[str] = None


@dataclass
class StatusDefinition:
    """Status definition from StatusSettings."""
    id: int
    name: str


@dataclass
class BinderItem:
    """A single item in the Scrivener binder (document or folder)."""
    uuid: str
    item_type: str  # 'DraftFolder', 'Folder', 'Text', 'Trash', 'Root'
    title: str
    created: str = ""
    modified: str = ""

    # Metadata IDs (reference global definitions)
    label_id: Optional[int] = None
    status_id: Optional[int] = None
    keyword_ids: List[int] = field(default_factory=list)

    # Resolved metadata (populated after lookup)
    label: Optional[str] = None
    status: Optional[str] = None
    keywords: List[str] = field(default_factory=list)

    # Additional metadata
    synopsis: Optional[str] = None
    include_in_compile: bool = True
    icon_file_name: Optional[str] = None

    # Content path
    content_path: Optional[Path] = None

    # Converted content (set during RTF conversion)
    converted_content: Optional[str] = None

    # Hierarchy
    children: List["BinderItem"] = field(default_factory=list)
    parent: Optional["BinderItem"] = None


@dataclass
class ScrivenerProject:
    """Complete Scrivener project data."""
    identifier: str
    version: str
    creator: str
    device: str
    author: str
    title: str
    created: str
    modified: str

    binder_items: List[BinderItem] = field(default_factory=list)

    # Global metadata definitions
    labels: List[LabelDefinition] = field(default_factory=list)
    statuses: List[StatusDefinition] = field(default_factory=list)

    # Source path
    scriv_path: Optional[Path] = None


class ScrivenerParser:
    """Parser for Scrivener .scrivx XML files."""

    def __init__(self, scriv_path: Path):
        self.scriv_path = Path(scriv_path)
        self.scrivx_path = self._find_scrivx()
        self.data_dir = self.scriv_path / "Files" / "Data"

    def _find_scrivx(self) -> Path:
        """Find the .scrivx file in the project."""
        scrivx_files = list(self.scriv_path.glob("*.scrivx"))
        if not scrivx_files:
            raise FileNotFoundError(f"No .scrivx file found in {self.scriv_path}")
        return scrivx_files[0]

    def parse(self) -> ScrivenerProject:
        """Parse the Scrivener project."""
        logger.info(f"Parsing: {self.scrivx_path}")

        tree = ET.parse(self.scrivx_path)
        root = tree.getroot()

        # Parse project attributes
        project = ScrivenerProject(
            identifier=root.get("Identifier", "unknown"),
            version=root.get("Version", "2.0"),
            creator=root.get("Creator", "unknown"),
            device=root.get("Device", "unknown"),
            author=root.get("Author", "unknown"),
            title=self.scriv_path.stem,  # Use folder name as title
            created=root.get("Created", ""),
            modified=root.get("Modified", ""),
            scriv_path=self.scriv_path
        )

        # Parse label settings
        label_settings = root.find("LabelSettings")
        if label_settings is not None:
            project.labels = self._parse_labels(label_settings)

        # Parse status settings
        status_settings = root.find("StatusSettings")
        if status_settings is not None:
            project.statuses = self._parse_statuses(status_settings)

        # Parse binder
        binder = root.find("Binder")
        if binder is not None:
            project.binder_items = self._parse_binder_items(binder)

        logger.info(f"Parsed {len(project.binder_items)} top-level binder items")
        return project

    def _parse_labels(self, label_settings: ET.Element) -> List[LabelDefinition]:
        """Parse label definitions."""
        labels = []
        labels_elem = label_settings.find("Labels")
        if labels_elem is not None:
            for label in labels_elem.findall("Label"):
                labels.append(LabelDefinition(
                    id=int(label.get("ID", -1)),
                    name=label.text or "",
                    color=label.get("Color")
                ))
        return labels

    def _parse_statuses(self, status_settings: ET.Element) -> List[StatusDefinition]:
        """Parse status definitions."""
        statuses = []
        status_items = status_settings.find("StatusItems")
        if status_items is not None:
            for status in status_items.findall("Status"):
                statuses.append(StatusDefinition(
                    id=int(status.get("ID", -1)),
                    name=status.text or ""
                ))
        return statuses

    def _parse_binder_items(self, binder: ET.Element, parent: Optional[BinderItem] = None) -> List[BinderItem]:
        """Parse binder items recursively."""
        items = []

        for elem in binder.findall("BinderItem"):
            uuid = elem.get("UUID", "")
            item_type = elem.get("Type", "Text")

            # Get title
            title_elem = elem.find("Title")
            title = title_elem.text if title_elem is not None else "Untitled"

            # Create item
            item = BinderItem(
                uuid=uuid,
                item_type=item_type,
                title=title,
                created=elem.get("Created", ""),
                modified=elem.get("Modified", ""),
                parent=parent
            )

            # Parse metadata
            metadata = elem.find("MetaData")
            if metadata is not None:
                self._parse_metadata(item, metadata)

            # Find content path
            item.content_path = self._find_content_path(uuid)

            # Parse children recursively
            children_elem = elem.find("Children")
            if children_elem is not None:
                item.children = self._parse_binder_items(children_elem, item)

            items.append(item)

        return items

    def _parse_metadata(self, item: BinderItem, metadata: ET.Element):
        """Parse metadata element into item."""
        # Label ID
        label_id = metadata.find("LabelID")
        if label_id is not None and label_id.text:
            try:
                item.label_id = int(label_id.text)
            except ValueError:
                pass

        # Status ID
        status_id = metadata.find("StatusID")
        if status_id is not None and status_id.text:
            try:
                item.status_id = int(status_id.text)
            except ValueError:
                pass

        # Synopsis
        synopsis = metadata.find("Synopsis")
        if synopsis is not None:
            item.synopsis = synopsis.text

        # Include in compile
        include = metadata.find("IncludeInCompile")
        if include is not None:
            item.include_in_compile = include.text == "Yes"

        # Icon
        icon = metadata.find("IconFileName")
        if icon is not None:
            item.icon_file_name = icon.text

    def _find_content_path(self, uuid: str) -> Optional[Path]:
        """Find content.rtf file for a given UUID."""
        # Scrivener stores content in: Files/Data/{UUID}/content.rtf
        content_path = self.data_dir / uuid / "content.rtf"

        if content_path.exists():
            return content_path

        # Try case-insensitive search
        if self.data_dir.exists():
            for folder in self.data_dir.iterdir():
                if folder.name.lower() == uuid.lower():
                    rtf_path = folder / "content.rtf"
                    if rtf_path.exists():
                        return rtf_path

        return None

    def resolve_metadata(self, project: ScrivenerProject):
        """Resolve metadata IDs to actual names."""
        label_map = {l.id: l.name for l in project.labels}
        status_map = {s.id: s.name for s in project.statuses}

        self._resolve_items(project.binder_items, label_map, status_map)

    def _resolve_items(self, items: List[BinderItem],
                       label_map: Dict[int, str],
                       status_map: Dict[int, str]):
        """Resolve metadata for items recursively."""
        for item in items:
            if item.label_id is not None and item.label_id in label_map:
                item.label = label_map[item.label_id]

            if item.status_id is not None and item.status_id in status_map:
                item.status = status_map[item.status_id]

            if item.children:
                self._resolve_items(item.children, label_map, status_map)


if __name__ == "__main__":
    import sys
    if len(sys.argv) < 2:
        print("Usage: python scrivener_parser.py <path/to/Project.scriv>")
        sys.exit(1)

    scriv_path = Path(sys.argv[1])
    parser = ScrivenerParser(scriv_path)
    project = parser.parse()
    parser.resolve_metadata(project)

    print(f"Project: {project.title}")
    print(f"Version: {project.version}")
    print(f"Items: {len(project.binder_items)}")

    def print_items(items, indent=0):
        for item in items:
            print(f"{'  ' * indent}- {item.title} ({item.item_type})")
            if item.children:
                print_items(item.children, indent + 1)

    print_items(project.binder_items)
```

**Step 2: Verify the file was created**

Run: `ls -la /Users/phong/Projects/chapterwise-claude-plugins/plugins/chapterwise-codex/scripts/scrivener_parser.py`
Expected: File exists with correct permissions

**Step 3: Test with a sample Scrivener project (if available)**

Run: `python3 /Users/phong/Projects/chapterwise-claude-plugins/plugins/chapterwise-codex/scripts/scrivener_parser.py /path/to/test.scriv`
Expected: Lists project structure

**Step 4: Commit**

```bash
cd /Users/phong/Projects/chapterwise-claude-plugins
git add plugins/chapterwise-codex/scripts/scrivener_parser.py
git commit -m "feat(scrivener): add XML parser for .scrivx files"
```

---

## Task 2: Create RTF Converter (Python)

**Files:**
- Create: `/Users/phong/Projects/chapterwise-claude-plugins/plugins/chapterwise-codex/scripts/rtf_converter.py`

**Step 1: Create the rtf_converter.py file**

```python
#!/usr/bin/env python3
"""
RTF Converter - RTF to Markdown/HTML Conversion

Converts Scrivener RTF content files to Markdown.
Supports multiple conversion methods.
"""

import logging
import shutil
import subprocess
from pathlib import Path

logger = logging.getLogger(__name__)


class RTFConverter:
    """Convert RTF files to Markdown."""

    def __init__(self, method: str = "striprtf"):
        """
        Initialize converter.

        Args:
            method: Conversion method - "striprtf", "pandoc", or "raw"
        """
        self.method = method
        self._validate_method()

    def _validate_method(self):
        """Validate that the chosen method is available."""
        if self.method == "pandoc":
            if not shutil.which("pandoc"):
                logger.warning("pandoc not found, falling back to striprtf")
                self.method = "striprtf"

        if self.method == "striprtf":
            try:
                import striprtf
            except ImportError:
                logger.warning("striprtf not installed, falling back to raw")
                self.method = "raw"

    def convert(self, rtf_path: Path) -> str:
        """
        Convert RTF file to Markdown.

        Args:
            rtf_path: Path to RTF file

        Returns:
            Converted Markdown text
        """
        if not rtf_path.exists():
            logger.warning(f"RTF file not found: {rtf_path}")
            return ""

        try:
            if self.method == "pandoc":
                return self._convert_with_pandoc(rtf_path)
            elif self.method == "striprtf":
                return self._convert_with_striprtf(rtf_path)
            else:
                return self._get_raw(rtf_path)
        except Exception as e:
            logger.error(f"Failed to convert {rtf_path}: {e}")
            return f"[Conversion error: {e}]"

    def _convert_with_pandoc(self, rtf_path: Path) -> str:
        """Convert using pandoc (best quality)."""
        try:
            result = subprocess.run(
                ["pandoc", "-f", "rtf", "-t", "markdown", str(rtf_path)],
                capture_output=True,
                text=True,
                timeout=30
            )
            if result.returncode == 0:
                return self._clean_markdown(result.stdout)
            else:
                logger.warning(f"pandoc failed: {result.stderr}")
                return self._convert_with_striprtf(rtf_path)
        except subprocess.TimeoutExpired:
            logger.warning("pandoc timed out")
            return self._convert_with_striprtf(rtf_path)

    def _convert_with_striprtf(self, rtf_path: Path) -> str:
        """Convert using striprtf (fast, basic)."""
        from striprtf.striprtf import rtf_to_text

        rtf_content = rtf_path.read_text(encoding="utf-8", errors="replace")
        text = rtf_to_text(rtf_content)
        return self._text_to_markdown(text)

    def _get_raw(self, rtf_path: Path) -> str:
        """Return raw RTF content (no conversion)."""
        return rtf_path.read_text(encoding="utf-8", errors="replace")

    def _clean_markdown(self, markdown: str) -> str:
        """Clean up pandoc markdown output."""
        # Remove excessive blank lines
        lines = markdown.split("\n")
        cleaned = []
        prev_blank = False

        for line in lines:
            is_blank = not line.strip()
            if is_blank and prev_blank:
                continue
            cleaned.append(line)
            prev_blank = is_blank

        return "\n".join(cleaned).strip()

    def _text_to_markdown(self, text: str) -> str:
        """Convert plain text to basic Markdown."""
        # striprtf gives plain text, so we just clean it up
        lines = text.split("\n")
        cleaned = []
        prev_blank = False

        for line in lines:
            stripped = line.strip()
            is_blank = not stripped

            if is_blank and prev_blank:
                continue

            cleaned.append(stripped)
            prev_blank = is_blank

        return "\n\n".join(p for p in "\n".join(cleaned).split("\n\n") if p.strip())


if __name__ == "__main__":
    import sys
    if len(sys.argv) < 2:
        print("Usage: python rtf_converter.py <path/to/content.rtf> [method]")
        print("Methods: striprtf (default), pandoc, raw")
        sys.exit(1)

    rtf_path = Path(sys.argv[1])
    method = sys.argv[2] if len(sys.argv) > 2 else "striprtf"

    converter = RTFConverter(method=method)
    result = converter.convert(rtf_path)
    print(result)
```

**Step 2: Verify the file was created**

Run: `ls -la /Users/phong/Projects/chapterwise-claude-plugins/plugins/chapterwise-codex/scripts/rtf_converter.py`
Expected: File exists

**Step 3: Install Python dependency**

Run: `pip3 install striprtf`
Expected: Successfully installed striprtf

**Step 4: Commit**

```bash
cd /Users/phong/Projects/chapterwise-claude-plugins
git add plugins/chapterwise-codex/scripts/rtf_converter.py
git commit -m "feat(scrivener): add RTF to Markdown converter"
```

---

## Task 3: Create File Writer (Python)

**Files:**
- Create: `/Users/phong/Projects/chapterwise-claude-plugins/plugins/chapterwise-codex/scripts/scrivener_file_writer.py`

**Step 1: Create the scrivener_file_writer.py file**

```python
#!/usr/bin/env python3
"""
Scrivener File Writer - Output File Generation

Writes Scrivener content to disk in chosen format:
- Codex Lite (Markdown with YAML frontmatter)
- Codex YAML (.codex.yaml)
- Codex JSON (.codex.json)
"""

import json
import logging
import re
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import List, Optional, TYPE_CHECKING

import yaml

if TYPE_CHECKING:
    from scrivener_parser import ScrivenerProject, BinderItem

logger = logging.getLogger(__name__)


@dataclass
class WriteResult:
    """Result of write operation."""
    files_written: int
    directories_created: int
    errors: List[str]


class ScrivenerFileWriter:
    """Write Scrivener content to disk."""

    def __init__(self, output_dir: Path, format: str, dry_run: bool = False):
        self.output_dir = Path(output_dir)
        self.format = format
        self.dry_run = dry_run
        self.files_written = 0
        self.dirs_created = 0
        self.errors = []

    def preview_files(self, project: "ScrivenerProject") -> List[str]:
        """Preview what files would be created."""
        files = []
        self._collect_files(project.binder_items, "", files)
        return files

    def _collect_files(self, items: List["BinderItem"], parent_path: str, files: List[str]):
        """Collect file paths recursively."""
        for item in items:
            if item.item_type in ("Trash", "Root"):
                continue

            slug = self._slugify(item.title)

            if item.item_type in ("Folder", "DraftFolder"):
                folder_path = f"{parent_path}/{slug}" if parent_path else slug
                if item.children:
                    self._collect_files(item.children, folder_path, files)

            elif item.item_type == "Text":
                ext = self._get_extension()
                file_path = f"{parent_path}/{slug}{ext}" if parent_path else f"{slug}{ext}"
                files.append(file_path)

                # Text items can have children too
                if item.children:
                    self._collect_files(item.children, parent_path, files)

    def write_project(self, project: "ScrivenerProject") -> WriteResult:
        """Write all project files to disk."""
        if not self.dry_run:
            self.output_dir.mkdir(parents=True, exist_ok=True)
            self.dirs_created += 1

        self._write_items(project.binder_items, self.output_dir)

        return WriteResult(
            files_written=self.files_written,
            directories_created=self.dirs_created,
            errors=self.errors
        )

    def _write_items(self, items: List["BinderItem"], current_dir: Path):
        """Write items recursively."""
        for item in items:
            if item.item_type in ("Trash", "Root"):
                continue

            slug = self._slugify(item.title)

            if item.item_type in ("Folder", "DraftFolder"):
                folder_path = current_dir / slug
                if not self.dry_run:
                    folder_path.mkdir(parents=True, exist_ok=True)
                    self.dirs_created += 1

                if item.children:
                    self._write_items(item.children, folder_path)

            elif item.item_type == "Text":
                self._write_document(item, current_dir)

                # Text items can have children
                if item.children:
                    self._write_items(item.children, current_dir)

    def _write_document(self, item: "BinderItem", directory: Path):
        """Write a single document."""
        slug = self._slugify(item.title)
        ext = self._get_extension()
        file_path = directory / f"{slug}{ext}"

        try:
            if self.format == "markdown":
                content = self._build_markdown(item)
            elif self.format == "yaml":
                content = self._build_yaml(item)
            else:  # json
                content = self._build_json(item)

            if not self.dry_run:
                file_path.write_text(content, encoding="utf-8")

            self.files_written += 1
            logger.debug(f"Wrote: {file_path}")

        except Exception as e:
            self.errors.append(f"{file_path}: {e}")
            logger.error(f"Failed to write {file_path}: {e}")

    def _build_markdown(self, item: "BinderItem") -> str:
        """Build Codex Lite (Markdown with frontmatter)."""
        frontmatter = {
            "type": self._map_type(item),
            "name": item.title
        }

        # Add Scrivener metadata
        if item.label:
            frontmatter["scrivener_label"] = item.label
        if item.status:
            frontmatter["scrivener_status"] = item.status
        if item.keywords:
            frontmatter["tags"] = ", ".join(item.keywords)
        if item.synopsis:
            frontmatter["summary"] = item.synopsis
        if not item.include_in_compile:
            frontmatter["scrivener_include_in_compile"] = False

        yaml_fm = yaml.dump(frontmatter, default_flow_style=False, allow_unicode=True).strip()

        body = item.converted_content or ""

        return f"---\n{yaml_fm}\n---\n\n# {item.title}\n\n{body}\n"

    def _build_yaml(self, item: "BinderItem") -> str:
        """Build full Codex YAML."""
        data = self._build_codex_data(item)
        return yaml.dump(data, default_flow_style=False, allow_unicode=True)

    def _build_json(self, item: "BinderItem") -> str:
        """Build Codex JSON."""
        data = self._build_codex_data(item)
        return json.dumps(data, indent=2, ensure_ascii=False)

    def _build_codex_data(self, item: "BinderItem") -> dict:
        """Build Codex data structure."""
        data = {
            "metadata": {
                "formatVersion": "1.2",
                "created": datetime.now().isoformat()
            },
            "id": item.uuid,
            "type": self._map_type(item),
            "name": item.title
        }

        # Add attributes
        attributes = []
        if item.label:
            attributes.append({"key": "scrivener_label", "value": item.label})
        if item.status:
            attributes.append({"key": "scrivener_status", "value": item.status})
        if item.keywords:
            attributes.append({"key": "keywords", "value": ", ".join(item.keywords)})
        if not item.include_in_compile:
            attributes.append({"key": "scrivener_include_in_compile", "value": "false"})

        if attributes:
            data["attributes"] = attributes

        if item.synopsis:
            data["summary"] = item.synopsis

        if item.converted_content:
            data["body"] = item.converted_content

        return data

    def generate_index(self, project: "ScrivenerProject"):
        """Generate index.codex.yaml files."""
        if self.dry_run:
            return

        # Create boilerplate index.codex.yaml
        index_path = self.output_dir / "index.codex.yaml"
        index_data = {
            "metadata": {
                "formatVersion": "1.2",
                "created": datetime.now().isoformat(),
                "source": "scrivener-import"
            },
            "id": "index-root",
            "type": "project",
            "name": project.title,
            "summary": f"Imported from Scrivener: {project.title}",
            "attributes": [
                {"key": "scrivener_identifier", "value": project.identifier},
                {"key": "scrivener_version", "value": project.version},
                {"key": "scrivener_creator", "value": project.creator}
            ]
        }

        index_path.write_text(
            yaml.dump(index_data, default_flow_style=False, allow_unicode=True),
            encoding="utf-8"
        )
        logger.info(f"Created: {index_path}")

        # Create .index.codex.yaml (auto-generated cache)
        cache_index = self._build_cache_index(project)
        cache_path = self.output_dir / ".index.codex.yaml"
        cache_path.write_text(
            yaml.dump(cache_index, default_flow_style=False, allow_unicode=True),
            encoding="utf-8"
        )
        logger.info(f"Created: {cache_path}")

    def _build_cache_index(self, project: "ScrivenerProject") -> dict:
        """Build .index.codex.yaml structure."""
        return {
            "metadata": {
                "formatVersion": "2.1",
                "generated": True,
                "generatedAt": datetime.now().isoformat(),
                "source": "scrivener-import"
            },
            "id": "index-root",
            "type": "index",
            "name": project.title,
            "children": self._build_index_children(project.binder_items)
        }

    def _build_index_children(self, items: List["BinderItem"]) -> List[dict]:
        """Build index children recursively."""
        children = []

        for item in items:
            if item.item_type in ("Trash", "Root"):
                continue

            slug = self._slugify(item.title)

            if item.item_type in ("Folder", "DraftFolder"):
                child = {
                    "id": f"folder-{slug}",
                    "type": "folder",
                    "name": item.title
                }
                if item.children:
                    child["children"] = self._build_index_children(item.children)
                children.append(child)

            elif item.item_type == "Text":
                ext = self._get_extension()
                child = {
                    "id": f"file-{slug}",
                    "type": self._map_type(item),
                    "name": item.title,
                    "_filename": f"{slug}{ext}"
                }
                children.append(child)

                # Handle Text items with children
                if item.children:
                    for sub in self._build_index_children(item.children):
                        children.append(sub)

        return children

    def _map_type(self, item: "BinderItem") -> str:
        """Map Scrivener item to Codex type."""
        # Check label first
        if item.label:
            label_lower = item.label.lower()
            if "chapter" in label_lower:
                return "chapter"
            if "scene" in label_lower:
                return "scene"
            if "character" in label_lower:
                return "character"
            if "location" in label_lower:
                return "location"

        # Check title patterns
        title_lower = item.title.lower()
        if title_lower.startswith("chapter"):
            return "chapter"
        if title_lower.startswith("scene"):
            return "scene"

        return "document"

    def _get_extension(self) -> str:
        """Get file extension for format."""
        if self.format == "markdown":
            return ".md"
        elif self.format == "yaml":
            return ".codex.yaml"
        else:
            return ".codex.json"

    def _slugify(self, text: str) -> str:
        """Convert text to slug for filenames."""
        # Lowercase
        slug = text.lower()
        # Replace spaces and special chars with hyphens
        slug = re.sub(r'[^\w\s-]', '', slug)
        slug = re.sub(r'[\s_]+', '-', slug)
        # Remove multiple hyphens
        slug = re.sub(r'-+', '-', slug)
        # Trim hyphens
        slug = slug.strip('-')

        return slug or "untitled"
```

**Step 2: Verify the file was created**

Run: `ls -la /Users/phong/Projects/chapterwise-claude-plugins/plugins/chapterwise-codex/scripts/scrivener_file_writer.py`
Expected: File exists

**Step 3: Commit**

```bash
cd /Users/phong/Projects/chapterwise-claude-plugins
git add plugins/chapterwise-codex/scripts/scrivener_file_writer.py
git commit -m "feat(scrivener): add file writer for Codex output formats"
```

---

## Task 4: Create Main CLI Orchestrator (Python)

**Files:**
- Create: `/Users/phong/Projects/chapterwise-claude-plugins/plugins/chapterwise-codex/scripts/scrivener_import.py`

**Step 1: Create the scrivener_import.py file**

```python
#!/usr/bin/env python3
"""
Scrivener Import - Main CLI Orchestrator

Converts Scrivener (.scriv) projects to Chapterwise Codex formats.
Supports: Codex Lite (Markdown), Codex YAML, Codex JSON

Usage:
    python3 scrivener_import.py /path/to/Project.scriv
    python3 scrivener_import.py /path/to/Project.scriv --format markdown --output ./output
    python3 scrivener_import.py /path/to/Project.scriv --dry-run --verbose
"""

import argparse
import json
import logging
import sys
from pathlib import Path
from typing import Optional

from scrivener_parser import ScrivenerParser, ScrivenerProject, BinderItem
from rtf_converter import RTFConverter
from scrivener_file_writer import ScrivenerFileWriter


def setup_logging(verbose: bool, quiet: bool) -> logging.Logger:
    """Configure logging based on verbosity."""
    if quiet:
        level = logging.ERROR
    elif verbose:
        level = logging.DEBUG
    else:
        level = logging.INFO

    logging.basicConfig(
        level=level,
        format='%(asctime)s [%(levelname)s] %(message)s',
        datefmt='%H:%M:%S'
    )
    return logging.getLogger(__name__)


def report_progress(message: str, current: int, total: int, json_output: bool = False):
    """Report progress for external consumers (VS Code, Claude)."""
    if json_output:
        # JSON line protocol for VS Code to parse
        print(json.dumps({
            "type": "progress",
            "message": message,
            "current": current,
            "total": total,
            "percent": round((current / total) * 100) if total > 0 else 0
        }), flush=True)
    else:
        # Human-readable for terminal/Claude
        percent = round((current / total) * 100) if total > 0 else 0
        print(f"[{current}/{total}] ({percent}%) {message}", flush=True)


def validate_scriv_path(scriv_path: Path) -> bool:
    """Validate that path is a valid Scrivener project."""
    if not scriv_path.exists():
        return False
    if not scriv_path.is_dir():
        return False

    # Check for .scrivx file
    scrivx_files = list(scriv_path.glob("*.scrivx"))
    if not scrivx_files:
        return False

    # Check for Files/Data directory
    data_dir = scriv_path / "Files" / "Data"
    if not data_dir.exists():
        return False

    return True


def count_text_items(items: list) -> int:
    """Count all Text type items recursively."""
    count = 0
    for item in items:
        if item.item_type == "Text":
            count += 1
        if item.children:
            count += count_text_items(item.children)
    return count


def iterate_text_items(items: list):
    """Iterate through all Text items recursively."""
    for item in items:
        if item.item_type == "Text":
            yield item
        if item.children:
            yield from iterate_text_items(item.children)


def main():
    parser = argparse.ArgumentParser(
        description="Import Scrivener projects to Chapterwise Codex format",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Preview what will be created
  python3 scrivener_import.py MyNovel.scriv --dry-run

  # Import to Markdown (Codex Lite) - recommended
  python3 scrivener_import.py MyNovel.scriv --format markdown

  # Import to specific output directory
  python3 scrivener_import.py MyNovel.scriv --output ./imported --format yaml

  # Verbose output with JSON progress (for VS Code)
  python3 scrivener_import.py MyNovel.scriv --json --verbose
        """
    )

    # Positional argument
    parser.add_argument(
        "scriv_path",
        type=Path,
        help="Path to .scriv folder/package"
    )

    # Output options
    parser.add_argument(
        "--format", "-f",
        choices=["markdown", "yaml", "json"],
        default="markdown",
        help="Output format: markdown (Codex Lite), yaml, or json (default: markdown)"
    )
    parser.add_argument(
        "--output", "-o",
        type=Path,
        help="Output directory (default: ./<ProjectName>)"
    )

    # RTF conversion options
    parser.add_argument(
        "--rtf-method",
        choices=["striprtf", "pandoc", "raw"],
        default="striprtf",
        help="RTF conversion method (default: striprtf)"
    )

    # Index generation
    parser.add_argument(
        "--generate-index",
        action="store_true",
        default=True,
        help="Generate index.codex.yaml after import (default: True)"
    )
    parser.add_argument(
        "--no-index",
        action="store_true",
        help="Skip index generation"
    )

    # Behavior options
    parser.add_argument(
        "--dry-run", "-d",
        action="store_true",
        help="Preview what would be created without writing files"
    )
    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="Verbose output"
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Output progress as JSON lines (for programmatic parsing)"
    )
    parser.add_argument(
        "--quiet", "-q",
        action="store_true",
        help="Minimal output (errors only)"
    )

    args = parser.parse_args()

    # Setup logging
    logger = setup_logging(args.verbose, args.quiet)

    # Validate input
    scriv_path = args.scriv_path.resolve()
    if not validate_scriv_path(scriv_path):
        error_msg = f"Invalid Scrivener project: {scriv_path}"
        if args.json:
            print(json.dumps({"type": "error", "message": error_msg}))
        else:
            print(f"ERROR: {error_msg}", file=sys.stderr)
        sys.exit(1)

    # Determine output directory
    project_name = scriv_path.stem  # Remove .scriv extension
    output_dir = args.output.resolve() if args.output else Path.cwd() / project_name

    # Handle --no-index flag
    generate_index = args.generate_index and not args.no_index

    try:
        # Phase 1: Parse Scrivener project
        report_progress("Parsing Scrivener project...", 1, 5, args.json)
        parser_obj = ScrivenerParser(scriv_path)
        project = parser_obj.parse()

        if not project:
            raise ValueError("Failed to parse Scrivener project")

        # Phase 2: Resolve metadata (convert IDs to names)
        report_progress("Resolving metadata...", 2, 5, args.json)
        parser_obj.resolve_metadata(project)

        # Count items for progress
        total_items = count_text_items(project.binder_items)
        logger.info(f"Found {total_items} text documents to convert")

        # Phase 3: Convert RTF content
        report_progress(f"Converting {total_items} RTF documents...", 3, 5, args.json)
        rtf_converter = RTFConverter(method=args.rtf_method)

        converted = 0
        for item in iterate_text_items(project.binder_items):
            if item.content_path and item.content_path.exists():
                item.converted_content = rtf_converter.convert(item.content_path)
                converted += 1
                if args.verbose:
                    report_progress(f"Converted: {item.title}", converted, total_items, args.json)

        # Phase 4: Write output files
        report_progress("Writing output files...", 4, 5, args.json)

        if args.dry_run:
            # Preview mode - just print what would be created
            print("\n=== DRY RUN - No files will be written ===\n")
            print(f"Output directory: {output_dir}")
            print(f"Format: {args.format}")
            print(f"\nFiles that would be created:")

            writer = ScrivenerFileWriter(output_dir, args.format, dry_run=True)
            files = writer.preview_files(project)
            for f in files:
                print(f"  {f}")

            print(f"\nTotal: {len(files)} files")

            if generate_index:
                print(f"\nIndex files:")
                print(f"  {output_dir}/index.codex.yaml")
                print(f"  {output_dir}/.index.codex.yaml")
        else:
            # Actually write files
            writer = ScrivenerFileWriter(output_dir, args.format)
            result = writer.write_project(project)

            # Phase 5: Generate index
            if generate_index:
                report_progress("Generating index files...", 5, 5, args.json)
                writer.generate_index(project)

            # Final report
            if args.json:
                print(json.dumps({
                    "type": "result",
                    "success": True,
                    "outputDir": str(output_dir),
                    "filesGenerated": result.files_written,
                    "format": args.format,
                    "indexGenerated": generate_index
                }))
            else:
                print(f"\n✅ Scrivener project imported successfully!")
                print(f"   Output: {output_dir}")
                print(f"   Files: {result.files_written}")
                print(f"   Format: {args.format}")
                if generate_index:
                    print(f"   Index: {output_dir}/.index.codex.yaml")

    except Exception as e:
        error_msg = str(e)
        if args.json:
            print(json.dumps({"type": "error", "message": error_msg}))
        else:
            print(f"ERROR: {error_msg}", file=sys.stderr)

        if args.verbose:
            import traceback
            traceback.print_exc()

        sys.exit(1)


if __name__ == "__main__":
    main()
```

**Step 2: Make the file executable**

Run: `chmod +x /Users/phong/Projects/chapterwise-claude-plugins/plugins/chapterwise-codex/scripts/scrivener_import.py`
Expected: No output, file is now executable

**Step 3: Test the help command**

Run: `python3 /Users/phong/Projects/chapterwise-claude-plugins/plugins/chapterwise-codex/scripts/scrivener_import.py --help`
Expected: Shows usage information

**Step 4: Commit**

```bash
cd /Users/phong/Projects/chapterwise-claude-plugins
git add plugins/chapterwise-codex/scripts/scrivener_import.py
git commit -m "feat(scrivener): add main CLI orchestrator"
```

---

## Task 5: Create Claude Skill Definition

**Files:**
- Create: `/Users/phong/Projects/chapterwise-claude-plugins/plugins/chapterwise-codex/commands/import-scrivener.md`

**Step 1: Create the skill definition file**

```markdown
---
description: "Import Scrivener projects (.scriv) to Chapterwise Codex format. Converts RTF content to Markdown, preserves Scrivener metadata (labels, status, keywords), and generates index files. Use when user mentions 'scrivener', 'import scriv', or '.scriv project'."
allowed-tools: Read, Grep, Glob, Bash, Write, Edit, AskUserQuestion
triggers:
  - scrivener import
  - import scrivener
  - scrivener to codex
  - convert scrivener
  - scriv to markdown
  - import .scriv
  - scrivener project
disable-model-invocation: true
argument-hint: "[path/to/Project.scriv]"
---

# Import Scrivener Project

Import a Scrivener (.scriv) project into Chapterwise Codex format.

## Quick Start

```bash
# Preview what will be created (always do this first)
python3 ${CLAUDE_PLUGIN_ROOT}/scripts/scrivener_import.py /path/to/Project.scriv --dry-run

# Import to Markdown (Codex Lite) - recommended
python3 ${CLAUDE_PLUGIN_ROOT}/scripts/scrivener_import.py /path/to/Project.scriv --format markdown

# Import to current directory
python3 ${CLAUDE_PLUGIN_ROOT}/scripts/scrivener_import.py /path/to/Project.scriv --output .
```

## Workflow

When user invokes this skill:

### Step 1: Identify the Scrivener Project

If path provided as argument:
- Validate it's a .scriv folder (contains .scrivx file)

If no path provided:
- Use Glob to find .scriv folders: `**/*.scriv`
- If multiple found, use AskUserQuestion to let user choose
- If none found, inform user and exit

### Step 2: Preview the Import

Always run dry-run first to show user what will be created:

```bash
python3 ${CLAUDE_PLUGIN_ROOT}/scripts/scrivener_import.py "$SCRIV_PATH" --dry-run --verbose
```

### Step 3: Confirm Options

Use AskUserQuestion to confirm:
- Output format: Markdown (recommended), YAML, or JSON
- Output location: Current directory or custom path
- Generate index files: Yes (recommended) or No

### Step 4: Run Import

```bash
python3 ${CLAUDE_PLUGIN_ROOT}/scripts/scrivener_import.py "$SCRIV_PATH" \
  --format "$FORMAT" \
  --output "$OUTPUT_DIR" \
  --verbose
```

### Step 5: Report Results

Show user:
- Number of files created
- Output directory path
- Any warnings or errors
- Suggest opening index.codex.yaml in VS Code

## Command Reference

```
python3 scrivener_import.py <scriv_path> [options]

Positional:
  scriv_path              Path to .scriv folder

Options:
  --format, -f            Output format: markdown, yaml, json (default: markdown)
  --output, -o            Output directory (default: ./<ProjectName>)
  --rtf-method            RTF conversion: striprtf, pandoc, raw (default: striprtf)
  --generate-index        Generate index files (default: true)
  --no-index              Skip index generation
  --dry-run, -d           Preview without writing files
  --verbose, -v           Verbose output
  --json                  JSON progress output
  --quiet, -q             Minimal output
```

## Output Formats

### Codex Lite (Markdown) - Recommended

Human-readable, Git-friendly Markdown with YAML frontmatter:

```markdown
---
type: chapter
name: "Chapter 1: The Awakening"
scrivener_label: "Chapter"
scrivener_status: "First Draft"
---

# Chapter 1: The Awakening

Content here...
```

### Codex YAML

Full Codex format with structured metadata.

### Codex JSON

Machine-readable JSON format (same structure as YAML).

## Troubleshooting

**"No .scrivx file found"**
- Selected folder is not a valid Scrivener project
- Make sure you select the .scriv folder itself

**"striprtf not installed"**
- Run: `pip3 install striprtf`
- Or use `--rtf-method raw` to skip conversion

**"pandoc not found"**
- Install pandoc for better RTF conversion
- Or use default striprtf method

## Dependencies

Required:
- Python 3.8+
- PyYAML: `pip3 install pyyaml`
- striprtf: `pip3 install striprtf`

Optional (for better RTF quality):
- pandoc: Install from https://pandoc.org/installing.html
```

**Step 2: Verify the skill file was created**

Run: `ls -la /Users/phong/Projects/chapterwise-claude-plugins/plugins/chapterwise-codex/commands/import-scrivener.md`
Expected: File exists

**Step 3: Commit**

```bash
cd /Users/phong/Projects/chapterwise-claude-plugins
git add plugins/chapterwise-codex/commands/import-scrivener.md
git commit -m "feat(scrivener): add Claude skill for Scrivener import"
```

---

## Task 6: Create Sync Script for VS Code Extension

**Files:**
- Create: `/Users/phong/Projects/chapterwise-codex/scripts/sync-scrivener-scripts.sh`
- Create: `/Users/phong/Projects/chapterwise-codex/scripts/scrivener/` directory

**Step 1: Create the scripts directory**

Run: `mkdir -p /Users/phong/Projects/chapterwise-codex/scripts/scrivener`
Expected: Directory created

**Step 2: Create the sync script**

```bash
#!/bin/bash
# Sync Scrivener import scripts from Claude plugin (canonical source)
# Run this before releasing the VS Code extension

set -e

CANONICAL="/Users/phong/Projects/chapterwise-claude-plugins/plugins/chapterwise-codex/scripts"
TARGET="/Users/phong/Projects/chapterwise-codex/scripts/scrivener"

# Files to sync
FILES=(
    "scrivener_import.py"
    "scrivener_parser.py"
    "rtf_converter.py"
    "scrivener_file_writer.py"
)

echo "Syncing Scrivener scripts from Claude plugin..."
echo "Source: $CANONICAL"
echo "Target: $TARGET"
echo ""

mkdir -p "$TARGET"

for file in "${FILES[@]}"; do
    if [ -f "$CANONICAL/$file" ]; then
        cp "$CANONICAL/$file" "$TARGET/$file"
        echo "  ✓ Synced $file"
    else
        echo "  ✗ Missing $CANONICAL/$file"
        exit 1
    fi
done

echo ""
echo "Done. Scripts synced to $TARGET"
echo ""
echo "Remember to commit these changes before releasing the extension."
```

**Step 3: Make the script executable**

Run: `chmod +x /Users/phong/Projects/chapterwise-codex/scripts/sync-scrivener-scripts.sh`
Expected: No output

**Step 4: Run the sync script**

Run: `/Users/phong/Projects/chapterwise-codex/scripts/sync-scrivener-scripts.sh`
Expected: Shows all files synced successfully

**Step 5: Verify synced files**

Run: `ls -la /Users/phong/Projects/chapterwise-codex/scripts/scrivener/`
Expected: All 4 Python files present

**Step 6: Commit**

```bash
cd /Users/phong/Projects/chapterwise-codex
git add scripts/
git commit -m "feat(scrivener): add sync script and Python scripts for Scrivener import"
```

---

## Task 7: Create TypeScript Wrapper for VS Code

**Files:**
- Create: `/Users/phong/Projects/chapterwise-codex/src/scrivenerImport.ts`

**Step 1: Create the TypeScript wrapper file**

```typescript
/**
 * Scrivener Import - VS Code Integration
 *
 * Thin TypeScript wrapper that calls shared Python scripts.
 * Provides VS Code UI (QuickPick, Progress) around Python core.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { spawn } from 'child_process';

// Configuration
const SCRIPTS_DIR = 'scripts/scrivener';
const MAIN_SCRIPT = 'scrivener_import.py';

/**
 * Import options from user
 */
export interface ScrivenerImportOptions {
  scrivPath: string;
  outputDir: string;
  format: 'markdown' | 'yaml' | 'json';
  generateIndex: boolean;
}

/**
 * Progress update from Python script
 */
interface ProgressUpdate {
  type: 'progress' | 'result' | 'error';
  message?: string;
  current?: number;
  total?: number;
  percent?: number;
  success?: boolean;
  filesGenerated?: number;
  outputDir?: string;
}

/**
 * Check if Python 3 is available
 */
async function checkPython(): Promise<boolean> {
  return new Promise((resolve) => {
    const python = spawn('python3', ['--version']);
    python.on('close', (code) => resolve(code === 0));
    python.on('error', () => resolve(false));
  });
}

/**
 * Check if required Python packages are installed
 */
async function checkDependencies(): Promise<{ installed: boolean; missing: string[] }> {
  return new Promise((resolve) => {
    const python = spawn('python3', ['-c', 'import yaml; import striprtf']);
    python.on('close', (code) => {
      if (code === 0) {
        resolve({ installed: true, missing: [] });
      } else {
        resolve({ installed: false, missing: ['pyyaml', 'striprtf'] });
      }
    });
    python.on('error', () => resolve({ installed: false, missing: ['pyyaml', 'striprtf'] }));
  });
}

/**
 * Validate Scrivener project folder
 */
function validateScrivenerProject(scrivPath: string): boolean {
  if (!fs.existsSync(scrivPath) || !fs.statSync(scrivPath).isDirectory()) {
    return false;
  }

  // Check for .scrivx file
  const files = fs.readdirSync(scrivPath);
  const hasScrivx = files.some(f => f.toLowerCase().endsWith('.scrivx'));

  if (!hasScrivx) {
    return false;
  }

  // Check for Files/Data directory
  const dataDir = path.join(scrivPath, 'Files', 'Data');
  return fs.existsSync(dataDir);
}

/**
 * Show folder picker for Scrivener project
 */
async function selectScrivenerProject(): Promise<string | undefined> {
  const result = await vscode.window.showOpenDialog({
    canSelectFiles: true,
    canSelectFolders: true,
    canSelectMany: false,
    title: 'Select Scrivener Project (.scriv)',
    filters: { 'Scrivener Projects': ['scriv'] }
  });

  if (!result || result.length === 0) {
    return undefined;
  }

  const scrivPath = result[0].fsPath;

  if (!validateScrivenerProject(scrivPath)) {
    vscode.window.showErrorMessage(
      'Selected folder is not a valid Scrivener project. Missing .scrivx file or Files/Data directory.'
    );
    return undefined;
  }

  return scrivPath;
}

/**
 * Get import options from user
 */
async function getImportOptions(scrivPath: string): Promise<ScrivenerImportOptions | undefined> {
  const projectName = path.basename(scrivPath, '.scriv');

  // Format selection
  const formatChoice = await vscode.window.showQuickPick([
    { label: '$(markdown) Codex Lite (Markdown)', description: 'Recommended', detail: 'Human-readable, Git-friendly', value: 'markdown' as const },
    { label: '$(symbol-file) Codex YAML', description: 'Full format', detail: 'Hierarchical structure', value: 'yaml' as const },
    { label: '$(json) Codex JSON', description: 'Machine-readable', detail: 'API-friendly', value: 'json' as const }
  ], {
    title: 'Output Format',
    placeHolder: 'How should Scrivener content be saved?'
  });

  if (!formatChoice) return undefined;

  // Output location
  const workspaceFolders = vscode.workspace.workspaceFolders;
  let outputDir: string;

  if (workspaceFolders && workspaceFolders.length > 0) {
    const locationChoice = await vscode.window.showQuickPick([
      { label: '$(folder) Current Workspace', description: `Create ${projectName}/ here`, value: 'workspace' },
      { label: '$(folder-opened) Choose Location', description: 'Select custom folder', value: 'custom' }
    ], {
      title: 'Output Location'
    });

    if (!locationChoice) return undefined;

    if (locationChoice.value === 'workspace') {
      outputDir = path.join(workspaceFolders[0].uri.fsPath, projectName);
    } else {
      const customResult = await vscode.window.showOpenDialog({
        canSelectFolders: true,
        canSelectFiles: false,
        canSelectMany: false,
        title: 'Select Output Folder'
      });
      if (!customResult || customResult.length === 0) return undefined;
      outputDir = path.join(customResult[0].fsPath, projectName);
    }
  } else {
    const customResult = await vscode.window.showOpenDialog({
      canSelectFolders: true,
      canSelectFiles: false,
      canSelectMany: false,
      title: 'Select Output Folder'
    });
    if (!customResult || customResult.length === 0) return undefined;
    outputDir = path.join(customResult[0].fsPath, projectName);
  }

  // Index generation
  const indexChoice = await vscode.window.showQuickPick([
    { label: '$(check) Yes, generate index', description: 'Recommended', detail: 'Creates index.codex.yaml for navigation', value: true },
    { label: '$(x) No, just import files', description: 'Skip index', detail: 'Generate later with /index command', value: false }
  ], {
    title: 'Generate Index?'
  });

  if (indexChoice === undefined) return undefined;

  return {
    scrivPath,
    outputDir,
    format: formatChoice.value,
    generateIndex: indexChoice.value
  };
}

/**
 * Run the Python import script with progress
 */
async function runImport(
  context: vscode.ExtensionContext,
  options: ScrivenerImportOptions,
  progress: vscode.Progress<{ message?: string; increment?: number }>,
  token: vscode.CancellationToken
): Promise<ProgressUpdate> {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(context.extensionPath, SCRIPTS_DIR, MAIN_SCRIPT);

    const args = [
      scriptPath,
      options.scrivPath,
      '--format', options.format,
      '--output', options.outputDir,
      '--json',
      '--verbose'
    ];

    if (!options.generateIndex) {
      args.push('--no-index');
    }

    const python = spawn('python3', args);

    let lastResult: ProgressUpdate | null = null;
    let lastPercent = 0;

    python.stdout.on('data', (data: Buffer) => {
      const lines = data.toString().split('\n').filter(l => l.trim());

      for (const line of lines) {
        try {
          const update: ProgressUpdate = JSON.parse(line);

          if (update.type === 'progress') {
            const increment = update.percent ? update.percent - lastPercent : undefined;
            lastPercent = update.percent || lastPercent;
            progress.report({
              message: update.message,
              increment: increment
            });
          } else if (update.type === 'result' || update.type === 'error') {
            lastResult = update;
          }
        } catch {
          // Non-JSON output, ignore or log
        }
      }
    });

    python.stderr.on('data', (data: Buffer) => {
      console.error(`Scrivener import stderr: ${data}`);
    });

    python.on('close', (code) => {
      if (code === 0 && lastResult) {
        resolve(lastResult);
      } else if (lastResult?.type === 'error') {
        reject(new Error(lastResult.message || 'Import failed'));
      } else {
        reject(new Error(`Import failed with exit code ${code}`));
      }
    });

    python.on('error', (err) => {
      reject(new Error(`Failed to start Python: ${err.message}`));
    });

    // Handle cancellation
    token.onCancellationRequested(() => {
      python.kill();
      reject(new Error('Import cancelled'));
    });
  });
}

/**
 * Main import command
 */
export async function runScrivenerImport(context: vscode.ExtensionContext): Promise<void> {
  // Check Python availability
  const hasPython = await checkPython();
  if (!hasPython) {
    const action = await vscode.window.showErrorMessage(
      'Python 3 is required for Scrivener import.',
      'Download Python'
    );
    if (action === 'Download Python') {
      vscode.env.openExternal(vscode.Uri.parse('https://www.python.org/downloads/'));
    }
    return;
  }

  // Check dependencies
  const deps = await checkDependencies();
  if (!deps.installed) {
    const action = await vscode.window.showWarningMessage(
      `Missing Python packages: ${deps.missing.join(', ')}`,
      'Install Now'
    );
    if (action === 'Install Now') {
      const terminal = vscode.window.createTerminal('Install Dependencies');
      terminal.sendText(`pip3 install ${deps.missing.join(' ')}`);
      terminal.show();
    }
    return;
  }

  // Select Scrivener project
  const scrivPath = await selectScrivenerProject();
  if (!scrivPath) return;

  // Get options
  const options = await getImportOptions(scrivPath);
  if (!options) return;

  // Run import with progress
  try {
    const result = await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: 'Importing Scrivener Project',
      cancellable: true
    }, async (progress, token) => {
      return await runImport(context, options, progress, token);
    });

    if (result.success) {
      const action = await vscode.window.showInformationMessage(
        `Imported ${result.filesGenerated} files to ${result.outputDir}`,
        'Open Folder',
        'Open Index'
      );

      if (action === 'Open Folder') {
        vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(result.outputDir!));
      } else if (action === 'Open Index') {
        const indexPath = path.join(result.outputDir!, 'index.codex.yaml');
        if (fs.existsSync(indexPath)) {
          const doc = await vscode.workspace.openTextDocument(indexPath);
          await vscode.window.showTextDocument(doc);
        }
      }
    }
  } catch (error) {
    vscode.window.showErrorMessage(
      `Scrivener import failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Register command
 */
export function registerScrivenerImport(context: vscode.ExtensionContext): void {
  const command = vscode.commands.registerCommand(
    'chapterwiseCodex.importScrivener',
    () => runScrivenerImport(context)
  );
  context.subscriptions.push(command);
}

/**
 * Dispose
 */
export function disposeScrivenerImport(): void {
  // Cleanup if needed
}
```

**Step 2: Verify the TypeScript file was created**

Run: `ls -la /Users/phong/Projects/chapterwise-codex/src/scrivenerImport.ts`
Expected: File exists

**Step 3: Commit**

```bash
cd /Users/phong/Projects/chapterwise-codex
git add src/scrivenerImport.ts
git commit -m "feat(scrivener): add TypeScript wrapper for VS Code integration"
```

---

## Task 8: Update VS Code Extension Entry Point

**Files:**
- Modify: `/Users/phong/Projects/chapterwise-codex/src/extension.ts`

**Step 1: Add import at top of file (after other imports)**

Add after existing imports (around line 20):

```typescript
import { registerScrivenerImport, disposeScrivenerImport } from './scrivenerImport';
```

**Step 2: Register command in activate function**

Add in the `activate` function, after other command registrations (search for similar `register` calls):

```typescript
  // Register Scrivener import command
  registerScrivenerImport(context);
```

**Step 3: Add dispose in deactivate function**

Add in the `deactivate` function:

```typescript
  disposeScrivenerImport();
```

**Step 4: Verify the file compiles**

Run: `cd /Users/phong/Projects/chapterwise-codex && npm run compile`
Expected: No TypeScript errors

**Step 5: Commit**

```bash
cd /Users/phong/Projects/chapterwise-codex
git add src/extension.ts
git commit -m "feat(scrivener): register import command in extension activation"
```

---

## Task 9: Update package.json with Command

**Files:**
- Modify: `/Users/phong/Projects/chapterwise-codex/package.json`

**Step 1: Add command to contributes.commands array**

Find the `"commands"` array in `contributes` and add:

```json
{
  "command": "chapterwiseCodex.importScrivener",
  "title": "ChapterWise Codex: Import Scrivener Project",
  "icon": "$(file-add)"
}
```

**Step 2: Add to commandPalette menu (if exists)**

Find `"menus"` > `"commandPalette"` and add:

```json
{
  "command": "chapterwiseCodex.importScrivener",
  "when": "true"
}
```

**Step 3: Verify JSON is valid**

Run: `cd /Users/phong/Projects/chapterwise-codex && node -e "require('./package.json')"`
Expected: No output (valid JSON)

**Step 4: Commit**

```bash
cd /Users/phong/Projects/chapterwise-codex
git add package.json
git commit -m "feat(scrivener): add import command to package.json"
```

---

## Task 10: Test End-to-End

**Files:**
- No files modified, just verification

**Step 1: Test Claude skill (if available test project)**

Run: Find a .scriv project or skip if none available

```bash
# In Claude Code, invoke:
/chapterwise-codex:import-scrivener /path/to/test.scriv --dry-run
```

Expected: Shows preview of files that would be created

**Step 2: Test VS Code extension**

Run:
1. Open VS Code in chapterwise-codex directory
2. Press F5 to launch extension development host
3. Open Command Palette (Cmd+Shift+P)
4. Type "Import Scrivener"
5. Select command

Expected: File picker dialog appears

**Step 3: Verify Python dependencies work**

Run: `python3 -c "import yaml; import striprtf; print('OK')"`
Expected: Prints "OK"

**Step 4: Final commit (if all tests pass)**

```bash
cd /Users/phong/Projects/chapterwise-codex
git add .
git commit -m "test(scrivener): verify end-to-end import functionality"
```

---

## Summary

| Task | Component | Files Created/Modified |
|------|-----------|----------------------|
| 1 | Python Parser | `scrivener_parser.py` |
| 2 | RTF Converter | `rtf_converter.py` |
| 3 | File Writer | `scrivener_file_writer.py` |
| 4 | CLI Orchestrator | `scrivener_import.py` |
| 5 | Claude Skill | `import-scrivener.md` |
| 6 | Sync Script | `sync-scrivener-scripts.sh` + synced files |
| 7 | TS Wrapper | `scrivenerImport.ts` |
| 8 | Extension Entry | `extension.ts` (modified) |
| 9 | Package Config | `package.json` (modified) |
| 10 | Testing | Verification only |

## Dependencies to Install

```bash
# Python packages
pip3 install pyyaml striprtf

# Optional for better RTF conversion
brew install pandoc  # or download from pandoc.org
```

## Invocation

**Claude Skill:**
```
/chapterwise-codex:import-scrivener /path/to/Novel.scriv
```

**VS Code Command:**
```
Cmd+Shift+P → "ChapterWise Codex: Import Scrivener Project"
```

Both use the same Python scripts, ensuring identical behavior.
