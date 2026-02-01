#!/usr/bin/env python3
"""
Scrivener File Writer - Output File Generation

Writes Scrivener content to disk in chosen format:
- Codex Lite (Markdown with YAML frontmatter)
- Codex YAML (.codex.yaml)
- Codex JSON (.codex.json)
"""

import argparse
import json
import logging
import re
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import List, Optional, TYPE_CHECKING

try:
    import yaml
except ImportError:
    yaml = None

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

    def __init__(self, output_dir: Path, format: str = "markdown", dry_run: bool = False):
        """
        Initialize file writer.

        Args:
            output_dir: Directory to write files to
            format: Output format - "markdown", "yaml", or "json"
            dry_run: If True, don't actually write files
        """
        self.output_dir = Path(output_dir)
        self.format = format
        self.dry_run = dry_run
        self.files_written = 0
        self.dirs_created = 0
        self.errors: List[str] = []

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

        # Build YAML frontmatter
        if yaml:
            yaml_fm = yaml.dump(frontmatter, default_flow_style=False, allow_unicode=True).strip()
        else:
            # Fallback to simple format if yaml not installed
            yaml_fm = "\n".join(f"{k}: {repr(v)}" for k, v in frontmatter.items())

        body = item.converted_content or ""

        return f"---\n{yaml_fm}\n---\n\n# {item.title}\n\n{body}\n"

    def _build_yaml(self, item: "BinderItem") -> str:
        """Build full Codex YAML."""
        if not yaml:
            raise ImportError("PyYAML is required for YAML output. Install with: pip3 install pyyaml")

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

        if not yaml:
            logger.warning("PyYAML not installed, skipping index generation")
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


def main():
    parser = argparse.ArgumentParser(
        description="Write Scrivener content to Codex format files",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Formats:
  markdown  - Codex Lite (.md with YAML frontmatter) - default
  yaml      - Full Codex format (.codex.yaml)
  json      - Full Codex format (.codex.json)

This module is typically used by scrivener_import.py, not directly.
        """
    )

    parser.add_argument(
        "--format", "-f",
        choices=["markdown", "yaml", "json"],
        default="markdown",
        help="Output format (default: markdown)"
    )
    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="Verbose output"
    )

    args = parser.parse_args()

    if args.verbose:
        logging.basicConfig(level=logging.DEBUG)

    # Just show help - this module is meant to be imported
    print("ScrivenerFileWriter module loaded successfully.")
    print(f"YAML available: {yaml is not None}")
    print(f"\nUse: from scrivener_file_writer import ScrivenerFileWriter")


if __name__ == "__main__":
    main()
