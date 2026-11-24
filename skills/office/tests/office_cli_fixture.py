"""Exercise the Office helpers through their public command-line interfaces."""

import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from zipfile import ZIP_DEFLATED, ZipFile

from docx import Document
from docx.oxml import OxmlElement
from lxml import etree
from PIL import Image
from pptx import Presentation
from pptx.opc.constants import RELATIONSHIP_TYPE
from pptx.oxml.ns import qn
from pptx.util import Inches
from xlsxwriter import Workbook

SCRIPTS = Path(__file__).resolve().parents[1] / "scripts"
MIB = 1024 * 1024
INPUT_LIMIT = 256 * MIB
ZIP_LIMIT = 512 * MIB

# -I ignores PYTHONIOENCODING. Force legacy pipe encodings before the actual
# entrypoint starts, including on systems whose normal pipes already use UTF-8.
LEGACY_PIPE = (
    "import runpy,sys;"
    "sys.stdout.reconfigure(encoding='cp1252',errors='strict');"
    "sys.stderr.reconfigure(encoding='cp1252',errors='strict');"
    "sys.argv=sys.argv[1:];runpy.run_path(sys.argv[0],run_name='__main__')"
)


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


class OfficeCLITest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="office-cli-中文 ")
        self.root = Path(self.temp.name)
        self.image = self.root / "picture.png"
        Image.new("RGB", (4, 4), "red").save(self.image)

    def tearDown(self):
        self.temp.cleanup()

    def execute(self, script, *args, cwd=None, legacy_pipe=False):
        command = [sys.executable, "-I", "-B"]
        env = os.environ.copy()
        if legacy_pipe:
            env.update({"LC_ALL": "C", "PYTHONUTF8": "0", "PYTHONIOENCODING": "cp1252"})
            command.extend(["-X", "utf8=0", "-c", LEGACY_PIPE])
        command.extend([str(SCRIPTS / script), *map(str, args)])
        return subprocess.run(command, capture_output=True, timeout=30, cwd=cwd, env=env)

    def invoke(self, script, *args, ok=True, cwd=None, legacy_pipe=False):
        completed = self.execute(script, *args, cwd=cwd, legacy_pipe=legacy_pipe)
        stdout = completed.stdout.decode("utf-8")
        stderr = completed.stderr.decode("utf-8")
        if not ok:
            self.assertNotEqual(completed.returncode, 0, stdout)
            return json.loads(stderr)
        self.assertEqual(completed.returncode, 0, stderr)
        return json.loads(stdout)

    def extract_and_check(self, source, out, *options):
        original_hash = sha(source)
        response = self.invoke("extract_assets.py", "--input", source, "--output-dir", out, "--zip", *options)
        self.assertEqual(sha(source), original_hash)
        manifest_path = Path(response["manifest"])
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        self.assertEqual(manifest["source"]["sha256"], original_hash)
        available = [asset for asset in manifest["assets"] if asset["status"] == "available"]
        self.assertEqual(set(manifest["files"]), {asset["relativePath"] for asset in available})
        self.assertEqual(len(manifest["files"]), len(set(manifest["files"])))
        self.assertEqual(response["files"], len(available))
        archive_path = Path(response["archive"]["path"])
        self.assertEqual(response["archive"]["sha256"], sha(archive_path))
        with ZipFile(archive_path) as archive:
            self.assertEqual(set(archive.namelist()), set(manifest["archive"]["entries"]))
            self.assertEqual(json.loads(archive.read("manifest.json").decode("utf-8")), manifest)
            for asset in available:
                file = out / asset["relativePath"]
                self.assertEqual(asset["sha256"], sha(file))
                self.assertEqual(asset["byteLength"], file.stat().st_size)
                self.assertEqual(archive.read(asset["relativePath"]), file.read_bytes())
        return manifest

    def test_tilde_paths_keep_literal_names_and_expand_current_home(self):
        source = self.root / "~office-literal-fixture.docx"
        doc = Document()
        doc.add_paragraph("tilde fixture")
        doc.add_picture(str(self.image))
        doc.save(source)
        for relative in ("~office-literal-fixture.docx", "./~office-literal-fixture.docx"):
            result = self.invoke("read_office.py", "--input", relative, cwd=self.root)
            self.assertEqual(Path(result["source"]["path"]), source.resolve())
            self.assertEqual(result["units"][0]["text"], "tilde fixture")
        for relative in ("~office-assets", "./~office-assets-second"):
            response = self.invoke("extract_assets.py", "--input", source, "--output-dir", relative, cwd=self.root)
            self.assertEqual(Path(response["manifest"]).resolve(), (self.root / relative / "manifest.json").resolve())
            self.assertEqual(response["files"], 1)

        with tempfile.TemporaryDirectory(prefix="office-tilde-test-", dir=Path.home()) as directory:
            home_fixture = Path(directory)
            home_source = home_fixture / "source.docx"
            doc.save(home_source)
            relative_source = str(Path("~") / home_fixture.name / "source.docx")
            data = self.invoke("read_office.py", "--input", relative_source, cwd=self.root)
            self.assertEqual(Path(data["source"]["path"]), home_source.resolve())
            relative_output = str(Path("~") / home_fixture.name / "assets")
            response = self.invoke("extract_assets.py", "--input", relative_source, "--output-dir", relative_output, cwd=self.root)
            self.assertEqual(Path(response["manifest"]), home_fixture / "assets" / "manifest.json")
            self.assertEqual(response["files"], 1)

    def test_docx_body_range_table_and_partial(self):
        source = self.root / "source.docx"
        doc = Document()
        doc.add_paragraph("before")
        doc.add_table(rows=1, cols=1).cell(0, 0).text = "table value"
        doc.add_paragraph("after")
        doc.add_picture(str(self.image))
        doc.save(source)
        before = sha(source)
        data = self.invoke("read_office.py", "--input", source, "--blocks", "1-2")
        self.assertEqual(data["coverage"]["requested"], {"kind": "blocks", "start": 1, "end": 2})
        self.assertEqual(data["coverage"]["processed"][0]["end"], 2)
        self.assertEqual(data["units"][0]["text"], "before")
        self.assertEqual(data["units"][1]["rows"][0][0]["text"], "table value")
        limited = self.invoke("read_office.py", "--input", source, "--max-units", "1")
        self.assertTrue(limited["partial"])
        self.assertIn("LIMIT_REACHED", [warning["code"] for warning in limited["warnings"]])
        warning = next(warning for warning in limited["warnings"] if warning["code"] == "LIMIT_REACHED")
        self.assertIn("2 units", warning["message"])
        self.assertIn("limit is 1", warning["message"])
        full = self.invoke("read_office.py", "--input", source)
        self.assertTrue(full["partial"], "image content is outside the text reader")
        saved = self.root / "body.json"
        self.invoke("read_office.py", "--input", source, "--output", saved)
        self.assertEqual(json.loads(saved.read_text(encoding="utf-8"))["source"]["sha256"], before)
        initial = saved.read_bytes()
        self.invoke("read_office.py", "--input", source, "--output", saved, ok=False)
        self.assertEqual(saved.read_bytes(), initial)
        assets = self.extract_and_check(source, self.root / "doc-assets")
        asset = next(asset for asset in assets["assets"] if asset["status"] == "available")
        self.assertEqual((self.root / "doc-assets" / asset["relativePath"]).read_bytes(), self.image.read_bytes())
        self.assertEqual(asset["uses"][0]["location"]["block"], 4)
        self.assertEqual(sha(source), before)

    def test_pptx_group_notes_reused_image_and_master_omission(self):
        source = self.root / "slides.pptx"
        deck = Presentation()
        slide = deck.slides.add_slide(deck.slide_layouts[6])
        group = slide.shapes.add_group_shape()
        group.shapes.add_textbox(Inches(1), Inches(1), Inches(3), Inches(1)).text = "group text"
        picture = group.shapes.add_picture(str(self.image), Inches(1), Inches(2))
        picture.crop_left = 0.2
        picture.rotation = 45
        group.shapes.add_picture(str(self.image), Inches(3), Inches(2))
        table = slide.shapes.add_table(1, 2, Inches(1), Inches(4), Inches(4), Inches(1)).table
        table.cell(0, 0).text = "table left"
        table.cell(0, 1).text = "table right"
        slide.notes_slide.notes_text_frame.text = "speaker note"
        second = deck.slides.add_slide(deck.slide_layouts[6])
        inherited = second.shapes.add_picture(str(self.image), Inches(1), Inches(1))
        blip = inherited._element.xpath(".//a:blip")[0]
        media = second.part.related_part(blip.get(qn("r:embed")))
        master = second.slide_layout.slide_master
        blip.set(qn("r:embed"), master.part.relate_to(media, RELATIONSHIP_TYPE.IMAGE))
        master.shapes._spTree.insert_element_before(inherited._element, "p:extLst")
        deck.save(source)
        data = self.invoke("read_office.py", "--input", source, "--pages", "1")
        self.assertEqual(data["coverage"]["processed"][0]["pages"], [1])
        self.assertIn("group text", [unit.get("text") for unit in data["units"]])
        self.assertEqual(next(unit["text"] for unit in data["units"] if unit.get("role") == "speaker_notes"), "speaker note")
        table_unit = next(unit for unit in data["units"] if unit["kind"] == "table")
        self.assertEqual([cell["text"] for cell in table_unit["rows"][0]], ["table left", "table right"])
        self.assertEqual(table_unit["location"]["slide"], 1)
        manifest = self.extract_and_check(source, self.root / "slide-assets", "--pages", "1", "--type", "image")
        asset = next(asset for asset in manifest["assets"] if asset["status"] == "available")
        self.assertEqual(len(asset["uses"]), 2)
        self.assertEqual(asset["uses"][0]["crop"]["left"], 0.2)
        self.assertEqual(asset["uses"][0]["rotationDegrees"], 45)
        all_slides = self.extract_and_check(source, self.root / "all-slides")
        self.assertTrue(all_slides["partial"])
        self.assertIn("ASSET_COVERAGE_PARTIAL", [warning["code"] for warning in all_slides["warnings"]])

    def test_pptx_reports_permission_error_at_the_failed_input_step(self):
        source = self.root / "source.pptx"
        Presentation().save(source)
        simulate_denial = """
import errno, runpy, sys
from pathlib import Path
from unittest.mock import patch

method, script, source = sys.argv[1:]
original = getattr(Path, method)
def deny_source(path, *args, **kwargs):
    if path.name == Path(source).name:
        error = PermissionError(errno.EACCES, "fixture denied", str(path))
        error.winerror = 5
        raise error
    return original(path, *args, **kwargs)

sys.argv = [script, "--input", source]
with patch.object(Path, method, deny_source):
    runpy.run_path(script, run_name="__main__")
"""
        for method, phase in (("resolve", "input_resolve"), ("stat", "input_stat")):
            with self.subTest(phase=phase):
                result = subprocess.run(
                    [sys.executable, "-I", "-B", "-c", simulate_denial, method,
                     str(SCRIPTS / "read_office.py"), str(source)],
                    capture_output=True, timeout=30,
                )
                self.assertEqual(result.returncode, 1)
                self.assertEqual(result.stdout, b"")
                error = json.loads(result.stderr)["error"]
                self.assertEqual(error["code"], "PROCESSING_FAILED")
                self.assertEqual(error["phase"], phase)
                self.assertEqual(error["winerror"], 5)
                self.assertEqual(error["errno"], 13)

    def test_xlsx_formula_cache_range_and_picture(self):
        source = self.root / "sheet.xlsx"
        book = Workbook(str(source))
        sheet = book.add_worksheet("Data")
        sheet.write("A1", 42)
        sheet.write_formula("B1", "=A1*2", None, 84)
        sheet.insert_image("C2", str(self.image))
        book.add_worksheet("Other").write("A1", "not selected")
        book.close()
        data = self.invoke("read_office.py", "--input", source, "--sheet", "Data", "--range", "A1:C3")
        formula = next(unit for unit in data["units"] if unit["location"]["address"] == "B1")
        self.assertEqual((formula["formula"], formula["cachedValue"]), ("=A1*2", 84))
        self.assertEqual(data["coverage"]["processed"][0]["sheet"], "Data")
        assets = self.extract_and_check(source, self.root / "sheet-assets", "--sheet", "Data", "--range", "A1:C3")
        asset = next(asset for asset in assets["assets"] if asset["status"] == "available")
        self.assertEqual(asset["uses"][0]["location"]["address"], "C2")
        self.assertEqual((self.root / "sheet-assets" / asset["relativePath"]).read_bytes(), self.image.read_bytes())

    def test_external_image_is_reported_without_a_request(self):
        class Handler(BaseHTTPRequestHandler):
            requests = 0
            def do_GET(self):
                type(self).requests += 1
                self.send_error(404)
            def log_message(self, *_args):
                pass
        server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            source = self.root / "external.docx"
            doc = Document()
            doc.add_picture(str(self.image))
            doc.save(source)
            with ZipFile(source) as archive:
                files = {name: archive.read(name) for name in archive.namelist()}
            rel_ns = "http://schemas.openxmlformats.org/package/2006/relationships"
            office_rel = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
            drawing_ns = "http://schemas.openxmlformats.org/drawingml/2006/main"
            body = etree.fromstring(files["word/document.xml"])
            blip = body.find(f".//{{{drawing_ns}}}blip")
            rel_id = blip.attrib.pop(f"{{{office_rel}}}embed")
            blip.set(f"{{{office_rel}}}link", rel_id)
            files["word/document.xml"] = etree.tostring(body)
            relations = etree.fromstring(files["word/_rels/document.xml.rels"])
            relation = next(item for item in relations.findall(f"{{{rel_ns}}}Relationship") if item.get("Id") == rel_id)
            relation.set("TargetMode", "External")
            relation.set("Target", f"http://127.0.0.1:{server.server_port}/image")
            files["word/_rels/document.xml.rels"] = etree.tostring(relations)
            with ZipFile(source, "w") as archive:
                for name, data in files.items():
                    archive.writestr(name, data)
            self.invoke("read_office.py", "--input", source)
            assets = self.extract_and_check(source, self.root / "external-assets", "--type", "image")
            self.assertEqual(Handler.requests, 0)
            self.assertTrue(assets["partial"])
            self.assertEqual(assets["assets"][0]["status"], "external")
            self.assertEqual(assets["files"], [])
        finally:
            server.shutdown()
            server.server_close()
            thread.join()

    def test_utf8_pipes_files_and_relative_paths_with_legacy_parent(self):
        cwd = self.root / "工作 空间 [甲] & 😀"
        cwd.mkdir()
        source = cwd / "中 文 [报告] & 😀.docx"
        doc = Document()
        doc.add_paragraph("中文内容 😀")
        doc.add_picture(str(self.image))
        doc.save(source)
        before = sha(source)

        data = self.invoke("read_office.py", "--input", source.name, cwd=cwd, legacy_pipe=True)
        self.assertEqual(data["source"]["path"], str(source.resolve()))
        self.assertIn("中文内容 😀", [unit.get("text") for unit in data["units"]])

        output = cwd / "输出 & 😀.json"
        self.invoke("read_office.py", "--input", source.name, "--output", output.name, cwd=cwd, legacy_pipe=True)
        output_bytes = output.read_bytes()
        saved = json.loads(output_bytes.decode("utf-8"))
        self.assertEqual(saved["source"]["sha256"], before)
        self.assertIn("中文内容 😀", [unit.get("text") for unit in saved["units"]])
        error = self.invoke("read_office.py", "--input", source.name, "--output", output.name,
                            cwd=cwd, legacy_pipe=True, ok=False)
        self.assertEqual(error["operation"], "read")
        self.assertIn("😀", error["error"]["message"])
        self.assertEqual(output.read_bytes(), output_bytes)

        out = cwd / "素材 [图片] & 😀"
        response = self.invoke("extract_assets.py", "--input", source.name, "--output-dir", out.name,
                               cwd=cwd, legacy_pipe=True)
        manifest = json.loads(Path(response["manifest"]).read_bytes().decode("utf-8"))
        self.assertEqual(manifest["source"]["sha256"], before)
        self.assertEqual(manifest["source"]["path"], str(source.resolve()))
        self.assertEqual(response["files"], 1)
        error = self.invoke("extract_assets.py", "--input", source.name, "--output-dir", out.name,
                            cwd=cwd, legacy_pipe=True, ok=False)
        self.assertEqual(error["operation"], "extract_assets")
        self.assertIn("😀", error["error"]["message"])
        self.assertEqual(json.loads(Path(response["manifest"]).read_bytes().decode("utf-8")), manifest)
        self.assertEqual(sha(source), before)

        for script in ("read_office.py", "extract_assets.py"):
            # argparse writes errors before the script's JSON error handler.
            args = ["--input", source.name, "--错误😀"]
            if script == "extract_assets.py":
                args.extend(["--output-dir", "unused"])
            completed = self.execute(script, *args, cwd=cwd, legacy_pipe=True)
            self.assertEqual(completed.returncode, 2)
            self.assertIn("--错误😀", completed.stderr.decode("utf-8"))

    def test_input_size_and_archive_limits_apply_before_page_selection(self):
        source = self.root / "oversized.pptx"
        with source.open("wb") as stream:
            stream.truncate(INPUT_LIMIT)
        # At exactly 256 MiB this invalid container passes input-size admission.
        at_limit = self.invoke("read_office.py", "--input", source, "--pages", "1", ok=False)
        self.assertEqual(at_limit["error"]["code"], "INVALID_DOCUMENT")
        with source.open("r+b") as stream:
            stream.truncate(INPUT_LIMIT + 1)
        for script, operation in (("read_office.py", "read"), ("extract_assets.py", "extract_assets")):
            args = ["--input", source, "--pages", "1"]
            if operation == "extract_assets":
                args.extend(["--output-dir", self.root / "not-created"])
            error = self.invoke(script, *args, ok=False)
            self.assertEqual(error["operation"], operation)
            self.assertEqual(error["error"]["code"], "INPUT_TOO_LARGE")
            self.assertIn(str(INPUT_LIMIT + 1), error["error"]["message"])
            self.assertIn(str(INPUT_LIMIT), error["error"]["message"])
            self.assertIn("Whole input", error["error"]["message"])
        self.assertFalse((self.root / "not-created").exists())
        self.assertEqual(source.stat().st_size, INPUT_LIMIT + 1)

        entries = self.root / "entries.pptx"
        with ZipFile(entries, "w") as archive:
            for index in range(10_001):
                archive.writestr(f"entry-{index}", b"")
        error = self.invoke("read_office.py", "--input", entries, "--pages", "1", ok=False)
        self.assertEqual(error["error"]["code"], "INPUT_TOO_LARGE")
        self.assertIn("10001 entries", error["error"]["message"])
        self.assertIn("10000 entries", error["error"]["message"])

    def test_declared_zip_expansion_at_and_over_limit(self):
        source = self.root / "budget.docx"
        doc = Document()
        doc.add_paragraph("budget accepted")
        doc.save(source)
        with ZipFile(source, "a", compression=ZIP_DEFLATED, compresslevel=1) as archive:
            remaining = ZIP_LIMIT - sum(entry.file_size for entry in archive.infolist())
            with archive.open("unused/padding.bin", "w") as entry:
                chunk = bytes(MIB)
                while remaining:
                    amount = min(remaining, len(chunk))
                    entry.write(chunk[:amount])
                    remaining -= amount
        with ZipFile(source) as archive:
            self.assertEqual(sum(entry.file_size for entry in archive.infolist()), ZIP_LIMIT)
        data = self.invoke("read_office.py", "--input", source, "--blocks", "1-1")
        self.assertEqual(data["units"][0]["text"], "budget accepted")
        assets = self.invoke("extract_assets.py", "--input", source, "--blocks", "1-1",
                             "--output-dir", self.root / "zip-at-limit")
        self.assertEqual(assets["files"], 0)

        with ZipFile(source, "a") as archive:
            archive.writestr("unused/one-more-byte.bin", b"x")
        for script, operation in (("read_office.py", "read"), ("extract_assets.py", "extract_assets")):
            args = ["--input", source, "--blocks", "1-1"]
            if operation == "extract_assets":
                args.extend(["--output-dir", self.root / "zip-over-limit"])
            error = self.invoke(script, *args, ok=False)
            self.assertEqual(error["operation"], operation)
            self.assertEqual(error["error"]["code"], "INPUT_TOO_LARGE")
            self.assertIn(str(ZIP_LIMIT + 1), error["error"]["message"])
            self.assertIn(str(ZIP_LIMIT), error["error"]["message"])
            self.assertIn("expanded bytes", error["error"]["message"])
        self.assertFalse((self.root / "zip-over-limit").exists())

    def test_output_limits_report_attempted_values_and_keep_partial_semantics(self):
        source = self.root / "content.docx"
        doc = Document()
        doc.add_paragraph("中😀文档")
        doc.save(source)
        data = self.invoke("read_office.py", "--input", source, "--max-text-chars", "3")
        self.assertTrue(data["partial"])
        self.assertEqual(data["units"][0]["text"], "中😀")
        warning = next(warning for warning in data["warnings"] if warning["code"] == "LIMIT_REACHED")
        self.assertIn("5 UTF-16 units", warning["message"])
        self.assertIn("limit is 3", warning["message"])
        self.assertIn("limit", [item["reason"] for item in data["coverage"]["omissions"]])

        doc = Document()
        doc.sections[0].header.paragraphs[0].text = "outside the reader"
        doc.add_paragraph("first")
        doc.add_paragraph("second")
        source = self.root / "warnings.docx"
        doc.save(source)
        data = self.invoke("read_office.py", "--input", source, "--max-units", "1")
        self.assertTrue(data["partial"])
        warning = next(warning for warning in data["warnings"] if warning["code"] == "LIMIT_REACHED")
        self.assertIn("2 units", warning["message"])
        self.assertIn("limit is 1", warning["message"])
        self.assertIn("warnings may be omitted", warning["message"])

        sheet = self.root / "cells.xlsx"
        book = Workbook(str(sheet))
        book.add_worksheet("Data").write_row("A1", [1, 2])
        book.close()
        data = self.invoke("read_office.py", "--input", sheet, "--sheet", "Data", "--range", "A1:B1", "--max-cells", "1")
        self.assertTrue(data["partial"])
        warning = next(warning for warning in data["warnings"] if warning["code"] == "LIMIT_REACHED")
        self.assertIn("2 worksheet cells", warning["message"])
        self.assertIn("limit is 1", warning["message"])

        image = self.root / "large.png"
        with image.open("wb") as stream:
            stream.write(self.image.read_bytes())
            stream.truncate(20 * MIB + 1)
        doc = Document()
        doc.add_picture(str(image))
        source = self.root / "asset.docx"
        doc.save(source)
        response = self.invoke("extract_assets.py", "--input", source, "--output-dir", self.root / "large-asset")
        manifest = json.loads(Path(response["manifest"]).read_bytes().decode("utf-8"))
        self.assertTrue(manifest["partial"])
        self.assertEqual(manifest["assets"][0]["status"], "too_large")
        warning = next(warning for warning in manifest["warnings"] if warning["code"] == "LIMIT_REACHED")
        self.assertIn(str(20 * MIB + 1), warning["message"])
        self.assertIn(str(20 * MIB), warning["message"])

        pixels = self.root / "pixels.png"
        Image.new("1", (4097, 4097)).save(pixels)
        doc = Document()
        doc.add_picture(str(pixels))
        source = self.root / "pixels.docx"
        doc.save(source)
        before = sha(source)
        error = self.invoke("extract_assets.py", "--input", source, "--output-dir", self.root / "pixel-output", ok=False)
        self.assertEqual(error["error"]["code"], "OUTPUT_TOO_LARGE")
        self.assertIn(str(4097 * 4097), error["error"]["message"])
        self.assertIn(str(16_777_216), error["error"]["message"])
        self.assertFalse((self.root / "pixel-output").exists())
        self.assertEqual(sha(source), before)

    def test_conflicts_and_invalid_scopes_are_rejected(self):
        source = self.root / "source.docx"
        doc = Document()
        doc.add_paragraph("keep")
        doc.save(source)
        out = self.root / "exists"
        out.mkdir()
        keep = out / "keep.txt"
        keep.write_text("preserve", encoding="utf-8")
        self.invoke("extract_assets.py", "--input", source, "--output-dir", out, ok=False)
        self.assertEqual(keep.read_text(encoding="utf-8"), "preserve")
        self.invoke("read_office.py", "--input", source, "--pages", "1", ok=False)
        self.invoke("read_office.py", "--input", source, "--range", "A1:B2", ok=False)
        for script in ("read_office.py", "extract_assets.py"):
            completed = self.execute(script, "--help")
            self.assertEqual(completed.returncode, 0)
            self.assertIn("--input", completed.stdout.decode("utf-8"))


if __name__ == "__main__":
    unittest.main()
