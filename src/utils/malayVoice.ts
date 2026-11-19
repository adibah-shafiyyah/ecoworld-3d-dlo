import { AvatarId } from '../types/game';

export type MalaysianVoiceName = 'Kore' | 'Zephyr' | 'Puck' | 'Charon' | 'Fenrir';

export type MalaysianEmotionContext =
  | 'welcome'
  | 'mission_intro'
  | 'instruction'
  | 'hint'
  | 'warning'
  | 'correct'
  | 'wrong'
  | 'encouragement'
  | 'congrats'
  | 'closing'
  | 'report';

export const MALAYSIAN_TTS_STYLE_DIRECTIVE =
  'Speak strictly in natural, standard Malaysian Bahasa Melayu (Bahasa Melayu baku Malaysia, Kuala Lumpur / RTM broadcast standard, locale ms-MY). ' +
  'Pronounce Malay words authentically like a real Malaysian speaker (natural soft final -a where appropriate in fluent standard Malay speech, crisp consonant articulation, genuine Malaysian stress and cadence). ' +
  'NEVER use an Indonesian (id-ID / Jakarta) accent, vocabulary cadence, or overly stiff mechanical reading. ' +
  'Speak at a comfortable, unhurried conversational pace with natural micro-pauses at commas and sentence boundaries, smooth phrasing, and authentic human warmth — never robotic, never flat, and never overly theatrical.';

export const EMOTION_VOICE_DIRECTIONS: Record<MalaysianEmotionContext, string> = {
  welcome:
    'Tone & Emotion (Ucapan Alu-aluan): Warm, cheerful, smiling, and genuinely welcoming like a caring Malaysian mentor greeting Year 6 pupils.',
  mission_intro:
    'Tone & Emotion (Pengenalan Misi): Enthusiastic, engaging, and intriguing — spark curiosity and readiness for adventure without sounding rushed.',
  instruction:
    'Tone & Emotion (Arahan Permainan): Calm, crystal-clear, steady, and reassuring so primary school pupils can follow every step effortlessly.',
  hint:
    'Tone & Emotion (Petunjuk): Gentle, supportive, and guiding — soft encouraging inflection that nudges the pupil thoughtfully.',
  warning:
    'Tone & Emotion (Amaran / Cabaran): Earnest, firm, and concerned, conveying real environmental urgency with composed authority rather than shouting.',
  correct:
    'Tone & Emotion (Jawapan Betul): Happy, bright, excited, and genuinely praising the pupil with uplifting warmth.',
  wrong:
    'Tone & Emotion (Jawapan Salah): Gentle, positive, patient, and reassuring — encouraging the pupil warmly to try again without discouragement.',
  encouragement:
    'Tone & Emotion (Kata-kata Semangat): Confident, motivating, heartfelt, and persuasive — lifting the pupil’s belief in their ability to help.',
  congrats:
    'Tone & Emotion (Ucapan Tahniah): Very cheerful, proud, celebratory, and deeply appreciative — radiate genuine joy and pride in the pupil’s success.',
  closing:
    'Tone & Emotion (Penutup Permainan): Warm, touching, sincere, and inspiring — leave a memorable, hopeful impression on the pupil.',
  report:
    'Tone & Emotion (Laporan Lapangan): Articulate, observant, clear Malaysian broadcast/field reporter cadence with natural pauses and authentic concern where appropriate.',
};

export function inferEmotionFromMalayText(text: string): MalaysianEmotionContext {
  const lower = (text || '').toLowerCase();
  if (/tahniah|syabas|cemerlang|berbangga|hebat/.test(lower)) return 'congrats';
  if (/perhatian|bahaya|ancaman|terancam|pencemaran|busuk|mati|jerebu/.test(lower)) {
    return /salam sejahtera|selamat datang/.test(lower) ? 'mission_intro' : 'warning';
  }
  if (/salam sejahtera|selamat datang|hai rakan|helo/.test(lower)) return 'welcome';
  if (/ayuh|jadilah wira|masa depan bumi|tanggungjawab/.test(lower)) return 'closing';
  if (/cuba lagi|tidak mengapa|hampir tepat/.test(lower)) return 'wrong';
  if (/tepat sekali|pandai|bagus|berjaya/.test(lower)) return 'correct';
  if (/petunjuk|bayangan|perhatikan/.test(lower)) return 'hint';
  if (/teruskan|yakin|semangat|bersedia/.test(lower)) return 'encouragement';
  return 'instruction';
}

