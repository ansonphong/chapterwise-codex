#!/usr/bin/env python3
"""
RTF Converter - RTF to Markdown/HTML Conversion

Converts Scrivener RTF content files to Markdown.
Supports multiple conversion methods with graceful fallback.
"""

import argparse
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
        """Validate that the chosen method is available, fallback gracefully."""
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
        rtf_path = Path(rtf_path)

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
        except FileNotFoundError:
            logger.warning("pandoc not found")
            return self._convert_with_striprtf(rtf_path)

    def _convert_with_striprtf(self, rtf_path: Path) -> str:
        """Convert using striprtf (fast, basic)."""
        try:
            from striprtf.striprtf import rtf_to_text
        except ImportError:
            logger.warning("striprtf not available, returning raw")
            return self._get_raw(rtf_path)

        try:
            rtf_content = rtf_path.read_text(encoding="utf-8", errors="replace")
            text = rtf_to_text(rtf_content)
            return self._text_to_markdown(text)
        except Exception as e:
            logger.error(f"striprtf conversion failed: {e}")
            return self._get_raw(rtf_path)

    def _get_raw(self, rtf_path: Path) -> str:
        """Return raw RTF content (no conversion)."""
        try:
            return rtf_path.read_text(encoding="utf-8", errors="replace")
        except Exception as e:
            logger.error(f"Failed to read file: {e}")
            return f"[Read error: {e}]"

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

        # Join and split by double newlines to form paragraphs
        content = "\n".join(cleaned)
        paragraphs = [p.strip() for p in content.split("\n\n") if p.strip()]
        return "\n\n".join(paragraphs)


def main():
    parser = argparse.ArgumentParser(
        description="Convert RTF files to Markdown",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Methods:
  striprtf  - Fast, basic conversion using striprtf library (default)
  pandoc    - Better quality using pandoc CLI
  raw       - No conversion, return raw RTF content

Examples:
  python3 rtf_converter.py content.rtf
  python3 rtf_converter.py content.rtf pandoc
  python3 rtf_converter.py content.rtf --method striprtf
        """
    )

    parser.add_argument(
        "rtf_path",
        type=Path,
        nargs="?",
        help="Path to RTF file"
    )
    parser.add_argument(
        "method_positional",
        nargs="?",
        help="Conversion method (positional)"
    )
    parser.add_argument(
        "--method", "-m",
        choices=["striprtf", "pandoc", "raw"],
        default="striprtf",
        help="Conversion method (default: striprtf)"
    )
    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="Verbose output"
    )

    args = parser.parse_args()

    if args.rtf_path is None:
        parser.print_help()
        return

    if args.verbose:
        logging.basicConfig(level=logging.DEBUG)

    # Handle positional method argument
    method = args.method_positional if args.method_positional else args.method

    converter = RTFConverter(method=method)
    result = converter.convert(args.rtf_path)
    print(result)


if __name__ == "__main__":
    main()
