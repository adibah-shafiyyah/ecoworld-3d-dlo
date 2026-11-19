import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Award,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Trophy,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  BrowserSpeechHandle,
  buildMalaysianTtsStyle,
  fetchMalaysianTtsAudioUrl,
  speakMalaysianBrowserNatural,
} from '../utils/malayVoice';
import { playSFX, setMusicState } from '../utils/sound';
import { CikguAdibahAvatar } from './CikguAdibahAvatar';

export const CIKGU_ADIBAH_FINALE_PARAGRAPHS = [
  'Tahniah, wira-wira bumi! Ejen Adiburgh amat berbangga dengan kejayaan kamu semua! Akhirnya, kelima-lima misi berjaya diselesaikan dengan cemerlang. Berkat usaha, kerjasama dan kebijaksanaan kamu, bumi kita kini berjaya diselamatkan daripada ancaman pencemaran!',
  'Ingatlah, tugas menjaga bumi bukan sekadar selesai dalam permainan ini, tetapi merupakan tanggungjawab kita setiap hari. Teruskan menjadi insan yang prihatin, sayangi alam sekitar dan jadilah wira kecil yang membawa perubahan besar kepada dunia!',
  'Sekali lagi, syabas dan tahniah daripada Ejen Adiburgh! Kamu semua memang HEBAT!',
];

const FULL_FINALE_SCRIPT = CIKGU_ADIBAH_FINALE_PARAGRAPHS.join('\n\n');

const FINALE_TTS_STYLE = buildMalaysianTtsStyle(
  'Ejen Adiburgh, the warm, joyful, proud Malaysian female mentor congratulating her Year 6 pupils after saving Earth. Radiate genuine celebration and pride at the opening, transition smoothly into sincere heartfelt inspiration on daily responsibility, and conclude cheerfully with appreciative warmth. Never robotic, never over-acted, and never Indonesian.',
  'congrats'
);

let cachedFinaleUrl: string | null = null;

interface CikguAdibahFinaleModalProps {
  studentName: string;
  onOpenHeroes: () => void;
  onClose: () => void;
}

type VoiceStatus = 'loading' | 'playing' | 'paused' | 'ended' | 'blocked' | 'silent';

interface ConfettiPiece {
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  rot: number;
  vRot: number;
  color: string;
  alpha: number;
}

function CelebrationConfettiCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const palette = ['#facc15', '#34d399', '#38bdf8', '#f472b6', '#a7f3d0', '#fde047'];
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const pieces: ConfettiPiece[] = Array.from({ length: 84 }, (_, idx) => ({
      x: Math.random() * width,
      y: idx < 42 ? Math.random() * height * 0.45 : -Math.random() * height * 0.6,
      vx: (Math.random() - 0.5) * 1.8,
      vy: 1.5 + Math.random() * 2.3,
      w: 6 + Math.random() * 7,
      h: 4 + Math.random() * 5,
      rot: Math.random() * Math.PI * 2,
      vRot: (Math.random() - 0.5) * 0.14,
      color: palette[idx % palette.length],
      alpha: 0.72 + Math.random() * 0.28,
    }));

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    let rafId = 0;
    const render = () => {
      ctx.clearRect(0, 0, width, height);
      for (const p of pieces) {
        p.x += p.vx + Math.sin(p.y * 0.018) * 0.35;
        p.y += p.vy;
        p.rot += p.vRot;

        if (p.y > height + 20) {
          p.y = -18;
          p.x = Math.random() * width;
        }
        if (p.x < -20) p.x = width + 20;
        if (p.x > width + 20) p.x = -20;

        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }
      rafId = requestAnimationFrame(render);
    };
    rafId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full pointer-events-none z-0"
      aria-hidden="true"
    />
  );
}

const SPARKLE_POSITIONS = [
  'top-4 left-6',
  'top-8 right-10',
  'top-24 left-12',
  'top-28 right-8',
  'bottom-24 left-8',
  'bottom-20 right-12',
];