export function buildMalaysianTtsStyle(
  sceneStyle?: string,
  emotion?: MalaysianEmotionContext
): string {
  const parts = [MALAYSIAN_TTS_STYLE_DIRECTIVE];
  if (emotion && EMOTION_VOICE_DIRECTIONS[emotion]) {
    parts.push(EMOTION_VOICE_DIRECTIONS[emotion]);
  }
  const extra = (sceneStyle || '').trim();
  if (extra) {
    parts.push(extra);
  }
  return parts.join(' ');
}

export function getAgentVoiceName(avatarId: AvatarId): MalaysianVoiceName {
  switch (avatarId) {
    case 'rimba':
      return 'Charon';
    case 'bayu':
      return 'Puck';
    case 'tirta':
      return 'Zephyr';
    case 'suara':
    default:
      return 'Kore';
  }
}

// Shared session cache + deduplicated in-flight promise map for instant replay
const clientTtsUrlCache = new Map<string, string>();
const clientTtsInFlight = new Map<string, Promise<string | null>>();

export interface FetchMalaysianTtsOptions {
  text: string;
  style?: string;
  voiceName?: MalaysianVoiceName;
  emotion?: MalaysianEmotionContext;
}

export async function fetchMalaysianTtsAudioUrl({
  text,
  style,
  voiceName = 'Kore',
  emotion,
}: FetchMalaysianTtsOptions): Promise<string | null> {
  const trimmed = (text || '').trim();
  if (!trimmed) return null;

  const resolvedEmotion = emotion || inferEmotionFromMalayText(trimmed);
  const fullStyle = buildMalaysianTtsStyle(style, resolvedEmotion);
  const cacheKey = `${voiceName}::${resolvedEmotion}::${fullStyle}::${trimmed}`;

  const existing = clientTtsUrlCache.get(cacheKey);
  if (existing) return existing;

  const pending = clientTtsInFlight.get(cacheKey);
  if (pending) return pending;

  const promise = (async (): Promise<string | null> => {
    try {
      const resp = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: trimmed,
          style: fullStyle,
          voiceName,
          emotion: resolvedEmotion,
        }),
      });
      if (!resp.ok) return null;
      const data = (await resp.json()) as { audioBase64?: string; mimeType?: string };
      if (!data.audioBase64) return null;

      const bin = atob(data.audioBase64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) {
        bytes[i] = bin.charCodeAt(i);
      }
      const url = URL.createObjectURL(new Blob([bytes], { type: data.mimeType || 'audio/wav' }));
      clientTtsUrlCache.set(cacheKey, url);
      return url;
    } catch {
      return null;
    } finally {
      clientTtsInFlight.delete(cacheKey);
    }
  })();

  clientTtsInFlight.set(cacheKey, promise);
  return promise;
}

const INDONESIAN_VOICE_RE =
  /indonesia|\bid[-_]?id\b|bahasa indonesia|gadis|damayanti|andika|indri|ardi|putri|sari/i;
const MALAY_NAME_RE = /\bmalay\b|bahasa melayu|\bms[-_]?my\b|yasmin|osman/i;
const MALE_MS_VOICE_RE = /osman|farid|adam|david|mark|daniel|rishi|alex|fred|george|guy|ryan|\bmale\b|lelaki/i;
const FEMALE_MS_VOICE_RE = /yasmin|amira|siti|nur|ain|zura|puteri|rina|female|woman|girl|ms-my-x-ms[bc]/i;

