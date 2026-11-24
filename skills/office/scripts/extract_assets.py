#!/usr/bin/env python3
"""Extract referenced OOXML media to a new directory with an auditable manifest."""

import hashlib
import json
from pathlib import Path
import sys
from zipfile import ZIP_DEFLATED, ZipFile

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))
from office_worker.cli import assert_unchanged, common_parser, configure_utf8_output, expand_current_home, prepare, result, run_cli, write_json_exclusive

configure_utf8_output()
from office_worker.assets import collect_assets

LAYERS = {
    "docx": ("referenced media in body blocks", ["headers, footers, notes and comments", "revisions and alternate content may be incomplete"]),
    "pptx": ("referenced media in selected slide shapes, including groups", ["layout, master and speaker-note media", "charts and diagrams require rendering"]),
    "xlsx": ("referenced media in worksheet drawing anchors", ["absolute anchors and other non-drawing package parts", "charts and diagrams require rendering"]),
}


def main():
    parser = common_parser("Extract referenced DOCX, PPTX or XLSX media without fetching external links or executing macros.")
    parser.add_argument("--output-dir", required=True, help="A new directory for media and manifest.json; never overwrite")
    parser.add_argument("--type", choices=("all", "image", "audio", "video"), default="all", help="Media category (default: all)")
    parser.add_argument("--zip", action="store_true", help="Also create assets.zip containing the manifest and extracted files")
    args = parser.parse_args()
    source, state = prepare(args, "extract_assets")
    output_dir = expand_current_home(args.output_dir).absolute()
    output_dir.mkdir()  # Fails for every existing target, including symlinks.
    created = []
    try:
        state.request["outputDir"] = str(output_dir)
        assets = collect_assets(state, args.type)
        files = [asset["relativePath"] for asset in assets if "relativePath" in asset]
        created.extend(output_dir / name for name in files)
        assert_unchanged(source)
        layer, exclusions = LAYERS[state.request["format"]]
        manifest = result(state, source, "assets", assets, layer, exclusions)
        manifest["type"] = args.type
        manifest["files"] = files
        if args.zip:
            manifest["archive"] = {"path": "assets.zip", "entries": ["manifest.json", *files]}
        manifest_path = output_dir / "manifest.json"
        write_json_exclusive(manifest_path, manifest)
        created.append(manifest_path)
        response = {"ok": True, "manifest": str(manifest_path), "partial": manifest["partial"], "files": len(files)}
        if args.zip:
            archive_path = output_dir / "assets.zip"
            with ZipFile(archive_path, "x", compression=ZIP_DEFLATED) as archive:
                created.append(archive_path)
                for name in manifest["archive"]["entries"]:
                    archive.write(output_dir / name, name)
            digest = hashlib.sha256()
            with archive_path.open("rb") as stream:
                for chunk in iter(lambda: stream.read(1024 * 1024), b""):
                    digest.update(chunk)
            response["archive"] = {"path": str(archive_path), "sha256": digest.hexdigest()}
        print(json.dumps(response, ensure_ascii=False))
    except Exception:
        for path in reversed(created):
            path.unlink(missing_ok=True)
        try:
            output_dir.rmdir()
        except OSError:
            pass  # Preserve anything not created by this invocation.
        raise


if __name__ == "__main__":
    run_cli(main, "extract_assets")
