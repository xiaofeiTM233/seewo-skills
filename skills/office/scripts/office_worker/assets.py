"""Read OOXML relationships and export original, referenced media bytes."""

import hashlib
import mimetypes
import os
import posixpath
import warnings
from zipfile import ZipFile

from lxml import etree
from PIL import Image, UnidentifiedImageError

from .common import Failure, validate_selection

REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
PKG_REL = "http://schemas.openxmlformats.org/package/2006/relationships"
MAIN = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
DRAWING = "http://schemas.openxmlformats.org/drawingml/2006/main"
SPREADSHEET_DRAWING = "http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing"


def xml(archive, name):
    parser = etree.XMLParser(resolve_entities=False, no_network=True, load_dtd=False)
    return etree.fromstring(archive.read(name), parser)


def relationships(archive, source):
    folder, name = posixpath.split(source)
    rels_name = posixpath.join(folder, "_rels", name + ".rels")
    if rels_name not in archive.namelist():
        return {}
    result = {}
    for item in xml(archive, rels_name):
        rid, target = item.get("Id"), item.get("Target")
        if not rid or not target:
            continue
        external = item.get("TargetMode") == "External"
        resolved = target if external else posixpath.normpath(posixpath.join(folder, target.lstrip("/"))) if not target.startswith("/") else target.lstrip("/")
        if not external and (resolved == ".." or resolved.startswith("../")):
            raise Failure("INVALID_DOCUMENT", "Document contains an invalid media relationship.")
        result[rid] = {"target": resolved, "type": item.get("Type", ""), "external": external}
    return result


def relation_references(element):
    seen = set()
    for child in element.iter():
        for name, value in child.attrib.items():
            if name not in (f"{{{REL}}}embed", f"{{{REL}}}link", f"{{{REL}}}id"):
                continue
            owner = child
            while owner is not element and etree.QName(owner).localname not in ("pic", "pict", "graphicFrame"):
                owner = owner.getparent()
            key = (value, owner)
            if key not in seen:
                seen.add(key)
                yield value, owner


def image_transform(element):
    result = {}
    rect = next(element.iter(f"{{{DRAWING}}}srcRect"), None)
    if rect is not None:
        result["crop"] = {"left": int(rect.get("l", "0")) / 100000,
                          "top": int(rect.get("t", "0")) / 100000,
                          "right": int(rect.get("r", "0")) / 100000,
                          "bottom": int(rect.get("b", "0")) / 100000}
    transform = next(element.iter(f"{{{DRAWING}}}xfrm"), None)
    if transform is not None and transform.get("rot"):
        result["rotationDegrees"] = int(transform.get("rot")) / 60000
    return result


