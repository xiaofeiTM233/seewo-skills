"""Shared bounds and response types for the fixed readers."""

from dataclasses import dataclass
from zipfile import BadZipFile, ZipFile


@dataclass
class Failure(Exception):
    code: str
    message: str


class LimitReached(Exception):
    pass


def utf16_length(text):
    return len(text.encode("utf-16-le", "surrogatepass")) // 2


class State:
    def __init__(self, request):
        self.request = request
        self.limits = request["limits"]
        self.units = []
        self.warnings = []
        self.omissions = []
        self.processed = []
        self.characters = 0
        self.cells = 0
        self.warning_limit_reached = False

    def warn(self, code, message, location=None, omission=False):
        if len(self.warnings) >= self.limits["maxUnits"]:
            if not self.warning_limit_reached:
                self.warning_limit_reached = True
                self.warnings.append({"code": "LIMIT_REACHED", "message": f"Document warnings would reach {len(self.warnings) + 1}; limit is {self.limits['maxUnits']}. Additional warnings were omitted."})
                self.omissions.append({"reason": "limit"})
            if code == "LIMIT_REACHED":
                warning = {"code": code, "message": f"{message} Some document warnings may be omitted; warning limit is {self.limits['maxUnits']}."}
                if location is not None:
                    warning["location"] = location
                self.warnings[-1] = warning
            return
        warning = {"code": code, "message": message}
        if location is not None:
            warning["location"] = location
        if warning not in self.warnings:
            self.warnings.append(warning)
        if omission:
            reason = {"LIMIT_REACHED": "limit", "NEEDS_OCR": "needs_ocr"}.get(code, "unsupported_content")
            item = {"reason": reason}
            if location is not None:
                item["location"] = location
            if item not in self.omissions:
                self.omissions.append(item)

    def add(self, unit, cells=0):
        texts = [unit.get("text", "")]
        if unit["kind"] == "table":
            texts = [cell["text"] for row in unit["rows"] for cell in row]
        count = sum(utf16_length(text) for text in texts)
        remaining = self.limits["maxTextChars"] - self.characters
        attempted_chars = self.characters + count
        if (unit["kind"] == "text" and count > remaining and remaining > 0 and
            len(self.units) < self.limits["maxUnits"] and self.cells + cells <= self.limits["maxCells"]):
            end = 0
            used = 0
            for character in unit["text"]:
                length = utf16_length(character)
                if used + length > remaining:
                    break
                used += length
                end += 1
            self.units.append({**unit, "text": unit["text"][:end]})
            self.characters += used
            self.warn("LIMIT_REACHED", f"Output content would reach {attempted_chars} UTF-16 units; limit is {self.limits['maxTextChars']}.", unit["location"], True)
            raise LimitReached()
        if (len(self.units) >= self.limits["maxUnits"] or
            self.characters + count > self.limits["maxTextChars"] or
            self.cells + cells > self.limits["maxCells"]):
            if len(self.units) >= self.limits["maxUnits"]:
                detail = f"{len(self.units) + 1} units; limit is {self.limits['maxUnits']}"
            elif attempted_chars > self.limits["maxTextChars"]:
                detail = f"{attempted_chars} UTF-16 units; limit is {self.limits['maxTextChars']}"
            else:
                detail = f"{self.cells + cells} cells; limit is {self.limits['maxCells']}"
            self.warn("LIMIT_REACHED", f"Output content would reach {detail}.", unit["location"], True)
            raise LimitReached()
        self.units.append(unit)
        self.characters += count
        self.cells += cells

    def coverage(self):
        result = {"processed": self.processed, "omissions": self.omissions}
        if self.request.get("selection") is not None:
            result["requested"] = self.request["selection"]
        return result

def validate_zip(request):
    try:
        with ZipFile(request["inputPath"]) as archive:
            entries = archive.infolist()
            entry_limit = request["limits"]["maxZipEntries"]
            if len(entries) > entry_limit:
                raise Failure("INPUT_TOO_LARGE", f"Whole archive has {len(entries)} entries; limit is {entry_limit} entries.")
            expanded_bytes = sum(entry.file_size for entry in entries)
            expanded_limit = request["limits"]["maxZipUncompressedBytes"]
            if expanded_bytes > expanded_limit:
                raise Failure("INPUT_TOO_LARGE", f"Whole archive declares {expanded_bytes} expanded bytes; limit is {expanded_limit} bytes.")
            seen = set()
            for entry in entries:
                name = entry.filename
                if (name in seen or name.startswith("/") or "\\" in name or
                    any(part == ".." for part in name.split("/"))):
                    raise Failure("INVALID_DOCUMENT", "Document archive has invalid entries.")
                seen.add(name)
                if entry.flag_bits & 1:
                    raise Failure("PASSWORD_PROTECTED", "Password-protected documents are not supported.")
    except BadZipFile as error:
        # Encrypted Office containers are OLE files; zipfile cannot parse them.
        with open(request["inputPath"], "rb") as source:
            magic = source.read(8)
        if magic == bytes.fromhex("d0cf11e0a1b11ae1"):
            raise Failure("PASSWORD_PROTECTED", "Password-protected Office documents are not supported.") from error
        raise Failure("INVALID_DOCUMENT", "Invalid Office document archive.") from error


def validate_selection(request, kind):
    selection = request.get("selection")
    if selection is not None and selection.get("kind") != kind:
        raise Failure("UNSUPPORTED_SELECTION", "Selection does not apply to this document type.")
    return selection
