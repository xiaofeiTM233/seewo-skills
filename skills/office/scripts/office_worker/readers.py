"""Read ordered document content without editing or recalculating inputs."""

import datetime
import math
from itertools import zip_longest

from .common import Failure, LimitReached, validate_selection


def read_docx(state):
    from docx import Document
    from docx.table import Table
    from docx.text.paragraph import Paragraph

    selection = validate_selection(state.request, "blocks")
    document = Document(state.request["inputPath"])
    body = document.element.body
    if body.xpath(".//w:ins | .//w:del | .//w:sdt | .//w:txbxContent"):
        state.warn("UNSUPPORTED_CONTENT", "Revision, content-control, or text-box content may be omitted.", omission=True)
    if body.xpath(".//w:altChunk"):
        state.warn("UNSUPPORTED_CONTENT", "Alternative-format embedded content is not read.", omission=True)
    if body.xpath(".//c:chart | .//dgm:relIds"):
        state.warn("UNSUPPORTED_CONTENT", "Chart or diagram content requires rendering.", omission=True)
    omitted = ("header", "footer", "footnotes", "endnotes", "comments")
    if any(any(rel.reltype.endswith("/" + kind) for kind in omitted) for rel in document.part.rels.values()):
        state.warn("UNSUPPORTED_CONTENT", "Headers, footers, notes, or comments are outside the body reader.", omission=True)
    blocks = list(document.iter_inner_content())
    first = selection["start"] if selection else 1
    last = selection["end"] if selection else len(blocks)
    if selection and (first < 1 or last < first or first > len(blocks)):
        raise Failure("UNSUPPORTED_SELECTION", "Document block range is invalid.")
    processed = []
    image_location = None
    try:
        for index, item in enumerate(blocks, 1):
            if not first <= index <= last:
                continue
            location = {"kind": "block", "block": index}
            if image_location is None and (item._element.xpath(".//a:blip") or
                    any(isinstance(element.tag, str) and element.tag.endswith("}imagedata") for element in item._element.iter())):
                image_location = location
            if isinstance(item, Paragraph):
                text = item.text
                state.add({"kind": "text", "location": location, "text": text,
                           "textStatus": "text" if text else "empty_or_graphics"})
            elif isinstance(item, Table):
                read_docx_table(state, item, location)
            processed.append(index)
    except LimitReached:
        pass
    text_parts = []
    for unit in state.units:
        if unit["kind"] == "text":
            text_parts.append(unit["text"])
        elif unit["kind"] == "table":
            text_parts.extend(cell["text"] for row in unit["rows"] for cell in row)
    if image_location is not None:
        state.warn("UNSUPPORTED_CONTENT", "Images were not interpreted; text in images requires OCR.", image_location, True)
    if image_location is not None and not any(part.strip() for part in text_parts):
        for unit in state.units:
            if unit["kind"] == "text" and unit["location"] == image_location:
                unit["textStatus"] = "needs_ocr"
                break
        state.warn("NEEDS_OCR", "Document image text requires OCR.", image_location, True)
    if processed:
        state.processed.append({"kind": "blocks", "start": processed[0], "end": processed[-1]})


def read_docx_table(state, table, location):
    from docx.table import Table

    rows = []
    positions = {}
    for row_index, row in enumerate(table.rows, 1):
        cells = []
        for column_index, cell in enumerate(row.cells, 1 + row.grid_cols_before):
            coordinate = {"row": row_index, "column": column_index}
            cell_location = {**location, "tablePath": [*location.get("tablePath", []), coordinate]}
            entry = {"location": cell_location, "text": cell.text}
            positions.setdefault(cell._tc, []).append((row_index, column_index, entry))
            cells.append(entry)
        rows.append(cells)
    for positions_for_cell in positions.values():
        origin_row, origin_column, origin = positions_for_cell[0]
        row_span = max(item[0] for item in positions_for_cell) - origin_row + 1
        col_span = max(item[1] for item in positions_for_cell) - origin_column + 1
        if row_span > 1:
            origin["rowSpan"] = row_span
        if col_span > 1:
            origin["columnSpan"] = col_span
        for _, _, other in positions_for_cell[1:]:
            other["mergedOrigin"] = {"row": origin_row, "column": origin_column}
            other["text"] = ""
    state.add({"kind": "table", "location": location, "rows": rows}, sum(len(row) for row in rows))
    seen = set()
    for row_index, row in enumerate(table.rows, 1):
        for column_index, cell in enumerate(row.cells, 1 + row.grid_cols_before):
            if cell._tc in seen:
                continue
            seen.add(cell._tc)
            for block_index, child in enumerate(cell.iter_inner_content(), 1):
                if isinstance(child, Table):
                    coordinate = {"row": row_index, "column": column_index, "block": block_index}
                    nested = {**location, "tablePath": [*location.get("tablePath", []), coordinate]}
                    read_docx_table(state, child, nested)


