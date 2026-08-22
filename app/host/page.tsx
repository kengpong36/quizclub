"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/components/AuthProvider";
import type { Category, Question } from "@/lib/types";
import { GAMES } from "@/lib/types";
import { playReveal, playFlip, playFanfare } from "@/lib/sound";
import SoundToggle from "@/components/SoundToggle";

const HOST_USERNAME = "jkmc";
const DEFAULT_GAME_ID = GAMES.find((g) => g.playable)?.id || "truth-or-lie";
const CARD_COUNT_OPTIONS = [6, 9, 12, 15];

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

type Stage = "setup" | "grid";

export default function HostModePage() {
  const { session, profile, loading: authLoading } = useAuth();

  const [categories, setCategories] = useState<Category[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [selectedCatIds, setSelectedCatIds] = useState<Set<string>>(new Set());
  const [cardCount, setCardCount] = useState(9);

  const [stage, setStage] = useState<Stage>("setup");
  const [cards, setCards] = useState<Question[]>([]);
  const [usedIds, setUsedIds] = useState<Set<string>>(new Set());
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const fanfarePlayedRef = useRef(false);

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

  const allUsedForEffect = cards.length > 0 && cards.every((c) => usedIds.has(c.id));
  useEffect(() => {
    if (allUsedForEffect && !fanfarePlayedRef.current) {
      fanfarePlayedRef.current = true;
      playFanfare();
    }
    if (!allUsedForEffect) fanfarePlayedRef.current = false;
  }, [allUsedForEffect]);

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
  const availableCounts = CARD_COUNT_OPTIONS.filter((n) => n <= pool.length);

  function toggleCat(id: string) {
    const next = new Set(selectedCatIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedCatIds(next);
  }

  function startRound() {
    const n = Math.min(cardCount, pool.length);
    setCards(shuffle(pool).slice(0, n));
    setUsedIds(new Set());
    setCurrentId(null);
    setRevealed(false);
    setStage("grid");
  }

  function pickCard(q: Question) {
    if (usedIds.has(q.id)) return;
    playFlip();
    setCurrentId(q.id);
    setRevealed(false);
  }

  function revealAnswer() {
    if (!currentId) return;
    playReveal();
    setRevealed(true);
    setUsedIds((prev) => new Set(prev).add(currentId));
  }

  const current = cards.find((c) => c.id === currentId) || null;
  const currentCatName = current
    ? categories.find((c) => c.id === current.category_id)?.name || "หมวด"
    : "";
  const allUsed = cards.length > 0 && cards.every((c) => usedIds.has(c.id));

  return (
    <div className="frame">
      <SoundToggle />
      <h2 className="section-title">🎙️ โหมดพิธีกร</h2>
      <div className="section-sub">
        {stage === "setup"
          ? "เลือกหมวดและจำนวนการ์ด แล้วให้ผู้เล่นเลือกการ์ดกันเอง"
          : "ให้ผู้เล่นชี้/เลือกหมายเลขการ์ด แล้วพิธีกรแตะเปิดการ์ดนั้นบนจอ"}
      </div>

      {/* Team timers */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        <TeamTimer label="ทีม 1" color="var(--truth)" />
        <TeamTimer label="ทีม 2" color="var(--lie)" />
      </div>

      {stage === "setup" && (
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
          <label className="field-label">จำนวนการ์ด</label>
          <div className="len-select">
            {availableCounts.map((n) => (
              <button key={n} className={n === cardCount ? "sel" : ""} onClick={() => setCardCount(n)}>
                {n}
              </button>
            ))}
          </div>
          <button className="btn" disabled={pool.length === 0} onClick={startRound}>
            🎴 แจกการ์ด
          </button>
        </>
      )}

      {stage === "grid" && (
        <>
          <div className="pick-grid">
            {cards.map((c, i) => {
              const isUsed = usedIds.has(c.id);
              const isActive = c.id === currentId;
              const flipped = isUsed || isActive;
              return (
                <div
                  key={c.id}
                  className={
                    "pick-card" +
                    (flipped ? " flipped" : "") +
                    (isUsed ? " used" : "") +
                    (isActive ? " active" : "")
                  }
                  style={{ animationDelay: `${i * 0.05}s` }}
                  onClick={() => pickCard(c)}
                >
                  <div className="pick-card-inner">
                    <div className="pick-card-face pick-card-back">{i + 1}</div>
                    <div className="pick-card-face pick-card-front">{isUsed ? "✅" : "❓"}</div>
                  </div>
                </div>
              );
            })}
          </div>

          {current && (
            <div className="modal-back" onClick={() => setCurrentId(null)}>
              <div className="modal" onClick={(e) => e.stopPropagation()}>
                <div className="row-between">
                  <span className="category-tag">{currentCatName}</span>
                  <button className="link-btn" onClick={() => setCurrentId(null)}>
                    ✕ ปิด
                  </button>
                </div>
                <div className="qcard" key={current.id}>
                  {current.text}
                </div>

                {revealed ? (
                  <>
                    <div className="reveal show">
                      <div className={"verdict " + (current.answer ? "ok" : "no")}>
                        {current.answer ? "✅ คำตอบ: จริง" : "❌ คำตอบ: มั่ว"}
                      </div>
                      <div>{current.explain}</div>
                    </div>
                    <button className="btn" style={{ marginTop: 14 }} onClick={() => setCurrentId(null)}>
                      ปิด กลับไปเลือกการ์ดถัดไป
                    </button>
                  </>
                ) : (
                  <button className="btn" onClick={revealAnswer}>
                    เฉลย
                  </button>
                )}
              </div>
            </div>
          )}

          {allUsed && (
            <div className="info-text" style={{ textAlign: "center", margin: "16px 0" }}>
              🎉 เปิดครบทุกใบแล้ว!
            </div>
          )}

          <button className="btn ghost" style={{ marginTop: 16 }} onClick={startRound}>
            🔄 แจกการ์ดใหม่ (สุ่มใหม่)
          </button>
          <button className="btn ghost" style={{ marginTop: 10 }} onClick={() => setStage("setup")}>
            เปลี่ยนหมวด / จำนวนการ์ด
          </button>
        </>
      )}
    </div>
  );
}