export function isStrictMalaysianMalayVoice(voice: SpeechSynthesisVoice): boolean {
  const lang = (voice.lang || '').toLowerCase();
  const name = (voice.name || '').toLowerCase();
  if (lang.startsWith('id') || INDONESIAN_VOICE_RE.test(name)) {
    return false;
  }
  return lang.startsWith('ms') || MALAY_NAME_RE.test(name);
}

/**
 * Selects ONLY a verified Malaysian Bahasa Melayu (ms-MY / ms) browser voice.
 * Strictly NEVER falls back to Indonesian (id-ID) or English voices.
 */
export function pickMalaysianSpeechVoice(
  voices: SpeechSynthesisVoice[],
  options?: { preferFemale?: boolean }
): { voice: SpeechSynthesisVoice | null; isConfirmedFemale: boolean } {
  if (!voices || voices.length === 0) {
    return { voice: null, isConfirmedFemale: false };
  }

  const msPool = voices.filter(isStrictMalaysianMalayVoice);
  if (msPool.length === 0) {
    return { voice: null, isConfirmedFemale: false };
  }

  const msMyPool = msPool.filter((v) => v.lang.toLowerCase().startsWith('ms-my'));
  const prioritizedPool = msMyPool.length > 0 ? msMyPool : msPool;

  if (options?.preferFemale) {
    const nonMale = prioritizedPool.filter((v) => !MALE_MS_VOICE_RE.test(v.name));
    const confirmedFemale = nonMale.find((v) => FEMALE_MS_VOICE_RE.test(v.name));
    if (confirmedFemale) {
      return { voice: confirmedFemale, isConfirmedFemale: true };
    }
    if (nonMale.length > 0) {
      return { voice: nonMale[0], isConfirmedFemale: false };
    }
  } else {
    const femalePreferred = prioritizedPool.find(
      (v) => !MALE_MS_VOICE_RE.test(v.name) && FEMALE_MS_VOICE_RE.test(v.name)
    );
    if (femalePreferred) {
      return { voice: femalePreferred, isConfirmedFemale: true };
    }
  }

  return { voice: prioritizedPool[0], isConfirmedFemale: false };
}

export function splitNaturalMalaySentences(text: string): string[] {
  const normalized = (text || '').replace(/\r\n/g, '\n').trim();
  if (!normalized) return [];

  const chunks: string[] = [];
  const paragraphs = normalized.split(/\n+/);
  for (const para of paragraphs) {
    const clean = para.trim();
    if (!clean) continue;
    const sentences = clean.match(/[^.!?]+[.!?…]*|[^.!?\n]+$/g) || [clean];
    for (const s of sentences) {
      const part = s.trim();
      if (part) chunks.push(part);
    }
  }
  return chunks.length > 0 ? chunks : [normalized];
}

function getFallbackProsody(
  sentence: string,
  baseEmotion: MalaysianEmotionContext,
  preferFemale: boolean,
  isConfirmedFemale: boolean
): { rate: number; pitch: number; pauseAfterMs: number } {
  const lower = sentence.toLowerCase();
  const isQuestion = sentence.trim().endsWith('?');
  const isExclaim = sentence.trim().endsWith('!');

  let rate = 0.94;
  let pitchOffset = 0;
  let pauseAfterMs = 190;

  const effectiveEmotion =
    baseEmotion === 'mission_intro' || baseEmotion === 'congrats'
      ? inferEmotionFromMalayText(sentence) === 'instruction'
        ? baseEmotion
        : inferEmotionFromMalayText(sentence)
      : baseEmotion;

  switch (effectiveEmotion) {
    case 'welcome':
      rate = 0.96;
      pitchOffset = 0.05;
      pauseAfterMs = 210;
      break;
    case 'mission_intro':
    case 'encouragement':
      rate = 0.97;
      pitchOffset = 0.04;
      pauseAfterMs = 200;
      break;
    case 'warning':
      rate = 0.91;
      pitchOffset = -0.04;
      pauseAfterMs = 240;
      break;
    case 'correct':
    case 'congrats':
      rate = 0.99;
      pitchOffset = 0.08;
      pauseAfterMs = 200;
      break;
    case 'wrong':
    case 'hint':
      rate = 0.93;
      pitchOffset = 0.02;
      pauseAfterMs = 220;
      break;
    case 'closing':
      rate = 0.92;
      pitchOffset = 0.03;
      pauseAfterMs = 240;
      break;
    case 'report':
    case 'instruction':
    default:
      rate = 0.94;
      pitchOffset = 0;
      pauseAfterMs = 190;
      break;
  }

  if (isQuestion) {
    pitchOffset += 0.04;
    pauseAfterMs = 260;
  } else if (isExclaim && /tahniah|syabas|ayuh|hebat/.test(lower)) {
    pitchOffset += 0.03;
    pauseAfterMs = 230;
  }

  const basePitch = preferFemale ? (isConfirmedFemale ? 1.06 : 1.18) : 0.98;
  return {
    rate: Math.max(0.85, Math.min(1.08, rate)),
    pitch: Math.max(0.85, Math.min(1.32, basePitch + pitchOffset)),
    pauseAfterMs,
  };
}

