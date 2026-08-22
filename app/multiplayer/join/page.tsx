"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { getGuestId, getSavedNickname, saveNickname } from "@/lib/guest";

export default function JoinRoomPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [nickname, setNickname] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setNickname(getSavedNickname());
  }, []);

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const cleanCode = code.trim();
    const cleanName = nickname.trim();
    if (!/^\d{5}$/.test(cleanCode)) return setError("รหัสห้องต้องเป็นตัวเลข 5 หลัก");
    if (!cleanName) return setError("ใส่ชื่อเล่นก่อนนะ");
    setLoading(true);

    const { data: room, error: roomErr } = await supabase
      .from("rooms")
      .select("id, status")
      .eq("code", cleanCode)
      .maybeSingle();

    if (roomErr || !room) {
      setLoading(false);
      return setError("ไม่พบห้องนี้ เช็ครหัสอีกทีนะ");
    }
    if (room.status === "ended") {
      setLoading(false);
      return setError("ห้องนี้จบเกมไปแล้ว");
    }

    saveNickname(cleanName);
    const guestId = getGuestId();
    const { error: joinErr } = await supabase
      .from("room_players")
      .upsert(
        { room_id: room.id, guest_id: guestId, nickname: cleanName },
        { onConflict: "room_id,guest_id" }
      );
    setLoading(false);
    if (joinErr) return setError(joinErr.message);
    router.push(`/multiplayer/room/${cleanCode}`);
  }

  return (
    <div className="frame">
      <h2 className="section-title">🔑 เข้าร่วมห้อง</h2>
      <div className="section-sub">ขอรหัสห้อง 5 หลักจากเจ้าภาพ แล้วใส่ชื่อเล่นของคุณ</div>
      <form onSubmit={handleJoin}>
        <label className="field-label">รหัสห้อง (5 หลัก)</label>
        <input
          type="text"
          inputMode="numeric"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, "").slice(0, 5))}
          placeholder="เช่น 48213"
          style={{ fontSize: 22, letterSpacing: 6, textAlign: "center", fontFamily: "Kanit" }}
        />
        <label className="field-label">ชื่อเล่นของคุณ</label>
        <input
          type="text"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder="เช่น เก่งพงศ์"
          maxLength={20}
        />
        {error && <div className="error-text">{error}</div>}
        <button className="btn" style={{ marginTop: 18 }} type="submit" disabled={loading}>
          {loading ? "กำลังเข้าห้อง..." : "เข้าห้อง"}
        </button>
      </form>
      <Link href="/multiplayer" className="btn ghost" style={{ display: "block", textAlign: "center", marginTop: 12 }}>
        ← กลับ
      </Link>
    </div>
  );
}
