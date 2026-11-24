"""Common command-line handling for the Office skill's read-only helpers."""

import argparse
from contextlib import contextmanager
from dataclasses import dataclass
import hashlib
import json
from pathlib import Path
import sys

from .common import Failure, State, validate_zip

LIMITS = {
    "maxUnits": 2000,
    "maxTextChars": 2_000_000,
    "maxAssets": 200,
    "maxAssetBytes": 20 * 1024 * 1024,
    "maxTotalAssetBytes": 100 * 1024 * 1024,
    "maxCells": 20_000,
    "maxZipEntries": 10_000,
    "maxZipUncompressedBytes": 512 * 1024 * 1024,
    "maxImagePixels": 16_777_216,
}
MAX_INPUT_BYTES = 256 * 1024 * 1024


@dataclass
class FileIOFailure(Failure):
    phase: str
    errno: int | None
    winerror: int | None


@contextmanager
def file_io_phase(phase):
    try:
        yield
    except OSError as error:
        raise FileIOFailure("PROCESSING_FAILED", str(error), phase, error.errno,
                            getattr(error, "winerror", None)) from error


def expand_current_home(value):
    """Expand a standalone ~ component while preserving literal ~name paths."""
    path = Path(value)
    if path.parts and path.parts[0] == "~":
        return Path.home().joinpath(*path.parts[1:])
    return path


def configure_utf8_output():
    # Windows pipes use the active code page even when the caller expects UTF-8.
    sys.stdout.reconfigure(encoding="utf-8", errors="backslashreplace")
    sys.stderr.reconfigure(encoding="utf-8", errors="backslashreplace")


def bounded_integer(maximum):
    def parse(value):
        try:
            number = int(value)
        except ValueError as error:
            raise argparse.ArgumentTypeError("must be an integer") from error
        if not 1 <= number <= maximum:
            raise argparse.ArgumentTypeError(f"must be between 1 and {maximum}")
        return number
    return parse


def page_numbers(value):
    result = []
    try:
        for term in value.split(","):
            parts = term.split("-")
            if len(parts) == 1:
                first = last = int(parts[0])
            elif len(parts) == 2:
                first, last = map(int, parts)
            else:
                raise ValueError()
            if first < 1 or last < first or last - first + len(result) >= LIMITS["maxUnits"]:
                raise ValueError()
            result.extend(range(first, last + 1))
        if not result or len(set(result)) != len(result):
            raise ValueError()
    except ValueError as error:
        raise argparse.ArgumentTypeError("use distinct 1-based slide numbers, e.g. 1,3-5") from error
    return result


def blocks(value):
    try:
        first, last = map(int, value.split("-"))
        if first < 1 or last < first:
            raise ValueError()
        return {"kind": "blocks", "start": first, "end": last}
    except ValueError as error:
        raise argparse.ArgumentTypeError("use a 1-based range such as 2-8") from error


def common_parser(description):
    parser = argparse.ArgumentParser(description=description)
    parser.add_argument("--input", required=True, help="Input .docx, .pptx, or .xlsx (read-only)")
    scope = parser.add_mutually_exclusive_group()
    scope.add_argument("--blocks", type=blocks, help="DOCX body block range, e.g. 2-8")
    scope.add_argument("--pages", type=page_numbers, help="PPTX slides, e.g. 1,3-5")
    scope.add_argument("--sheet", help="XLSX worksheet name")
    parser.add_argument("--range", dest="cell_range", help="XLSX bounded cell range; requires --sheet")
    return parser