export interface BrowserSpeechHandle {
  started: boolean;
  cancel: () => void;
}

/**
 * Speaks Malaysian Malay text sentence-by-sentence via browser speechSynthesis
 * (ONLY when a verified ms-MY voice is available) so long scripts never cut off
 * mid-sentence and carry natural inter-sentence pauses and emotional contour.
 */
export function speakMalaysianBrowserNatural(params: {
  text: string;
  emotion?: MalaysianEmotionContext;
  preferFemale?: boolean;
  voices?: SpeechSynthesisVoice[];
  onStart?: () => void;
  onEnd?: () => void;
  onError?: () => void;
}): BrowserSpeechHandle {
  const noop: BrowserSpeechHandle = { started: false, cancel: () => {} };
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return noop;
  }

  const live = window.speechSynthesis.getVoices();
  const pool = live.length > 0 ? live : params.voices || [];
  const preferFemale = params.preferFemale ?? true;
  const { voice, isConfirmedFemale } = pickMalaysianSpeechVoice(pool, { preferFemale });
  if (!voice) {
    return noop;
  }

  const sentences = splitNaturalMalaySentences(params.text);
  if (sentences.length === 0) return noop;

  const baseEmotion = params.emotion || inferEmotionFromMalayText(params.text);
  let cancelled = false;
  let timerId: number | null = null;
  let startedNotified = false;

  try {
    window.speechSynthesis.cancel();
  } catch {
    // ignore
  }

  const speakAt = (idx: number) => {
    if (cancelled) return;
    if (idx >= sentences.length) {
      params.onEnd?.();
      return;
    }

    const sentence = sentences[idx];
    const prosody = getFallbackProsody(sentence, baseEmotion, preferFemale, isConfirmedFemale);
    const utter = new SpeechSynthesisUtterance(sentence);
    utter.voice = voice;
    utter.lang = voice.lang || 'ms-MY';
    utter.rate = prosody.rate;
    utter.pitch = prosody.pitch;

    utter.onstart = () => {
      if (cancelled) return;
      if (!startedNotified) {
        startedNotified = true;
        params.onStart?.();
      }
    };
    utter.onend = () => {
      if (cancelled) return;
      if (idx + 1 >= sentences.length) {
        params.onEnd?.();
      } else {
        timerId = window.setTimeout(() => speakAt(idx + 1), prosody.pauseAfterMs);
      }
    };
    utter.onerror = () => {
      if (cancelled) return;
      cancelled = true;
      params.onError?.();
    };

    try {
      window.speechSynthesis.speak(utter);
    } catch {
      cancelled = true;
      params.onError?.();
    }
  };

  speakAt(0);
  if (!startedNotified) {
    startedNotified = true;
    params.onStart?.();
  }

  return {
    started: true,
    cancel: () => {
      cancelled = true;
      if (timerId !== null) {
        window.clearTimeout(timerId);
        timerId = null;
      }
      try {
        window.speechSynthesis.cancel();
      } catch {
        // ignore
      }
    },
  };
}
