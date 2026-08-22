"use client";

import { useEffect, useState } from "react";
import { isMuted, setMuted, unlockAudio, playTick } from "@/lib/sound";

export default function SoundToggle() {
  const [muted, setMutedState] = useState(true);

  useEffect(() => {
    setMutedState(isMuted());
  }, []);

  function toggle() {
    const next = !muted;
    if (!next) {
      // Turning sound ON — this tap is the user gesture browsers require
      // before they'll allow audio to actually play.
      unlockAudio();
    }
    setMuted(next);
    setMutedState(next);
    if (!next) {
      // small confirmation beep so it's obvious sound is now on
      setTimeout(() => playTick(), 60);
    }
  }

  return (
    <button
      onClick={toggle}
      aria-label={muted ? "เปิดเสียง" : "ปิดเสียง"}
      style={{
        position: "fixed",
        top: 14,
        right: 14,
        zIndex: 40,
        width: 40,
        height: 40,
        borderRadius: "50%",
        border: "1px solid var(--line)",
        background: "rgba(21,10,13,0.85)",
        backdropFilter: "blur(4px)",
        color: "var(--cream)",
        fontSize: 18,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {muted ? "🔇" : "🔊"}
    </button>
  );
}
