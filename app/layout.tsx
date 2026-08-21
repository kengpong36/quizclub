import type { Metadata } from "next";
import AuthProvider from "@/components/AuthProvider";
import NavBar from "@/components/NavBar";
import "./globals.css";

export const metadata: Metadata = {
  title: "ควิซคลับ — จริงหรือมั่ว & เกมอื่นๆ",
  description: "แพลตฟอร์มเกมควิซทายจริง/มั่ว จัดการคำถามและอันดับผู้เล่นได้",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Kanit:wght@400;500;600;700;900&family=Sarabun:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <AuthProvider>
          <div className="wrap">
            <NavBar />
            {children}
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
