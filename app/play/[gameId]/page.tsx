"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/components/AuthProvider";
import type { Category, Question } from "@/lib/types";
import { GAMES } from "@/lib/types";
import { playTick, playCorrect, playWrong, playFanfare } from "@/lib/sound";
import SoundToggle from "@/components/SoundToggle";

type Stage = "loading" | "pick" | "play" | "end";
const TOTAL_TIME = 10;
const FALLBACK_DAILY_LIMIT = 3;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function startOfTodayISO(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export default function PlayPage() {
  const { gameId } = useParams<{ gameId: string }>();
  const router = useRouter();
  const { session, profile, loading: authLoading } = useAuth();
  const game = GAMES.find((g) => g.id === gameId);

  const [stage, setStage] = useState<Stage>("loading");
  const [categories, setCategories] = useState<Category[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [selectedCatIds, setSelectedCatIds] = useState<Set<string>>(new Set());
  const [roundLength, setRoundLength] = useState(10);
  const [playsToday, setPlaysToday] = useState<number | null>(null);
  const [dailyLimit, setDailyLimit] = useState(FALLBACK_DAILY_LIMIT);
  const [limitError, setLimitError] = useState("");

  const [deck, setDeck] = useState<Question[]>([]);
  const [idx, setIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [timeLeft, setTimeLeft] = useState(TOTAL_TIME);
  const [answered, setAnswered] = useState(false);
  const [chosen, setChosen] = useState<boolean | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [bestStreak, setBestStreak] = useState(0);
  const [saved, setSaved] = useState(false);

  const isUnlimited = profile?.role === "admin";

  async function refreshPlaysToday(userId: string) {
    const { count } = await supabase
      .from("scores")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("game_id", gameId)
      .gte("played_at", startOfTodayISO());
    setPlaysToday(count ?? 0);
  }

  useEffect(() => {
    if (authLoading) return;
    if (!session) {
      setStage("pick"); // will render the login-required screen below
      return;
    }
    async function load() {
      const { data: cats } = await supabase
        .from("categories")
        .select("*")
        .eq("game_id", gameId);
      const { data: qs } = await supabase
        .from("questions")
        .select("*")
        .eq("game_id", gameId);
      setCategories(cats || []);
      setQuestions(qs || []);
      setSelectedCatIds(new Set((cats || []).map((c) => c.id)));
      const { data: settingRow } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "daily_play_limit")
        .maybeSingle();
      const parsed = settingRow ? parseInt(settingRow.value, 10) : NaN;
      setDailyLimit(!isNaN(parsed) && parsed > 0 ? parsed : FALLBACK_DAILY_LIMIT);
      if (session?.user?.id) await refreshPlaysToday(session.user.id);
      setStage("pick");
    }
    load();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId, authLoading, session]);

  if (!game) {
    return <div className="frame">ไม่พบเกมนี้</div>;
  }

  if (authLoading) {
    return <div className="frame">กำลังโหลด...</div>;
  }

  if (!session) {
    return (
      <div className="frame">
        <h2 className="section-title">ต้องเข้าสู่ระบบก่อนเล่น</h2>
        <div className="section-sub">
          เกมนี้ต้องมีบัญชีเพื่อบันทึกคะแนนและจำกัดจำนวนรอบต่อวัน — สมัครฟรี ใช้แค่ชื่อผู้ใช้กับรหัสผ่าน
        </div>
        <div className="end-actions">
          <Link href="/signup" className="btn" style={{ textAlign: "center" }}>
            สมัครสมาชิก
          </Link>
          <Link href="/login" className="btn ghost" style={{ textAlign: "center" }}>
            เข้าสู่ระบบ
          </Link>
          <Link href="/" className="btn ghost" style={{ textAlign: "center" }}>
            กลับหน้าแรก
          </Link>
        </div>
      </div>
    );
  }

  const pool = questions.filter((q) => selectedCatIds.has(q.category_id));
  const availableOptions = Array.from(
    new Set([5, 10, 15, pool.length].filter((v) => v > 0 && v <= pool.length))
  ).sort((a, b) => a - b);

  const remainingPlays = playsToday === null ? null : Math.max(0, dailyLimit - playsToday);
  const limitReached = !isUnlimited && remainingPlays !== null && remainingPlays <= 0;

  function toggleCat(id: string) {
    const next = new Set(selectedCatIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedCatIds(next);
  }

  function startGame() {
    if (limitReached) return;
    setLimitError("");
    const chosenLen = roundLength && pool.length >= roundLength ? roundLength : pool.length;
    const newDeck = shuffle(pool).slice(0, chosenLen);
    setDeck(newDeck);
    setIdx(0);
    setScore(0);
    setStreak(0);
    setBestStreak(0);
    setSaved(false);
    setStage("play");
    loadQuestion(0, newDeck);
  }

  function loadQuestion(i: number, d: Question[]) {
    setAnswered(false);
    setChosen(null);
    setTimeLeft(TOTAL_TIME);
    if (timerRef.current) clearInterval(timerRef.current);
    let t = TOTAL_TIME;
    let lastTickSecond = Math.ceil(t);
    timerRef.current = setInterval(() => {
      t -= 0.1;
      setTimeLeft(Math.max(0, t));
      const currentSecond = Math.ceil(t);
      if (currentSecond <= 3 && currentSecond >= 1 && currentSecond !== lastTickSecond) {
        playTick();
        lastTickSecond = currentSecond;
      }
      if (t <= 0) {
        if (timerRef.current) clearInterval(timerRef.current);
        handleAnswer(null, i, d);
      }
    }, 100);
  }

  function handleAnswer(userChoice: boolean | null, i?: number, d?: Question[]) {
    setAnswered((prevAnswered) => {
      if (prevAnswered) return prevAnswered;
      const curIdx = i ?? idx;
      const curDeck = d ?? deck;
      if (timerRef.current) clearInterval(timerRef.current);
      const q = curDeck[curIdx];
      const correct = userChoice === q.answer;
      if (correct) playCorrect();
      else playWrong();
      setChosen(userChoice);
      setScore((s) => {
        if (!correct) return s;
        const newStreak = streak + 1;
        return s + (newStreak >= 3 ? 15 : 10);
      });
      setStreak((s) => {
        const next = correct ? s + 1 : 0;
        setBestStreak((b) => Math.max(b, next));
        return next;
      });
      return true;
    });
  }

  function nextQuestion() {
    const next = idx + 1;
    if (next >= deck.length) {
      endGame();
    } else {
      setIdx(next);
      loadQuestion(next, deck);
    }
  }

  async function endGame() {
    setStage("end");
    playFanfare();
    if (session?.user?.id) {
      const { error } = await supabase.from("scores").insert({
        user_id: session.user.id,
        game_id: gameId,
        score,
        total_questions: deck.length,
        best_streak: bestStreak,
      });
      if (error) {
        // Likely blocked by the daily-limit trigger (edge case: limit hit
        // mid-session, e.g. played in another tab).
        setLimitError("หมดโควตาการเล่นวันนี้แล้ว คะแนนรอบนี้เลยไม่ถูกบันทึกลงอันดับนะครับ");
      } else {
        setSaved(true);
      }
      await refreshPlaysToday(session.user.id);
    }
  }

  function replaySameCategories() {
    startGame();
  }

  // ---------------- RENDER ----------------
  if (stage === "loading") {
    return <div className="frame">กำลังโหลด...</div>;
  }

  if (stage === "pick") {
    return (
      <div className="frame">
        <div className="row-between">
          <h2 className="section-title">เลือกหมวด — {game.name}</h2>
          <button className="link-btn" onClick={() => router.push("/")}>
            ← กลับหน้าแรก
          </button>
        </div>
        <div className="section-sub">เลือกหมวดที่อยากเล่น (เลือกได้หลายหมวด)</div>

        {!isUnlimited && remainingPlays !== null && (
          <div
            className="info-text"
            style={{
              marginBottom: 14,
              color: limitReached ? "#f0938c" : "var(--muted)",
            }}
          >
            {limitReached
              ? `เล่นครบ ${dailyLimit} ครั้งของวันนี้แล้ว กลับมาเล่นใหม่ได้พรุ่งนี้นะครับ`
              : `เล่นได้อีก ${remainingPlays}/${dailyLimit} ครั้งวันนี้`}
          </div>
        )}

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
          {categories.length === 0 && (
            <div className="empty-note">
              ยังไม่มีหมวดหมู่หรือคำถามในเกมนี้ ให้ admin ไปเพิ่มที่หน้า &quot;จัดการคำถาม&quot;
            </div>
          )}
          {categories.map((c) => {
            const count = questions.filter((q) => q.category_id === c.id).length;
            return (
              <label className="cat-chip" key={c.id}>
                <span className="cname">
                  <input
                    type="checkbox"
                    checked={selectedCatIds.has(c.id)}
                    onChange={() => toggleCat(c.id)}
                  />
                  {c.name}
                </span>
                <span className="ccount">{count} ข้อ</span>
              </label>
            );
          })}
        </div>
        {pool.length > 0 && (
          <>
            <label className="field-label">จำนวนคำถามต่อรอบ</label>
            <div className="len-select">
              {availableOptions.map((v) => (
                <button
                  key={v}
                  className={v === roundLength ? "sel" : ""}
                  onClick={() => setRoundLength(v)}
                >
                  {v === pool.length ? `ทั้งหมด (${v})` : v}
                </button>
              ))}
            </div>
          </>
        )}
        <button className="btn" disabled={pool.length === 0 || limitReached} onClick={startGame}>
          {limitReached ? "หมดโควตาวันนี้แล้ว" : "เริ่มเกม"}
        </button>
      </div>
    );
  }

  if (stage === "play") {
    const q = deck[idx];
    const catName = categories.find((c) => c.id === q.category_id)?.name || "หมวด";
    const pct = Math.max(0, (timeLeft / TOTAL_TIME) * 100);
    const correct = chosen !== null && chosen === q.answer;
    return (
      <div className="frame">
        <SoundToggle />
        <div className="hud">
          <span className="pill">
            ข้อ {idx + 1}/{deck.length}
          </span>
          <span className="pill streak">🔥 คอมโบ {streak}</span>
          <span className="pill">คะแนน {score}</span>
        </div>
        <div className="fuse-track">
          <div className="fuse-bar" style={{ width: pct + "%" }} />
        </div>
        <div className="category-tag">{catName}</div>
        <div className={"qcard" + (answered ? (correct ? " correct-pulse" : " shake") : "")}>
          {q.text}
        </div>
        <div className="answers">
          <button
            className={"ans-btn truth" + (chosen === true ? " chosen" : "")}
            disabled={answered}
            onClick={() => handleAnswer(true)}
          >
            จริง
          </button>
          <button
            className={"ans-btn lie" + (chosen === false ? " chosen" : "")}
            disabled={answered}
            onClick={() => handleAnswer(false)}
          >
            มั่ว
          </button>
        </div>
        {answered && (
          <>
            <div className="reveal">
              <div className={"verdict " + (q.answer ? "ok" : "no")}>
                {q.answer ? "✅ คำตอบ: จริง" : "❌ คำตอบ: มั่ว"}
              </div>
              <div>{q.explain}</div>
            </div>
            <button className="btn" style={{ marginTop: 16 }} onClick={nextQuestion}>
              ข้อถัดไป
            </button>
          </>
        )}
      </div>
    );
  }

  // stage === "end"
  const pctScore = score / (deck.length * 10);
  let rank = "🤡 มั่วยิ่งกว่าคำถาม";
  let desc = "ดูเหมือนคุณจะโดนหลอกได้ง่ายมาก ลองเล่นใหม่เพื่อแก้มือ!";
  if (pctScore >= 1.3) {
    rank = "🏆 ปรมาจารย์จริงหรือมั่ว";
    desc = "แม่นยำสุดขีด แถมยังตอบไวราวกับรู้ล่วงหน้า!";
  } else if (pctScore >= 1.0) {
    rank = "🥇 นักสืบมือฉมัง";
    desc = "ตอบถูกเกือบทุกข้อ ความรู้แน่นมาก";
  } else if (pctScore >= 0.6) {
    rank = "🥈 นักทายฝีมือดี";
    desc = "ทำได้ดี แต่ยังมีบางข้อที่โดนหลอกอยู่บ้าง";
  } else if (pctScore >= 0.3) {
    rank = "🥉 มือใหม่หัดทาย";
    desc = "ยังงงๆ กับความจริงและเรื่องมั่วอยู่บ้าง ลองใหม่อีกครั้ง!";
  }

  const canReplay = isUnlimited || (remainingPlays !== null && remainingPlays > 0);

  return (
    <div className="frame">
      <div style={{ fontFamily: "Kanit", color: "var(--muted)", textAlign: "center" }}>
        คะแนนรวมของคุณ
      </div>
      <div className="score-big">{score}</div>
      <div className="rank">{rank}</div>
      <div className="end-desc">{desc}</div>
      {saved && (
        <div className="info-text" style={{ textAlign: "center", marginBottom: 16 }}>
          บันทึกคะแนนลงอันดับแล้ว ✅
        </div>
      )}
      {limitError && (
        <div className="error-text" style={{ textAlign: "center", marginBottom: 16 }}>
          {limitError}
        </div>
      )}
      {!isUnlimited && remainingPlays !== null && (
        <div className="info-text" style={{ textAlign: "center", marginBottom: 16 }}>
          เหลือโควตาเล่นวันนี้อีก {remainingPlays}/{dailyLimit} ครั้ง
        </div>
      )}
      <div className="end-actions">
        <button className="btn" onClick={replaySameCategories} disabled={!canReplay}>
          {canReplay ? "เล่นหมวดเดิมอีกครั้ง" : "หมดโควตาวันนี้แล้ว"}
        </button>
        <button className="btn ghost" onClick={() => router.push("/leaderboard")}>
          ดูกระดานอันดับ
        </button>
        <button className="btn ghost" onClick={() => router.push("/")}>
          กลับหน้าแรก
        </button>
      </div>
    </div>
  );
}
