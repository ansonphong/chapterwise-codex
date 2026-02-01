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
from typing import List

from scrivener_parser import ScrivenerParser, ScrivenerProject, BinderItem
from rtf_converter import RTFConverter
from scrivener_file_writer import ScrivenerFileWriter

logger = logging.getLogger(__name__)


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


def count_text_items(items: List[BinderItem]) -> int:
    """Count all Text type items recursively."""
    count = 0
    for item in items:
        if item.item_type == "Text":
            count += 1
        if item.children:
            count += count_text_items(item.children)
    return count


def iterate_text_items(items: List[BinderItem]):
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
        nargs="?",
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

    # V2: Nested index options
    parser.add_argument(
        "--index-depth",
        type=int,
        default=1,
        help="How many levels get their own index.codex.yaml (0=single, 1=per-book, 2=per-act)"
    )
    parser.add_argument(
        "--containers",
        type=str,
        default="act,part,book,folder",
        help="Types that become inline in index (comma-separated, default: act,part,book,folder)"
    )
    parser.add_argument(
        "--content",
        type=str,
        default="chapter,scene,document",
        help="Types that become .md files (comma-separated, default: chapter,scene,document)"
    )
    parser.add_argument(
        "--nested",
        action="store_true",
        default=True,
        help="Use V2 nested index structure (default: True)"
    )
    parser.add_argument(
        "--flat",
        action="store_true",
        help="Use flat structure (legacy V1 mode)"
    )

    args = parser.parse_args()

    # Show help if no path provided
    if args.scriv_path is None:
        parser.print_help()
        return 0

    # Setup logging
    log = setup_logging(args.verbose, args.quiet)

    # Validate input
    scriv_path = args.scriv_path.resolve()
    if not validate_scriv_path(scriv_path):
        error_msg = f"Invalid Scrivener project: {scriv_path}"
        if args.json:
            print(json.dumps({"type": "error", "message": error_msg}))
        else:
            print(f"ERROR: {error_msg}", file=sys.stderr)
        return 1

    # Determine output directory
    project_name = scriv_path.stem  # Remove .scriv extension
    output_dir = args.output.resolve() if args.output else Path.cwd() / project_name

    # Handle --no-index flag
    generate_index = args.generate_index and not args.no_index

    # Parse container and content types
    container_types = [t.strip() for t in args.containers.split(",")]
    content_types = [t.strip() for t in args.content.split(",")]

    # Use nested mode unless --flat is specified
    use_nested = args.nested and not args.flat

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
        log.info(f"Found {total_items} text documents to convert")

        # Phase 3: Convert RTF content
        report_progress(f"Converting {total_items} RTF documents...", 3, 5, args.json)
        rtf_converter = RTFConverter(method=args.rtf_method)

        converted = 0
        for item in iterate_text_items(project.binder_items):
            if item.content_path and item.content_path.exists():
                item.converted_content = rtf_converter.convert(item.content_path)
                converted += 1
                if args.verbose and not args.json:
                    print(f"  Converted: {item.title}")

        # Phase 4: Write output files
        report_progress("Writing output files...", 4, 5, args.json)

        if args.dry_run:
            # Preview mode - just print what would be created
            if not args.json:
                print("\n=== DRY RUN - No files will be written ===\n")
                print(f"Output directory: {output_dir}")
                print(f"Format: {args.format}")
                print(f"Mode: {'nested (V2)' if use_nested else 'flat (V1)'}")
                if use_nested:
                    print(f"Index depth: {args.index_depth}")
                print(f"\nFiles that would be created:")

            writer = ScrivenerFileWriter(
                output_dir,
                args.format,
                dry_run=True,
                index_depth=args.index_depth,
                containers=container_types,
                content_types=content_types
            )
            files = writer.preview_files(project)

            if args.json:
                print(json.dumps({
                    "type": "preview",
                    "outputDir": str(output_dir),
                    "format": args.format,
                    "mode": "nested" if use_nested else "flat",
                    "indexDepth": args.index_depth if use_nested else 0,
                    "files": files,
                    "fileCount": len(files)
                }))
            else:
                for f in files:
                    print(f"  {f}")
                print(f"\nTotal: {len(files)} files")

                if generate_index:
                    print(f"\nIndex files:")
                    print(f"  {output_dir}/index.codex.yaml")
                    if not use_nested:
                        print(f"  {output_dir}/.index.codex.yaml")
        else:
            # Actually write files
            writer = ScrivenerFileWriter(
                output_dir,
                args.format,
                index_depth=args.index_depth,
                containers=container_types,
                content_types=content_types
            )

            if use_nested:
                # V2: Nested index structure
                result = writer.write_project_nested(project)
                # Index is generated as part of write_project_nested
            else:
                # V1: Flat structure (legacy)
                result = writer.write_project(project)

                # Phase 5: Generate index (legacy mode)
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

        return 0

    except Exception as e:
        error_msg = str(e)
        if args.json:
            print(json.dumps({"type": "error", "message": error_msg}))
        else:
            print(f"ERROR: {error_msg}", file=sys.stderr)

        if args.verbose:
            import traceback
            traceback.print_exc()

        return 1


if __name__ == "__main__":
    sys.exit(main())