class AssetCollector:
    def __init__(self, state, archive):
        self.state = state
        self.archive = archive
        self.assets = {}
        self.targets = {}
        self.keys = {}

    def add(self, relation, location, transform=None):
        reltype = relation["type"].split("/")[-1].lower()
        if reltype not in ("image", "audio", "video", "media"):
            return
        target = relation["target"]
        external = relation["external"]
        if not external and target not in self.archive.namelist():
            self.state.warn("ASSET_COVERAGE_PARTIAL", "A media relationship has no packaged target.", location, True)
            return
        key = (external, target)
        asset_id = self.keys.get(key)
        if asset_id is None:
            if len(self.assets) >= self.state.limits["maxAssets"]:
                self.state.warn("LIMIT_REACHED", f"Output would reach {len(self.assets) + 1} assets; limit is {self.state.limits['maxAssets']}.", location, True)
                return
            digest = hashlib.sha256()
            too_large = not external and self.archive.getinfo(target).file_size > self.state.limits["maxAssetBytes"]
            if not external and not too_large:
                with self.archive.open(target) as source:
                    while True:
                        chunk = source.read(1024 * 1024)
                        if not chunk:
                            break
                        digest.update(chunk)
            identity = self.state.request["sourceVersion"] + "\0" + target + "\0" + digest.hexdigest()
            asset_id = hashlib.sha256(identity.encode("utf-8")).hexdigest()
            media_type = mimetypes.guess_type(target)[0] or "application/octet-stream"
            kind = reltype if reltype in ("image", "audio", "video") else media_type.split("/", 1)[0]
            extension = posixpath.splitext(target)[1].lower()
            if not extension or len(extension) > 12 or not extension[1:].isalnum():
                extension = mimetypes.guess_extension(media_type) or ".bin"
            candidate = {"assetId": asset_id, "representation": self.state.request["representation"],
                         "kind": kind, "mediaType": media_type, "suggestedName": "asset-" + asset_id + extension,
                         "uses": [], "status": "external" if external else "too_large" if too_large else "available"}
            if external:
                candidate["reference"] = target
                self.state.warn("EXTERNAL_REFERENCE_NOT_FETCHED", "An external media reference was not fetched.", location, True)
            else:
                candidate["packagePart"] = target
                if too_large:
                    self.state.warn("LIMIT_REACHED", f"Media part is {self.archive.getinfo(target).file_size} bytes; per-file output limit is {self.state.limits['maxAssetBytes']} bytes.", location, True)
            self.assets[asset_id] = candidate
            self.targets[asset_id] = target
            self.keys[key] = asset_id
        use = {"location": location}
        if transform:
            use.update(transform)
        self.assets[asset_id]["uses"].append(use)

    def add_render_required(self, location):
        identity = self.state.request["sourceVersion"] + "\0render\0" + str(location)
        asset_id = hashlib.sha256(identity.encode("utf-8")).hexdigest()
        if asset_id in self.assets:
            return
        if len(self.assets) >= self.state.limits["maxAssets"]:
            self.state.warn("LIMIT_REACHED", f"Output would reach {len(self.assets) + 1} assets; limit is {self.state.limits['maxAssets']}.", location, True)
            return
        self.assets[asset_id] = {"assetId": asset_id, "representation": "rendered", "kind": "image", "mediaType": "image/png",
                                 "suggestedName": "render-" + asset_id[:16] + ".png",
                                 "uses": [{"location": location}], "status": "render_required"}
        self.state.warn("RENDER_REQUIRED", "Chart or graphic requires page rendering.", location, True)

    def from_element(self, element, rels, location):
        for rid, owner in relation_references(element):
            relation = rels.get(rid)
            if relation:
                kind = relation["type"].split("/")[-1].lower()
                if kind in ("chart", "diagramdata", "diagramdrawing"):
                    self.add_render_required(location)
                else:
                    self.add(relation, location, image_transform(owner))

    def extract(self, ids):
        if len(ids) != len(set(ids)) or any(i not in self.assets or self.assets[i]["status"] != "available" for i in ids):
            raise Failure("ASSET_NOT_FOUND", "A requested asset is missing or is not extractable.")
        results, written, total = [], [], 0
        try:
            for asset_id in ids:
                item = self.assets[asset_id]
                info = self.archive.getinfo(self.targets[asset_id])
                if info.file_size > self.state.limits["maxAssetBytes"]:
                    raise Failure("OUTPUT_TOO_LARGE", f"Asset output is {info.file_size} bytes; per-file limit is {self.state.limits['maxAssetBytes']} bytes.")
                if total + info.file_size > self.state.limits["maxTotalAssetBytes"]:
                    raise Failure("OUTPUT_TOO_LARGE", f"Total asset output would be {total + info.file_size} bytes; limit is {self.state.limits['maxTotalAssetBytes']} bytes.")
                if item["mediaType"].startswith("image/"):
                    try:
                        with self.archive.open(info) as source, warnings.catch_warnings():
                            warnings.simplefilter("error", Image.DecompressionBombWarning)
                            with Image.open(source) as image:
                                if image.width * image.height > self.state.limits["maxImagePixels"]:
                                    raise Failure("OUTPUT_TOO_LARGE", f"Asset image has {image.width * image.height} pixels; limit is {self.state.limits['maxImagePixels']} pixels.")
                    except (Image.DecompressionBombError, Image.DecompressionBombWarning) as error:
                        raise Failure("OUTPUT_TOO_LARGE", f"Asset image exceeds the {self.state.limits['maxImagePixels']} pixel output limit: {error}") from error
                    except UnidentifiedImageError:
                        # Original vector/unknown image bytes can be exported without rasterizing.
                        pass
                filename = item["suggestedName"]
                destination = os.path.join(self.state.request["outputDir"], filename)
                digest = hashlib.sha256()
                size = 0
                with self.archive.open(info) as source, open(destination, "xb") as output:
                    written.append(destination)
                    while True:
                        chunk = source.read(1024 * 1024)
                        if not chunk:
                            break
                        size += len(chunk)
                        if size > self.state.limits["maxAssetBytes"]:
                            raise Failure("OUTPUT_TOO_LARGE", f"Asset output is at least {size} bytes; per-file limit is {self.state.limits['maxAssetBytes']} bytes.")
                        if total + size > self.state.limits["maxTotalAssetBytes"]:
                            raise Failure("OUTPUT_TOO_LARGE", f"Total asset output is at least {total + size} bytes; limit is {self.state.limits['maxTotalAssetBytes']} bytes.")
                        digest.update(chunk)
                        output.write(chunk)
                total += size
                results.append({**item, "relativePath": filename, "byteLength": size, "sha256": digest.hexdigest()})
            return results
        except Exception:
            for path in written:
                try:
                    os.unlink(path)
                except OSError:
                    pass
            raise


