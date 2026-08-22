"use client";

import { useEffect, useState } from "react";
import { isMuted, setMuted } from "@/lib/sound";

export default function SoundToggle() {
  const [muted, setMutedState] = useState(true);

  useEffect(() => {
    setMutedState(isMuted());
  }, []);

  function toggle() {
    const next = !muted;
    setMuted(next);
    setMutedState(next);
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
