"""Write the launch score into Ableton via the AbletonMCP Remote Script socket (localhost:9877).
Creates one 60-beat Session clip per track (slot 0) and is launched as one scene."""
import json, socket, subprocess, sys

TRACKS = {"pad": (0, "PAD"), "bass": (1, "BASS"), "arp": (4, "ARP"), "ping": (5, "SIGNAL"), "drums": (6, "DRUMS")}
LEN = 60.0

def cmd(kind, **params):
    with socket.create_connection(("localhost", 9877), timeout=20) as s:
        s.sendall(json.dumps({"type": kind, "params": params}).encode())
        buf = b""
        while True:
            chunk = s.recv(65536)
            if not chunk:
                break
            buf += chunk
            try:
                res = json.loads(buf)
                break
            except ValueError:
                continue
    if res.get("status") == "error":
        sys.exit(f"{kind}: {res.get('message')}")
    return res.get("result")

score = json.loads(subprocess.check_output(["bun", "score.mjs"]))
only = set(sys.argv[1:])
for key, (track, name) in TRACKS.items():
    if only and key not in only:
        continue
    cmd("set_track_name", track_index=track, name=name)
    cmd("create_clip", track_index=track, clip_index=0, length=LEN)
    cmd("set_clip_name", track_index=track, clip_index=0, name=f"launch {name.lower()}")
    notes = score[key]
    for i in range(0, len(notes), 60):
        cmd("add_notes_to_clip", track_index=track, clip_index=0, notes=notes[i:i + 60])
    print(f"{name}: {len(notes)} notes")