export function CikguAdibahFinaleModal({
  studentName,
  onOpenHeroes,
  onClose,
}: CikguAdibahFinaleModalProps) {
  const [status, setStatus] = useState<VoiceStatus>('loading');
  const [muted, setMuted] = useState(false);
  const [speechCompleted, setSpeechCompleted] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const speechHandleRef = useRef<BrowserSpeechHandle | null>(null);
  const modeRef = useRef<'tts' | 'speech' | 'none'>('none');
  const sessionRef = useRef(0);
  const mutedRef = useRef(false);
  mutedRef.current = muted;

  const stopFinaleAudio = useCallback(() => {
    sessionRef.current += 1;
    modeRef.current = 'none';
    if (audioRef.current) {
      try {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      } catch {
        // ignore
      }
      audioRef.current = null;
    }
    if (speechHandleRef.current) {
      speechHandleRef.current.cancel();
      speechHandleRef.current = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // ignore
      }
    }
    setMusicState({ suppressedForAudio: false });
  }, []);

  const revealFinalBanner = useCallback(() => {
    setSpeechCompleted(true);
    playSFX('win');
  }, []);

  const playBrowserFallback = useCallback(
    (activeSession: number) => {
      if (activeSession !== sessionRef.current) return;
      if (mutedRef.current) {
        setStatus('paused');
        setMusicState({ suppressedForAudio: false });
        return;
      }

      const handle = speakMalaysianBrowserNatural({
        text: FULL_FINALE_SCRIPT,
        emotion: 'congrats',
        preferFemale: true,
        onStart: () => {
          if (activeSession !== sessionRef.current) return;
          setStatus('playing');
          setMusicState({ suppressedForAudio: true });
        },
        onEnd: () => {
          if (activeSession !== sessionRef.current) return;
          if (modeRef.current === 'speech') {
            setStatus('ended');
            setMusicState({ suppressedForAudio: false });
            revealFinalBanner();
          }
        },
        onError: () => {
          if (activeSession !== sessionRef.current) return;
          setStatus('ended');
          setMusicState({ suppressedForAudio: false });
          revealFinalBanner();
        },
      });
      if (handle.started) {
        modeRef.current = 'speech';
        speechHandleRef.current = handle;
        return;
      }

      // Strict ms-MY guard: never fall back to non-Malaysian voices
      modeRef.current = 'none';
      setStatus('silent');
      setMusicState({ suppressedForAudio: false });
      setNotice(
        'Ucapan tahniah dipaparkan dalam mod bacaan teks kerana enjin suara Bahasa Melayu Malaysia (ms-MY) tidak tersedia buat sementara.'
      );
      window.setTimeout(() => {
        if (activeSession === sessionRef.current) {
          revealFinalBanner();
        }
      }, 1400);
    },
    [revealFinalBanner]
  );

  const startFinaleSpeech = useCallback(async () => {
    stopFinaleAudio();
    const mySession = sessionRef.current;
    setNotice(null);
    setStatus('loading');

    try {
      let audioUrl = cachedFinaleUrl;
      if (!audioUrl) {
        audioUrl = await fetchMalaysianTtsAudioUrl({
          text: FULL_FINALE_SCRIPT,
          style: FINALE_TTS_STYLE,
          voiceName: 'Kore',
          emotion: 'congrats',
        });
        if (mySession !== sessionRef.current) return;
        if (!audioUrl) {
          playBrowserFallback(mySession);
          return;
        }
        cachedFinaleUrl = audioUrl;
      }

      if (mySession !== sessionRef.current) return;
      const audio = new Audio(audioUrl);
      audio.muted = mutedRef.current;
      audioRef.current = audio;
      modeRef.current = 'tts';

      audio.onplay = () => {
        if (mySession !== sessionRef.current) return;
        setStatus('playing');
        setMusicState({ suppressedForAudio: !audio.muted });
      };
      audio.onended = () => {
        if (mySession !== sessionRef.current) return;
        setStatus('ended');
        setMusicState({ suppressedForAudio: false });
        revealFinalBanner();
      };
      audio.onerror = () => {
        if (mySession !== sessionRef.current) return;
        playBrowserFallback(mySession);
      };

      try {
        await audio.play();
      } catch {
        if (mySession !== sessionRef.current) return;
        setStatus('blocked');
        setMusicState({ suppressedForAudio: false });
      }
    } catch {
      if (mySession !== sessionRef.current) return;
      playBrowserFallback(mySession);
    }
  }, [playBrowserFallback, revealFinalBanner, stopFinaleAudio]);

  useEffect(() => {
    startFinaleSpeech();
    return () => {
      stopFinaleAudio();
    };
  }, [startFinaleSpeech, stopFinaleAudio]);

  const handleTogglePlayPause = () => {
    playSFX('click');
    if (status === 'blocked' || status === 'ended' || status === 'silent') {
      startFinaleSpeech();
      return;
    }

    if (modeRef.current === 'tts' && audioRef.current) {
      if (audioRef.current.paused) {
        audioRef.current.play().catch(() => setStatus('blocked'));
        setStatus('playing');
        setMusicState({ suppressedForAudio: !muted });
      } else {
        audioRef.current.pause();
        setStatus('paused');
        setMusicState({ suppressedForAudio: false });
      }
      return;
    }

    if (modeRef.current === 'speech' && 'speechSynthesis' in window) {
      if (status === 'playing') {
        window.speechSynthesis.pause();
        setStatus('paused');
        setMusicState({ suppressedForAudio: false });
      } else if (status === 'paused') {
        window.speechSynthesis.resume();
        setStatus('playing');
        setMusicState({ suppressedForAudio: !muted });
      }
    }
  };

  const handleToggleMute = () => {
    playSFX('click');
    const nextMuted = !muted;
    setMuted(nextMuted);
    if (modeRef.current === 'tts' && audioRef.current) {
      audioRef.current.muted = nextMuted;
      setMusicState({ suppressedForAudio: !nextMuted && status === 'playing' });
      if (nextMuted && !speechCompleted) {
        setSpeechCompleted(true);
      }
    } else if (modeRef.current === 'speech' && 'speechSynthesis' in window) {
      if (nextMuted) {
        window.speechSynthesis.cancel();
        setStatus('paused');
        setMusicState({ suppressedForAudio: false });
        if (!speechCompleted) setSpeechCompleted(true);
      } else {
        startFinaleSpeech();
      }
    }
  };

  const handleFinishEarlyAndReveal = () => {
    stopFinaleAudio();
    setStatus('ended');
    revealFinalBanner();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/88 p-3 sm:p-5 overflow-y-auto">
      <CelebrationConfettiCanvas />

      <div className="relative z-10 w-full max-w-3xl max-h-[93vh] overflow-y-auto eco-scroll bg-slate-950/96 border-2 border-amber-300/80 rounded-3xl p-5 sm:p-7 text-slate-100 shadow-[0_0_55px_rgba(250,204,21,0.28)] space-y-5 modal-pop-in">
        {/* Decorative Twinkling Sparkles */}
        {SPARKLE_POSITIONS.map((pos, idx) => (
          <Sparkles
            key={pos}
            style={{ animationDelay: `${idx * 0.28}s` }}
            className={`pointer-events-none absolute ${pos} w-4 h-4 text-amber-300/75 finale-star-twinkle`}
            aria-hidden="true"
          />
        ))}

        {/* Prominent Cikgu Adibah Profile & Header */}
        <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-5 pb-4 border-b border-emerald-500/30">
          <div className="relative shrink-0">
            <CikguAdibahAvatar
              size="xl"
              ringColor="gold"
              speaking={status === 'playing' && !muted}
            />
          </div>

          <div className="min-w-0 flex-1 text-center sm:text-left space-y-1.5">
            <div className="text-xs font-game font-black tracking-wider text-amber-300 uppercase flex items-center justify-center sm:justify-start gap-1.5">
              <Award className="w-4 h-4 text-emerald-300 shrink-0" />
              <span>PENYELESAIAN KELIMA-LIMA MISI · {studentName}</span>
            </div>
            <h2 className="game-title-emerald text-xl sm:text-3xl font-black leading-tight">
              UCAPAN TAHNIAH EJEN ADIBURGH
            </h2>
            <p className="text-xs sm:text-sm text-emerald-200 font-medium">
              {status === 'loading'
                ? 'Menyediakan suara ucapan tahniah Ejen Adiburgh...'
                : status === 'playing'
                ? muted
                  ? 'Ucapan dipaparkan (mod senyap)'
                  : 'Ejen Adiburgh sedang menyampaikan ucapan penghargaan khas untuk anda...'
                : status === 'paused'
                ? 'Ucapan dijeda sementara.'
                : status === 'blocked'
                ? 'Klik butang di bawah untuk mendengar ucapan tahniah Ejen Adiburgh.'
                : status === 'ended'
                ? 'Ucapan tahniah Ejen Adiburgh selesai disampaikan!'
                : 'Mod bacaan teks ucapan tahniah.'}
            </p>
          </div>
        </div>

        {/* Autoplay blocked fallback CTA */}
        {status === 'blocked' && (
          <div className="p-4 rounded-2xl bg-amber-950/55 border border-amber-400/70 flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs sm:text-sm text-amber-100 font-medium">
              Tekan butang ini untuk mendengar suara ucapan tahniah daripada Ejen Adiburgh.
            </div>
            <button
              type="button"
              onClick={() => {
                playSFX('win');
                startFinaleSpeech();
              }}
              className="btn-game-gold px-5 py-2.5 text-slate-950 font-game text-xs sm:text-sm font-black flex items-center gap-2 whitespace-nowrap cursor-pointer"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>DENGAR UCAPAN EJEN ADIBURGH</span>
            </button>
          </div>
        )}

        {/* Verbatim Congratulatory Script Display */}
        <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/95 border border-emerald-500/35 max-h-60 sm:max-h-64 overflow-y-auto eco-scroll space-y-3.5 text-sm sm:text-[15px] leading-relaxed text-slate-100">
          {CIKGU_ADIBAH_FINALE_PARAGRAPHS.map((para, idx) => (
            <p
              key={idx}
              className={
                idx === 0
                  ? 'font-semibold text-emerald-200'
                  : idx === 2
                  ? 'font-bold text-amber-300'
                  : 'text-slate-200'
              }
            >
              {para}
            </p>
          ))}
        </div>

        {notice && (
          <div className="p-3 rounded-xl bg-slate-900 border border-cyan-500/40 text-xs text-cyan-200">
            {notice}
          </div>
        )}

        {/* Prominent Victory Message Revealed After Speech Completes */}
        {speechCompleted && (
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-950 via-teal-900/90 to-emerald-950 border-2 border-amber-300 p-4 sm:p-5 text-center shadow-[0_0_32px_rgba(52,211,153,0.35)] modal-pop-in space-y-1.5">
            <div className="flex items-center justify-center gap-2 text-amber-300">
              <Sparkles className="w-5 h-5 finale-star-twinkle" />
              <span className="font-game text-xs font-black tracking-widest uppercase">
                PENAMATAN KEMPEN PENYELAMATAN ECOWORLD 3D
              </span>
              <Sparkles className="w-5 h-5 finale-star-twinkle" />
            </div>
            <div className="font-game text-xl sm:text-3xl font-black text-white tracking-wide drop-shadow-[0_2px_10px_rgba(16,185,129,0.7)]">
              MISI BERJAYA! BUMI TELAH DISELAMATKAN!
            </div>
          </div>
        )}

        {/* Voice Controls + Final Navigation Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                playSFX('click');
                startFinaleSpeech();
              }}
              className="btn-game-cyan btn-game-sm px-3.5 py-2 text-slate-950 text-xs font-bold flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Main Semula</span>
            </button>

            <button
              type="button"
              onClick={handleTogglePlayPause}
              className="btn-game-slate btn-game-sm px-3.5 py-2 text-slate-100 text-xs font-bold flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              {status === 'playing' ? (
                <>
                  <Pause className="w-3.5 h-3.5 text-amber-300" />
                  <span>Jeda</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 text-emerald-400 fill-current" />
                  <span>Mainkan</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleToggleMute}
              className="btn-game-slate btn-game-sm px-3.5 py-2 text-slate-100 text-xs font-bold flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              {muted ? (
                <>
                  <VolumeX className="w-3.5 h-3.5 text-rose-400" />
                  <span>Suara: Tutup</span>
                </>
              ) : (
                <>
                  <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Suara: Buka</span>
                </>
              )}
            </button>

            {!speechCompleted && (
              <button
                type="button"
                onClick={handleFinishEarlyAndReveal}
                className="btn-game-slate btn-game-sm px-3.5 py-2 text-amber-200 text-xs font-bold flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>Papar Mesej Kejayaan</span>
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                playSFX('xp');
                stopFinaleAudio();
                onOpenHeroes();
              }}
              className="btn-game-gold px-4 py-2.5 text-slate-950 font-game text-xs sm:text-sm font-black flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              <Trophy className="w-4 h-4" />
              <span>Sijil Dewan Wira</span>
            </button>

            <button
              type="button"
              onClick={() => {
                playSFX('click');
                stopFinaleAudio();
                onClose();
              }}
              className="btn-game-emerald px-4 py-2.5 text-slate-950 font-game text-xs sm:text-sm font-black whitespace-nowrap cursor-pointer"
            >
              <span>Kembali ke Peta 3D</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
