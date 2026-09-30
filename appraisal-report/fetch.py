#!/usr/bin/env python3
"""Download Contractors Cloud project files and extract their text.

Usage: fetch.py <client_id> <project_id> "<name>=<url>" ["<name>=<url>" ...]
(a bare <url> also works). Each file is saved under its Contractors Cloud name
in files/<client_id>/<project_id>/ and converted with
`pdftotext -layout`; the .txt path and character count are printed. A text
length near 0 means a scanned PDF: open the PDF itself with the Read tool.
"""
import os, re, subprocess, sys, urllib.parse

HERE = os.path.dirname(os.path.abspath(__file__))

def main():
    cid, pid, urls = sys.argv[1], sys.argv[2], sys.argv[3:]
    out = os.path.join(HERE, "files", cid, pid)
    os.makedirs(out, exist_ok=True)
    for arg in urls:
        if "=http" in arg:
            label, url = arg.split("=http", 1)
            url = "http" + url
            ext = os.path.splitext(urllib.parse.urlparse(url).path)[1]
            name = re.sub(r"[^A-Za-z0-9._ #()-]+", "_", label).strip() or "file"
            if not name.lower().endswith(ext.lower()):
                name += ext
        else:
            url = arg
            name = os.path.basename(urllib.parse.urlparse(url).path)
        path = os.path.join(out, name)
        if not os.path.exists(path) or os.path.getsize(path) == 0:
            r = subprocess.run(["curl", "-sS", "-f", "-o", path, url], capture_output=True, text=True)
            if r.returncode != 0:
                print(f"FAILED {url}: {r.stderr.strip()[:120]}")
                if os.path.exists(path):
                    os.remove(path)
                continue
        if not name.lower().endswith(".pdf"):
            print(f"SAVED {path} (not a PDF)")
            continue
        txt = path[:-4] + ".txt"
        subprocess.run(["pdftotext", "-layout", path, txt], capture_output=True)
        n = len(open(txt, errors="ignore").read().strip()) if os.path.exists(txt) else 0
        print(f"OK {txt} chars={n}")

if __name__ == "__main__":
    main()
