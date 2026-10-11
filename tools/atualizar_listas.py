#!/usr/bin/env python3
"""CineHUB list updater helper.
Run every 3 days (manually or with a scheduler) to verify upstream list URLs.
This helper only downloads/validates M3U metadata; it does not rewrite the CineHUB catalog.
"""
from pathlib import Path
import json, time, urllib.request

ROOT=Path(__file__).resolve().parents[1]
CFG=ROOT/"dados/listas.json"
OUT=ROOT/"dados/listas-status.json"
cfg=json.loads(CFG.read_text(encoding="utf-8"))
items=[]
for group in ("remote","catalog"):
    for x in cfg["sources"].get(group,[]):
        try:
            req=urllib.request.Request(x["url"],method="GET",headers={"User-Agent":"CineHUB-ListUpdater/2.3.1","Range":"bytes=0-4095"})
            with urllib.request.urlopen(req,timeout=20) as r:
                head=r.read(4096)
            ok=b"#EXTM3U" in head or b"#EXTINF" in head
            items.append({"id":x["id"],"name":x["name"],"ok":ok,"status":getattr(r,"status",200)})
        except Exception as e:
            items.append({"id":x["id"],"name":x["name"],"ok":False,"error":str(e)})
OUT.write_text(json.dumps({"checked_at":time.time(),"items":items},ensure_ascii=False,indent=2),encoding="utf-8")
print(f"CineHUB: {sum(1 for x in items if x['ok'])}/{len(items)} fontes remotas responderam como M3U.")