def selection_for(args, document_format):
    if args.blocks:
        if document_format != "docx":
            raise Failure("UNSUPPORTED_SELECTION", "--blocks requires DOCX input.")
        selection = args.blocks
    elif args.pages:
        if document_format != "pptx":
            raise Failure("UNSUPPORTED_SELECTION", "--pages requires PPTX input.")
        selection = {"kind": "pages", "pages": args.pages}
    elif args.sheet:
        if document_format != "xlsx":
            raise Failure("UNSUPPORTED_SELECTION", "--sheet requires XLSX input.")
        selection = {"kind": "cells", "sheet": args.sheet}
        if args.cell_range:
            from openpyxl.utils import range_boundaries
            try:
                min_col, min_row, max_col, max_row = range_boundaries(args.cell_range)
                if None in (min_col, min_row, max_col, max_row) or min_col < 1 or min_row < 1 or max_col < min_col or max_row < min_row:
                    raise ValueError("range is not bounded and ordered")
            except (TypeError, ValueError) as error:
                raise Failure("UNSUPPORTED_SELECTION", "--range must be a bounded cell range, e.g. A1:D20.") from error
            selection["range"] = args.cell_range
    else:
        selection = None
    if args.cell_range and not args.sheet:
        raise Failure("UNSUPPORTED_SELECTION", "--range requires --sheet.")
    return selection


def file_facts(path):
    with file_io_phase("input_stat"):
        before = path.stat()
        if not path.is_file():
            raise Failure("INVALID_INPUT", "Input must be a regular file.")
    if before.st_size > MAX_INPUT_BYTES:
        raise Failure("INPUT_TOO_LARGE", f"Whole input is {before.st_size} bytes; limit is {MAX_INPUT_BYTES} bytes.")
    digest = hashlib.sha256()
    with file_io_phase("input_read"), path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    with file_io_phase("input_stat"):
        after = path.stat()
    if (before.st_dev, before.st_ino, before.st_size, before.st_mtime_ns) != (after.st_dev, after.st_ino, after.st_size, after.st_mtime_ns):
        raise Failure("SOURCE_CHANGED", "Input changed during reading.")
    return {"path": str(path), "bytes": after.st_size, "sha256": digest.hexdigest()}


def prepare(args, operation, limits=None):
    with file_io_phase("input_resolve"):
        path = expand_current_home(args.input).resolve(strict=True)
    document_format = path.suffix.lower().lstrip(".")
    if document_format not in ("docx", "pptx", "xlsx"):
        raise Failure("UNSUPPORTED_FORMAT", "Only DOCX, PPTX, and XLSX are supported; convert older formats first.")
    source = file_facts(path)
    request = {"operation": operation, "inputPath": str(path), "format": document_format,
               "sourceVersion": source["sha256"], "representation": "original", "limits": limits or LIMITS,
               "selection": selection_for(args, document_format)}
    with file_io_phase("input_archive"):
        validate_zip(request)
    return source, State(request)


def assert_unchanged(source):
    if file_facts(Path(source["path"])) != source:
        raise Failure("SOURCE_CHANGED", "Input changed during processing; the result was discarded.")


def result(state, source, key, data, layer, exclusions):
    return {"schemaVersion": 1, "ok": True, "operation": state.request["operation"],
            "format": state.request["format"], "source": source,
            "sourceFact": "SHA-256 describes the current input container, not a Host authorization or conversion history.",
            "coverage": {**state.coverage(), "layer": layer, "exclusions": exclusions},
            "partial": bool(state.omissions), "warnings": state.warnings, key: data}


def write_json_exclusive(path, value):
    stream = None
    try:
        with open(path, "x", encoding="utf-8") as stream:
            json.dump(value, stream, ensure_ascii=False, indent=2)
            stream.write("\n")
    except Exception:
        if stream is not None:
            Path(path).unlink(missing_ok=True)
        raise


def run_cli(main, operation):
    try:
        main()
    except Failure as error:
        detail = {"code": error.code, "message": error.message}
        if operation == "read" and isinstance(error, FileIOFailure):
            detail.update(phase=error.phase, errno=error.errno, winerror=error.winerror)
        print(json.dumps({"ok": False, "operation": operation, "error": detail}, ensure_ascii=False), file=sys.stderr)
        raise SystemExit(1) from error
    except (OSError, ValueError, KeyError) as error:
        print(json.dumps({"ok": False, "operation": operation, "error": {"code": "PROCESSING_FAILED", "message": str(error)}}, ensure_ascii=False), file=sys.stderr)
        raise SystemExit(1) from error
