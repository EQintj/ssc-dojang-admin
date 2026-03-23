"use client";

import React, { useState, useEffect, useCallback } from "react";
import Script from "next/script";
import {
  MapPin,
  Calendar,
  Users,
  Zap,
  CheckCircle,
  Navigation,
  CreditCard,
  Star,
  Play,
  Image as ImageIcon,
  Info,
  Camera,
  Lock,
  Clock,
  Shield,
  FileText,
  Video,
  Copy,
  Phone
} from "lucide-react";
import { supabase } from "@/lib/supabase";

// ─── 타입 정의 ───────────────────────────────────────────────────────────────
type EventScale = "weekday" | "saturday" | "allDayA" | "allDayB";

interface PartInfo {
  active: boolean;
  startTime: string; // "HH:MM"
  endTime: string;   // "HH:MM"
  count: number;
}

interface FormData {
  gymName: string;
  contact: string;
  baseAddress: string;
  detailAddress: string;
  eventScale: EventScale;
  parts: { p1: PartInfo; p2: PartInfo; p3: PartInfo; p4: PartInfo };
  facilities: {
    size: string;
    elevator: boolean;
    parking: boolean;
    parkingLocation: string;
    projector: boolean;
    audio: boolean;
  };
  snsAgreed: boolean;
  eventDate: string;
  status: string;
  reviewText: string;
  rating: number;
}

const DEFAULT_PARTS = {
  p1: { active: true, startTime: "10:00", endTime: "12:00", count: 0 },
  p2: { active: false, startTime: "", endTime: "", count: 0 },
  p3: { active: false, startTime: "", endTime: "", count: 0 },
  p4: { active: false, startTime: "", endTime: "", count: 0 },
};

