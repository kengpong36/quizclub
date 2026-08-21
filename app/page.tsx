"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { GAMES } from "@/lib/types";

export default function HomePage() {
  const router = useRouter();
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    async function loadCounts() {
      const { data } = await supabase.from("questions").select("game_id");
      const c: Record<string, number> = {};
      (data || []).forEach((row: { game_id: string }) => {
        c[row.game_id] = (c[row.game_id] || 0) + 1;
      });
      setCounts(c);
    }
    loadCounts();
  }, []);

  return (
    <div className="frame">
      <h2 className="section-title">เลือกเกมที่จะเล่น</h2>
      <div className="section-sub">
        คลังคำถามเก็บอยู่บนฐานข้อมูลกลาง เล่นจากอุปกรณ์ไหนก็เห็นเหมือนกัน
      </div>
      <div className="game-grid">
        {GAMES.map((g) => (
          <div
            key={g.id}
            className={"game-card" + (g.playable ? "" : " disabled")}
            onClick={() => g.playable && router.push(`/play/${g.id}`)}
          >
            <div className="gtitle">
              {g.icon} {g.name}
            </div>
            <div className="gdesc">{g.desc}</div>
            <div className="gmeta">
              {g.playable ? `${counts[g.id] || 0} คำถามในคลัง` : "ยังเล่นไม่ได้"}
            </div>
          </div>
        ))}
      </div>
      <footer className="note">
        ควิซคลับ — ผูกกับฐานข้อมูล Supabase, deploy อัตโนมัติผ่าน Vercel เมื่อ push ขึ้น GitHub
      </footer>
    </div>
  );
}
