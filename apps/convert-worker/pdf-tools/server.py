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


def main() -> None:
    server = HTTPServer(("0.0.0.0", 8080), Handler)
    server.serve_forever()


if __name__ == "__main__":
    main()