def docx_assets(state, collector):
    from docx import Document

    selection = validate_selection(state.request, "blocks")
    document = Document(state.request["inputPath"])
    blocks = list(document.iter_inner_content())
    first = selection["start"] if selection else 1
    last = selection["end"] if selection else len(blocks)
    if selection and (first < 1 or last < first or first > len(blocks)):
        raise Failure("UNSUPPORTED_SELECTION", "Document block range is invalid.")
    rels = relationships(collector.archive, str(document.part.partname).lstrip("/"))
    for index, block in enumerate(blocks, 1):
        if first <= index <= last:
            collector.from_element(block._element, rels, {"kind": "block", "block": index})
    if blocks:
        state.processed.append({"kind": "blocks", "start": first, "end": min(last, len(blocks))})
    if document.element.body.xpath(".//w:ins | .//w:del | .//w:sdt"):
        state.warn("ASSET_COVERAGE_PARTIAL", "Media in revisions or content controls may be omitted.", omission=True)
    if document.element.body.xpath(".//w:altChunk"):
        state.warn("ASSET_COVERAGE_PARTIAL", "Embedded alternative-format media was not scanned.", omission=True)
    if any(rel.reltype.endswith(("/header", "/footer", "/footnotes", "/endnotes", "/comments")) for rel in document.part.rels.values()):
        state.warn("ASSET_COVERAGE_PARTIAL", "Media outside the document body was not scanned.", omission=True)


def pptx_assets(state, collector):
    from pptx import Presentation
    from pptx.enum.shapes import MSO_SHAPE_TYPE

    selection = validate_selection(state.request, "pages")
    presentation = Presentation(state.request["inputPath"])
    pages = selection["pages"] if selection else list(range(1, len(presentation.slides) + 1))
    if any(not isinstance(page, int) or isinstance(page, bool) or page < 1 or page > len(presentation.slides) for page in pages):
        raise Failure("UNSUPPORTED_SELECTION", "Slide selection is invalid.")
    for page in pages:
        slide = presentation.slides[page - 1]
        rels = relationships(collector.archive, str(slide.part.partname).lstrip("/"))

        def walk(shapes):
            for shape in shapes:
                location = {"kind": "slide", "slide": page, "shapeId": str(shape.shape_id)}
                if shape.shape_type == MSO_SHAPE_TYPE.GROUP:
                    walk(shape.shapes)
                else:
                    collector.from_element(shape._element, rels, location)
                    if shape.has_chart:
                        collector.add_render_required(location)
                    elif shape._element.tag.endswith("}graphicFrame") and not shape.has_table:
                        collector.add_render_required(location)
        walk(slide.shapes)
        if slide._element.xpath("./p:cSld/p:bg//a:blip"):
            state.warn("ASSET_COVERAGE_PARTIAL", "Slide background media was not scanned.",
                       {"kind": "slide", "slide": page}, True)
        if any(part.element.xpath(".//a:blip") for part in (slide.slide_layout, slide.slide_layout.slide_master)):
            state.warn("ASSET_COVERAGE_PARTIAL", "Media inherited from a layout or master was not scanned.",
                       {"kind": "slide", "slide": page}, True)
        if slide.has_notes_slide and any(rel.reltype.endswith(("/image", "/audio", "/video", "/media"))
                                         for rel in slide.notes_slide.part.rels.values()):
            state.warn("ASSET_COVERAGE_PARTIAL", "Media in speaker notes was not scanned.",
                       {"kind": "slide", "slide": page}, True)
    if pages:
        state.processed.append({"kind": "pages", "pages": pages})


