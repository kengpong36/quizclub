"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { playCorrect, playTick, playFanfare } from "@/lib/sound";
import SoundToggle from "@/components/SoundToggle";

const WORD_BANK: Record<string, string[]> = {
  "🐾 สัตว์": [
    "ช้าง", "เสือ", "จิงโจ้", "ยีราฟ", "เต่า", "แมว", "สุนัข", "ปลาวาฬ", "นกฮูก",
    "ผีเสื้อ", "กระต่าย", "หมี", "สิงโต", "จระเข้", "งู", "ปลาหมึก", "แมงมุม",
    "นกกระจอกเทศ", "ค้างคาว", "ลิง", "แพนด้า", "หมาป่า", "ฮิปโป", "ยุง",
  ],
  "💼 อาชีพ": [
    "หมอ", "ครู", "ตำรวจ", "นักบิน", "พ่อครัว", "ทนายความ", "วิศวกร", "นักร้อง",
    "ช่างตัดผม", "นักดับเพลิง", "ชาวประมง", "เกษตรกร", "นักข่าว", "สถาปนิก",
    "พยาบาล", "ช่างภาพ", "นักแสดง", "คนขับแท็กซี่", "พนักงานส่งของ",
  ],
  "🍜 อาหาร": [
    "ผัดไทย", "ต้มยำกุ้ง", "ส้มตำ", "ข้าวเหนียวมะม่วง", "พิซซ่า", "ซูชิ",
    "ก๋วยเตี๋ยว", "แกงเขียวหวาน", "ไก่ทอด", "สปาเก็ตตี้", "ไอศกรีม",
    "แฮมเบอร์เกอร์", "หมูกระทะ", "ข้าวมันไก่", "ชาไข่มุก", "ขนมครก", "สุกี้",
  ],
  "⚽ กีฬา": [
    "ฟุตบอล", "บาสเก็ตบอล", "เทนนิส", "ว่ายน้ำ", "มวยไทย", "แบดมินตัน",
    "กอล์ฟ", "วอลเลย์บอล", "ปิงปอง", "วิ่งมาราธอน", "ยิงธนู", "มวยปล้ำ",
    "สเก็ตบอร์ด", "โบว์ลิ่ง", "ปั่นจักรยาน", "ยิมนาสติก",
  ],
  "🏠 สิ่งของในบ้าน": [
    "ตู้เย็น", "โทรทัศน์", "หมอน", "พัดลม", "กระทะ", "ไม้กวาด", "นาฬิกา",
    "กระจก", "เตารีด", "เครื่องซักผ้า", "ร่ม", "กรรไกร", "หม้อหุงข้าว", "เตียง",
  ],
  "🎭 คำกริยา/แอ๊กชัน": [
    "ว่ายน้ำ", "เต้นรำ", "นอนหลับ", "ร้องไห้", "หัวเราะ", "วิ่ง", "กระโดด",
    "ปีนเขา", "ทำอาหาร", "ขับรถ", "ตกปลา", "ถ่ายรูป", "ปั่นจักรยาน", "ร้องเพลง",
    "ตีกอล์ฟ", "แปรงฟัน", "ตัดผม", "ล้างจาน",
  ],
};

const DURATIONS = [30, 60, 90, 120];
const SHAKE_THRESHOLD = 18;
const SHAKE_DEBOUNCE_MS = 900;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

type Stage = "setup" | "playing" | "end";
type MotionPermState = "unknown" | "not-needed" | "needed" | "granted" | "denied";

