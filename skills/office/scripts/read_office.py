#!/usr/bin/env python3
"""Read a bounded, selected layer of an OOXML document without modifying it."""

import json
from pathlib import Path
import sys

# Isolated Python (-I) does not add the script directory to sys.path.
sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))
from office_worker.cli import (
    LIMITS,
    assert_unchanged,
    bounded_integer,
    common_parser,
    configure_utf8_output,
    file_io_phase,
    prepare,
    result,
    run_cli,
    write_json_exclusive,
)

configure_utf8_output()
from office_worker.readers import read_docx, read_pptx, read_xlsx

LAYERS = {
    "docx": ("body paragraphs and tables", ["headers, footers, footnotes, endnotes, comments", "revisions, text boxes and some embedded objects", "text in images"]),
    "pptx": ("slide shapes, tables and speaker notes", ["inherited layout/master content", "chart and diagram content", "text in images"]),
    "xlsx": ("worksheet cells, formulas and stored cached values", ["charts, drawings and calculated values not stored in the input"]),
}


def main():
    parser = common_parser("Read DOCX, PPTX or XLSX as structured JSON. No OCR, conversion or recalculation is performed.")
    parser.add_argument("--output", help="Write JSON to a new file instead of stdout; never overwrite")
    parser.add_argument("--max-units", type=bounded_integer(LIMITS["maxUnits"]), default=LIMITS["maxUnits"])
    parser.add_argument("--max-text-chars", type=bounded_integer(LIMITS["maxTextChars"]), default=LIMITS["maxTextChars"])
    parser.add_argument("--max-cells", type=bounded_integer(LIMITS["maxCells"]), default=LIMITS["maxCells"])
    args = parser.parse_args()
    limits = {**LIMITS, "maxUnits": args.max_units, "maxTextChars": args.max_text_chars, "maxCells": args.max_cells}
    source, state = prepare(args, "read", limits)
    with file_io_phase("document_parse"):
        {"docx": read_docx, "pptx": read_pptx, "xlsx": read_xlsx}[state.request["format"]](state)
    assert_unchanged(source)
    layer, exclusions = LAYERS[state.request["format"]]
    output = result(state, source, "units", state.units, layer, exclusions)
    output["limits"] = {"maxUnits": args.max_units, "maxTextChars": args.max_text_chars, "maxCells": args.max_cells}
    if args.output:
        with file_io_phase("output_write"):
            write_json_exclusive(args.output, output)
        with file_io_phase("output_resolve"):
            file = str(Path(args.output).resolve())
        print(json.dumps({"ok": True, "file": file, "partial": output["partial"]}, ensure_ascii=False))
    else:
        print(json.dumps(output, ensure_ascii=False))


if __name__ == "__main__":
    run_cli(main, "read")