def read_pptx(state):
    from pptx import Presentation
    from pptx.enum.shapes import MSO_SHAPE_TYPE

    selection = validate_selection(state.request, "pages")
    presentation = Presentation(state.request["inputPath"])
    pages = selection["pages"] if selection else list(range(1, len(presentation.slides) + 1))
    if any(not isinstance(page, int) or isinstance(page, bool) or page < 1 or page > len(presentation.slides) for page in pages):
        raise Failure("UNSUPPORTED_SELECTION", "Slide selection is invalid.")
    processed = []
    try:
        for number in pages:
            slide = presentation.slides[number - 1]
            before = len(state.units)
            has_picture = False

            def walk(shapes):
                nonlocal has_picture
                for shape in shapes:
                    location = {"kind": "slide", "slide": number, "shapeId": str(shape.shape_id)}
                    if shape.shape_type == MSO_SHAPE_TYPE.GROUP:
                        walk(shape.shapes)
                        continue
                    if shape.shape_type == MSO_SHAPE_TYPE.PICTURE or shape._element.tag.endswith("}pic"):
                        has_picture = True
                    if shape.has_text_frame and shape.text_frame.text:
                        state.add({"kind": "text", "location": location, "text": shape.text_frame.text, "textStatus": "text"})
                    if shape.has_table:
                        rows = []
                        for row_index, row in enumerate(shape.table.rows, 1):
                            cells = []
                            for column_index, cell in enumerate(row.cells, 1):
                                cell_location = {**location, "tableCell": {"row": row_index, "column": column_index}}
                                item = {"location": cell_location, "text": cell.text}
                                if cell.is_merge_origin:
                                    if cell.span_height > 1:
                                        item["rowSpan"] = cell.span_height
                                    if cell.span_width > 1:
                                        item["columnSpan"] = cell.span_width
                                cells.append(item)
                            rows.append(cells)
                        state.add({"kind": "table", "location": location, "rows": rows}, sum(len(row) for row in rows))
                    if shape.has_chart:
                        state.warn("UNSUPPORTED_CONTENT", "Chart content requires rendering.", location, True)
                    elif shape.shape_type == MSO_SHAPE_TYPE.PLACEHOLDER and not shape.has_text_frame and not shape.has_table:
                        if shape._element.xpath(".//a:graphicData"):
                            state.warn("UNSUPPORTED_CONTENT", "Graphic content requires rendering.", location, True)
                    elif shape._element.tag.endswith("}graphicFrame") and not shape.has_table:
                        state.warn("UNSUPPORTED_CONTENT", "Graphic content requires rendering.", location, True)

            walk(slide.shapes)
            if has_picture:
                state.warn("UNSUPPORTED_CONTENT", "Slide images were not interpreted; text in images requires OCR.",
                           {"kind": "slide", "slide": number}, True)
            # Slide masters and layouts may contribute pictures absent from slide.shapes.
            if any(part.element.xpath(".//a:blip") for part in (slide.slide_layout, slide.slide_layout.slide_master)):
                state.warn("UNSUPPORTED_CONTENT", "Inherited layout or master images are not read as slide content.",
                           {"kind": "slide", "slide": number}, True)
            if len(state.units) == before:
                location = {"kind": "slide", "slide": number}
                state.add({"kind": "text", "location": location, "text": "",
                           "textStatus": "needs_ocr" if has_picture else "empty_or_graphics"})
                if has_picture:
                    state.warn("NEEDS_OCR", "Slide image text requires OCR.", location, True)
            if slide.has_notes_slide:
                frame = slide.notes_slide.notes_text_frame
                if frame is not None and frame.text.strip():
                    state.add({"kind": "text", "location": {"kind": "slide", "slide": number},
                               "role": "speaker_notes", "text": frame.text, "textStatus": "text"})
            processed.append(number)
    except LimitReached:
        pass
    if processed:
        state.processed.append({"kind": "pages", "pages": processed})


