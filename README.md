# ควิซคลับ (QuizClub)

เกมควิซ "จริงหรือมั่ว" (และเผื่อเกมอื่นในอนาคต) พร้อมระบบ:
- จัดการคำถาม/หมวดหมู่ผ่านหน้า Admin (เปลี่ยนแล้วผู้เล่นทุกคนเห็นทันที)
- สมัครสมาชิก/เข้าสู่ระบบ (Supabase Auth)
- กระดานอันดับ (leaderboard) ต่อเกม
- Deploy ฟรีผ่าน Vercel ผูกกับ GitHub อัตโนมัติ

Stack: **Next.js 14 (App Router) + Supabase (Postgres + Auth) + Vercel**

---

## 1) ตั้งค่า Supabase (ฐานข้อมูล + ระบบสมาชิก — ฟรี)

1. ไปที่ https://supabase.com → สมัคร/ล็อกอิน → **New project**
   - ตั้งชื่อโปรเจกต์ ตั้งรหัสผ่านฐานข้อมูล (เก็บไว้ดีๆ) เลือก region ใกล้ไทย เช่น Singapore
2. รอโปรเจกต์สร้างเสร็จ (1-2 นาที)
3. ไปที่เมนู **SQL Editor** (แถบซ้าย) → **New query**
4. เปิดไฟล์ `supabase/schema.sql` ในโปรเจกต์นี้ → คัดลอกทั้งหมด → วางแล้วกด **Run**
   - จะได้ตาราง `profiles`, `categories`, `questions`, `scores` พร้อม Row Level Security (RLS) ที่ตั้งไว้ว่า:
     - ทุกคนอ่านคำถาม/หมวดหมู่/อันดับได้
     - มีแค่ผู้ใช้ role = `admin` เท่านั้นที่แก้ไขคำถาม/หมวดหมู่ได้
     - ผู้เล่นบันทึกคะแนนของตัวเองได้เท่านั้น
5. ไปที่ **Project Settings → API** → คัดลอกค่า 2 ตัว:
   - `Project URL` → ใช้เป็น `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → ใช้เป็น `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### ตั้งตัวเองเป็น admin
1. เข้าเว็บที่ deploy แล้ว (หรือรันในเครื่องก่อนก็ได้) → **สมัครสมาชิก** ด้วยอีเมลตัวเอง
2. กลับไปที่ Supabase → **SQL Editor** → รันคำสั่ง (แก้ `YOUR_USERNAME` เป็นชื่อที่ใช้สมัคร):
   ```sql
   update profiles set role = 'admin' where username = 'YOUR_USERNAME';
   ```
3. ล็อกเอาต์แล้วล็อกอินใหม่อีกครั้ง — เมนู "จัดการคำถาม" จะปรากฏขึ้น

> หมายเหตุ: ค่าเริ่มต้น Supabase จะบังคับให้ยืนยันอีเมลก่อนล็อกอินได้ ถ้าอยากปิดไว้ตอนทดสอบ ไปที่
> **Authentication → Providers → Email** แล้วปิด "Confirm email"

---

## 2) รันทดสอบในเครื่องตัวเอง (ไม่บังคับ)

```bash
npm install
cp .env.local.example .env.local
# แก้ .env.local ใส่ค่า URL และ anon key จาก Supabase
npm run dev
```
เปิด http://localhost:3000

---

## 3) ขึ้น GitHub (ไม่ต้องใช้คำสั่ง git ก็ได้)

**วิธีง่ายสุด (ผ่านเว็บ ไม่ต้องลงโปรแกรมอะไร):**
1. เข้า https://github.com/new → ตั้งชื่อ repo เช่น `quizclub` → Create repository
2. ในหน้า repo ว่างเปล่า กด **uploading an existing file**
3. ลาก "ทั้งโฟลเดอร์" ของโปรเจกต์นี้วางลงไป (ยกเว้น `node_modules`, `.next`, `.env.local` ที่ไม่ควรอัปโหลด — ถ้าใช้ .gitignore ที่แนบมาไม่ต้องกังวลเรื่องนี้เวลาใช้ git จริง แต่ตอนลากผ่านเว็บต้องลบโฟลเดอร์เหล่านี้ออกเองก่อนลาก เพราะเว็บไม่มองไฟล์ .gitignore)
4. Commit changes

**หรือถ้าถนัด CLI:**
```bash
git init
git add .
git commit -m "init quizclub"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/quizclub.git
git push -u origin main
```

---

## 4) Deploy ฟรีบน Vercel (ผูก GitHub อัตโนมัติ)

1. เข้า https://vercel.com → สมัคร/ล็อกอินด้วย GitHub account เดียวกัน
2. **Add New → Project** → เลือก repo `quizclub` ที่เพิ่งสร้าง → Import
3. ในหน้า Configure Project → เปิด **Environment Variables** ใส่:
   - `NEXT_PUBLIC_SUPABASE_URL` = (ค่าจาก Supabase)
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = (ค่าจาก Supabase)
4. กด **Deploy** รอสักครู่ ได้ลิงก์ เช่น `https://quizclub-yourname.vercel.app`

จากนี้ไป **ทุกครั้งที่ push โค้ดขึ้น GitHub branch `main`, Vercel จะ build และ deploy ให้อัตโนมัติ** ไม่ต้องกดอะไรเพิ่ม

---

## โครงสร้างโปรเจกต์

```
app/
  page.tsx                 หน้าแรก (เลือกเกม)
  play/[gameId]/page.tsx   เลือกหมวด + เล่นเกม + จบเกม (บันทึกคะแนน)
  leaderboard/page.tsx     กระดานอันดับ
  admin/page.tsx           จัดการคำถาม/หมวดหมู่ (เฉพาะ admin)
  login/, signup/          ระบบสมาชิก
lib/
  supabaseClient.ts        ตัวเชื่อมต่อ Supabase
  types.ts                 type ต่างๆ + GAMES registry
components/
  AuthProvider.tsx         เก็บสถานะผู้ใช้ที่ล็อกอินทั้งแอป
  NavBar.tsx                เมนูบนสุด
supabase/
  schema.sql                สคีมาฐานข้อมูล + RLS (รันครั้งเดียวตอนตั้งโปรเจกต์)
```

## เพิ่มเกมใหม่ในอนาคต

1. เปิด `lib/types.ts` → เพิ่ม object ใหม่ใน `GAMES` array เช่น
   ```ts
   { id: "guess-the-price", name: "ทายราคา", icon: "💰", desc: "...", playable: true }
   ```
2. ไปหน้า Admin → สร้างหมวดหมู่/คำถามโดยตั้ง `game_id` เป็น id ใหม่นั้น (ถ้ากลไกเกมเหมือนเดิม
   คือถาม-ตอบจริง/มั่ว จะเล่นได้ทันทีที่ `/play/guess-the-price`)
3. ถ้ากลไกเกมต่างไปจากเดิม (ไม่ใช่ true/false) จะต้องเขียนหน้าเกมใหม่แยกต่างหาก
   (คัดลอกโครงจาก `app/play/[gameId]/page.tsx` ไปปรับ)