// ─── 유틸 ────────────────────────────────────────────────────────────────
function formatTime(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

function getAmPm(timeStr: string): string {
  if (!timeStr || timeStr.length < 5) return "";
  const hours = parseInt(timeStr.slice(0, 2), 10);
  return hours < 12 ? "오전" : "오후";
}

const PRICE_CONFIG: Record<EventScale, { basePrice: number; baseCount: number; addPrice: number; label: string }> = {
  weekday: { basePrice: 350000, baseCount: 35, addPrice: 10000, label: "평일" },
  saturday: { basePrice: 400000, baseCount: 40, addPrice: 10000, label: "토요일 파트" },
  allDayA: { basePrice: 600000, baseCount: 60, addPrice: 10000, label: "토요일 종일 A" },
  allDayB: { basePrice: 800000, baseCount: 80, addPrice: 10000, label: "토요일 종일 B" },
};

// ─── 메인 컴포넌트 ────────────────────────────────────────────────────────────
export default function DirectorDashboard() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loginForm, setLoginForm] = useState({ gymName: "", pin: "" });
  const [isExistingGym, setIsExistingGym] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const [recentGyms, setRecentGyms] = useState<string[]>([]);
  useEffect(() => {
    try {
      const saved = localStorage.getItem("kssc_recent_gyms");
      if (saved) setRecentGyms(JSON.parse(saved));
    } catch {}
  }, []);

  const saveRecentGym = (name: string) => {
    try {
      const updated = [name, ...recentGyms.filter(g => g !== name)].slice(0, 5);
      setRecentGyms(updated);
      localStorage.setItem("kssc_recent_gyms", JSON.stringify(updated));
    } catch {}
  };

  const [formData, setFormData] = useState<FormData>({
    gymName: "",
    contact: "",
    baseAddress: "",
    detailAddress: "",
    eventScale: "weekday",
    parts: DEFAULT_PARTS,
    facilities: {
      size: "",
      elevator: false,
      parking: false,
      parkingLocation: "",
      projector: false,
      audio: false,
    },
    snsAgreed: false,
    eventDate: "",
    status: "예약대기",
    reviewText: "",
    rating: 5,
  });

  const [totalPrice, setTotalPrice] = useState(0);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  // 총 인원 계산
  const totalCount = Object.values(formData.parts).reduce(
    (acc, p) => acc + (p.active ? p.count : 0),
    0
  );

  // 금액 자동계산
  useEffect(() => {
    const cfg = PRICE_CONFIG[formData.eventScale];
    let price = cfg.basePrice;
    if (totalCount > cfg.baseCount) {
      price += (totalCount - cfg.baseCount) * cfg.addPrice;
    }
    setTotalPrice(price);
  }, [formData.eventScale, totalCount]);

  // 토요일 파트 1부만 점유
  useEffect(() => {
    if (formData.eventScale === "saturday") {
      setFormData((prev) => ({
        ...prev,
        parts: {
          ...prev.parts,
          p2: { ...prev.parts.p2, active: false, count: 0 },
          p3: { ...prev.parts.p3, active: false, count: 0 },
          p4: { ...prev.parts.p4, active: false, count: 0 },
        },
      }));
    }
  }, [formData.eventScale]);

  // 연락처 000-0000-0000 포맷터
  const handleContactChange = (raw: string) => {
    const onlyNums = raw.replace(/\D/g, "");
    let formatted = onlyNums;
    if (onlyNums.length <= 3) {
      formatted = onlyNums;
    } else if (onlyNums.length <= 7) {
      formatted = `${onlyNums.slice(0, 3)}-${onlyNums.slice(3)}`;
    } else {
      formatted = `${onlyNums.slice(0, 3)}-${onlyNums.slice(3, 7)}-${onlyNums.slice(7, 11)}`;
    }
    setFormData({ ...formData, contact: formatted });
  };

  // ─── 스마트 로그인 로직 ─────────────────────────────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginForm.gymName.trim() || loginForm.pin.length !== 4) {
      alert("도장명과 숫자 4자리 비밀번호를 입력해주세요.");
      return;
    }
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("gym_events")
        .select("*")
        .eq("gym_name", loginForm.gymName)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error && error.code !== "PGRST116") {
        console.error("DB Check Error:", error);
      }

      if (data) {
        if (data.password === loginForm.pin) {
          // 주소 분리 처리 (기존 데이터 호환)
          let base = data.address || "";
          let detail = "";
          if (base.includes("|")) {
            const split = base.split("|");
            base = split[0];
            detail = split[1] || "";
          }

          setFormData({
            gymName: data.gym_name,
            contact: data.contact || "",
            baseAddress: base,
            detailAddress: detail,
            eventScale: data.event_scale || "weekday",
            parts: data.parts || DEFAULT_PARTS,
            facilities: data.facilities || formData.facilities,
            snsAgreed: data.sns_agreed || false,
            eventDate: data.facilities?.eventDate || "",
            status: data.status || "예약대기",
            reviewText: data.facilities?.reviewText || "",
            rating: data.facilities?.rating || 5,
          });
          setIsExistingGym(true);
          setIsLoggedIn(true);
          saveRecentGym(loginForm.gymName);
        } else {
          alert("비밀번호가 일치하지 않습니다. 도장명과 비밀번호를 다시 확인하세요.");
        }
      } else {
        setFormData((prev) => ({ ...prev, gymName: loginForm.gymName }));
        setIsExistingGym(false);
        setIsLoggedIn(true);
        saveRecentGym(loginForm.gymName);
      }
    } catch (err) {
      console.error(err);
      alert("로그인 처리 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  // ─── 데이터 취합 및 저장 ──────────────────────────────
  const handleSave = async () => {
    setIsLoading(true);
    try {
      const payload = {
        gym_name: formData.gymName,
        password: loginForm.pin,
        contact: formData.contact,
        address: `${formData.baseAddress}|${formData.detailAddress}`, // | 로 구분해서 합산 저장
        event_scale: formData.eventScale,
        parts: formData.parts,
        facilities: {
          ...formData.facilities,
          eventDate: formData.eventDate,
          reviewText: formData.reviewText,
          rating: formData.rating,
        },
        sns_agreed: formData.snsAgreed,
        total_price: totalPrice,
        total_count: totalCount,
        ...(isExistingGym ? {} : { status: "예약대기" }),
      };

      let dbError = null;

      if (isExistingGym) {
        const { error } = await supabase
          .from("gym_events")
          .update({ ...payload, created_at: new Date().toISOString() })
          .eq("gym_name", formData.gymName);
        dbError = error;
      } else {
        const { error } = await supabase.from("gym_events").insert([{ ...payload, created_at: new Date().toISOString() }]);
        dbError = error;
      }

      if (dbError) {
        console.error("Supabase Save Error:", dbError);
        alert("\n데이터 저장 오류!\n관리자에게 문의하세요.\n");
        return;
      }

      setIsExistingGym(true);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveReview = async () => {
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from("gym_events")
        .update({
          facilities: {
            ...formData.facilities,
            eventDate: formData.eventDate,
            reviewText: formData.reviewText,
            rating: formData.rating,
          }
        })
        .eq("gym_name", formData.gymName);
      
      if (error) throw error;
      alert("✅ 후기가 성공적으로 등록되었습니다. 감사합니다!");
    } catch (err) {
      console.error(err);
      alert("후기 등록 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleTimeInput = useCallback((
    partKey: keyof FormData["parts"],
    field: "startTime" | "endTime",
    value: string
  ) => {
    const formatted = formatTime(value);
    setFormData((prev) => ({
      ...prev,
      parts: {
        ...prev.parts,
        [partKey]: { ...prev.parts[partKey], [field]: formatted },
      },
    }));
  }, []);

  const handleCountInput = useCallback((partKey: keyof FormData["parts"], value: string) => {
    setFormData((prev) => ({
      ...prev,
      parts: {
        ...prev.parts,
        [partKey]: { ...prev.parts[partKey], count: Number(value) || 0 },
      },
    }));
  }, []);

  const handleScaleChange = (type: EventScale) => {
    if (type === "allDayA") {
      alert("본 상품은 오전 2시간(30명), 오후 2시간(30명) 총 60명 기준 작전입니다.");
    } else if (type === "allDayB") {
      alert("본 상품은 오전 3시간(40명), 오후 3시간(40명) 총 80명 기준 작전입니다.");
    } else if (type === "saturday") {
      alert("토요일 파트 작전은 1부(단일 섹션)만 활성화됩니다.");
    }
    setFormData({ ...formData, eventScale: type });
  };

  const openDaumPostcode = () => {
    if ((window as any).daum && (window as any).daum.Postcode) {
      new (window as any).daum.Postcode({
        oncomplete: function (data: any) {
          setFormData((prev) => ({ ...prev, baseAddress: data.address }));
        }
      }).open();
    } else {
      alert("주소 검색 스크립트가 아직 로드되지 않았습니다. 잠시 후 다시 시도해주세요.");
    }
  };

  const copyAccount = () => {
    navigator.clipboard.writeText("215-081652-01-013").then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const isSaturdayRestrict = formData.eventScale === "saturday";
  const partKeys: (keyof FormData["parts"])[] = ["p1", "p2", "p3", "p4"];
  const posterProjectUrl = "https://kssc-poster.vercel.app";

  const handleLogout = () => {
    setIsLoggedIn(false);
    setLoginForm({ gymName: "", pin: "" });
  };

  // ─── LOGIN SCREEN ───
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-[#0b0e14] text-white flex items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-cyan-900/20 blur-[100px] rounded-full pointer-events-none"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-pink-900/20 blur-[100px] rounded-full pointer-events-none"></div>

        <form
          onSubmit={handleLogin}
          className="relative z-10 tactical-panel p-8 rounded-2xl shadow-[0_0_30px_rgba(34,211,238,0.1)] w-full max-w-sm space-y-8"
        >
          <div className="text-center mb-6">
            <h1 className="text-3xl font-black italic tracking-tighter text-cyan-400 neon-text-cyan mb-2">
              K-SURVIVAL
              <br />
              STATION
            </h1>
            <p className="text-sm text-gray-500 font-bold tracking-widest flex items-center justify-center gap-2">
              <Shield size={14} className="text-pink-500" />
              관장님 보안 접속 채널
            </p>
          </div>

          <div className="space-y-5">
            <div>
              <label className="block text-[11px] font-bold text-cyan-400 mb-2">
                소속 도장명
              </label>
              <input
                type="text"
                required
                value={loginForm.gymName}
                onChange={(e) => setLoginForm({ ...loginForm, gymName: e.target.value })}
                className="w-full bg-[#0b0e14] border border-cyan-800/50 rounded-lg p-4 text-sm focus:border-cyan-400 focus:shadow-[0_0_10px_rgba(34,211,238,0.3)] outline-none transition-all placeholder:text-gray-700"
                placeholder="예: 라온 태권도"
              />
              {recentGyms.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  <span className="text-[10px] text-gray-500 font-bold self-center mr-1">최근 입력:</span>
                  {recentGyms.map((gym, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setLoginForm({ ...loginForm, gymName: gym })}
                      className="bg-cyan-950/40 border border-cyan-800/50 hover:bg-cyan-900/60 text-cyan-300 px-3 py-1.5 rounded-full text-[10px] font-bold transition-colors"
                    >
                      {gym}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label className="block text-[11px] font-bold text-pink-400 mb-2">
                보안 핀 번호 (비밀번호 4자리)
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-pink-500/50" size={16} />
                <input
                  type="password"
                  required
                  maxLength={4}
                  pattern="\d{4}"
                  value={loginForm.pin}
                  onChange={(e) => setLoginForm({ ...loginForm, pin: e.target.value.replace(/\D/g, "") })}
                  className="w-full bg-[#0b0e14] border border-pink-800/50 rounded-lg p-4 pl-12 text-sm focus:border-pink-400 focus:shadow-[0_0_10px_rgba(236,72,153,0.3)] outline-none transition-all tracking-[0.5em] placeholder:tracking-normal placeholder:text-gray-700 font-bold"
                  placeholder="숫자 4자리"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-cyan-500 hover:bg-cyan-400 text-[#0b0e14] font-black italic tracking-wider py-4 rounded-lg transition-all disabled:opacity-50 neon-border-cyan uppercase"
          >
            {isLoading ? "시스템 인증 중..." : "시스템 로그인"}
          </button>
        </form>
        
        <a href="/admin-master" className="absolute bottom-6 text-[10px] text-gray-600 hover:text-cyan-500 font-bold flex items-center gap-1 transition-colors z-20">
          <Lock size={10} /> 관리자 통제 구역 접근
        </a>
      </div>
    );
  }

  // ─── DASHBOARD SCREEN ───
  return (
    <div className="min-h-screen bg-[#0b0e14] text-white p-4 pb-28 md:p-8 font-sans selection:bg-cyan-500/30">
      <Script src="//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js" strategy="lazyOnload" />

      {/* HEADER */}
      <header className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-gray-800 pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-gradient-to-r from-cyan-500 to-blue-500 text-black text-[10px] font-black px-2 py-0.5 rounded-sm tracking-wider uppercase">
              보안 채널
            </span>
            <h1 className="text-2xl font-black italic tracking-tighter neon-text-cyan">K-SURVIVAL</h1>
          </div>
          <p className="text-gray-400 text-sm font-bold tracking-widest uppercase">작전 관제 콘솔</p>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-[10px] text-gray-500 font-bold tracking-wider uppercase">대상 도장</p>
            <p className="text-pink-400 font-black text-sm uppercase">{formData.gymName}</p>
          </div>
          <button onClick={handleLogout} className="px-3 py-1.5 border border-red-500/30 text-red-400 text-xs font-bold rounded-md hover:bg-red-500/10 transition-colors uppercase">
            로그아웃
          </button>
        </div>
      </header>

      {/* WELCOME */}
      <div className="bg-[#161b22]/50 border-l-4 border-cyan-500 p-4 rounded-r-lg mb-8 shadow-lg relative overflow-hidden">
        <div className="absolute right-[-20%] top-[-50%] w-64 h-64 bg-cyan-500/10 blur-[50px] rounded-full pointer-events-none"></div>
        <p className="text-sm font-medium relative z-10 text-gray-300">
          반갑습니다, <span className="text-cyan-400 font-black text-base">{formData.gymName}</span> 관장님!
          <br className="md:hidden" /> 성공적인 레이저 태그 행사를 위해 아래의 <span className="text-pink-400 font-bold">작전 목록</span>을 확인해 주세요.
        </p>
      </div>

      {/* STATUS BLOCK: 확정 */}
      {formData.status === "확정" && (
        <div className="bg-green-900/40 border border-green-500/50 p-6 rounded-xl mb-8 shadow-[0_0_30px_rgba(34,197,94,0.15)] flex flex-col md:flex-row items-center gap-4 animate-in fade-in zoom-in duration-500">
          <div className="bg-green-500/20 p-4 rounded-full border border-green-500/50 flex-shrink-0">
            <CheckCircle size={32} className="text-green-400" />
          </div>
          <div className="text-center md:text-left">
            <h2 className="text-2xl font-black text-green-400 tracking-widest mb-1">예약이 확정되었습니다!</h2>
            <p className="text-green-100/70 text-sm font-bold mt-1">
              관장님의 작전 요청을 마스터가 최종 승인했습니다. 지정하신 일자(<span className="text-white bg-green-900/50 px-2 py-0.5 rounded">{formData.eventDate || "미정"}</span>)에 현장 통제관 및 병력이 투입됩니다.
            </p>
          </div>
        </div>
      )}

      {/* STATUS BLOCK: 완료 */}
      {formData.status === "완료" && (
        <div className="bg-yellow-900/40 border border-yellow-500/50 p-6 rounded-xl mb-8 shadow-[0_0_30px_rgba(234,179,8,0.15)] flex flex-col md:flex-row items-center gap-4 animate-in fade-in zoom-in duration-500">
          <div className="bg-yellow-500/20 p-4 rounded-full border border-yellow-500/50 flex-shrink-0">
            <CheckCircle size={32} className="text-yellow-400" />
          </div>
          <div className="text-center md:text-left">
            <h2 className="text-2xl font-black text-yellow-400 tracking-widest mb-1">행사가 성공적으로 완료되었습니다!</h2>
            <p className="text-yellow-100/70 text-sm font-bold mt-1">
              K-SURVIVAL 작전이 모두 성황리에 종료되었습니다. 화면 우측 하단의 <span className="text-white">작전 종료 보고서</span>에서 <span className="text-yellow-400 font-black">행사 후기와 평점</span>을 남겨주시면 감사하겠습니다.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── LEFT COLUMN ── */}
        <div className="space-y-6">
          <h2 className="text-2xl font-black italic tracking-widest text-[#FFD400] mb-4 flex items-center gap-2 uppercase">
            <Shield size={24} className="text-[#FFD400]" />
            사전 작전 계획
          </h2>

          <section className="tactical-panel rounded-xl p-5 md:p-6 shadow-2xl relative overflow-hidden group hover:border-cyan-500/50 transition-colors">
            <div className="flex items-center gap-2 mb-3 relative z-10">
              <Play className="text-red-500" size={20} />
              <h3 className="font-bold tracking-wider text-sm md:text-base uppercase">① 전술 훈련 영상</h3>
            </div>
            <p className="text-xs text-gray-400 mb-4 relative z-10">
              <span className="text-cyan-400 font-bold">K-서바이벌 유튜브 채널(@elqueen_kssc)</span> 레이저 태그 전술 영상. 게임 방식과 현장감을 익혀보세요.
            </p>
            <div className="aspect-video w-full rounded-lg overflKzow-hidden bg-black border border-gray-700 relative z-10 shadow-[0_0_15px_rgba(0,0,0,0.5)]">
              {/* 유튜브 채널의 최신 영상 ID로 변경해주세요. 현재는 검색 임베드입니다. */}
              <iframe
                width="100%"
                height="100%"
                src="https://www.youtube.com/embed/S_xh_zAYKzs?si=UMpQ3a0taTExedW5"
                title="Tactical Video"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              ></iframe>
            </div>
          </section>

          <section className="bg-gradient-to-br from-pink-900/30 to-[#0b0e14] border border-pink-500/30 rounded-xl p-5 md:p-6 shadow-2xl hover:border-pink-500/80 transition-all">
            <div className="flex items-center gap-2 mb-2">
              <ImageIcon className="text-pink-400" size={20} />
              <h3 className="font-bold tracking-wider uppercase">② 홍보물 제작소</h3>
            </div>
            <p className="text-xs text-gray-300 mb-5">
              날짜와 도장명만 넣으면 홍보 포스터가 즉석으로! <br /><span className="text-pink-300 font-bold text-[10px]">&gt; K-Survival 포스터 시스템 연동됨</span>
            </p>
            <a
              href={posterProjectUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full text-center bg-pink-600 hover:bg-pink-500 text-white font-black italic tracking-widest py-4 rounded-lg transition-transform transform hover:scale-[1.02] shadow-[0_0_15px_rgba(236,72,153,0.4)] uppercase"
            >
              포스터 생성하기
            </a>
          </section>

          <section className="tactical-panel rounded-xl p-5 md:p-6 shadow-2xl group hover:border-cyan-500/50 transition-colors">
            <div className="flex items-center gap-2 mb-3">
              <FileText className="text-blue-400" size={20} />
              <h3 className="font-bold tracking-wider uppercase">③ 공식 제안서 열람</h3>
            </div>
            <p className="text-xs text-gray-400 mb-4">행사 세부 운영안 및 프로그램 안내 공식 문서입니다.</p>
            <a
              href="https://gamma.app/docs/-59jqnrb0fsze1za"
              target="_blank"
              rel="noopener noreferrer"
              className="block flex items-center justify-center gap-2 w-full text-center bg-blue-600/20 border border-blue-500/50 hover:bg-blue-600/40 text-blue-300 font-bold tracking-widest py-3 rounded-lg transition-colors uppercase"
            >
              제안서 열람하기 ↗
            </a>
          </section>

          <section className="tactical-panel rounded-xl p-5 md:p-6 shadow-2xl group hover:border-cyan-500/50 transition-colors">
            <div className="flex items-center gap-2 mb-3">
              <Video className="text-emerald-400" size={20} />
              <h3 className="font-bold tracking-wider uppercase">④ 작전 사진 및 영상</h3>
            </div>
            <p className="text-xs text-gray-400 mb-4">생생한 작전 현장 미디어 갤러리 아카이브입니다.</p>
            <a
              href="http://naver.me/GCvzraLT"
              target="_blank"
              rel="noopener noreferrer"
              className="block flex items-center justify-center gap-2 w-full text-center bg-emerald-600/20 border border-emerald-500/50 hover:bg-emerald-600/40 text-emerald-300 font-bold tracking-widest py-3 rounded-lg transition-colors uppercase"
            >
              미디어 자료실 접속 ↗
            </a>
          </section>

          <section className="tactical-panel rounded-xl p-5 md:p-6 shadow-2xl">
            <div className="flex items-center gap-2 mb-3">
              <Users className="text-cyan-400" size={20} />
              <h3 className="font-bold tracking-wider uppercase">⑤ 팀 편성 가이드</h3>
            </div>
            <div className="bg-cyan-950/40 border border-cyan-800 p-4 rounded-lg space-y-2 text-sm relative">
              <div className="absolute left-[-1px] top-4 bottom-4 w-[2px] bg-cyan-500"></div>
              <p className="text-cyan-200 font-bold">전술 대형: 5 vs 5</p>
              <p className="text-cyan-400/80 text-xs font-bold font-mono">- 저학년 2명 / 고학년 3명 권장 조합</p>
              <div className="flex gap-2 items-start mt-4 pt-4 border-t border-cyan-800/50">
                <Info size={16} className="text-cyan-500 flex-shrink-0 mt-0.5" />
                <p className="text-[11px] text-gray-400 font-medium">
                  현장 상황에 따라 유동적으로 변경될 수 있습니다. 작전 통제관의 재량을 확보해 주세요.
                </p>
              </div>
            </div>
            {/* 공지 문구 삽입 */}
            <div className="mt-4 bg-red-900/40 border border-red-500/50 p-3 rounded-lg flex items-start gap-2 animate-pulse">
              <span className="text-red-400 font-black">⚠️</span>
              <p className="text-[11px] font-bold text-red-100">
                설치 예정 시간은 행사 시작 1시간 ~ 1시간 30분 전이오니, 원활한 셋팅을 위해 출입문 미리 개방 부탁드립니다.
              </p>
            </div>
          </section>

          <section className="tactical-panel rounded-xl p-6 shadow-2xl">
            <div className="flex items-center gap-2 mb-4">
              <Camera className="text-green-400" size={20} />
              <h3 className="font-bold tracking-wider uppercase">⑥ SNS 촬영 동의</h3>
            </div>
            <label className="flex items-start gap-3 cursor-pointer group bg-black/40 p-4 rounded-lg border border-gray-800 hover:border-green-500/50 transition-colors relative overflow-hidden">
              <div className={`absolute left-0 top-0 bottom-0 w-1 transition-all ${formData.snsAgreed ? 'bg-green-500 shadow-[0_0_10px_#22c55e]' : 'bg-transparent'}`}></div>
              <input
                type="checkbox"
                checked={formData.snsAgreed}
                onChange={(e) => setFormData({ ...formData, snsAgreed: e.target.checked })}
                className="accent-green-500 w-5 h-5 mt-0.5"
              />
              <div>
                <p className={`text-sm font-bold transition-colors ${formData.snsAgreed ? 'text-green-400' : 'text-gray-300'}`}>
                  SNS 촬영 승인
                </p>
                <p className="text-[11px] text-gray-500 mt-1">
                  행사 중 촬영된 사진 및 영상이 공식 홍보 관제망에 업로드 되는 것을 인가합니다.
                </p>
              </div>
            </label>
          </section>

          {/* 7. 행사 완료 후 리뷰작성 폼 */}
          {formData.status === "완료" && (
            <section className="tactical-panel rounded-xl p-5 md:p-6 shadow-2xl border border-yellow-500/30 bg-gradient-to-br from-[#0b0e14] to-yellow-900/10">
              <div className="flex items-center gap-2 mb-4">
                <Star className="text-yellow-400 fill-yellow-400" size={20} />
                <h3 className="font-bold tracking-wider uppercase text-yellow-400">✅ 작전 종료 보고서 (행사 평점)</h3>
              </div>
              <div className="space-y-4">
                <p className="text-xs text-gray-400">
                  행사는 성황리에 잘 마무리되셨나요? 관장님의 소중한 후기와 평점을 남겨주시면 향후 작전 개선에 큰 도움이 됩니다!
                </p>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button 
                      key={star} 
                      onClick={() => setFormData({ ...formData, rating: star })}
                      className="focus:outline-none hover:scale-110 transition-transform"
                    >
                      <Star size={28} className={star <= formData.rating ? "text-yellow-400 fill-yellow-400" : "text-gray-600"} />
                    </button>
                  ))}
                  <span className="ml-2 text-sm font-bold text-yellow-500">{formData.rating}점</span>
                </div>
                <textarea
                  value={formData.reviewText}
                  onChange={(e) => setFormData({ ...formData, reviewText: e.target.value })}
                  placeholder="아이들의 반응, 시설, 진행자 피드백 등 행사 후기를 자유롭게 남겨주세요."
                  className="w-full bg-black/50 border border-yellow-900/50 rounded-lg p-3 text-sm text-yellow-100 placeholder-yellow-900/50 outline-none focus:border-yellow-500 focus:shadow-[0_0_10px_rgba(234,179,8,0.2)] resize-none h-24"
                />
                <button
                  onClick={handleSaveReview}
                  disabled={isLoading}
                  className="w-full bg-yellow-600 hover:bg-yellow-500 text-[#0b0e14] font-black tracking-widest py-3 rounded-lg transition-colors uppercase disabled:opacity-50"
                >
                  후기 등록 및 제출
                </button>
              </div>
            </section>
          )}
        </div>

        {/* ── RIGHT COLUMN ── */}
        <div className="space-y-6">
          <h2 className="text-2xl font-black italic tracking-widest text-cyan-500 mb-4 flex items-center gap-2 border-b border-gray-800 pb-2 uppercase">
            <Navigation size={24} className="text-cyan-500" />
            작전 현장 브리핑
          </h2>

          <div className="tactical-panel rounded-xl p-5 md:p-6 shadow-2xl space-y-8">
            {/* 3-0-1. 날짜 입력 */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Calendar className="text-cyan-400" size={16} />
                <h3 className="font-bold text-sm tracking-widest uppercase">작전 수행 일자</h3>
              </div>
              <input
                type="date"
                value={formData.eventDate}
                onChange={(e) => setFormData({ ...formData, eventDate: e.target.value })}
                className="w-full bg-[#0b0e14] border border-cyan-500/50 shadow-[0_0_15px_rgba(34,211,238,0.2)] rounded-lg p-3 text-sm focus:border-cyan-400 focus:shadow-[0_0_25px_rgba(34,211,238,0.5)] outline-none transition-all text-cyan-300 font-black tracking-widest cursor-pointer [color-scheme:dark]"
              />
            </div>

            {/* 3-0. 연락망 입력 */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Phone className="text-cyan-400" size={16} />
                <h3 className="font-bold text-sm tracking-widest uppercase">긴급 통신망 (연락처)</h3>
              </div>
              <input
                type="tel"
                value={formData.contact}
                onChange={(e) => handleContactChange(e.target.value)}
                maxLength={13}
                className="w-full bg-[#0b0e14] border border-gray-700 rounded-lg p-3 text-sm focus:border-cyan-500 focus:shadow-[0_0_8px_rgba(34,211,238,0.2)] outline-none transition-all placeholder-gray-700 text-cyan-200 tracking-wider font-mono"
                placeholder="010-0000-0000"
              />
            </div>

            {/* 3-1. 주소 입력 */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <MapPin className="text-cyan-400" size={16} />
                <h3 className="font-bold text-sm tracking-widest uppercase">작전지 주소 (내비 연동)</h3>
              </div>
              <div className="space-y-3">
                <div className="flex gap-2">
                  <input
                    type="text"
                    disabled
                    value={formData.baseAddress}
                    className="flex-1 bg-black/50 border border-gray-700 rounded-lg p-3 text-sm text-teal-100 placeholder-gray-600 outline-none"
                    placeholder="검색 버튼을 눌러 지도(우편번호) 검색"
                  />
                  <button
                    onClick={openDaumPostcode}
                    className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs px-4 rounded-lg transition-colors uppercase tracking-widest whitespace-nowrap"
                  >
                    주소 검색
                  </button>
                </div>
                <input
                  type="text"
                  value={formData.detailAddress}
                  onChange={(e) => setFormData({ ...formData, detailAddress: e.target.value })}
                  className="w-full bg-[#0b0e14] border border-gray-700 rounded-lg p-3 text-sm focus:border-cyan-500 focus:shadow-[0_0_8px_rgba(34,211,238,0.2)] outline-none transition-all placeholder-gray-700 text-cyan-200"
                  placeholder="추가 상세 주소 (층수, 호수 등)"
                />
              </div>
            </div>

            {/* 3-2. 부별 시간 & 인원 */}
            <div className="pt-6 border-t border-gray-800/70">
              <div className="flex items-center gap-2 mb-4">
                <Clock className="text-pink-500" size={16} />
                <h3 className="font-bold text-sm tracking-widest uppercase">작전 시간 및 투입 인원</h3>
              </div>

              {/* 스케일 선택 */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-5">
                {(Object.keys(PRICE_CONFIG) as EventScale[]).map((type) => (
                  <button
                    key={type}
                    onClick={() => handleScaleChange(type)}
                    className={`py-3 rounded-md text-[10px] md:text-xs font-black tracking-widest border transition-all uppercase ${formData.eventScale === type
                      ? "bg-pink-600 border-pink-400 text-white shadow-[0_0_10px_rgba(236,72,153,0.4)]"
                      : "bg-black border-gray-800 text-gray-600 hover:text-gray-400"
                      }`}
                  >
                    {PRICE_CONFIG[type].label}
                  </button>
                ))}
              </div>

              {/* 부별 입력 (듀얼 타임) */}
              <div className="space-y-3 mb-5">
                {partKeys.map((key, idx) => {
                  const part = formData.parts[key];
                  const isDisabledBySaturday = isSaturdayRestrict && idx > 0;

                  return (
                    <div
                      key={key}
                      className={`flex flex-col md:flex-row md:items-center gap-3 p-3.5 rounded-lg border transition-all ${isDisabledBySaturday
                        ? "bg-black/80 border-red-900/30 opacity-30 grayscale cursor-not-allowed"
                        : part.active
                          ? "bg-[#0b0e14] border-gray-700"
                          : "bg-black/40 border-gray-900 opacity-50 grayscale"
                        }`}
                    >
                      <div className="flex items-center gap-3">
                        <label className={`flex items-center gap-2 ${isDisabledBySaturday ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                          <input
                            type="checkbox"
                            disabled={isDisabledBySaturday}
                            checked={part.active}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                parts: { ...formData.parts, [key]: { ...part, active: e.target.checked } },
                              })
                            }
                            className="accent-pink-600 w-4 h-4"
                          />
                          <span className="text-xs font-black w-7 text-pink-400">{idx + 1}부</span>
                        </label>

                        {/* 시간 입력 필드 */}
                        <div className="flex items-center gap-1.5 bg-black/50 p-1.5 rounded-md border border-cyan-800/50 focus-within:border-cyan-400 focus-within:shadow-[0_0_15px_rgba(34,211,238,0.3)] transition-all">
                          <input
                            type="text"
                            disabled={!part.active || isDisabledBySaturday}
                            value={part.startTime}
                            onChange={(e) => handleTimeInput(key, "startTime", e.target.value)}
                            className="bg-transparent text-xs text-center text-cyan-300 font-bold outline-none disabled:text-gray-700 font-mono w-[60px]"
                            placeholder="00:00"
                            maxLength={5}
                          />
                          <span className="text-cyan-600/60 text-[10px] drop-shadow-[0_0_5px_rgba(34,211,238,0.8)]">~</span>
                          <input
                            type="text"
                            disabled={!part.active || isDisabledBySaturday}
                            value={part.endTime}
                            onChange={(e) => handleTimeInput(key, "endTime", e.target.value)}
                            className="bg-transparent text-xs text-center text-cyan-300 font-bold outline-none disabled:text-gray-700 font-mono w-[60px]"
                            placeholder="00:00"
                            maxLength={5}
                          />
                        </div>
                      </div>

                      {/* 인원 필드 */}
                      <div className="flex items-center gap-2 ml-auto">
                        <div className="bg-black/50 flex items-center border border-gray-800 p-1 rounded-md focus-within:border-pink-800">
                          <Users size={12} className="text-gray-600 ml-1" />
                          <input
                            type="number"
                            disabled={!part.active || isDisabledBySaturday}
                            min={0}
                            value={part.count || ""}
                            onChange={(e) => handleCountInput(key, e.target.value)}
                            className="w-10 bg-transparent text-center text-xs font-black text-white p-1 outline-none disabled:text-gray-700 font-mono"
                            placeholder="0"
                          />
                        </div>
                        <span className="text-[10px] text-gray-500 font-bold w-4">명</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* 금액 결과 */}
              <div className="bg-[#0b0e14] p-5 rounded-xl border border-cyan-500/30 flex flex-col sm:flex-row justify-between sm:items-center gap-4 relative overflow-hidden">
                <div className="absolute right-[-10%] bottom-[-50%] w-32 h-32 bg-cyan-500/10 blur-[30px] rounded-full"></div>
                <div>
                  <p className="text-sm md:text-lg font-black text-cyan-500 mb-1 uppercase tracking-widest drop-shadow-[0_0_5px_rgba(34,211,238,0.8)]">예상 비용</p>
                  <p className="text-[9px] text-gray-500 font-bold">* 기준인원 초과 시 1만원/인 추가 결산</p>
                </div>
                <div className="flex flex-col items-end">
                  <p className="text-xs text-gray-500 font-black mb-1 tracking-wider uppercase">총 인원: <span className="text-white text-sm">{totalCount}명</span></p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-black text-cyan-400 font-mono tracking-tighter drop-shadow-[0_0_10px_rgba(34,211,238,0.5)]">{totalPrice.toLocaleString()}</span>
                    <span className="text-xs font-bold text-gray-400 uppercase">원</span>
                  </div>
                  <p className="text-[9px] text-cyan-200 mt-2 bg-cyan-900/40 px-2 py-0.5 rounded">* 출장비는 지역에 따라 금액이 다릅니다.</p>
                </div>
              </div>
            </div>

            {/* 3-3. 시설물 체크리스트 */}
            <div className="pt-6 border-t border-gray-800/70">
              <div className="flex items-center gap-2 mb-4">
                <Zap className="text-amber-400" size={16} />
                <h3 className="font-bold text-sm tracking-widest uppercase">시설물 확인</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm font-medium">
                <div className="space-y-4">
                  <div className="flex items-center gap-3 bg-black/30 p-2 rounded-lg border border-gray-800 focus-within:border-amber-500/50 transition-colors">
                    <span className="text-xs text-gray-500 uppercase tracking-widest font-black">작전 평수</span>
                    <input
                      type="number"
                      value={formData.facilities.size}
                      onChange={(e) => setFormData({ ...formData, facilities: { ...formData.facilities, size: e.target.value } })}
                      className="flex-1 bg-transparent text-right text-amber-100 outline-none font-mono font-bold"
                      placeholder="0"
                    />
                    <span className="text-xs text-gray-600">평</span>
                  </div>
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={formData.facilities.elevator}
                      onChange={(e) => setFormData({ ...formData, facilities: { ...formData.facilities, elevator: e.target.checked } })}
                      className="accent-cyan-500 w-4 h-4"
                    />
                    <span className="group-hover:text-cyan-300 transition-colors">엘리베이터 가동</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={formData.facilities.projector}
                      onChange={(e) => setFormData({ ...formData, facilities: { ...formData.facilities, projector: e.target.checked } })}
                      className="accent-cyan-500 w-4 h-4"
                    />
                    <span className="group-hover:text-cyan-300 transition-colors">빔프로젝터 인식</span>
                  </label>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={formData.facilities.parking}
                        onChange={(e) => setFormData({ ...formData, facilities: { ...formData.facilities, parking: e.target.checked } })}
                        className="accent-cyan-500 w-4 h-4"
                      />
                      <span className="group-hover:text-cyan-300 transition-colors">주차 공간 확보</span>
                    </label>
                    {formData.facilities.parking && (
                      <input
                        type="text"
                        value={formData.facilities.parkingLocation}
                        onChange={(e) => setFormData({ ...formData, facilities: { ...formData.facilities, parkingLocation: e.target.value } })}
                        className="w-full bg-black/40 border border-gray-800 p-2 rounded-lg text-xs ml-7 outline-none focus:border-cyan-600 text-cyan-200 transition-colors w-[calc(100%-1.75rem)]"
                        placeholder="상세 위치 (예: 지하 1층 끝)"
                      />
                    )}
                  </div>
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={formData.facilities.audio}
                      onChange={(e) => setFormData({ ...formData, facilities: { ...formData.facilities, audio: e.target.checked } })}
                      className="accent-cyan-500 w-4 h-4"
                    />
                    <span className="group-hover:text-cyan-300 transition-colors">음향기기 연결</span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Action / Statement (Submit) */}
          <section className="bg-gradient-to-r from-cyan-900 to-blue-900 text-white rounded-xl p-[2px] shadow-2xl mt-6 relative overflow-hidden group">
            <div className="absolute inset-0 bg-white/20 blur opacity-0 group-hover:opacity-100 transition-opacity duration-1000 pointer-events-none"></div>
            <div className="bg-[#0b0e14]/90 backdrop-blur-xl rounded-lg p-6 relative z-10 w-full h-full">
              <div className="flex justify-between items-center mb-5">
                <h2 className="font-black italic text-lg tracking-widest uppercase text-cyan-400">최종 확정 프로토콜</h2>
                <CreditCard size={24} className="text-gray-600" />
              </div>

              <div className="space-y-1 mb-6 bg-black/50 p-4 rounded-lg border border-gray-800 relative">
                <p className="text-[10px] font-bold text-gray-500 tracking-widest uppercase">정산 계좌 안내</p>
                <p className="text-xl font-black tracking-tighter text-gray-200 font-mono">IBK 기업 <br className="sm:hidden" />215-081652-01-013</p>
                <p className="text-xs font-bold text-gray-400">예금주: 이상진</p>
                <button
                  onClick={copyAccount}
                  className="absolute right-4 top-1/2 -translate-y-1/2 bg-gray-800 hover:bg-gray-700 p-2 rounded-md flex flex-col items-center gap-1 transition-colors group/copy"
                >
                  <Copy size={16} className={copied ? "text-green-400" : "text-gray-400"} />
                  <span className={`text-[9px] font-bold ${copied ? "text-green-400" : "text-gray-400"}`}>
                    {copied ? "복사 완료" : "복사"}
                  </span>
                </button>
              </div>

              {saved ? (
                <div className="w-full bg-green-500/20 border border-green-500 text-green-400 font-black italic tracking-widest py-4 rounded-lg text-center shadow-[0_0_15px_rgba(34,197,94,0.3)] uppercase">
                  작전 로드 완료! 금고에 안전하게 저장되었습니다.
                </div>
              ) : (
                <button
                  disabled={isLoading}
                  onClick={handleSave}
                  className={`w-full font-black italic py-4 rounded-lg transition-all tracking-widest text-sm uppercase ${isLoading
                    ? "bg-gray-800 text-gray-500 cursor-not-allowed"
                    : "bg-cyan-500 hover:bg-cyan-400 text-[#0b0e14] neon-border-cyan hover:shadow-[0_0_20px_rgba(34,211,238,0.6)]"
                    }`}
                >
                  {isLoading ? "암호화 전송 중..." : "데이터 전송 & 작전 확정"}
                </button>
              )}
            </div>
          </section>

        </div>
      </div>

      {/* 하단 고정 탭 메뉴 */}
      <nav className="fixed bottom-0 left-0 right-0 bg-[#0b0e14]/95 backdrop-blur-xl border-t border-cyan-900/50 flex justify-around p-4 z-50">
        <button className="flex flex-col items-center gap-1 text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]">
          <Zap size={20} />
          <span className="text-[11px] font-black tracking-widest uppercase">작전 준비</span>
        </button>
        <button className="flex flex-col items-center gap-1 text-gray-500 hover:text-cyan-400 transition-colors">
          <Star size={20} />
          <span className="text-[11px] font-black tracking-widest uppercase">작전 후기</span>
        </button>
        <a
          href={posterProjectUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-col items-center gap-1 text-gray-500 hover:text-pink-400 transition-colors"
        >
          <CheckCircle size={20} />
          <span className="text-[11px] font-black tracking-widest uppercase">포스터 제작</span>
        </a>
      </nav>
    </div>
  );
}
