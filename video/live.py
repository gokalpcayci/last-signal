"""Tiny client for the AbletonMCP Remote Script socket: python3 live.py stop | fire"""
import json, socket, sys, time
TRACKS = (0, 1, 4, 5, 6)
def cmd(t, **p):
    with socket.create_connection(("localhost", 9877), timeout=10) as s:
        s.sendall(json.dumps({"type": t, "params": p}).encode())
        buf = b""
        while True:
            c = s.recv(65536)
            if not c: break
            buf += c
            try: return json.loads(buf).get("result")
            except ValueError: pass
def beat():
    r = cmd("get_session_info")
    return (json.loads(r) if isinstance(r, str) else r)["current_song_time"]
if sys.argv[1] == "stop":
    for t in TRACKS: cmd("stop_clip", track_index=t, clip_index=0)
    print("clips stopped")
elif sys.argv[1] == "fire":
    # each socket call takes ~0.6 s, so slow the song to 30 BPM (8 s bars) while firing:
    # all five land on the same next downbeat; clip positions are in beats, so nothing shifts
    cmd("set_tempo", tempo=30.0)
    while True:
        b = beat()
        if 0.1 < b % 4 < 1.2: break
        time.sleep(0.1)
    for t in TRACKS: cmd("fire_clip", track_index=t, clip_index=0)
    cmd("set_tempo", tempo=120.0)
    print(f"fired at beat {b:.2f} (+{beat() - b:.2f} beats for all five) → start at beat {(b // 4 + 1) * 4:.0f}")
    target = (b // 4 + 1) * 4 + 66
    while beat() < target: time.sleep(0.2)
    cmd("stop_playback")
    print("stopped at", round(beat(), 1))
