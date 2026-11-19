import React, { useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  Download,
  FileAudio,
  FileText,
  FolderOpen,
  Mic,
  Pause,
  Play,
  RefreshCw,
  ShieldAlert,
  Video,
} from 'lucide-react';
import { createDemoPortfolio } from '../data/demoAccountData';
import {
  StudentAudioAttachment,
  StudentRecordingSubmission,
  StudentWorkPortfolio,
  UserAccount,
} from '../types/game';
import { playSFX, setMusicState } from '../utils/sound';
import { buildMergedStudentPortfolio } from '../utils/studentWorkApi';

interface TeacherWorkAttachmentsPanelProps {
  realStudents: UserAccount[];
  serverPortfolios: Partial<StudentWorkPortfolio>[];
  submissions: StudentRecordingSubmission[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
}

type MissionFilter = 'ALL' | 1 | 2 | 3 | 4 | 5;

function downloadPortfolioReport(portfolio: StudentWorkPortfolio) {
  const missionKeys: ('m1' | 'm2' | 'm3' | 'm4' | 'm5')[] = ['m1', 'm2', 'm3', 'm4', 'm5'];
  const lines: string[] = [
    '====================================================================',
    'LAMPIRAN HASIL KERJA MURID – ECOWORLD 3D',
    '====================================================================',
    `Nama Murid : ${portfolio.studentName}`,
    `ID Murid   : ${portfolio.studentId || '-'}`,
    `Kelas      : ${portfolio.className}`,
    `Jenis Rekod: ${portfolio.isDemo ? 'AKAUN DEMO (SIMULASI PENSYARAH)' : 'MURID SEBENAR'}`,
    `Dijana Pada: ${new Date().toLocaleString('ms-MY')}`,
    '',
  ];

  for (const key of missionKeys) {
    const m = portfolio.missions[key];
    lines.push('--------------------------------------------------------------------');
    lines.push(`${m.missionTitle} | Status: ${m.status} | Markah: ${m.score}%`);
    if (m.completedAt) {
      lines.push(`Tarikh Rekod: ${new Date(m.completedAt).toLocaleString('ms-MY')}`);
    }
    if (m.activities.length === 0) {
      lines.push('  - Belum ada jawapan direkodkan.');
    } else {
      m.activities.forEach((act, idx) => {
        lines.push(`  ${idx + 1}. ${act.activityName}`);
        if (act.prompt) lines.push(`     Soalan/Arahan: ${act.prompt}`);
        lines.push(`     Jawapan: ${act.answer}`);
      });
    }
    if (m.taskOutput) {
      lines.push(`  Hasil Tugasan / Ringkasan: ${m.taskOutput}`);
    }
    lines.push('');
  }

  lines.push('--------------------------------------------------------------------');
  lines.push(`LAMPIRAN RAKAMAN AUDIO / VIDEO (${portfolio.audioAttachments.length})`);
  if (portfolio.audioAttachments.length === 0) {
    lines.push('  - Tiada rakaman audio/video dihantar.');
  } else {
    portfolio.audioAttachments.forEach((att, idx) => {
      lines.push(
        `  ${idx + 1}. [Misi 0${att.missionId}] ${att.activityName} · Fail: ${att.fileName} · ${new Date(
          att.submittedAt
        ).toLocaleString('ms-MY')}`
      );
      if (att.transcript) {
        lines.push(`     Transkripsi/Catatan: ${att.transcript}`);
      }
    });
  }

  const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const safeId = (portfolio.studentId || portfolio.studentName || 'murid')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-');
  a.download = `lampiran-hasil-kerja-${safeId}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function TeacherWorkAttachmentsPanel({
  realStudents,
  serverPortfolios,
  submissions,
  loading,
  error,
  onRefresh,
}: TeacherWorkAttachmentsPanelProps) {
  const [recordMode, setRecordMode] = useState<'real' | 'demo'>('real');
  const [selectedStudentId, setSelectedStudentId] = useState<string>(
    realStudents[0]?.id || ''
  );
  const [missionFilter, setMissionFilter] = useState<MissionFilter>('ALL');
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const mediaRefs = useRef<Record<string, HTMLMediaElement | null>>({});

  const demoPortfolio = useMemo(() => createDemoPortfolio(), []);

  const realPortfolios = useMemo(() => {
    return realStudents
      .filter((s) => !s.isDemo)
      .map((student) => {
        const srv = serverPortfolios.find((p) => p.studentUserId === student.id);
        return buildMergedStudentPortfolio(student, srv, submissions);
      });
  }, [realStudents, serverPortfolios, submissions]);

  const activePortfolio: StudentWorkPortfolio | null = useMemo(() => {
    if (recordMode === 'demo') return demoPortfolio;
    if (realPortfolios.length === 0) return null;
    return (
      realPortfolios.find((p) => p.studentUserId === selectedStudentId) ||
      realPortfolios[0]
    );
  }, [demoPortfolio, realPortfolios, recordMode, selectedStudentId]);

  const handleTogglePlayAudio = (id: string, replayFromStart = false) => {
    const el = mediaRefs.current[id];
    if (!el) return;

    Object.entries(mediaRefs.current).forEach(([otherId, otherEl]) => {
      if (otherId !== id && otherEl && !otherEl.paused) {
        otherEl.pause();
      }
    });

    if (replayFromStart) {
      el.currentTime = 0;
      el.play().catch(() => {});
      setPlayingAudioId(id);
      setMusicState({ ducked: true });
      return;
    }

    if (el.paused) {
      el.play().catch(() => {});
      setPlayingAudioId(id);
      setMusicState({ ducked: true });
    } else {
      el.pause();
      setPlayingAudioId(null);
      setMusicState({ ducked: false });
    }
  };

  const missionKeys = (['m1', 'm2', 'm3', 'm4', 'm5'] as const).filter((k) => {
    if (missionFilter === 'ALL') return true;
    return Number(k.slice(1)) === missionFilter;
  });

  const filteredAudios: StudentAudioAttachment[] = useMemo(() => {
    if (!activePortfolio) return [];
    if (missionFilter === 'ALL') return activePortfolio.audioAttachments;
    return activePortfolio.audioAttachments.filter((a) => a.missionId === missionFilter);
  }, [activePortfolio, missionFilter]);

  return (
    <section className="space-y-5">
      {/* Header & Mode Switch */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="font-display text-lg sm:text-xl font-bold text-white flex items-center gap-2">
            <FolderOpen className="w-5 h-5 text-cyan-300 shrink-0" />
            <span>LAMPIRAN HASIL KERJA MURID</span>
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Himpunan automatik semua jawapan bertulis, aktiviti interaktif, hujah, refleksi dan rakaman audio murid mengikut Misi 01 hingga Misi 05.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-xl">
            <button
              type="button"
              onClick={() => {
                playSFX('click');
                setRecordMode('real');
              }}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg whitespace-nowrap cursor-pointer transition-colors ${
                recordMode === 'real'
                  ? 'bg-emerald-500 text-slate-950'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Murid Sebenar ({realPortfolios.length})
            </button>
            <button
              type="button"
              onClick={() => {
                playSFX('click');
                setRecordMode('demo');
              }}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg whitespace-nowrap cursor-pointer transition-colors ${
                recordMode === 'demo'
                  ? 'bg-amber-400 text-slate-950'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Akaun Demo Pensyarah (Simulasi)
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              playSFX('click');
              onRefresh();
            }}
            disabled={loading}
            className="btn-game-slate btn-game-sm px-3.5 py-2 text-xs font-bold text-cyan-200 flex items-center gap-1.5 whitespace-nowrap cursor-pointer disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Muat Semula</span>
          </button>

          {activePortfolio && (
            <button
              type="button"
              onClick={() => {
                playSFX('xp');
                downloadPortfolioReport(activePortfolio);
              }}
              className="btn-game-cyan btn-game-sm px-3.5 py-2 text-slate-950 text-xs font-bold flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Muat Turun Rekod (.txt)</span>
            </button>
          )}
        </div>
      </div>

      {/* Clear Distinction Notice for Demo Account */}
      {recordMode === 'demo' && (
        <div className="p-4 rounded-2xl bg-amber-950/40 border border-amber-400/60 flex items-start gap-3 text-xs text-amber-100">
          <ShieldAlert className="w-5 h-5 text-amber-300 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <div className="font-bold text-amber-300">
              MOD SIMULASI: AKAUN DEMO MURID – ECOWORLD 3D (BUKAN REKOD MURID SEBENAR)
            </div>
            <p className="text-amber-100/90">
              Data yang dipaparkan di bawah ialah data contoh khusus untuk demonstrasi pensyarah. Rekod ini diasingkan sepenuhnya dan tidak mengubah atau bercampur dengan rekod murid sebenar.
            </p>
          </div>
        </div>
      )}

      {error && recordMode === 'real' && (
        <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-500/60 text-xs text-rose-100">
          {error}
        </div>
      )}

      {/* Filter Toolbar: Student Selector + Mission Filter */}
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
        <div className="md:col-span-6">
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">
            Pilih Nama Murid
          </label>
          {recordMode === 'demo' ? (
            <div className="px-3.5 py-2 rounded-xl bg-slate-950 border border-amber-400/50 text-xs font-bold text-amber-200">
              {demoPortfolio.studentName} ({demoPortfolio.studentId} · {demoPortfolio.className})
            </div>
          ) : (
            <select
              value={activePortfolio?.studentUserId || ''}
              onChange={(e) => {
                playSFX('click');
                setSelectedStudentId(e.target.value);
              }}
              className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs sm:text-sm font-medium focus:outline-none focus:border-cyan-400"
            >
              {realPortfolios.map((p) => (
                <option key={p.studentUserId} value={p.studentUserId}>
                  {p.studentName} ({p.studentId || 'Tiada ID'} · {p.className})
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="md:col-span-6">
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">
            Pilih Misi
          </label>
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                ['ALL', 'Semua (01–05)'],
                [1, 'Misi 01'],
                [2, 'Misi 02'],
                [3, 'Misi 03'],
                [4, 'Misi 04'],
                [5, 'Misi 05'],
              ] as [MissionFilter, string][]
            ).map(([mVal, label]) => (
              <button
                key={String(mVal)}
                type="button"
                onClick={() => {
                  playSFX('click');
                  setMissionFilter(mVal);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap cursor-pointer transition-colors ${
                  missionFilter === mVal
                    ? 'bg-cyan-400 text-slate-950'
                    : 'bg-slate-950 border border-slate-800 text-slate-300 hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {!activePortfolio ? (
        <div className="p-8 rounded-2xl bg-slate-900 border border-slate-800 text-center text-xs text-slate-400">
          Tiada rekod murid untuk pilihan kelas semasa.
        </div>
      ) : (
        <div className="space-y-5">
          {/* Student Summary Line (Clean unboxed metadata) */}
          <div className="px-4 py-3 rounded-2xl bg-slate-900 border border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex flex-wrap items-center gap-2 text-slate-300">
              <strong className="text-white text-sm">{activePortfolio.studentName}</strong>
              <span aria-hidden="true">·</span>
              <span className="font-mono-num text-cyan-300 font-semibold">
                {activePortfolio.studentId || 'Tiada ID'}
              </span>
              <span aria-hidden="true">·</span>
              <span>{activePortfolio.className}</span>
              <span aria-hidden="true">·</span>
              <span className={activePortfolio.isDemo ? 'text-amber-300 font-semibold' : 'text-emerald-300 font-semibold'}>
                {activePortfolio.isDemo ? 'Akaun Demo Simulasi' : 'Murid Sebenar'}
              </span>
            </div>
            <div className="text-slate-400 font-mono-num">
              {filteredAudios.length} Lampiran Audio/Video
            </div>
          </div>

          {/* Section A: Mission-by-Mission Written Answers & Activities */}
          <div className="space-y-4">
            {missionKeys.map((key) => {
              const rec = activePortfolio.missions[key];
              const missionAudios = filteredAudios.filter(
                (a) => a.missionId === rec.missionId
              );
              const isDone = rec.status === 'Selesai';

              return (
                <article
                  key={key}
                  className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800">
                    <div className="space-y-0.5">
                      <h4 className="font-display text-base font-bold text-white flex items-center gap-2">
                        <FileText className="w-4 h-4 text-sky-400 shrink-0" />
                        <span>{rec.missionTitle}</span>
                      </h4>
                      <div className="text-xs text-slate-400 flex flex-wrap items-center gap-2">
                        <span className={isDone ? 'text-emerald-400 font-semibold' : 'text-amber-300 font-semibold'}>
                          {isDone ? '✓ Status: Selesai' : 'Status: Belum Selesai'}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono-num">Markah: {rec.score}%</span>
                        {rec.completedAt && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>Dikemas kini: {new Date(rec.completedAt).toLocaleString('ms-MY')}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Recorded Activities */}
                  {rec.activities.length > 0 ? (
                    <div className="space-y-2.5">
                      {rec.activities.map((act, idx) => (
                        <div
                          key={idx}
                          className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1"
                        >
                          <div className="text-xs font-bold text-sky-300">
                            {act.activityName}
                          </div>
                          {act.prompt && (
                            <div className="text-xs text-slate-400">
                              Arahan: {act.prompt}
                            </div>
                          )}
                          <div className="text-xs sm:text-sm text-slate-100 leading-relaxed whitespace-pre-wrap">
                            {act.answer}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-400">
                      Murid belum menghantar jawapan untuk misi ini.
                    </div>
                  )}

                  {rec.taskOutput && (
                    <div className="p-3.5 rounded-xl bg-slate-950 border border-emerald-500/30 text-xs text-emerald-100">
                      <strong className="text-emerald-300">Hasil Tugasan / Ringkasan:</strong>{' '}
                      {rec.taskOutput}
                    </div>
                  )}

                  {/* Mission-specific Audio Attachments */}
                  {missionAudios.length > 0 && (
                    <div className="pt-2 space-y-2.5">
                      <div className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                        <FileAudio className="w-4 h-4" />
                        <span>Lampiran Rakaman Audio / Video (Misi 0{rec.missionId})</span>
                      </div>
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                        {missionAudios.map((att) => {
                          const isPlaying = playingAudioId === att.id;
                          const downloadHref = att.mediaUrl.includes('?')
                            ? `${att.mediaUrl}&download=1`
                            : `${att.mediaUrl}?download=1`;

                          return (
                            <div
                              key={att.id}
                              className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="text-xs font-bold text-white flex items-center gap-1.5">
                                    {att.mediaType === 'video' ? (
                                      <Video className="w-3.5 h-3.5 text-indigo-300 shrink-0" />
                                    ) : (
                                      <Mic className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
                                    )}
                                    <span className="truncate">{att.activityName}</span>
                                  </div>
                                  <div className="text-[11px] text-slate-400 mt-0.5 space-y-0.5">
                                    <div>
                                      Murid: <strong className="text-slate-200">{att.studentName}</strong> · Misi 0{att.missionId}
                                    </div>
                                    <div className="font-mono-num">
                                      Fail: {att.fileName} · {new Date(att.submittedAt).toLocaleString('ms-MY')}
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {att.mediaType === 'video' ? (
                                <video
                                  ref={(el) => {
                                    mediaRefs.current[att.id] = el;
                                  }}
                                  controls
                                  src={att.mediaUrl}
                                  onPlay={() => {
                                    setPlayingAudioId(att.id);
                                    setMusicState({ ducked: true });
                                  }}
                                  onPause={() => {
                                    if (playingAudioId === att.id) setPlayingAudioId(null);
                                    setMusicState({ ducked: false });
                                  }}
                                  onEnded={() => {
                                    setPlayingAudioId(null);
                                    setMusicState({ ducked: false });
                                  }}
                                  className="w-full rounded-lg bg-black aspect-video"
                                />
                              ) : (
                                <audio
                                  ref={(el) => {
                                    mediaRefs.current[att.id] = el;
                                  }}
                                  controls
                                  src={att.mediaUrl}
                                  onPlay={() => {
                                    setPlayingAudioId(att.id);
                                    setMusicState({ ducked: true });
                                  }}
                                  onPause={() => {
                                    if (playingAudioId === att.id) setPlayingAudioId(null);
                                    setMusicState({ ducked: false });
                                  }}
                                  onEnded={() => {
                                    setPlayingAudioId(null);
                                    setMusicState({ ducked: false });
                                  }}
                                  className="w-full h-9"
                                />
                              )}

                              <div className="flex flex-wrap items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleTogglePlayAudio(att.id, false)}
                                  className="btn-game-cyan btn-game-sm px-3 py-1.5 text-slate-950 text-xs font-bold flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                                >
                                  {isPlaying ? (
                                    <>
                                      <Pause className="w-3.5 h-3.5" />
                                      <span>Jeda</span>
                                    </>
                                  ) : (
                                    <>
                                      <Play className="w-3.5 h-3.5 fill-current" />
                                      <span>Mainkan</span>
                                    </>
                                  )}
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleTogglePlayAudio(att.id, true)}
                                  className="btn-game-slate btn-game-sm px-3 py-1.5 text-slate-200 text-xs font-bold flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                  <span>Mainkan Semula</span>
                                </button>

                                <a
                                  href={downloadHref}
                                  download={att.fileName}
                                  className="btn-game-slate btn-game-sm px-3 py-1.5 text-sky-200 text-xs font-bold flex items-center gap-1.5 whitespace-nowrap"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                  <span>Muat Turun Fail</span>
                                </a>
                              </div>

                              {/* Optional supplementary transcript without removing original audio */}
                              {att.transcript && (
                                <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-[11px] text-slate-300 leading-relaxed">
                                  <strong className="text-sky-300">Transkripsi / Catatan Tambahan:</strong>{' '}
                                  {att.transcript}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
