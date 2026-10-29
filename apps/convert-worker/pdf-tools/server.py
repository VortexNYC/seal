"""seal-pdf-tools — tiny internal HTTP service over poppler-utils.

Endpoints (all POST, raw application/pdf body):
  /to-images?format=png|jpeg&dpi=150  -> application/zip of one image per page
  /to-text                            -> text/plain extracted text

Auth: X-Internal-Api-Key header must match PDF_TOOLS_API_KEY env var.
"""

import io
import os
import re
import subprocess
import tempfile
import urllib.parse
import zipfile
from http.server import BaseHTTPRequestHandler, HTTPServer

API_KEY = os.environ.get("PDF_TOOLS_API_KEY", "")
MAX_BYTES = 80 * 1024 * 1024
PDF_MAGIC = b"%PDF"


def run(cmd: list[str], cwd: str, stdin: bytes | None = None) -> bytes:
    proc = subprocess.run(cmd, input=stdin, capture_output=True, cwd=cwd)
    if proc.returncode != 0:
        raise RuntimeError(
            f"{cmd[0]} failed ({proc.returncode}): {proc.stderr.decode()[-800:]}"
        )
    return proc.stdout


class Handler(BaseHTTPRequestHandler):
    def _send(self, code: int, body: bytes, content_type: str = "text/plain") -> None:
        self.send_response(code)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:
        if self.path == "/health":
            self._send(200, b"ok")
        else:
            self._send(404, b"not found")

    def do_POST(self) -> None:
        if API_KEY and self.headers.get("X-Internal-Api-Key") != API_KEY:
            self._send(401, b"unauthorized")
            return

        length = int(self.headers.get("Content-Length") or 0)
        if length <= 0 or length > MAX_BYTES:
            self._send(400, b"missing or oversized pdf body")
            return

        if self.path == "/tracked-docx":
            self._tracked_docx(length)
            return

        pdf = self.rfile.read(length)
        if not pdf.startswith(PDF_MAGIC):
            self._send(400, b"not a pdf")
            return

        try:
            if self.path == "/to-text":
                out = run(["pdftotext", "-layout", "-", "-"], "/tmp", stdin=pdf)
                self._send(200, out, "text/plain; charset=utf-8")
                return

            if self.path == "/to-words":
                self._to_words(pdf)
                return

            if self.path.startswith("/to-images"):
                self._to_images(pdf)
                return

            if self.path.startswith("/ocr"):
                self._ocr(pdf)
                return

            if self.path.startswith("/pdf-to-office"):
                self._pdf_to_office(pdf)
                return

            self._send(404, b"not found")
        except RuntimeError as e:
            self._send(422, str(e).encode())
        except Exception as e:  # noqa: BLE001
            self._send(500, str(e).encode())

    def _tracked_docx(self, length: int) -> None:
        """JSON {title, text, edits:[{kind, anchor_quote, proposed_text, author?}]}
        -> .docx with w:ins/w:del tracked changes (Word shows real redlines).
        Anchors locate in the ORIGINAL text; unfound anchors are skipped with a
        `skipped` count in a response header (body is still a valid docx)."""
        import json

        try:
            payload = json.loads(self.rfile.read(length).decode())
        except Exception:
            self._send(400, b"invalid json")
            return
        text = payload.get("text") or ""
        edits = payload.get("edits") or []
        author = (payload.get("author") or "Seal").strip() or "Seal"
        title = (payload.get("title") or "Revised document").strip()

        docx_b64 = payload.get("docx_b64")
        if docx_b64:
            import base64
            try:
                original = base64.b64decode(docx_b64)
                out_bytes, graft_skipped = graft_tracked_docx(original, edits, author)
                self.send_response(200)
                self.send_header(
                    "Content-Type",
                    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                )
                self.send_header("X-Skipped-Edits", str(graft_skipped))
                self.send_header("X-Grafted", "1")
                self.send_header("Content-Length", str(len(out_bytes)))
                self.end_headers()
                self.wfile.write(out_bytes)
            except Exception as e:  # noqa: BLE001 — fall back to rebuild below? no: report
                self._send(422, f"graft failed: {e}".encode())
            return

        # Segments: ("n"|"i"|"d", text). Anchors match only "n" spans —
        # edits target the original text, not earlier proposals.
        segments: list[list] = [["n", text]]
        skipped = 0
        for edit in edits:
            quote = edit.get("anchor_quote") or ""
            proposed = edit.get("proposed_text") or ""
            kind = edit.get("kind")
            if not quote:
                skipped += 1
                continue
            new_segments: list[list] = []
            applied = False
            for seg in segments:
                if applied or seg[0] != "n" or quote not in seg[1]:
                    new_segments.append(seg)
                    continue
                idx = seg[1].find(quote)
                before, after = seg[1][:idx], seg[1][idx + len(quote):]
                if kind == "delete":
                    new_segments += [["n", before], ["d", quote], ["n", after]]
                elif kind == "replace":
                    new_segments += [
                        ["n", before],
                        ["d", quote],
                        ["i", proposed],
                        ["n", after],
                    ]
                else:
                    new_segments += [
                        ["n", before + quote],
                        ["i", proposed],
                        ["n", after],
                    ]
                applied = True
            segments = [seg for seg in new_segments if seg[1]]
            if not applied:
                skipped += 1

        def esc(t: str) -> str:
            return (t.replace("&", "&amp;").replace("<", "&lt;")
                     .replace(">", "&gt;").replace('"', "&quot;"))

        now = "2026-01-01T00:00:00Z"  # deterministic-ish; callers don't care
        import datetime
        now = datetime.datetime.now(datetime.timezone.utc).strftime(
            "%Y-%m-%dT%H:%M:%SZ"
        )

        # Render segments → w:p paragraphs (split on blank lines in "n" text).
        body_parts: list[str] = []
        buf: list[str] = []  # current paragraph runs

        def flush_paragraph() -> None:
            if not buf:
                return
            body_parts.append("<w:p>" + "".join(buf) + "</w:p>")
            buf.clear()

        def emit_norm(chunk: str) -> None:
            paras = re.split(r"\n\s*\n", chunk)
            for i, para in enumerate(paras):
                if i > 0:
                    flush_paragraph()
                if para:
                    ptext = para.replace("\n", " ")
                    buf.append(
                        f'<w:r><w:t xml:space="preserve">{esc(ptext)}</w:t></w:r>'
                    )

        for kind, chunk in segments:
            if kind == "n":
                emit_norm(chunk)
            elif kind == "d":
                buf.append(
                    f'<w:del w:author="{esc(author)}" w:date="{now}">'
                    f'<w:r><w:delText xml:space="preserve">{esc(chunk)}</w:delText></w:r></w:del>'
                )
            else:
                buf.append(
                    f'<w:ins w:author="{esc(author)}" w:date="{now}">'
                    f'<w:r><w:t xml:space="preserve">{esc(chunk)}</w:t></w:r></w:ins>'
                )
        flush_paragraph()

        document_xml = (
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
            "<w:body>" + "".join(body_parts) + "</w:body></w:document>"
        )
        content_types = (
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
            '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
            '<Default Extension="xml" ContentType="application/xml"/>'
            '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
            '<Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>'
            "</Types>"
        )
        rels = (
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>'
            "</Relationships>"
        )
        settings = (
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
            "<w:trackChanges/></w:settings>"
        )

        buf_io = io.BytesIO()
        with zipfile.ZipFile(buf_io, "w", zipfile.ZIP_DEFLATED) as zf:
            zf.writestr("[Content_Types].xml", content_types)
            zf.writestr("_rels/.rels", rels)
            zf.writestr("word/document.xml", document_xml)
            zf.writestr("word/settings.xml", settings)
        self.send_response(200)
        self.send_header(
            "Content-Type",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        )
        self.send_header("X-Skipped-Edits", str(skipped))
        body = buf_io.getvalue()
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _to_images(self, pdf: bytes) -> None:
        qs = urllib.parse.parse_qs(urllib.parse.urlsplit(self.path).query)
        fmt = (qs.get("format", ["png"])[0]).lower()
        if fmt not in ("png", "jpeg", "jpg"):
            self._send(400, b"format must be png or jpeg")
            return
        dpi = int(qs.get("dpi", ["150"])[0])
        dpi = max(50, min(600, dpi))

        workdir = tempfile.mkdtemp(prefix="pdfimg-")
        src = os.path.join(workdir, "in.pdf")
        with open(src, "wb") as f:
            f.write(pdf)

        flag = "-png" if fmt == "png" else "-jpeg"
        ext = "png" if fmt == "png" else "jpg"
        prefix = os.path.join(workdir, "page")
        run(["pdftoppm", flag, "-r", str(dpi), src, prefix], workdir)

        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
            for name in sorted(os.listdir(workdir)):
                if re.fullmatch(rf"page-\d+\.{ext}", name):
                    with open(os.path.join(workdir, name), "rb") as f:
                        zf.writestr(name, f.read())
        self._send(200, buf.getvalue(), "application/zip")

    def _to_words(self, pdf: bytes) -> None:
        """pdftotext -bbox XHTML → JSON word list with 0–1 page coordinates."""
        import xml.etree.ElementTree as ET

        out = run(
            ["pdftotext", "-bbox", "-", "-"], "/tmp", stdin=pdf
        )
        # pdftotext writes XHTML; tolerate the ns prefix if present.
        text = out.decode("utf-8", errors="replace")
        try:
            root = ET.fromstring(text)
        except ET.ParseError:
            self._send(422, b"bbox extraction failed")
            return

        words = []
        page_no = 0
        for page in root.iter():
            tag = page.tag.split("}")[-1]
            if tag != "page":
                continue
            try:
                pw = float(page.get("width", "0"))
                ph = float(page.get("height", "0"))
            except ValueError:
                continue
            if not pw or not ph:
                continue
            page_no += 1
            for word in page.iter():
                if word.tag.split("}")[-1] != "word" or not word.text:
                    continue
                try:
                    words.append(
                        {
                            "page": page_no,
                            "x": round(float(word.get("xMin", "0")) / pw, 4),
                            "y": round(float(word.get("yMin", "0")) / ph, 4),
                            "w": round(
                                (float(word.get("xMax", "0"))
                                 - float(word.get("xMin", "0"))) / pw,
                                4,
                            ),
                            "h": round(
                                (float(word.get("yMax", "0"))
                                 - float(word.get("yMin", "0"))) / ph,
                                4,
                            ),
                            "t": word.text,
                        }
                    )
                except (TypeError, ValueError):
                    continue

        import json

        self._send(
            200,
            json.dumps({"words": words}).encode(),
            "application/json",
        )

    def _ocr(self, pdf: bytes) -> None:
        qs = urllib.parse.parse_qs(urllib.parse.urlsplit(self.path).query)
        lang = qs.get("lang", ["eng"])[0]
        if not re.fullmatch(r"[a-z]{3}(?:\+[a-z]{3})*", lang):
            self._send(400, b"invalid lang (tesseract codes, e.g. eng or eng+fra)")
            return

        workdir = tempfile.mkdtemp(prefix="ocr-")
        src = os.path.join(workdir, "in.pdf")
        dst = os.path.join(workdir, "out.pdf")
        with open(src, "wb") as f:
            f.write(pdf)

        # Tesseract OpenCL profiling emits "Error in pix*:" lines on first
        # run and caches its profile as ./tesseract_opencl_profile_devices.dat
        # in CWD. ocrmypdf fails lang detection on any stderr "Error" line,
        # so pre-warm the profile into this workdir first.
        try:
            run(["tesseract", "--list-langs"], workdir)
        except RuntimeError:
            pass

        # --skip-text: only OCR pages that lack a text layer.
        run(
            ["ocrmypdf", "--skip-text", "-l", lang, "--jobs", "2", src, dst],
            workdir,
        )
        with open(dst, "rb") as f:
            self._send(200, f.read(), "application/pdf")

    def _pdf_to_office(self, pdf: bytes) -> None:
        qs = urllib.parse.parse_qs(urllib.parse.urlsplit(self.path).query)
        fmt = (qs.get("format", ["docx"])[0]).lower()
        if fmt not in ("docx", "xlsx", "pptx"):
            self._send(400, b"format must be docx, xlsx, or pptx")
            return

        workdir = tempfile.mkdtemp(prefix="office-")
        src = os.path.join(workdir, "in.pdf")
        with open(src, "wb") as f:
            f.write(pdf)

        # PDF imports into Draw; fidelity is layout-locked (text boxes, not
        # flowing prose) — honest export, same class as free-tier tools.
        run(
            [
                "soffice",
                "--headless",
                # Per-request user profile — concurrent soffice runs share a
                # lock otherwise.
                f"-env:UserInstallation=file://{workdir}/lo-profile",
                "--convert-to",
                fmt,
                "--outdir",
                workdir,
                src,
            ],
            workdir,
        )
        out = os.path.join(workdir, f"in.{fmt}")
        if not os.path.exists(out):
            raise RuntimeError(f"libreoffice produced no {fmt}")
        with open(out, "rb") as f:
            self._send(200, f.read(), "application/octet-stream")


