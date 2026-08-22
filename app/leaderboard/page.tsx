"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { GAMES } from "@/lib/types";
import type { Score } from "@/lib/types";

const playableGames = GAMES.filter((g) => g.playable);

export default function LeaderboardPage() {
  const [gameId, setGameId] = useState(playableGames[0]?.id || "");
  const [rows, setRows] = useState<Score[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!gameId) return;
      setLoading(true);
      const { data: scoreRows } = await supabase
        .from("scores")
        .select("*")
        .eq("game_id", gameId)
        .order("score", { ascending: false })
        .limit(20);

      const userIds = Array.from(new Set((scoreRows || []).map((r) => r.user_id)));
      let profileMap: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: profileRows } = await supabase
          .from("profiles")
          .select("id, username")
          .in("id", userIds);
        profileMap = Object.fromEntries(
          (profileRows || []).map((p: { id: string; username: string }) => [p.id, p.username])
        );
      }

      const merged: Score[] = (scoreRows || []).map((r) => ({
        ...r,
        profiles: { username: profileMap[r.user_id] || "ผู้เล่น" },
      }));
      setRows(merged);
      setLoading(false);
    }
    load();
  }, [gameId]);

  return (
    <div className="frame">
      <h2 className="section-title">กระดานอันดับ</h2>
      <div className="section-sub">คะแนนสูงสุด 20 อันดับแรกของแต่ละเกม</div>
      <div className="lb-game-select">
        {playableGames.map((g) => (
          <button
            key={g.id}
            className={"nav-link" + (g.id === gameId ? " active" : "")}
            onClick={() => setGameId(g.id)}
          >
            {g.icon} {g.name}
          </button>
        ))}
      </div>
      {loading && <div className="empty-note">กำลังโหลด...</div>}
      {!loading && rows.length === 0 && (
        <div className="empty-note">ยังไม่มีใครเล่นเกมนี้ เป็นคนแรกเลย!</div>
      )}
      {!loading &&
        rows.map((r, i) => (
          <div className="lb-row" key={r.id}>
            <div className="lb-rank">{i + 1}</div>
            <div style={{ flex: 1 }}>
              <div className="lb-name">{r.profiles?.username || "ผู้เล่น"}</div>
              <div className="lb-meta">
                {r.total_questions} ข้อ · คอมโบสูงสุด {r.best_streak} ·{" "}
                {new Date(r.played_at).toLocaleDateString("th-TH")}
              </div>
            </div>
            <div className="lb-score">{r.score}</div>
          </div>
        ))}
    </div>
  );
}
