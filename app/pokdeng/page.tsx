"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { getGuestId, getSavedNickname, saveNickname } from "@/lib/guest";

async function generateUniqueCode(): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = String(Math.floor(10000 + Math.random() * 90000));
    const { data } = await supabase.from("pokdeng_rooms").select("id").eq("code", code).maybeSingle();
    if (!data) return code;
  }
  return String(Math.floor(10000 + Math.random() * 90000));
}

export default function PokDengEntryPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"menu" | "create" | "join">("menu");
  const [nickname, setNickname] = useState(getSavedNickname());
  const [startingChips, setStartingChips] = useState(200);
  const [minBet, setMinBet] = useState(5);
  const [maxBet, setMaxBet] = useState(50);
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const name = nickname.trim();
    if (!name) return setError("ใส่ชื่อเล่นก่อนนะ");
    if (minBet < 1 || maxBet < minBet) return setError("ช่วงเดิมพันไม่ถูกต้อง");
    setLoading(true);
    saveNickname(name);
    const guestId = getGuestId();
    const code = await generateUniqueCode();
    const { data: room, error: roomErr } = await supabase
      .from("pokdeng_rooms")
      .insert({ code, host_guest_id: guestId, min_bet: minBet, max_bet: maxBet, status: "lobby" })
      .select()
      .single();
    if (roomErr || !room) {
      setLoading(false);
      return setError(roomErr?.message || "สร้างห้องไม่สำเร็จ");
    }
    await supabase
      .from("pokdeng_players")
      .upsert(
        { room_id: room.id, guest_id: guestId, nickname: name, chips: startingChips },
        { onConflict: "room_id,guest_id" }
      );
    setLoading(false);
    router.push(`/pokdeng/room/${code}`);
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const name = nickname.trim();
    const cleanCode = joinCode.trim();
    if (!/^\d{5}$/.test(cleanCode)) return setError("รหัสห้องต้องเป็นตัวเลข 5 หลัก");
    if (!name) return setError("ใส่ชื่อเล่นก่อนนะ");
    setLoading(true);
    const { data: room, error: roomErr } = await supabase
      .from("pokdeng_rooms")
      .select("id, status")
      .eq("code", cleanCode)
      .maybeSingle();
    if (roomErr || !room) {
      setLoading(false);
      return setError("ไม่พบห้องนี้ เช็ครหัสอีกทีนะ");
    }
    if (room.status !== "lobby") {
      setLoading(false);
      return setError("ห้องนี้เริ่มเกมไปแล้ว เข้าร่วมไม่ได้");
    }
    saveNickname(name);
    const guestId = getGuestId();
    const { error: joinErr } = await supabase
      .from("pokdeng_players")
      .upsert({ room_id: room.id, guest_id: guestId, nickname: name, chips: 200 }, { onConflict: "room_id,guest_id" });
    setLoading(false);
    if (joinErr) return setError(joinErr.message);
    router.push(`/pokdeng/room/${cleanCode}`);
  }

  if (mode === "menu") {
    return (
      <div className="frame">
        <h2 className="section-title">🃏 ไพ่ป๊อกเด้ง</h2>
        <div className="section-sub">
          เล่นพร้อมกันหลายคน เวียนเจ้ามือทุกรอบ มีชิปเสมือนพนันกันเล่นๆ (ไม่ใช่เงินจริง)
        </div>
        <div className="info-text" style={{ marginBottom: 16 }}>
          ⚠️ ไพ่ทุกใบเก็บไว้ในฐานข้อมูลกลางแบบเปิด (เพื่อความเร็ว ไม่ต้องล็อกอิน) ใครมีรหัสห้องดูข้อมูลได้ในทางเทคนิค — เหมาะเล่นสนุกกับเพื่อน ไม่เหมาะกับการพนันที่มีเดิมพันจริงจัง
        </div>
        <div className="game-grid">
          <div className="game-card" onClick={() => setMode("create")}>
            <div className="gtitle">🎬 สร้างห้อง</div>
            <div className="gdesc">ตั้งช่วงเดิมพัน ชิปเริ่มต้น แล้วแชร์รหัสห้องให้เพื่อน</div>
          </div>
          <div className="game-card" onClick={() => setMode("join")}>
            <div className="gtitle">🔑 เข้าร่วมห้อง</div>
            <div className="gdesc">มีรหัสห้องจากเพื่อนแล้ว ใส่ชื่อเล่นแล้วเข้าเล่นได้เลย</div>
          </div>
        </div>
        <Link href="/" className="btn ghost" style={{ display: "block", textAlign: "center", marginTop: 16 }}>
          กลับหน้าแรก
        </Link>
      </div>
    );
  }

  if (mode === "create") {
    return (
      <div className="frame">
        <h2 className="section-title">🎬 สร้างห้องป๊อกเด้ง</h2>
        <form onSubmit={handleCreate}>
          <label className="field-label">ชื่อเล่นของคุณ</label>
          <input type="text" value={nickname} onChange={(e) => setNickname(e.target.value)} maxLength={20} />
          <label className="field-label">ชิปเริ่มต้นต่อคน</label>
          <input
            type="text"
            inputMode="numeric"
            value={startingChips}
            onChange={(e) => setStartingChips(parseInt(e.target.value.replace(/\D/g, "")) || 0)}
          />
          <label className="field-label">เดิมพันขั้นต่ำ</label>
          <input
            type="text"
            inputMode="numeric"
            value={minBet}
            onChange={(e) => setMinBet(parseInt(e.target.value.replace(/\D/g, "")) || 0)}
          />
          <label className="field-label">เดิมพันสูงสุด</label>
          <input
            type="text"
            inputMode="numeric"
            value={maxBet}
            onChange={(e) => setMaxBet(parseInt(e.target.value.replace(/\D/g, "")) || 0)}
          />
          {error && <div className="error-text">{error}</div>}
          <button className="btn" style={{ marginTop: 18 }} type="submit" disabled={loading}>
            {loading ? "กำลังสร้าง..." : "สร้างห้อง"}
          </button>
        </form>
        <button className="btn ghost" style={{ marginTop: 12 }} onClick={() => setMode("menu")}>
          ← กลับ
        </button>
      </div>
    );
  }

  return (
    <div className="frame">
      <h2 className="section-title">🔑 เข้าร่วมห้องป๊อกเด้ง</h2>
      <form onSubmit={handleJoin}>
        <label className="field-label">รหัสห้อง (5 หลัก)</label>
        <input
          type="text"
          inputMode="numeric"
          value={joinCode}
          onChange={(e) => setJoinCode(e.target.value.replace(/[^0-9]/g, "").slice(0, 5))}
          style={{ fontSize: 22, letterSpacing: 6, textAlign: "center", fontFamily: "Kanit" }}
        />
        <label className="field-label">ชื่อเล่นของคุณ</label>
        <input type="text" value={nickname} onChange={(e) => setNickname(e.target.value)} maxLength={20} />
        {error && <div className="error-text">{error}</div>}
        <button className="btn" style={{ marginTop: 18 }} type="submit" disabled={loading}>
          {loading ? "กำลังเข้าห้อง..." : "เข้าห้อง"}
        </button>
      </form>
      <button className="btn ghost" style={{ marginTop: 12 }} onClick={() => setMode("menu")}>
        ← กลับ
      </button>
    </div>
  );
}
