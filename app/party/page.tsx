"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import type { Category, Question } from "@/lib/types";

const SOURCE_GAME_ID = "truth-or-lie"; // party mode reuses the same question bank
const RIDDLE_CATEGORY_NAME = "คำถามเชาว์";
const BREAK_EVERY = 10;
const BREAK_SECONDS = 120;

type Stage = "setup" | "countdown" | "reveal" | "break" | "done";

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function PartyModePage() {
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [selectedCatIds, setSelectedCatIds] = useState<Set<string>>(new Set());

  const [stage, setStage] = useState<Stage>("setup");
  const [deck, setDeck] = useState<Question[]>([]);
  const [idx, setIdx] = useState(0);
  const [countdownNum, setCountdownNum] = useState(3);
  const [breakSecondsLeft, setBreakSecondsLeft] = useState(BREAK_SECONDS);
  const breakTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    async function load() {
      const { data: cats } = await supabase
        .from("categories")
        .select("*")
        .eq("game_id", SOURCE_GAME_ID);
      const { data: qs } = await supabase
        .from("questions")
        .select("*")
        .eq("game_id", SOURCE_GAME_ID);
      setCategories(cats || []);
      setQuestions(qs || []);
      setSelectedCatIds(new Set((cats || []).map((c) => c.id)));
      setLoading(false);
    }
    load();
    return () => {
      if (breakTimerRef.current) clearInterval(breakTimerRef.current);
    };
  }, []);

  const pool = questions.filter((q) => selectedCatIds.has(q.category_id));

  function toggleCat(id: string) {
    const next = new Set(selectedCatIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedCatIds(next);
  }

  function startGame() {
    setDeck(shuffle(pool));
    setIdx(0);
    setStage("countdown");
  }

  function runCountdown() {
    setStage("countdown");
    setCountdownNum(3);
    let n = 3;
    const tick = () => {
      n -= 1;
      if (n <= 0) {
        setCountdownNum(0); // shows "โหวต!"
      } else {
        setCountdownNum(n);
        setTimeout(tick, 800);
      }
    };
    setTimeout(tick, 800);
  }

  function goToBreakOrNext(nextIdx: number) {
    if (nextIdx >= deck.length) {
      setStage("done");
      return;
    }
    if (nextIdx > 0 && nextIdx % BREAK_EVERY === 0) {
      startBreak(nextIdx);
    } else {
      setIdx(nextIdx);
      runCountdown();
    }
  }

  function startBreak(nextIdx: number) {
    setStage("break");
    setBreakSecondsLeft(BREAK_SECONDS);
    if (breakTimerRef.current) clearInterval(breakTimerRef.current);
    breakTimerRef.current = setInterval(() => {
      setBreakSecondsLeft((s) => {
        if (s <= 1) {
          if (breakTimerRef.current) clearInterval(breakTimerRef.current);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    setIdx(nextIdx);
  }

  function resumeFromBreak() {
    if (breakTimerRef.current) clearInterval(breakTimerRef.current);
    runCountdown();
  }

  function endGame() {
    if (breakTimerRef.current) clearInterval(breakTimerRef.current);
    setStage("setup");
    setDeck([]);
    setIdx(0);
  }

  const q = deck[idx];
  const catName = q ? categories.find((c) => c.id === q.category_id)?.name || "หมวด" : "";
  const isRiddle = catName === RIDDLE_CATEGORY_NAME;

  const SafetyBanner = () => (
    <div
      className="info-text"
      style={{
        textAlign: "center",
        marginBottom: 16,
        padding: "10px 12px",
        border: "1px solid var(--line)",
        borderRadius: 10,
        background: "rgba(0,0,0,0.2)",
      }}
    >
      🚫 พาสได้เสมอ ไม่ต้องมีเหตุผล &nbsp;·&nbsp; 💧 สลับเป็นน้ำเปล่าได้ตลอดเกม
    </div>
  );

  if (loading) {
    return <div className="frame">กำลังโหลด...</div>;
  }

  if (stage === "setup") {
    return (
      <div className="frame">
        <h2 className="section-title">🍻 จริงมั่ว วงเหล้า</h2>
        <div className="section-sub">
          พิธีกรเปิดหน้านี้อ่านคำถามให้วงฟัง ทุกคนโหวตพร้อมกัน ตอบผิดจิบ 1 — ไม่ต้องล็อกอิน
        </div>
        <SafetyBanner />
        <div className="row-between">
          <span style={{ fontSize: 13, color: "var(--muted)" }}>
            {pool.length} คำถามที่เลือกไว้
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
          {categories.map((c) => {
            const count = questions.filter((qq) => qq.category_id === c.id).length;
            return (
              <label className="cat-chip" key={c.id}>
                <span className="cname">
                  <input
                    type="checkbox"
                    checked={selectedCatIds.has(c.id)}
                    onChange={() => toggleCat(c.id)}
                  />
                  {c.name}
                  {c.name === RIDDLE_CATEGORY_NAME && " 🧠 (จิบคู่)"}
                </span>
                <span className="ccount">{count} ข้อ</span>
              </label>
            );
          })}
        </div>
        <button className="btn" disabled={pool.length === 0} onClick={startGame}>
          เริ่มวง
        </button>

        <div style={{ marginTop: 22 }}>
          <div className="qmeta" style={{ marginBottom: 8 }}>
            กติกาโดยย่อ
          </div>
          <ul style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.8, paddingLeft: 18 }}>
            <li>พิธีกรอ่านคำถาม → นับ 3-2-1 → ทุกคนชี้โป้งขึ้น (จริง) หรือลง (มั่ว) พร้อมกัน</li>
            <li>ตอบผิด จิบ 1 จิบ (ข้อหมวด &quot;คำถามเชาว์&quot; จิบ 2)</li>
            <li>ตอบถูกติดกัน 3 ข้อ ได้แจกจิบให้ใครก็ได้ 1 คน</li>
            <li>ทุก {BREAK_EVERY} ข้อ พักดื่มน้ำเปล่าอัตโนมัติ {BREAK_SECONDS / 60} นาที</li>
          </ul>
        </div>
        <Link href="/" className="btn ghost" style={{ display: "block", textAlign: "center", marginTop: 16 }}>
          กลับหน้าแรก
        </Link>
      </div>
    );
  }

  if (stage === "break") {
    const mm = String(Math.floor(breakSecondsLeft / 60)).padStart(2, "0");
    const ss = String(breakSecondsLeft % 60).padStart(2, "0");
    return (
      <div className="frame">
        <h2 className="section-title" style={{ textAlign: "center" }}>
          💧 พักดื่มน้ำ
        </h2>
        <div className="section-sub" style={{ textAlign: "center" }}>
          เล่นมาแล้ว {idx} ข้อ พักกันก่อนสักครู่
        </div>
        <div className="score-big">
          {mm}:{ss}
        </div>
        <div className="info-text" style={{ textAlign: "center", marginBottom: 20 }}>
          ทุกคนดื่มน้ำเปล่าอย่างน้อย 1 อึกก่อนเล่นต่อนะครับ
        </div>
        <div className="end-actions">
          <button className="btn" onClick={resumeFromBreak}>
            เล่นต่อเลย (ข้ามพัก)
          </button>
          <button className="btn ghost" onClick={endGame}>
            🛑 จบเกม
          </button>
        </div>
      </div>
    );
  }

  if (stage === "done") {
    return (
      <div className="frame">
        <h2 className="section-title" style={{ textAlign: "center" }}>
          🎉 จบวงแล้ว
        </h2>
        <div className="section-sub" style={{ textAlign: "center" }}>
          เล่นครบ {deck.length} ข้อ ดื่มน้ำเปล่าปิดท้ายกันหน่อยนะครับ
        </div>
        <div className="end-actions">
          <button className="btn" onClick={startGame}>
            เล่นรอบใหม่ (สุ่มใหม่)
          </button>
          <button className="btn ghost" onClick={endGame}>
            เปลี่ยนหมวดคำถาม
          </button>
          <Link href="/" className="btn ghost" style={{ textAlign: "center" }}>
            กลับหน้าแรก
          </Link>
        </div>
      </div>
    );
  }

  // stage === "countdown" or "reveal"
  return (
    <div className="frame">
      <div className="row-between">
        <span className="category-tag">
          {catName} {isRiddle && "🧠 จิบคู่"}
        </span>
        <span style={{ fontSize: 12, color: "var(--muted)", fontFamily: "Kanit" }}>
          ข้อ {idx + 1}/{deck.length}
        </span>
      </div>

      <div className="qcard">{q?.text}</div>

      {stage === "countdown" && (
        <div style={{ textAlign: "center", margin: "20px 0" }}>
          <div
            style={{
              fontFamily: "Kanit",
              fontWeight: 900,
              fontSize: countdownNum === 0 ? 40 : 64,
              color: "var(--gold)",
            }}
          >
            {countdownNum === 0 ? "โหวต! 👍👎" : countdownNum}
          </div>
          {countdownNum === 0 && (
            <button className="btn" style={{ marginTop: 16 }} onClick={() => setStage("reveal")}>
              เฉลย
            </button>
          )}
        </div>
      )}

      {stage === "reveal" && q && (
        <>
          <div className="reveal">
            <div className={"verdict " + (q.answer ? "ok" : "no")}>
              {q.answer ? "✅ คำตอบ: จริง" : "❌ คำตอบ: มั่ว"}
            </div>
            <div>{q.explain}</div>
            <div style={{ marginTop: 10, fontFamily: "Kanit", color: "var(--gold)" }}>
              ตอบผิด จิบ {isRiddle ? "2 จิบ 🧠" : "1 จิบ"} · ถูกติดกัน 3 ข้อ = แจกจิบได้ 1 คน
            </div>
          </div>
          <button className="btn" style={{ marginTop: 16 }} onClick={() => goToBreakOrNext(idx + 1)}>
            ข้อถัดไป
          </button>
        </>
      )}

      <SafetyBanner />
      <button className="btn ghost" onClick={endGame}>
        🛑 จบเกม
      </button>
    </div>
  );
}