def xlsx_assets(state, collector):
    from openpyxl.utils import get_column_letter, range_boundaries

    selection = validate_selection(state.request, "cells")
    workbook_path = "xl/workbook.xml"
    workbook = xml(collector.archive, workbook_path)
    workbook_rels = relationships(collector.archive, workbook_path)
    sheets = []
    for sheet in workbook.findall(f".//{{{MAIN}}}sheet"):
        name, rid = sheet.get("name"), sheet.get(f"{{{REL}}}id")
        if name and rid in workbook_rels:
            sheets.append((name, workbook_rels[rid]["target"]))
    if selection and selection["sheet"] not in [name for name, _ in sheets]:
        raise Failure("UNSUPPORTED_SELECTION", "Worksheet does not exist.")
    bounds = None
    if selection and selection.get("range"):
        try:
            bounds = range_boundaries(selection["range"])
            if None in bounds:
                raise ValueError("Unbounded range")
        except (TypeError, ValueError) as error:
            raise Failure("UNSUPPORTED_SELECTION", "Worksheet range is invalid.") from error
    for name, sheet_path in sheets:
        if selection and name != selection["sheet"]:
            continue
        sheet_rels = relationships(collector.archive, sheet_path)
        for rel in sheet_rels.values():
            if rel["external"] or not rel["type"].endswith("/drawing"):
                continue
            drawing_path = rel["target"]
            drawing_rels = relationships(collector.archive, drawing_path)
            drawing = xml(collector.archive, drawing_path)
            for anchor in drawing:
                start = anchor.find(f"{{{SPREADSHEET_DRAWING}}}from")
                if start is None:
                    state.warn("ASSET_COVERAGE_PARTIAL", "An absolute drawing anchor has no worksheet cell location.", omission=True)
                    continue
                row = int(start.findtext(f"{{{SPREADSHEET_DRAWING}}}row", "0")) + 1
                col = int(start.findtext(f"{{{SPREADSHEET_DRAWING}}}col", "0")) + 1
                if bounds and not (bounds[0] <= col <= bounds[2] and bounds[1] <= row <= bounds[3]):
                    continue
                location = {"kind": "cell", "sheet": name, "address": f"{get_column_letter(col)}{row}"}
                collector.from_element(anchor, drawing_rels, location)
                if any(element.tag.endswith("}graphicFrame") for element in anchor.iter()):
                    collector.add_render_required(location)
        processed = {"kind": "cells", "sheet": name}
        if selection and selection.get("range"):
            processed["range"] = selection["range"]
        state.processed.append(processed)


def collect_assets(state, asset_type="all"):
    with ZipFile(state.request["inputPath"]) as archive:
        collector = AssetCollector(state, archive)
        {"docx": docx_assets, "pptx": pptx_assets, "xlsx": xlsx_assets}[state.request["format"]](state, collector)
        assets = [item for item in collector.assets.values()
                  if asset_type == "all" or item["kind"] == asset_type]
        available = [item["assetId"] for item in assets if item["status"] == "available"]
        extracted = {item["assetId"]: item for item in collector.extract(available)}
        return [extracted.get(item["assetId"], item) for item in assets]