export default function CharadesPage() {
  const [stage, setStage] = useState<Stage>("setup");
  const [selectedCats, setSelectedCats] = useState<Set<string>>(new Set(Object.keys(WORD_BANK)));
  const [duration, setDuration] = useState(60);
  const [motionPerm, setMotionPerm] = useState<MotionPermState>("unknown");

  const [queue, setQueue] = useState<string[]>([]);
  const [wordIdx, setWordIdx] = useState(0);
  const [correctWords, setCorrectWords] = useState<string[]>([]);
  const [timeLeft, setTimeLeft] = useState(60);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastShakeRef = useRef(0);
  const stageRef = useRef<Stage>("setup");

  useEffect(() => {
    stageRef.current = stage;
  }, [stage]);

  useEffect(() => {
    const DME = window.DeviceMotionEvent as unknown as
      | { requestPermission?: () => Promise<string> }
      | undefined;
    if (typeof DeviceMotionEvent !== "undefined" && DME?.requestPermission) {
      setMotionPerm("needed");
    } else if (typeof window !== "undefined" && "DeviceMotionEvent" in window) {
      setMotionPerm("not-needed");
    } else {
      setMotionPerm("not-needed");
    }
  }, []);

  useEffect(() => {
    function handleMotion(e: DeviceMotionEvent) {
      if (stageRef.current !== "playing") return;
      const acc = e.accelerationIncludingGravity;
      if (!acc) return;
      const magnitude = Math.sqrt((acc.x || 0) ** 2 + (acc.y || 0) ** 2 + (acc.z || 0) ** 2);
      const now = Date.now();
      if (magnitude > SHAKE_THRESHOLD && now - lastShakeRef.current > SHAKE_DEBOUNCE_MS) {
        lastShakeRef.current = now;
        markCorrect();
      }
    }
    window.addEventListener("devicemotion", handleMotion);
    return () => window.removeEventListener("devicemotion", handleMotion);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function requestMotionPermission() {
    const DME = window.DeviceMotionEvent as unknown as { requestPermission?: () => Promise<string> };
    if (DME?.requestPermission) {
      try {
        const res = await DME.requestPermission();
        setMotionPerm(res === "granted" ? "granted" : "denied");
      } catch {
        setMotionPerm("denied");
      }
    }
  }

  function toggleCat(cat: string) {
    const next = new Set(selectedCats);
    if (next.has(cat)) next.delete(cat);
    else next.add(cat);
    setSelectedCats(next);
  }

  function startGame() {
    let words: string[] = [];
    selectedCats.forEach((cat) => (words = words.concat(WORD_BANK[cat])));
    words = shuffle(words);
    if (words.length === 0) return;
    setQueue(words);
    setWordIdx(0);
    setCorrectWords([]);
    setTimeLeft(duration);
    setStage("playing");

    if (timerRef.current) clearInterval(timerRef.current);
    let t = duration;
    timerRef.current = setInterval(() => {
      t -= 1;
      setTimeLeft(t);
      if (t <= 3 && t > 0) playTick();
      if (t <= 0) {
        if (timerRef.current) clearInterval(timerRef.current);
        endRound();
      }
    }, 1000);
  }

  function nextWord() {
    setWordIdx((i) => (i + 1) % Math.max(queue.length, 1));
  }

  function markCorrect() {
    playCorrect();
    setCorrectWords((prev) => [...prev, queue[wordIdx]]);
    nextWord();
  }

  function skipWord() {
    nextWord();
  }

  function endRound() {
    playFanfare();
    setStage("end");
  }

  function backToSetup() {
    if (timerRef.current) clearInterval(timerRef.current);
    setStage("setup");
  }

  const currentWord = queue[wordIdx] || "";

  if (stage === "setup") {
    return (
      <div className="frame">
        <SoundToggle />
        <h2 className="section-title">🙊 เกมใบ้คำ</h2>
        <div className="section-sub">
          ถือมือถือแปะหน้าผาก ให้เพื่อนช่วยใบ้คำในจอ เขย่าเครื่องเมื่อทายถูกเพื่อไปคำถัดไป
        </div>

        <div className="row-between">
          <span style={{ fontSize: 13, color: "var(--muted)" }}>เลือกหมวดคำ</span>
          <button
            className="link-btn"
            onClick={() =>
              setSelectedCats(
                selectedCats.size === Object.keys(WORD_BANK).length
                  ? new Set()
                  : new Set(Object.keys(WORD_BANK))
              )
            }
          >
            เลือก/ยกเลิกทั้งหมด
          </button>
        </div>
        <div className="cat-list">
          {Object.keys(WORD_BANK).map((cat) => (
            <label className="cat-chip" key={cat}>
              <span className="cname">
                <input type="checkbox" checked={selectedCats.has(cat)} onChange={() => toggleCat(cat)} />
                {cat}
              </span>
              <span className="ccount">{WORD_BANK[cat].length} คำ</span>
            </label>
          ))}
        </div>

        <label className="field-label">เวลาต่อรอบ</label>
        <div className="len-select">
          {DURATIONS.map((d) => (
            <button key={d} className={d === duration ? "sel" : ""} onClick={() => setDuration(d)}>
              {d} วิ
            </button>
          ))}
        </div>

        {motionPerm === "needed" && (
          <div className="info-text" style={{ marginBottom: 12 }}>
            📱 อุปกรณ์นี้ต้องขออนุญาตใช้เซนเซอร์เขย่าก่อนเล่น
            <button className="btn small" style={{ marginTop: 8 }} onClick={requestMotionPermission}>
              เปิดเซนเซอร์เขย่า
            </button>
          </div>
        )}
        {motionPerm === "denied" && (
          <div className="error-text" style={{ marginBottom: 12 }}>
            ไม่ได้รับอนุญาตใช้เซนเซอร์ — ใช้ปุ่ม &quot;ถูก&quot; / &quot;ข้าม&quot; บนจอแทนได้เลยระหว่างเล่น
          </div>
        )}

        <button className="btn" disabled={selectedCats.size === 0} onClick={startGame}>
          🎬 เริ่มเกม
        </button>
        <Link href="/" className="btn ghost" style={{ display: "block", textAlign: "center", marginTop: 12 }}>
          กลับหน้าแรก
        </Link>
      </div>
    );
  }

  if (stage === "end") {
    return (
      <div className="frame">
        <SoundToggle />
        <h2 className="section-title" style={{ textAlign: "center" }}>
          ⏱ หมดเวลา!
        </h2>
        <div className="score-big">{correctWords.length}</div>
        <div className="rank">ทายถูกทั้งหมด (คำ)</div>
        {correctWords.length > 0 && (
          <div className="info-text" style={{ marginBottom: 16 }}>
            {correctWords.join(" · ")}
          </div>
        )}
        <div className="end-actions">
          <button className="btn" onClick={startGame}>
            เล่นรอบใหม่ (สุ่มใหม่)
          </button>
          <button className="btn ghost" onClick={backToSetup}>
            เปลี่ยนหมวด/เวลา
          </button>
          <Link href="/" className="btn ghost" style={{ textAlign: "center" }}>
            กลับหน้าแรก
          </Link>
        </div>
      </div>
    );
  }

  // stage === "playing"
  return (
    <div className="frame">
      <SoundToggle />
      <div className="hud">
        <span className="pill">⏱ {timeLeft} วิ</span>
        <span className="pill streak">✅ {correctWords.length}</span>
      </div>
      <div className="fuse-track">
        <div className="fuse-bar" style={{ width: `${(timeLeft / duration) * 100}%` }} />
      </div>
      <div className="qcard" style={{ minHeight: 180, fontSize: "clamp(28px, 9vw, 40px)" }} key={currentWord + wordIdx}>
        {currentWord}
      </div>
      <div className="info-text" style={{ textAlign: "center", marginBottom: 14 }}>
        📳 เขย่าเครื่องเมื่อทายถูก
      </div>
      <div className="answers">
        <button className="ans-btn truth" onClick={markCorrect}>
          ✅ ถูก
        </button>
        <button className="ans-btn lie" onClick={skipWord}>
          ⏭ ข้าม
        </button>
      </div>
    </div>
  );
}
