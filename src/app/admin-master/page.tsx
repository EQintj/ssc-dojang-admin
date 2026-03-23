"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import {
  ShieldAlert, Activity, Users, DollarSign, Target, ChevronDown, X, MapPin, Zap, Clock, CheckCircle2, Phone, Trash2, Edit3, Save, XCircle, Calendar, Star
} from "lucide-react";

export default function MasterDashboard() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [pin, setPin] = useState("");

  const [events, setEvents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 모달(상세보기) 상태
  const [selectedEvent, setSelectedEvent] = useState<any | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<any | null>(null);

  // ─── ADMIN LOGIN ───
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin === "2320") {
      setIsAdmin(true);
      fetchEvents();
    } else {
      alert("접근 코드가 일치하지 않습니다.");
    }
  };

  // ─── FETCH DATA ───
  const fetchEvents = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("gym_events")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) console.error("Error fetching admin data:", error);
    else setEvents(data || []);
    setIsLoading(false);
  };

  // ─── UPDATE MANAGER / STATUS ───
  const updateRow = async (id: string, field: string, value: string) => {
    setEvents((prev) => prev.map((e) => (e.id === id ? { ...e, [field]: value } : e)));

    const { error } = await supabase.from("gym_events").update({ [field]: value }).eq("id", id);

    if (error) {
      console.error(`Error updating ${field}:`, error);
      alert("데이터 업데이트에 실패했습니다.");
      fetchEvents();
    }
  };

  // ─── DELETE EVENT ───
  const deleteEvent = async (id: string, gymName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`⚠️ 경고: [${gymName}]의 모든 작전 데이터를 영구 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) {
      const { error } = await supabase.from("gym_events").delete().eq("id", id);
      if (error) {
        alert("삭제 실패");
      } else {
        setEvents((prev) => prev.filter((ev) => ev.id !== id));
        if (selectedEvent?.id === id) {
          setSelectedEvent(null);
          setIsEditing(false);
        }
      }
    }
  };

  // ─── MODAL OPEN / SAVE ───
  const handleOpenModal = (ev: any) => {
    setSelectedEvent(ev);
    setEditData(JSON.parse(JSON.stringify(ev))); // Deep clone
    setIsEditing(false);
  };

  const handleSaveEdit = async () => {
    if (!editData) return;
    const { error } = await supabase.from("gym_events").update({
      contact: editData.contact,
      address: editData.address,
      sns_agreed: editData.sns_agreed,
      parts: editData.parts,
      facilities: editData.facilities,
      total_count: editData.total_count,
      total_price: editData.total_price
    }).eq("id", editData.id);

    if (error) {
      console.error("Update error:", error);
      alert("데이터 수정 중 에러가 발생했습니다.");
    } else {
      setEvents((prev) => prev.map((ev) => (ev.id === editData.id ? editData : ev)));
      setSelectedEvent(editData);
      setIsEditing(false);
      alert("데이터가 성공적으로 수정되었습니다.");
    }
  };

  // ─── RENDER LOGIN ───
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-[#000000] text-red-500 flex items-center justify-center p-4">
        <form onSubmit={handleLogin} className="border border-red-900 bg-[#0a0000] p-8 rounded-xl shadow-[0_0_30px_rgba(220,38,38,0.3)] text-center max-w-sm w-full">
          <ShieldAlert size={48} className="mx-auto mb-4 text-red-600 animate-pulse" />
          <h1 className="text-2xl font-black italic tracking-widest mb-6 uppercase">마스터 인증</h1>
          <input
            type="password"
            autoFocus
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="비밀코드 입력"
            className="w-full bg-black border border-red-800 p-4 text-center text-xl font-mono focus:outline-none focus:border-red-500 text-red-400 mb-6 tracking-[0.5em]"
          />
          <button type="submit" className="w-full bg-red-900 hover:bg-red-800 text-white font-bold py-3 uppercase tracking-widest">
            마스터 로그인
          </button>
        </form>
      </div>
    );
  }

  const totalBookings = events.length;
  const totalPeople = events.reduce((acc, ev) => acc + (ev.total_count || 0), 0);
  const totalRevenue = events.reduce((acc, ev) => acc + (ev.total_price || 0), 0);

  const getScaleLabel = (scale: string) => {
    if (scale === 'weekday') return "평일 작전";
    if (scale === 'saturday') return "토요일 파트 작전 (1부 제한)";
    if (scale === 'allDayA') return "토요일 종일 A (60명급)";
    if (scale === 'allDayB') return "토요일 종일 B (80명급)";
    return scale;
  };

  // ─── RENDER DASHBOARD ───
  return (
    <div className="min-h-screen bg-[#0b0e14] text-white p-4 md:p-8 font-sans relative">
      <header className="mb-8 flex flex-col sm:flex-row sm:justify-between items-start sm:items-end border-b border-gray-800 pb-4 gap-4">
        <div>
          <h1 className="text-3xl font-black italic uppercase tracking-tighter text-red-500 flex items-center gap-3">
            <Target size={28} />
            통합 지휘 통제소
          </h1>
          <p className="text-gray-400 text-sm font-mono mt-1">K-SURVIVAL 실시간 관제 시스템</p>
        </div>
        <button onClick={fetchEvents} className="bg-gray-800 hover:bg-gray-700 text-xs px-4 py-2 rounded-md font-bold uppercase cursor-pointer transition-colors shadow-lg shadow-black mx-auto sm:mx-0">
          데이터 새로고침
        </button>
      </header>

      {/* STATS WIDGETS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-[#161b22] border-l-4 border-cyan-500 p-6 rounded-r-xl shadow-lg relative overflow-hidden">
          <div className="absolute right-[-10%] top-[-50%] w-32 h-32 bg-cyan-500/10 blur-[30px] rounded-full pointer-events-none"></div>
          <div className="flex justify-between items-center mb-2">
            <p className="text-gray-400 text-xs font-bold tracking-widest uppercase">총 작전 수</p>
            <Activity size={16} className="text-cyan-500" />
          </div>
          <p className="text-3xl font-black text-white font-mono">{totalBookings}</p>
        </div>

        <div className="bg-[#161b22] border-l-4 border-pink-500 p-6 rounded-r-xl shadow-lg relative overflow-hidden">
          <div className="absolute right-[-10%] top-[-50%] w-32 h-32 bg-pink-500/10 blur-[30px] rounded-full pointer-events-none"></div>
          <div className="flex justify-between items-center mb-2">
            <p className="text-gray-400 text-xs font-bold tracking-widest uppercase">누적 투입 인원</p>
            <Users size={16} className="text-pink-500" />
          </div>
          <p className="text-3xl font-black text-white font-mono">{totalPeople.toLocaleString()}</p>
        </div>

        <div className="bg-[#161b22] border-l-4 border-green-500 p-6 rounded-r-xl shadow-lg relative overflow-hidden">
          <div className="absolute right-[-10%] top-[-50%] w-32 h-32 bg-green-500/10 blur-[30px] rounded-full pointer-events-none"></div>
          <div className="flex justify-between items-center mb-2">
            <p className="text-gray-400 text-xs font-bold tracking-widest uppercase">예상 총 매출</p>
            <DollarSign size={16} className="text-green-500" />
          </div>
          <p className="text-3xl font-black text-white font-mono">₩{totalRevenue.toLocaleString()}</p>
        </div>
      </div>

      {/* DATA TABLE */}
      <div className="bg-[#161b22] border border-gray-800 rounded-xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-[10px] text-gray-400 uppercase tracking-widest bg-black/50 border-b border-gray-800">
              <tr>
                <th className="px-6 py-4">작전일 / 작전망 (클릭 시 상세조회)</th>
                <th className="px-6 py-4">기준 좌표(위치)</th>
                <th className="px-6 py-4 text-center">동원 인력 / 시간</th>
                <th className="px-6 py-4 text-right">추정 자금</th>
                <th className="px-6 py-4 text-center">담당 지휘관 / 상태</th>
                <th className="px-6 py-4 text-center">데이터 파기</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-cyan-500 animate-pulse font-mono">
                    관제망에서 데이터를 수신하는 중...
                  </td>
                </tr>
              ) : events.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500 font-mono">
                    진행 중인 작전이 없습니다.
                  </td>
                </tr>
              ) : (
                events.map((ev) => {
                  const date = ev.facilities?.eventDate || new Date(ev.created_at).toLocaleDateString();
                  let timeSummary = "-";
                  if (ev.parts && typeof ev.parts === 'object') {
                    const activePart = Object.values(ev.parts).find((p: any) => p.active);
                    if (activePart) {
                      timeSummary = `${(activePart as any).startTime}~${(activePart as any).endTime}`;
                    }
                  }

                  let displayAddress = ev.address || "-";
                  if (displayAddress.includes("|")) {
                    displayAddress = displayAddress.split("|").join(" ");
                  }

                  return (
                    <tr key={ev.id} className="hover:bg-gray-800/40 transition-colors group cursor-pointer" onClick={() => handleOpenModal(ev)}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <p className="text-[10px] text-gray-500 mb-1">{date}</p>
                        <p className="font-black text-cyan-400 text-base group-hover:text-cyan-200 group-hover:underline underline-offset-4">
                          {ev.gym_name}
                        </p>
                        <p className="text-[10px] text-pink-400 uppercase mt-0.5 font-bold">
                          {getScaleLabel(ev.event_scale)}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-gray-300 text-xs truncate max-w-[200px]">{displayAddress}</p>
                        <p className="text-gray-500 text-[10px] mt-1 tracking-widest">{ev.contact || ""}</p>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <p className="font-bold text-white mb-1">{ev.total_count}명</p>
                        <p className="text-[10px] text-gray-500 font-mono bg-black/40 px-2 py-0.5 rounded inline-block">
                          {timeSummary}
                        </p>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <p className="font-mono font-bold text-green-400">
                          {ev.total_price?.toLocaleString()}
                        </p>
                      </td>
                      <td className="px-6 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex flex-col gap-2 items-center">
                          <div className="relative inline-block w-24">
                            <select
                              value={ev.manager_name || "미배정"}
                              onChange={(e) => updateRow(ev.id, "manager_name", e.target.value)}
                              className={`w-full appearance-none bg-[#0e1117] border rounded px-3 py-1.5 text-xs font-bold focus:outline-none focus:border-cyan-500 transition-colors cursor-pointer ${ev.manager_name === "미배정" || !ev.manager_name
                                  ? "text-gray-500 border-gray-700"
                                  : "text-cyan-200 border-cyan-800/50"
                                }`}
                            >
                              <option value="미배정">미배정</option>
                              <option value="이상현">이상현</option>
                              <option value="이상진">이상진</option>
                              <option value="유중용">유중용</option>
                              <option value="정재우">정재우</option>
                              <option value="강문천">강문천</option>
                            </select>
                            <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                          </div>

                          <div className="relative inline-block w-24">
                            <select
                              value={ev.status || "예약대기"}
                              onChange={(e) => updateRow(ev.id, "status", e.target.value)}
                              className={`w-full appearance-none bg-[#0e1117] border rounded px-3 py-1.5 text-[10px] font-bold focus:outline-none transition-colors cursor-pointer ${ev.status === "예약대기"
                                  ? "text-amber-500 border-amber-800/50"
                                  : ev.status === "수정됨"
                                    ? "text-blue-400 border-blue-800/50"
                                    : ev.status === "확정"
                                      ? "text-cyan-400 border-cyan-800/50"
                                      : ev.status === "취소"
                                        ? "text-red-500 border-red-800/50"
                                        : "text-green-500 border-green-800/50"
                                }`}
                            >
                              <option value="예약대기">예약대기</option>
                              <option value="확정">확정</option>
                              <option value="수정됨">수정완료</option>
                              <option value="완료">행사완료</option>
                              <option value="취소">취소</option>
                            </select>
                            <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center cursor-default bg-black/20" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={(e) => deleteEvent(ev.id, ev.gym_name, e)}
                          className="text-red-500/80 hover:text-red-400 hover:bg-red-500/10 p-2 rounded-lg transition-colors group-hover:block"
                          title="데이터 영구 삭제"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── MODAL (DETAIL VIEW & EDIT) ─── */}
      {selectedEvent && editData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#0b0e14] border border-cyan-900/50 rounded-2xl p-6 w-full max-w-2xl shadow-[0_0_50px_rgba(34,211,238,0.15)] relative max-h-[90vh] overflow-y-auto">
            {/* 닫기 버튼 */}
            <button
              onClick={() => {
                setSelectedEvent(null);
                setIsEditing(false);
              }}
              className="absolute top-6 right-6 text-gray-400 hover:text-white transition-colors bg-gray-800/50 w-8 h-8 rounded-full flex items-center justify-center"
            >
              <X size={18} />
            </button>

            {/* 헤더 타이틀 & 에딧 컨트롤 */}
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6 border-b border-gray-800 pb-4 pr-10">
              <div className="flex items-center gap-4">
                <div className="bg-cyan-950/40 p-3 rounded-xl border border-cyan-800/50">
                  <ShieldAlert size={28} className="text-cyan-400" />
                </div>
                <div>
                  <h2 className="text-2xl font-black italic tracking-widest text-cyan-400 font-mono uppercase">
                    {selectedEvent.gym_name}
                  </h2>
                  <div className="flex gap-2 text-xs mt-1">
                    <span className="text-gray-400">{new Date(selectedEvent.created_at).toLocaleString()}</span>
                    <span className="text-pink-400 font-bold uppercase">• {getScaleLabel(selectedEvent.event_scale)}</span>
                  </div>
                </div>
              </div>

              {/* Edit Controls */}
              <div className="flex items-center gap-2">
                {isEditing ? (
                  <>
                    <button
                      onClick={() => {
                        setIsEditing(false);
                        setEditData(JSON.parse(JSON.stringify(selectedEvent)));
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-bold rounded transition-colors"
                    >
                      <XCircle size={14} /> 취소
                    </button>
                    <button
                      onClick={handleSaveEdit}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white text-xs font-bold rounded transition-colors shadow-[0_0_10px_rgba(22,163,74,0.4)]"
                    >
                      <Save size={14} /> 수정사항 저장
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-900/40 border border-cyan-800 text-cyan-400 hover:bg-cyan-900/60 text-xs font-bold rounded transition-colors"
                  >
                    <Edit3 size={14} /> 데이터 수정
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-6">
              {/* 1. 기본 정보 블록 */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className={`bg-black/40 border p-4 rounded-xl ${isEditing ? 'border-cyan-800/50 shadow-[inset_0_0_10px_rgba(34,211,238,0.1)]' : 'border-gray-800'}`}>
                  <div className="flex items-center gap-2 mb-2 text-gray-400">
                    <Calendar size={14} className="text-cyan-500" />
                    <h3 className="text-xs font-bold uppercase tracking-widest">작전일</h3>
                  </div>
                  {isEditing ? (
                    <input
                      type="date"
                      value={editData.facilities?.eventDate || ""}
                      onChange={(e) => setEditData({ ...editData, facilities: { ...editData.facilities, eventDate: e.target.value } })}
                      className="w-full bg-[#0b0e14] border border-cyan-500/50 shadow-[0_0_15px_rgba(34,211,238,0.2)] rounded p-2 text-xs text-cyan-300 font-black outline-none transition-all focus:border-cyan-400 focus:shadow-[0_0_20px_rgba(34,211,238,0.4)] [color-scheme:dark] cursor-pointer"
                    />
                  ) : (
                    <p className="text-sm font-black text-cyan-300 font-mono tracking-wider drop-shadow-[0_0_5px_rgba(34,211,238,0.5)]">
                      {selectedEvent.facilities?.eventDate || "미지정"}
                    </p>
                  )}
                </div>

                <div className={`bg-black/40 border p-4 rounded-xl ${isEditing ? 'border-cyan-800/50 shadow-[inset_0_0_10px_rgba(34,211,238,0.1)]' : 'border-gray-800'}`}>
                  <div className="flex items-center gap-2 mb-2 text-gray-400">
                    <Phone size={14} className="text-cyan-500" />
                    <h3 className="text-xs font-bold uppercase tracking-widest">긴급 연락망</h3>
                  </div>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editData.contact || ""}
                      onChange={(e) => setEditData({ ...editData, contact: e.target.value })}
                      className="w-full bg-[#0b0e14] border border-cyan-800 rounded p-2 text-xs text-white outline-none font-mono"
                      placeholder="010-0000-0000"
                    />
                  ) : (
                    <p className="text-sm font-medium text-teal-100 break-words leading-relaxed font-mono tracking-wider">
                      {selectedEvent.contact || "연락처 미등록"}
                    </p>
                  )}
                </div>

                <div className={`bg-black/40 border p-4 rounded-xl ${isEditing ? 'border-cyan-800/50 shadow-[inset_0_0_10px_rgba(34,211,238,0.1)]' : 'border-gray-800'}`}>
                  <div className="flex items-center gap-2 mb-2 text-gray-400">
                    <MapPin size={14} className="text-pink-500" />
                    <h3 className="text-xs font-bold uppercase tracking-widest">작전지 주소</h3>
                  </div>
                  {isEditing ? (
                    <textarea
                      value={editData.address || ""}
                      onChange={(e) => setEditData({ ...editData, address: e.target.value })}
                      className="w-full bg-[#0b0e14] border border-cyan-800 rounded p-2 text-xs text-white outline-none resize-none h-16"
                    />
                  ) : (
                    <div className="space-y-3">
                      <p className="text-sm font-medium text-teal-100 break-words leading-relaxed">
                        {selectedEvent.address ? selectedEvent.address.replace("|", " ") : "주소 미입력"}
                      </p>
                      {selectedEvent.address && (
                        <div className="flex gap-2 pt-2 border-t border-gray-800/50">
                          <a
                            href={`https://map.naver.com/p/search/${encodeURIComponent(selectedEvent.address.replace("|", " ") || "태권도")}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 flex items-center justify-center gap-2 bg-[#2DB400]/10 border border-[#2DB400]/40 p-2 rounded-lg text-[#2DB400] text-xs font-black hover:bg-[#2DB400]/20 transition-colors uppercase tracking-widest"
                          >
                            네이버 지도
                          </a>
                          <a
                            href={`tmap://search?name=${encodeURIComponent(selectedEvent.address.replace("|", " ") || "")}`}
                            className="flex-1 flex items-center justify-center gap-2 bg-[#FFD400]/10 border border-[#FFD400]/40 p-2 rounded-lg text-[#FFD400] text-xs font-black hover:bg-[#FFD400]/20 transition-colors uppercase tracking-widest"
                          >
                            티맵(TMAP)
                          </a>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                
                <div className={`bg-black/40 border p-4 rounded-xl ${isEditing ? 'border-cyan-800/50 shadow-[inset_0_0_10px_rgba(34,211,238,0.1)]' : 'border-gray-800'}`}>
                  <div className="flex items-center gap-2 mb-2 text-gray-400">
                    <CheckCircle2 size={14} className="text-green-500" />
                    <h3 className="text-xs font-bold uppercase tracking-widest">SNS 촬영 동의</h3>
                  </div>
                  {isEditing ? (
                    <label className="flex items-center gap-2 cursor-pointer mt-3">
                      <input
                        type="checkbox"
                        checked={editData.sns_agreed || false}
                        onChange={(e) => setEditData({ ...editData, sns_agreed: e.target.checked })}
                        className="accent-green-500 w-4 h-4"
                      />
                      <span className="text-xs text-gray-300">사용 인가 처리</span>
                    </label>
                  ) : (
                    <p className={`text-sm font-bold ${selectedEvent.sns_agreed ? "text-green-400" : "text-gray-500"}`}>
                      {selectedEvent.sns_agreed ? "사용 인가" : "미동의"}
                    </p>
                  )}
                </div>
              </div>

              {/* 2. 시간표 & 스케줄 (가로 배치) */}
              <div>
                <div className="flex items-center gap-2 mb-3 px-1 text-cyan-500">
                  <Clock size={16} />
                  <h3 className="font-bold uppercase tracking-widest text-sm text-gray-300">투입 시간 & 편성 규모</h3>
                </div>
                <div className="bg-[#161b22] border border-gray-800 rounded-xl divide-y divide-gray-800/50">
                  {editData.parts && ["p1", "p2", "p3", "p4"].map((key, idx) => {
                    const part = editData.parts[key];
                    if (!part.active && !isEditing) return null;
                    return (
                      <div key={key} className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 px-4 gap-2 ${!part.active && isEditing ? 'opacity-40 bg-black/50 grayscale' : ''}`}>
                        <div className="flex items-center gap-3">
                          {isEditing && (
                            <input
                              type="checkbox"
                              checked={part.active}
                              onChange={(e) => {
                                const np = { ...editData.parts }; np[key].active = e.target.checked;
                                setEditData({ ...editData, parts: np });
                              }}
                              className="accent-pink-500"
                            />
                          )}
                          <span className={`${part.active ? 'bg-pink-900/20 text-pink-400 border border-pink-500/20' : 'bg-gray-800 text-gray-400'} text-[10px] font-black px-2 py-1 rounded`}>
                            {idx + 1}부
                          </span>

                          {isEditing ? (
                            <div className="flex items-center gap-1">
                              <input type="text" disabled={!part.active} value={part.startTime} placeholder="00:00" maxLength={5} onChange={(e) => {
                                let val = e.target.value.replace(/[^\d:]/g, ''); if(val.length === 4 && !val.includes(':')) val = val.slice(0,2)+':'+val.slice(2);
                                const np = {...editData.parts}; np[key].startTime = val; setEditData({...editData, parts: np});
                              }} className="bg-black border border-cyan-800 text-cyan-200 text-xs px-1 py-0.5 rounded text-center outline-none focus:border-cyan-500 focus:shadow-[0_0_10px_rgba(34,211,238,0.3)] transition-all w-[50px] font-mono" />
                              <span className="text-cyan-500/50">~</span>
                              <input type="text" disabled={!part.active} value={part.endTime} placeholder="00:00" maxLength={5} onChange={(e) => {
                                let val = e.target.value.replace(/[^\d:]/g, ''); if(val.length === 4 && !val.includes(':')) val = val.slice(0,2)+':'+val.slice(2);
                                const np = {...editData.parts}; np[key].endTime = val; setEditData({...editData, parts: np});
                              }} className="bg-black border border-cyan-800 text-cyan-200 text-xs px-1 py-0.5 rounded text-center outline-none focus:border-cyan-500 focus:shadow-[0_0_10px_rgba(34,211,238,0.3)] transition-all w-[50px] font-mono" />
                            </div>
                          ) : (
                            <span className="font-mono text-cyan-100 text-sm tracking-widest bg-black px-2 py-0.5 rounded">
                              {part.startTime} <span className="text-gray-600">~</span> {part.endTime}
                            </span>
                          )}
                        </div>

                        <div className={`flex items-center gap-1.5 px-3 py-1 rounded-lg border ${isEditing ? 'bg-[#0b0e14] border-cyan-800/50' : 'bg-black/50 border-gray-800'}`}>
                          <Users size={12} className="text-gray-500" />
                          {isEditing ? (
                            <input
                              type="number"
                              disabled={!part.active}
                              value={part.count}
                              onChange={(e) => {
                                const np = { ...editData.parts }; np[key].count = Number(e.target.value) || 0; setEditData({ ...editData, parts: np });
                              }}
                              className="w-10 bg-transparent text-sm font-bold text-white text-right outline-none"
                            />
                          ) : (
                            <span className="text-sm font-bold text-white">{part.count}명</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 3. 시설물 탐지 여부 */}
              <div>
                <div className="flex items-center gap-2 mb-3 px-1 text-amber-500">
                  <Zap size={16} />
                  <h3 className="font-bold uppercase tracking-widest text-sm text-gray-300">시설물 환경 정보</h3>
                </div>
                {editData.facilities && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                    <div className="bg-amber-950/20 border border-amber-900/30 p-3 rounded-lg flex flex-col items-center justify-center gap-1 text-center">
                      <span className="text-gray-500 font-bold uppercase">작전 평수</span>
                      {isEditing ? (
                        <div className="flex items-baseline gap-1 mt-1">
                          <input type="number" value={editData.facilities.size} onChange={(e) => setEditData({ ...editData, facilities: { ...editData.facilities, size: e.target.value } })} className="w-12 bg-black border border-amber-800/50 text-amber-400 text-center rounded p-1 outline-none font-black" />평
                        </div>
                      ) : (
                        <span className="text-amber-400 font-black text-sm">{editData.facilities.size || "0"}평</span>
                      )}
                    </div>
                    {[['엘리베이터', 'elevator'],
                    ['빔프로젝터', 'projector'],
                    ['음향기기', 'audio']].map(([label, facKey], i) => {
                      const active = editData.facilities[String(facKey)];
                      return (
                        <div key={i} className={`border p-3 rounded-lg flex flex-col items-center justify-center gap-2 text-center transition-colors ${active && !isEditing ? "bg-cyan-900/20 border-cyan-800/50" : "bg-black/30 border-gray-800"
                          }`}>
                          <span className="text-gray-400 font-bold">{String(label)}</span>
                          {isEditing ? (
                            <label className="flex items-center cursor-pointer">
                              <input type="checkbox" checked={active} onChange={(e) => setEditData({ ...editData, facilities: { ...editData.facilities, [String(facKey)]: e.target.checked } })} className="accent-cyan-500 w-4 h-4" />
                            </label>
                          ) : (
                            <span className={active ? "text-cyan-400 font-black" : "text-gray-600"}>{active ? "가동" : "불가"}</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
                {/* 주차장 특수 필드 */}
                {editData.facilities && (isEditing || editData.facilities.parking) && (
                  <div className={`mt-2 p-3 rounded-lg text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${isEditing ? 'border border-blue-800/50 bg-[#0b0e14]' : 'bg-blue-900/20 border-blue-800/50'}`}>
                    <label className="text-blue-300 font-bold flex items-center gap-2">
                      {isEditing && <input type="checkbox" checked={editData.facilities.parking} onChange={(e) => setEditData({ ...editData, facilities: { ...editData.facilities, parking: e.target.checked } })} className="accent-blue-500" />}
                      🅿️ 주차 확보 관련 세부
                    </label>
                    {isEditing ? (
                      <input type="text" disabled={!editData.facilities.parking} value={editData.facilities.parkingLocation} onChange={(e) => setEditData({ ...editData, facilities: { ...editData.facilities, parkingLocation: e.target.value } })} className="w-full sm:w-1/2 p-1.5 rounded bg-black border border-blue-900 text-blue-100 outline-none" placeholder="비고 입력" />
                    ) : (
                      <span className="text-blue-100 bg-black/50 px-3 py-1 rounded">{editData.facilities.parkingLocation || "정보 없음"}</span>
                    )}
                  </div>
                )}
              </div>

              {/* 4. 총 결산 영역 */}
              <div className="bg-gradient-to-r from-gray-900 to-black border border-green-900/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-xl">
                <div>
                  <p className="text-[10px] text-green-500/70 font-bold uppercase tracking-widest mb-1">Total Estimation</p>
                  <p className="text-gray-300 font-bold text-sm">예상 총 예산 및 누적 인원</p>
                </div>
                <div className="text-right flex items-center justify-end gap-4 w-full sm:w-auto">
                  <div className="flex flex-col items-end">
                    <span className="text-[10px] text-gray-500 mb-1 uppercase tracking-widest">Total Unit</span>
                    {isEditing ? (
                      <div className="flex items-end gap-1"><input type="number" value={editData.total_count} onChange={e => setEditData({ ...editData, total_count: Number(e.target.value) || 0 })} className="w-16 bg-black border border-gray-700 rounded p-1 text-right text-white font-bold outline-none" />명</div>
                    ) : (
                      <span className="text-lg font-black text-white">{editData.total_count}명</span>
                    )}
                  </div>
                  <div className="h-8 w-px bg-gray-800 hidden sm:block"></div>
                  <div className="flex flex-col items-end">
                    <span className="text-[10px] text-gray-500 mb-1 uppercase tracking-widest">KRW (예산)</span>
                    {isEditing ? (
                      <div className="flex items-end gap-1"><input type="number" value={editData.total_price} onChange={e => setEditData({ ...editData, total_price: Number(e.target.value) || 0 })} className="w-28 bg-black border border-green-900/50 rounded p-1 text-right text-green-400 font-mono font-bold outline-none" />원</div>
                    ) : (
                      <span className="text-2xl font-black text-green-400 font-mono">{editData.total_price?.toLocaleString()}원</span>
                    )}
                  </div>
                </div>
              </div>

              {/* 5. 후기 및 평점 (완료 시 노출) */}
              {selectedEvent.facilities?.reviewText && (
                <div className="bg-yellow-900/20 border border-yellow-600/50 flex flex-col gap-3 p-5 rounded-xl mt-4">
                  <div className="flex items-center gap-2">
                    <Star size={20} className="text-yellow-400 fill-yellow-400" />
                    <h3 className="font-bold text-yellow-500 tracking-widest text-sm uppercase">관장님 행사 후기 및 평점</h3>
                    <span className="bg-yellow-500/20 text-yellow-300 font-black px-2 py-0.5 rounded text-xs ml-2">{selectedEvent.facilities?.rating || 5}점</span>
                  </div>
                  <p className="text-yellow-100/90 text-sm whitespace-pre-wrap bg-black/50 p-4 rounded-lg border border-yellow-900/50">
                    {selectedEvent.facilities?.reviewText}
                  </p>
                </div>
              )}

            </div>
          </div>
        </div>
      )}

    </div>
  );
}