def scalar(value):
    if value is None:
        return None, "blank"
    if isinstance(value, bool):
        return value, "boolean"
    if isinstance(value, datetime.datetime):
        return value.isoformat(), "datetime"
    if isinstance(value, datetime.date):
        return value.isoformat(), "date"
    if isinstance(value, datetime.time):
        return value.isoformat(), "time"
    if isinstance(value, (int, float)):
        if isinstance(value, float) and not math.isfinite(value):
            raise ValueError("Non-finite spreadsheet value")
        return value, "number"
    if isinstance(value, str):
        return value, "string"
    raise ValueError("Unsupported spreadsheet cell value")


def read_xlsx(state):
    from openpyxl import load_workbook
    from openpyxl.utils import get_column_letter, range_boundaries

    selection = validate_selection(state.request, "cells")
    formulas = load_workbook(state.request["inputPath"], read_only=True, data_only=False, keep_links=False)
    cached = load_workbook(state.request["inputPath"], read_only=True, data_only=True, keep_links=False)
    try:
        names = [selection["sheet"]] if selection else formulas.sheetnames
        if any(name not in formulas.sheetnames for name in names):
            raise Failure("UNSUPPORTED_SELECTION", "Worksheet does not exist.")
        for name in names:
            sheet, values = formulas[name], cached[name]
            if selection and selection.get("range"):
                try:
                    min_col, min_row, max_col, max_row = range_boundaries(selection["range"])
                    if None in (min_col, min_row, max_col, max_row):
                        raise ValueError("Unbounded range")
                except (TypeError, ValueError) as error:
                    raise Failure("UNSUPPORTED_SELECTION", "Worksheet range is invalid.") from error
            else:
                min_col, min_row, max_col, max_row = 1, 1, sheet.max_column or 1, sheet.max_row or 1
            last_row = min_row - 1
            try:
                actual_rows = sheet.iter_rows(min_row=min_row, max_row=max_row, min_col=min_col, max_col=max_col)
                value_rows = values.iter_rows(min_row=min_row, max_row=max_row, min_col=min_col, max_col=max_col)
                for row_index, (row, cache_row) in enumerate(zip_longest(actual_rows, value_rows, fillvalue=()), min_row):
                    for column_index, (cell, cached_cell) in enumerate(zip_longest(row, cache_row, fillvalue=None), min_col):
                        if state.cells >= state.limits["maxCells"]:
                            state.warn("LIMIT_REACHED", f"Output would reach {state.cells + 1} worksheet cells; limit is {state.limits['maxCells']}.",
                                       {"kind": "cell", "sheet": name, "address": f"{get_column_letter(column_index)}{row_index}"}, True)
                            raise LimitReached()
                        state.cells += 1
                        raw = getattr(cell, "value", None)
                        if raw is None:
                            continue
                        location = {"kind": "cell", "sheet": name, "address": f"{get_column_letter(column_index)}{row_index}"}
                        try:
                            value, value_type = scalar(raw)
                        except ValueError:
                            state.warn("UNSUPPORTED_CONTENT", "Unsupported spreadsheet value was omitted.", location, True)
                            continue
                        if getattr(cell, "data_type", None) == "e":
                            value_type = "error"
                        unit = {"kind": "cell", "location": location, "value": value, "valueType": value_type, "text": str(value)}
                        if getattr(cell, "data_type", None) == "f":
                            unit["formula"] = value
                            saved = getattr(cached_cell, "value", None)
                            if saved is None:
                                state.warn("FORMULA_CACHE_UNAVAILABLE", "The formula has no distinguishable saved cached value.", location)
                            else:
                                try:
                                    unit["cachedValue"], _ = scalar(saved)
                                    unit["text"] += "\n" + str(unit["cachedValue"])
                                except ValueError:
                                    state.warn("FORMULA_CACHE_UNAVAILABLE", "The formula cache is unsupported.", location)
                        state.add(unit)
                    last_row = row_index
            except LimitReached:
                pass
            if last_row >= min_row:
                area = f"{get_column_letter(min_col)}{min_row}:{get_column_letter(max_col)}{last_row}"
                state.processed.append({"kind": "cells", "sheet": name, "range": area})
            if state.omissions and state.omissions[-1]["reason"] == "limit":
                break
    finally:
        formulas.close()
        cached.close()
