import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Pause,
  Play,
  RotateCcw,
  SkipForward,
  Sparkles,
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

export const CIKGU_ADIBAH_SCRIPT_PARAGRAPHS = [
  'Salam sejahtera, para ejen EcoWorld!',
  'Saya Ejen Adiburgh, penyelaras misi anda.',
  'Perhatian! Dunia kita kini sedang menghadapi ancaman yang semakin serius. Pencemaran alam sekitar, kemusnahan habitat, lambakan sampah dan sikap manusia yang tidak bertanggungjawab telah mengancam keseimbangan bumi.',
  'Alam yang dahulunya indah kini semakin terjejas. Jika kita terus berdiam diri, apakah yang akan terjadi kepada bumi yang menjadi tempat tinggal kita?',
  'Namun, harapan masih belum terpadam!',
  'Anda telah dipilih sebagai Ejen EcoWorld untuk menjalankan satu operasi penting, iaitu menyelamatkan bumi daripada terus terancam.',
  'Sepanjang pengembaraan ini, anda perlu menyelesaikan setiap misi, mengumpulkan maklumat, menggunakan kebijaksanaan serta menghasilkan kempen kesedaran yang mampu membuka mata masyarakat.',
  'Ingat, setiap tindakan membawa perubahan. Setiap suara mampu menyampaikan kesedaran. Dan setiap usaha, walaupun kecil, mampu memberikan impak yang besar kepada alam sekitar.',
  'Jadi, para ejen, bersediakah anda menyahut cabaran ini?',
  'Ayuh! Masa depan bumi berada di tangan kita. Selamatkan EcoWorld. Suarakan perubahan!',
];

const FULL_SCRIPT = CIKGU_ADIBAH_SCRIPT_PARAGRAPHS.join('\n\n');

const CIKGU_ADIBAH_TTS_STYLE = buildMalaysianTtsStyle(
  'Ejen Adiburgh, a warm, articulate, caring yet inspiring Malaysian female coordinator speaking standard Bahasa Melayu baku Malaysia (ms-MY). Begin warmly like greeting Year 6 pupils, shift naturally to earnest concern when describing pollution threats, use gentle curious inflection on questions, and build confident uplifting motivation at the close. Never robotic, never rushed, and never Indonesian.',
  'mission_intro'
);

let cachedNarrativeUrl: string | null = null;

interface CikguAdibahBriefingModalProps {
  studentName: string;
  onClose: () => void;
}

type VoiceStatus = 'loading' | 'playing' | 'paused' | 'ended' | 'blocked' | 'silent';

