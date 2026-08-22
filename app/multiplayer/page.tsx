"use client";

import Link from "next/link";

export default function MultiplayerEntryPage() {
  return (
    <div className="frame">
      <h2 className="section-title">📡 เล่นสด หลายคน</h2>
      <div className="section-sub">
        เล่นพร้อมกันได้ 2-10 คน ไม่ต้องล็อกอิน — เจ้าภาพคุมจังหวะคำถาม ผู้เล่นใช้แค่ชื่อเล่นกับรหัสห้อง
      </div>
      <div className="game-grid">
        <Link href="/multiplayer/host" className="game-card">
          <div className="gtitle">🎬 สร้างห้อง</div>
          <div className="gdesc">เป็นเจ้าภาพ เลือกหมวดคำถาม แล้วแชร์รหัสห้องให้เพื่อนเข้ามาเล่น</div>
        </Link>
        <Link href="/multiplayer/join" className="game-card">
          <div className="gtitle">🔑 เข้าร่วมห้อง</div>
          <div className="gdesc">มีรหัสห้อง 5 หลักจากเจ้าภาพแล้ว ใส่ชื่อเล่นแล้วเข้าเล่นได้เลย</div>
        </Link>
      </div>
      <Link href="/" className="btn ghost" style={{ display: "block", textAlign: "center", marginTop: 16 }}>
        กลับหน้าแรก
      </Link>
    </div>
  );
}
