import React, { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Sparkles, Volume2, X } from 'lucide-react';
import { MissionDef, UserAccount } from '../types/game';
import { playSFX } from '../utils/sound';
import { CikguAdibahAvatar } from './CikguAdibahAvatar';

interface CikguAdibahCompanionProps {
  user: UserAccount;
  activeMission: MissionDef | null;
  focusedMissionId: number;
  allFiveCompleted: boolean;
  onOpenBriefing: () => void;
  onOpenFinaleReplay: () => void;
}

const MISSION_TIPS: Record<number, string> = {
  1: 'Teliti punca pencemaran sungai & kumpul semua bukti tersurat serta tersirat ya, Ejen!',
  2: 'Fokus pada hubung kait punca dan kesan pencemaran udara serta berikan idea KBAT bernas.',
  3: 'Terokai kawasan Hutan Harapan dan pilih cadangan penyelesaian terbaik berserta justifikasi.',
  4: 'Susun hujah mengikut 4 komponen utama dan rakam suara anda dengan yakin di Makmal Suara!',
  5: 'Siapkan projek kempen digital terbaik anda dan sampaikan seruan menyelamatkan EcoWorld!',
};

export function CikguAdibahCompanion({
  user,
  activeMission,
  focusedMissionId,
  allFiveCompleted,
  onOpenBriefing,
  onOpenFinaleReplay,
}: CikguAdibahCompanionProps) {
  const [mapMinimized, setMapMinimized] = useState(true);
  const [missionPopoverOpen, setMissionPopoverOpen] = useState(false);

  useEffect(() => {
    setMapMinimized(true);
    setMissionPopoverOpen(false);
  }, [activeMission?.id]);

  const tipMissionId = activeMission?.id || (allFiveCompleted ? 5 : focusedMissionId || 1);
  const activeTip = allFiveCompleted && !activeMission
    ? 'Syabas! Semua 5 misi telah selesai. Bumi EcoWorld berjaya diselamatkan!'
    : MISSION_TIPS[tipMissionId] || MISSION_TIPS[1];

  // Compact docked companion chip during Missions 01–05 (sits cleanly above MusicControlPanel)
  if (activeMission) {
    return (
      <div className="no-print fixed bottom-[76px] right-3 sm:bottom-[82px] sm:right-4 z-[44] flex flex-col items-end gap-2">
        {missionPopoverOpen && (
          <div className="w-[min(300px,calc(100vw-24px))] rounded-2xl bg-slate-950/95 border border-emerald-400/70 p-3.5 text-slate-100 shadow-2xl space-y-2.5 modal-pop-in">
            <div className="flex items-start gap-3">
              <CikguAdibahAvatar size="md" ringColor="emerald" />
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-game font-black text-emerald-300 uppercase tracking-wider">
                  Wira Pembimbing EcoWorld
                </div>
                <div className="font-display text-sm font-bold text-white leading-tight">
                  Ejen Adiburgh
                </div>
                <div className="text-[11px] text-amber-300 font-semibold">
                  Misi 0{activeMission.id} · {activeMission.shortTitle}
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  playSFX('click');
                  setMissionPopoverOpen(false);
                }}
                aria-label="Tutup bimbingan Ejen Adiburgh"
                className="btn-game-slate btn-game-sm p-1 rounded-lg text-slate-300 cursor-pointer shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-xs text-slate-200 leading-relaxed bg-slate-900/90 border border-slate-800 rounded-xl p-2.5">
              &ldquo;{activeTip}&rdquo;
            </p>
          </div>
        )}

        <button
          type="button"
          onClick={() => {
            playSFX('click');
            setMissionPopoverOpen((v) => !v);
          }}
          title="Bimbingan Ejen Adiburgh sepanjang misi"
          aria-label="Buka panduan Ejen Adiburgh"
          className="group flex items-center gap-2 rounded-full bg-slate-950/92 border-2 border-emerald-400/80 pl-1 pr-3 py-1 shadow-[0_6px_22px_rgba(2,6,23,0.75)] hover:border-amber-300 transition-colors cursor-pointer"
        >
          <CikguAdibahAvatar size="sm" shape="circle" ringColor="emerald" className="w-9 h-9" />
          <div className="text-left leading-tight">
            <div className="font-game text-[10px] font-black text-white group-hover:text-amber-200">
              Ejen Adiburgh
            </div>
            <div className="text-[9.5px] font-semibold text-emerald-300">
              Wira Pembimbing
            </div>
          </div>
        </button>
      </div>
    );
  }

  // Island Map companion card (top-left, right below top nav bar)
  return (
    <div className="no-print fixed top-14 left-3 sm:left-6 z-30 max-w-[295px] sm:max-w-[330px]">
      {mapMinimized ? (
        <button
          type="button"
          onClick={() => {
            playSFX('click');
            setMapMinimized(false);
          }}
          className="flex items-center gap-2 rounded-2xl bg-slate-950/92 border border-emerald-400/70 px-2.5 py-1.5 shadow-xl text-left cursor-pointer hover:border-amber-300 transition-colors"
          title="Papar kad wira pembimbing Ejen Adiburgh"
        >
          <CikguAdibahAvatar size="sm" shape="circle" ringColor="emerald" className="w-9 h-9" />
          <div className="min-w-0 pr-1">
            <div className="font-game text-[11px] font-black text-white">Ejen Adiburgh</div>
            <div className="text-[10px] text-emerald-300 font-semibold">Wira Pembimbing</div>
          </div>
          <ChevronDown className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
        </button>
      ) : (
        <div className="rounded-2xl bg-slate-950/90 border border-emerald-400/60 p-3 text-slate-100 shadow-2xl backdrop-blur-md space-y-2">
          <div className="flex items-start gap-2.5">
            <CikguAdibahAvatar size="md" ringColor="emerald" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10px] font-game font-black text-emerald-300 uppercase tracking-wider">
                  Wira Pembimbing
                </span>
                <button
                  type="button"
                  onClick={() => {
                    playSFX('click');
                    setMapMinimized(true);
                  }}
                  title="Kecilkan kad Ejen Adiburgh"
                  aria-label="Kecilkan kad Ejen Adiburgh"
                  className="text-slate-400 hover:text-white p-0.5 rounded cursor-pointer"
                >
                  <ChevronUp className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="font-display text-sm font-bold text-white truncate">
                Ejen Adiburgh
              </div>
              <div className="text-[11px] text-amber-300 font-semibold truncate">
                Menemani {user.fullName} (Misi 1–5)
              </div>
            </div>
          </div>

          <p className="text-[11px] text-slate-200 leading-snug bg-slate-900/90 border border-slate-800 rounded-xl px-2.5 py-2">
            {activeTip}
          </p>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                playSFX('click');
                onOpenBriefing();
              }}
              className="btn-game-teal btn-game-sm px-2.5 py-1 text-[10.5px] font-game font-black text-slate-950 flex items-center gap-1 cursor-pointer"
            >
              <Volume2 className="w-3 h-3" />
              <span>Taklimat Suara</span>
            </button>

            {allFiveCompleted && (
              <button
                type="button"
                onClick={() => {
                  playSFX('win');
                  onOpenFinaleReplay();
                }}
                className="btn-game-gold btn-game-sm px-2.5 py-1 text-[10.5px] font-game font-black text-slate-950 flex items-center gap-1 cursor-pointer"
              >
                <Sparkles className="w-3 h-3" />
                <span>Ucapan Tahniah</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