W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
W = "{%s}" % W_NS


def _register_docx_namespaces() -> None:
    from xml.etree import ElementTree as ET

    ET.register_namespace("w", W_NS)
    ET.register_namespace(
        "r", "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
    )
    ET.register_namespace(
        "mc", "http://schemas.openxmlformats.org/markup-compatibility/2006"
    )
    ET.register_namespace(
        "wp", "http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
    )


def _norm_map(text: str) -> tuple[str, list[int]]:
    r"""Collapse whitespace to single spaces; return (normalized, raw-offset map)."""
    norm: list[str] = []
    rmap: list[int] = []
    prev_space = True
    for i, ch in enumerate(text):
        if ch.isspace():
            if not prev_space:
                norm.append(" ")
                rmap.append(i)
            prev_space = True
            continue
        prev_space = False
        norm.append(ch)
        rmap.append(i)
    return "".join(norm), rmap


def graft_tracked_docx(
    docx_bytes: bytes,
    edits: list[dict],
    author: str,
) -> tuple[bytes, int]:
    """Patch w:ins/w:del runs into an existing .docx's word/document.xml,
    preserving every other part (styles, images, numbering) untouched.
    Returns (docx_bytes, skipped_count)."""
    import copy
    import datetime
    import io
    import zipfile
    from xml.etree import ElementTree as ET

    _register_docx_namespaces()
    zin = zipfile.ZipFile(io.BytesIO(docx_bytes))
    root = ET.fromstring(zin.read("word/document.xml"))
    body = root.find(W + "body")
    if body is None:
        raise ValueError("no w:body")

    # Flat map: every w:t inside a direct w:r child of any w:p — global
    # offsets across the document (paragraphs get a synthetic "\n" gap).
    entries: list[tuple] = []  # (para_el, run_el, t_el, start)
    flat_parts: list[str] = []
    pos = 0
    for p in body.iter(W + "p"):
        for r in p:
            if r.tag != W + "r":
                continue
            t = r.find(W + "t")
            if t is None or not (t.text):
                continue
            entries.append((p, r, t, pos))
            flat_parts.append(t.text)
            pos += len(t.text)
        pos += 1  # synthetic paragraph separator
    flat = ""
    # rebuild flat honoring the gaps
    prev_end = 0
    pieces: list[str] = []
    cursor = 0
    t_iter = iter(entries)
    running = ""
    # simpler: concat t texts with "\n" between paragraphs — entries carry
    # real starts; flat is used only for anchor matching on normalized text.
    flat = "".join(flat_parts)
    # recompute true flat offsets without separators: entries[i].start must
    # equal cumulative t length; adjust entries to t-only offsets.
    entries2: list[tuple] = []
    off = 0
    for p, r, t, _s in entries:
        entries2.append((p, r, t, off))
        off += len(t.text or "")
    entries = entries2

    norm, rmap = _norm_map(flat)

    def raw_span(quote: str) -> tuple[int, int] | None:
        nq = " ".join(quote.split())
        if not nq:
            return None
        start = norm.find(nq)
        if start == -1:
            return None
        end_norm = start + len(nq) - 1
        # raw end = raw offset of the LAST normalized char + 1
        return rmap[start], rmap[end_norm] + 1

    # Resolve every edit to a raw span up front (original text positions).
    spans: list[tuple[int, int, dict]] = []
    skipped = 0
    for e in edits:
        q = e.get("anchor_quote") or ""
        rs = raw_span(q) if q else None
        if rs is None:
            skipped += 1
            continue
        spans.append((rs[0], rs[1], e))

    now = datetime.datetime.now(datetime.timezone.utc).strftime(
        "%Y-%m-%dT%H:%M:%SZ"
    )
    change_id = [0]

    def nid() -> str:
        change_id[0] += 1
        return str(change_id[0])

    def space_attr(text: str) -> dict:
        return {"{http://www.w3.org/XML/1998/namespace}space": "preserve"} if text != text.strip() else {}

    # Per-run split: each affected (p, r, t, start) gets replaced by a
    # sequence of [runs | w:del | w:ins] spliced into the paragraph.
    replacements: dict[int, list] = {}  # id(run_el) -> new children
    ins_emitted: set[int] = set()  # edit indices whose w:ins already emitted

    for p, r, t, start in entries:
        text = t.text or ""
        end = start + len(text)
        covered = [
            (i, s_, e_, e)
            for i, (s_, e_, e) in enumerate(spans)
            if s_ < end and e_ > start
        ]
        if not covered:
            continue
        # cut points within this run's text
        cuts = {0, len(text)}
        for i, s_, e_, _e in covered:
            cuts.add(max(0, s_ - start))
            cuts.add(min(len(text), e_ - start))
        points = sorted(cuts)
        seq: list = []
        for a, b in zip(points, points[1:]):
            if a == b:
                continue
            piece = text[a:b]
            ga, gb = start + a, start + b
            edit_idx = next(
                (i for i, s_, e_, _e in covered if s_ <= ga and e_ >= gb and (gb > s_ and ga < e_)),
                None,
            )
            if edit_idx is None:
                # untouched piece → normal run (clone rPr)
                nr = copy.deepcopy(r)
                nt = nr.find(W + "t")
                nt.text = piece
                for k in list(nt.attrib):
                    del nt.attrib[k]
                nt.attrib.update(space_attr(piece))
                seq.append(nr)
                continue
            _s_, _e_, edit = spans[edit_idx]
            kind = edit.get("kind")
            if kind == "insert":
                # anchor text stays; ins emitted once after the last piece
                nr = copy.deepcopy(r)
                nt = nr.find(W + "t")
                nt.text = piece
                for k in list(nt.attrib):
                    del nt.attrib[k]
                nt.attrib.update(space_attr(piece))
                seq.append(nr)
                if gb >= _e_ and edit_idx not in ins_emitted:
                    ins_emitted.add(edit_idx)
                    w_ins = ET.SubElement(body, W + "ins")  # placeholder, re-parented below
                    w_ins.attrib.update({W + "id": nid(), W + "author": author, W + "date": now})
                    ir = ET.SubElement(w_ins, W + "r")
                    it = ET.SubElement(ir, W + "t")
                    it.attrib.update(space_attr(edit.get("proposed_text") or ""))
                    it.text = edit.get("proposed_text") or ""
                    seq.append(w_ins)
                continue
            # delete / replace → this piece becomes w:del
            w_del = ET.Element(W + "del")
            w_del.attrib.update({W + "id": nid(), W + "author": author, W + "date": now})
            dr = copy.deepcopy(r)
            # run inside w:del uses w:delText instead of w:t
            dt_old = dr.find(W + "t")
            dr.remove(dt_old)
            dtext = ET.SubElement(dr, W + "delText")
            dtext.attrib.update(space_attr(piece))
            dtext.text = piece
            w_del.append(dr)
            seq.append(w_del)
            if kind == "replace" and gb >= _e_ and edit_idx not in ins_emitted:
                ins_emitted.add(edit_idx)
                w_ins = ET.Element(W + "ins")
                w_ins.attrib.update({W + "id": nid(), W + "author": author, W + "date": now})
                ir = ET.SubElement(w_ins, W + "r")
                it = ET.SubElement(ir, W + "t")
                it.attrib.update(space_attr(edit.get("proposed_text") or ""))
                it.text = edit.get("proposed_text") or ""
                seq.append(w_ins)
        replacements[id(r)] = seq

    # Splice: rebuild each paragraph's child list once
    for p in body.iter(W + "p"):
        children = list(p)
        if not any(id(ch) in replacements for ch in children):
            continue
        new_children: list = []
        for ch in children:
            seq = replacements.get(id(ch))
            if seq is None:
                new_children.append(ch)
            else:
                new_children.extend(seq)
        p[:] = new_children

    out_document = ET.tostring(root, encoding="utf-8", xml_declaration=True)

    # Ensure <w:trackChanges/> in settings.xml
    settings_bytes = None
    if "word/settings.xml" in zin.namelist():
        sroot = ET.fromstring(zin.read("word/settings.xml"))
        if sroot.find(W + "trackChanges") is None:
            ET.SubElement(sroot, W + "trackChanges")
        settings_bytes = ET.tostring(sroot, encoding="utf-8", xml_declaration=True)

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zout:
        for item in zin.infolist():
            data = zin.read(item.filename)
            if item.filename == "word/document.xml":
                data = out_document
            elif item.filename == "word/settings.xml" and settings_bytes is not None:
                data = settings_bytes
            zout.writestr(item, data)
        if settings_bytes is None:
            zout.writestr(
                "word/settings.xml",
                '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
                '<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
                "<w:trackChanges/></w:settings>",
            )
            if b"settings" not in zin.read("[Content_Types].xml"):
                ct = zin.read("[Content_Types].xml").decode()
                ct = ct.replace(
                    "</Types>",
                    '<Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/></Types>',
                )
                zout.writestr("[Content_Types].xml", ct)
    return buf.getvalue(), skipped


def main() -> None:
    server = HTTPServer(("0.0.0.0", 8080), Handler)
    server.serve_forever()


if __name__ == "__main__":
    main()
