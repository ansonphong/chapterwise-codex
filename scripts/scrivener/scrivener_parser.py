#!/usr/bin/env python3
"""
Scrivener Parser - XML/.scrivx Parsing

Parses Scrivener project structure from .scrivx XML files.
Builds BinderItem tree with metadata resolution.
"""

import argparse
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


def print_items(items: List[BinderItem], indent: int = 0):
    """Print binder items recursively."""
    for item in items:
        prefix = "  " * indent
        status = f" [{item.status}]" if item.status else ""
        label = f" ({item.label})" if item.label else ""
        print(f"{prefix}- {item.title} ({item.item_type}){label}{status}")
        if item.children:
            print_items(item.children, indent + 1)


def main():
    parser = argparse.ArgumentParser(
        description="Parse Scrivener .scrivx files and display project structure",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python3 scrivener_parser.py /path/to/MyNovel.scriv
  python3 scrivener_parser.py /path/to/MyNovel.scriv --verbose
        """
    )

    parser.add_argument(
        "scriv_path",
        type=Path,
        nargs="?",
        help="Path to .scriv folder/package"
    )
    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="Verbose output"
    )

    args = parser.parse_args()

    if args.scriv_path is None:
        parser.print_help()
        return

    if args.verbose:
        logging.basicConfig(level=logging.DEBUG)

    try:
        scriv_parser = ScrivenerParser(args.scriv_path)
        project = scriv_parser.parse()
        scriv_parser.resolve_metadata(project)

        print(f"Project: {project.title}")
        print(f"Version: {project.version}")
        print(f"Creator: {project.creator}")
        print(f"Labels: {len(project.labels)}")
        print(f"Statuses: {len(project.statuses)}")
        print(f"\nBinder Structure:")
        print_items(project.binder_items)

    except FileNotFoundError as e:
        print(f"Error: {e}")
        return 1
    except ET.ParseError as e:
        print(f"XML Parse Error: {e}")
        return 1


if __name__ == "__main__":
    main()
