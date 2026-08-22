"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/components/AuthProvider";
import type { Category, Question } from "@/lib/types";
import { GAMES } from "@/lib/types";
import { playReveal } from "@/lib/sound";
import SoundToggle from "@/components/SoundToggle";

const HOST_USERNAME = "jkmc";
const DEFAULT_GAME_ID = GAMES.find((g) => g.playable)?.id || "truth-or-lie";

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  const cs = Math.floor((ms % 1000) / 10);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}

function TeamTimer({ label, color }: { label: string; color: string }) {
  const [ms, setMs] = useState(0);
  const [running, setRunning] = useState(false);
  const rafRef = useRef<number | null>(null);
  const lastTickRef = useRef<number>(0);

  useEffect(() => {
    if (!running) return;
    lastTickRef.current = performance.now();
    function tick(now: number) {
      const delta = now - lastTickRef.current;
      lastTickRef.current = now;
      setMs((prev) => prev + delta);
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [running]);

  return (
    <div className="qrow" style={{ textAlign: "center", flex: 1 }}>
      <div className="qmeta" style={{ color }}>
        {label}
      </div>
      <div style={{ fontFamily: "Kanit", fontWeight: 900, fontSize: 28, margin: "8px 0" }}>
        {formatTime(ms)}
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <button className="btn small" style={{ flex: 1 }} onClick={() => setRunning((r) => !r)}>
          {running ? "หยุด" : "เริ่ม"}
        </button>
        <button
          className="btn ghost small"
          style={{ flex: 1 }}
          onClick={() => {
            setRunning(false);
            setMs(0);
          }}
        >
          รีเซ็ต
        </button>
      </div>
    </div>
  );
}

export default function HostModePage() {
  const { session, profile, loading: authLoading } = useAuth();

  const [categories, setCategories] = useState<Category[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [selectedCatIds, setSelectedCatIds] = useState<Set<string>>(new Set());
  const [deck, setDeck] = useState<Question[]>([]);
  const [idx, setIdx] = useState(0);
  const [revealed, setRevealed] = useState(false);

  const isHost = profile?.username === HOST_USERNAME;

  useEffect(() => {
    if (!isHost) return;
    async function load() {
      const { data: cats } = await supabase
        .from("categories")
        .select("*")
        .eq("game_id", DEFAULT_GAME_ID);
      const { data: qs } = await supabase
        .from("questions")
        .select("*")
        .eq("game_id", DEFAULT_GAME_ID);
      setCategories(cats || []);
      setQuestions(qs || []);
      setSelectedCatIds(new Set((cats || []).map((c) => c.id)));
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost]);

  if (authLoading) {
    return <div className="frame">กำลังโหลด...</div>;
  }

  if (!session) {
    return (
      <div className="frame">
        <h2 className="section-title">โหมดพิธีกร</h2>
        <div className="section-sub">หน้านี้สำหรับพิธีกรเท่านั้น ต้องเข้าสู่ระบบก่อน</div>
        <Link href="/login" className="btn" style={{ display: "block", textAlign: "center" }}>
          เข้าสู่ระบบ
        </Link>
      </div>
    );
  }

  if (!isHost) {
    return (
      <div className="frame">
        <h2 className="section-title">โหมดพิธีกร</h2>
        <div className="empty-note">หน้านี้สำหรับพิธีกรเท่านั้น บัญชีของคุณไม่มีสิทธิ์เข้าถึง</div>
      </div>
    );
  }

  const pool = questions.filter((q) => selectedCatIds.has(q.category_id));

  function toggleCat(id: string) {
    const next = new Set(selectedCatIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedCatIds(next);
  }

  function startRound() {
    setDeck(shuffle(pool));
    setIdx(0);
    setRevealed(false);
  }

  function next() {
    setRevealed(false);
    setIdx((i) => Math.min(i + 1, deck.length - 1));
  }
  function prev() {
    setRevealed(false);
    setIdx((i) => Math.max(i - 1, 0));
  }

  const q = deck[idx];
  const catName = q ? categories.find((c) => c.id === q.category_id)?.name || "หมวด" : "";

  return (
    <div className="frame">
      <SoundToggle />
      <h2 className="section-title">🎙️ โหมดพิธีกร</h2>
      <div className="section-sub">
        ไม่จับเวลาต่อข้อ สุ่มลำดับคำถามไว้ล่วงหน้า อ่านให้ผู้เข้าแข่งขันฟังแล้วกดเฉลยเองได้ตามจังหวะ
      </div>

      {/* Team timers */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        <TeamTimer label="ทีม 1" color="var(--truth)" />
        <TeamTimer label="ทีม 2" color="var(--lie)" />
      </div>

      {deck.length === 0 && (
        <>
          <div className="row-between">
            <span style={{ fontSize: 13, color: "var(--muted)" }}>
              {pool.length} คำถามพร้อมใช้
            </span>
            <button
              className="link-btn"
              onClick={() =>
                setSelectedCatIds(
                  selectedCatIds.size === categories.length
                    ? new Set()
                    : new Set(categories.map((c) => c.id))
                )
              }
            >
              เลือก/ยกเลิกทั้งหมด
            </button>
          </div>
          <div className="cat-list">
            {categories.map((c) => (
              <label className="cat-chip" key={c.id}>
                <span className="cname">
                  <input
                    type="checkbox"
                    checked={selectedCatIds.has(c.id)}
                    onChange={() => toggleCat(c.id)}
                  />
                  {c.name}
                </span>
                <span className="ccount">
                  {questions.filter((qq) => qq.category_id === c.id).length} ข้อ
                </span>
              </label>
            ))}
          </div>
          <button className="btn" disabled={pool.length === 0} onClick={startRound}>
            สุ่มคำถามเริ่มรอบใหม่
          </button>
        </>
      )}

      {deck.length > 0 && q && (
        <>
          <div className="row-between">
            <span className="category-tag">{catName}</span>
            <span style={{ fontSize: 12, color: "var(--muted)", fontFamily: "Kanit" }}>
              ข้อ {idx + 1}/{deck.length}
            </span>
          </div>
          <div className="qcard">{q.text}</div>

          {revealed ? (
            <div className="reveal show">
              <div className={"verdict " + (q.answer ? "ok" : "no")}>
                {q.answer ? "✅ คำตอบ: จริง" : "❌ คำตอบ: มั่ว"}
              </div>
              <div>{q.explain}</div>
            </div>
          ) : (
            <button
              className="btn"
              onClick={() => {
                playReveal();
                setRevealed(true);
              }}
            >
              เฉลย
            </button>
          )}

          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            <button className="btn ghost" style={{ flex: 1 }} onClick={prev} disabled={idx === 0}>
              ← ข้อก่อนหน้า
            </button>
            <button
              className="btn"
              style={{ flex: 1 }}
              onClick={next}
              disabled={idx >= deck.length - 1}
            >
              ข้อถัดไป →
            </button>
          </div>
          <button
            className="btn ghost"
            style={{ marginTop: 10 }}
            onClick={() => setDeck([])}
          >
            เลือกหมวดใหม่ / สุ่มรอบใหม่
          </button>
        </>
      )}
    </div>
  );
}