export function CikguAdibahBriefingModal({
  studentName,
  onClose,
}: CikguAdibahBriefingModalProps) {
  const [status, setStatus] = useState<VoiceStatus>('loading');
  const [muted, setMuted] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const speechHandleRef = useRef<BrowserSpeechHandle | null>(null);
  const modeRef = useRef<'tts' | 'speech' | 'none'>('none');
  const sessionRef = useRef(0);
  const mutedRef = useRef(false);
  mutedRef.current = muted;

  const stopNarrativeAudio = useCallback(() => {
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

  const playBrowserFallback = useCallback(
    (activeSession: number) => {
      if (activeSession !== sessionRef.current) return;
      if (mutedRef.current) {
        setStatus('paused');
        setMusicState({ suppressedForAudio: false });
        return;
      }

      const handle = speakMalaysianBrowserNatural({
        text: FULL_SCRIPT,
        emotion: 'mission_intro',
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
          }
        },
        onError: () => {
          if (activeSession !== sessionRef.current) return;
          setStatus('ended');
          setMusicState({ suppressedForAudio: false });
        },
      });
      if (handle.started) {
        modeRef.current = 'speech';
        speechHandleRef.current = handle;
        return;
      }

      // Strict ms-MY guard: do not play Indonesian or English voices
      modeRef.current = 'none';
      setStatus('silent');
      setMusicState({ suppressedForAudio: false });
      setNotice(
        'Suara AI sedang dipaparkan dalam mod bacaan teks kerana enjin suara Bahasa Melayu Malaysia (ms-MY) tidak tersedia buat sementara.'
      );
    },
    []
  );

  const startNarrative = useCallback(async () => {
    stopNarrativeAudio();
    const mySession = sessionRef.current;
    setNotice(null);
    setStatus('loading');

    try {
      let audioUrl = cachedNarrativeUrl;
      if (!audioUrl) {
        audioUrl = await fetchMalaysianTtsAudioUrl({
          text: FULL_SCRIPT,
          style: CIKGU_ADIBAH_TTS_STYLE,
          voiceName: 'Kore',
          emotion: 'mission_intro',
        });
        if (mySession !== sessionRef.current) return;
        if (!audioUrl) {
          playBrowserFallback(mySession);
          return;
        }
        cachedNarrativeUrl = audioUrl;
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
      };
      audio.onerror = () => {
        if (mySession !== sessionRef.current) return;
        playBrowserFallback(mySession);
      };

      try {
        await audio.play();
      } catch {
        if (mySession !== sessionRef.current) return;
        // Browser blocked autoplay -> surface explicit MULA OPERASI button
        setStatus('blocked');
        setMusicState({ suppressedForAudio: false });
      }
    } catch {
      if (mySession !== sessionRef.current) return;
      playBrowserFallback(mySession);
    }
  }, [playBrowserFallback, stopNarrativeAudio]);

  useEffect(() => {
    startNarrative();
    return () => {
      stopNarrativeAudio();
    };
  }, [startNarrative, stopNarrativeAudio]);

  const handleTogglePlayPause = () => {
    playSFX('click');
    if (status === 'blocked' || status === 'ended' || status === 'silent') {
      startNarrative();
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
    } else if (modeRef.current === 'speech' && 'speechSynthesis' in window) {
      if (nextMuted) {
        window.speechSynthesis.cancel();
        setStatus('paused');
        setMusicState({ suppressedForAudio: false });
      } else {
        startNarrative();
      }
    }
  };

  const handleSkipOrClose = () => {
    playSFX('click');
    stopNarrativeAudio();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-3 sm:p-5 overflow-y-auto">
      <div className="w-full max-w-3xl max-h-[92vh] overflow-y-auto eco-scroll bg-slate-950 border border-emerald-400/50 rounded-3xl p-5 sm:p-7 text-slate-100 shadow-2xl space-y-5">
        {/* Presenter Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 pb-4 border-b border-slate-800">
          <CikguAdibahAvatar size="lg" speaking={status === 'playing' && !muted} />
          <div className="min-w-0 flex-1 space-y-1">
            <div className="text-xs font-semibold text-emerald-300">
              Taklimat Pembukaan Ejen EcoWorld · {studentName}
            </div>
            <h2 className="font-display text-xl sm:text-2xl font-bold text-white leading-snug">
              EJEN ADIBURGH – PENYELARAS OPERASI ECOWORLD
            </h2>
            <p className="text-xs text-slate-400">
              {status === 'loading'
                ? 'Menyediakan suara AI Bahasa Melayu Malaysia...'
                : status === 'playing'
                ? muted
                  ? 'Suara dimatikan sementara (sedang membaca skrip)'
                  : 'Sedang menyampaikan taklimat misi penyelamatan bumi...'
                : status === 'paused'
                ? 'Taklimat dijeda.'
                : status === 'blocked'
                ? 'Pelayar memerlukan klik anda untuk memulakan audio taklimat.'
                : status === 'ended'
                ? 'Taklimat selesai disampaikan. Anda boleh mainkan semula atau teruskan operasi.'
                : 'Mod bacaan skrip Bahasa Melayu.'}
            </p>
          </div>
        </div>

        {/* Autoplay Blocked CTA: MULA OPERASI */}
        {status === 'blocked' && (
          <div className="p-4 rounded-2xl bg-amber-950/50 border border-amber-400/60 flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs sm:text-sm text-amber-100 font-medium">
              Klik butang di sebelah kanan untuk mendengar amanat suara AI Ejen Adiburgh.
            </div>
            <button
              type="button"
              onClick={() => {
                playSFX('portal');
                startNarrative();
              }}
              className="btn-game-gold px-5 py-2.5 text-slate-950 font-game text-xs sm:text-sm font-black flex items-center gap-2 whitespace-nowrap cursor-pointer"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>MULA OPERASI</span>
            </button>
          </div>
        )}

        {/* Full Script Display */}
        <div className="p-4 sm:p-5 rounded-2xl bg-slate-900 border border-slate-800 max-h-64 sm:max-h-72 overflow-y-auto eco-scroll space-y-3 text-sm leading-relaxed text-slate-200">
          {CIKGU_ADIBAH_SCRIPT_PARAGRAPHS.map((para, idx) => (
            <p
              key={idx}
              className={
                idx === 0 || idx === CIKGU_ADIBAH_SCRIPT_PARAGRAPHS.length - 1
                  ? 'font-semibold text-emerald-300'
                  : idx === 4
                  ? 'font-semibold text-amber-300'
                  : undefined
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

        {/* Audio Controls + Replay + Sound Control + Skip */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                playSFX('click');
                startNarrative();
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
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleSkipOrClose}
              className="btn-game-slate btn-game-sm px-3.5 py-2 text-slate-200 text-xs font-bold flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              <SkipForward className="w-3.5 h-3.5" />
              <span>Langkau Naratif</span>
            </button>

            <button
              type="button"
              onClick={handleSkipOrClose}
              className="btn-game-emerald px-5 py-2.5 text-slate-950 font-game text-xs sm:text-sm font-black flex items-center gap-2 whitespace-nowrap cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>MULA MISI ECOWORLD →</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
