import { buildMalaysianTtsStyle, pickMalaysianSpeechVoice } from './malayVoice';
import { setMusicState } from './sound';

const sessionAudioUrlCache = new Map<string, string>();
const inflightRequests = new Map<string, Promise<string>>();

export async function fetchMalayAiAudioUrl(
  text: string,
  options?: { style?: string; voiceGender?: 'female' | 'male' }
): Promise<string> {
  const cleanText = text.trim();
  const voiceGender = options?.voiceGender || 'female';
  const style = buildMalaysianTtsStyle(options?.style);
  const cacheKey = `${voiceGender}::${style}::${cleanText}`;

  const existingUrl = sessionAudioUrlCache.get(cacheKey);
  if (existingUrl) return existingUrl;

  const inflight = inflightRequests.get(cacheKey);
  if (inflight) return inflight;

  const promise = (async () => {
    const resp = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: cleanText, style, voiceGender }),
    });
    if (!resp.ok) {
      throw new Error(`TTS failed (${resp.status})`);
    }
    const data = (await resp.json()) as { audioBase64?: string; mimeType?: string };
    if (!data.audioBase64) {
      throw new Error('Empty AI audio payload');
    }
    const bin = atob(data.audioBase64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) {
      bytes[i] = bin.charCodeAt(i);
    }
    const url = URL.createObjectURL(new Blob([bytes], { type: data.mimeType || 'audio/wav' }));
    sessionAudioUrlCache.set(cacheKey, url);
    return url;
  })();

  inflightRequests.set(cacheKey, promise);
  try {
    return await promise;
  } finally {
    inflightRequests.delete(cacheKey);
  }
}

export interface InstructionAudioController {
  stop: () => void;
  play: (
    text: string,
    options?: {
      style?: string;
      voiceGender?: 'female' | 'male';
      onLoading?: () => void;
      onStart?: () => void;
      onEnd?: () => void;
      onBlocked?: () => void;
    }
  ) => Promise<void>;
}

export function createInstructionAudioController(): InstructionAudioController {
  let activeAudio: HTMLAudioElement | null = null;
  let sessionSeq = 0;

  const stop = () => {
    sessionSeq += 1;
    if (activeAudio) {
      try {
        activeAudio.onplay = null;
        activeAudio.onended = null;
        activeAudio.onerror = null;
        activeAudio.pause();
        activeAudio.currentTime = 0;
      } catch {
        // ignore
      }
      activeAudio = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // ignore
      }
    }
    setMusicState({ suppressedForAudio: false });
  };

  const play = async (
    text: string,
    options?: {
      style?: string;
      voiceGender?: 'female' | 'male';
      onLoading?: () => void;
      onStart?: () => void;
      onEnd?: () => void;
      onBlocked?: () => void;
    }
  ) => {
    stop();
    const mySeq = sessionSeq;
    options?.onLoading?.();

    const fallbackBrowserSpeech = () => {
      if (mySeq !== sessionSeq) return;
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        const voices = window.speechSynthesis.getVoices();
        const preferFemale = options?.voiceGender !== 'male';
        const { voice, isConfirmedFemale } = pickMalaysianSpeechVoice(voices, { preferFemale });
        if (voice) {
          window.speechSynthesis.cancel();
          const utter = new SpeechSynthesisUtterance(text);
          utter.voice = voice;
          utter.lang = voice.lang || 'ms-MY';
          utter.rate = 0.96;
          utter.pitch = preferFemale ? (isConfirmedFemale ? 1.12 : 1.24) : 0.95;
          utter.onstart = () => {
            if (mySeq !== sessionSeq) return;
            setMusicState({ suppressedForAudio: true });
            options?.onStart?.();
          };
          utter.onend = () => {
            if (mySeq !== sessionSeq) return;
            setMusicState({ suppressedForAudio: false });
            options?.onEnd?.();
          };
          utter.onerror = () => {
            if (mySeq !== sessionSeq) return;
            setMusicState({ suppressedForAudio: false });
            options?.onEnd?.();
          };
          setMusicState({ suppressedForAudio: true });
          options?.onStart?.();
          window.speechSynthesis.speak(utter);
          return;
        }
      }
      setMusicState({ suppressedForAudio: false });
      options?.onEnd?.();
    };

    try {
      const url = await fetchMalayAiAudioUrl(text, {
        style: options?.style,
        voiceGender: options?.voiceGender,
      });
      if (mySeq !== sessionSeq) return;
      const audio = new Audio(url);
      activeAudio = audio;
      audio.onplay = () => {
        if (mySeq !== sessionSeq) return;
        setMusicState({ suppressedForAudio: true });
        options?.onStart?.();
      };
      audio.onended = () => {
        if (mySeq !== sessionSeq) return;
        if (activeAudio === audio) activeAudio = null;
        setMusicState({ suppressedForAudio: false });
        options?.onEnd?.();
      };
      audio.onerror = () => {
        if (mySeq !== sessionSeq) return;
        fallbackBrowserSpeech();
      };
      try {
        await audio.play();
      } catch (playErr) {
        if (mySeq !== sessionSeq) return;
        const name = playErr instanceof Error ? playErr.name : '';
        if (name === 'NotAllowedError') {
          setMusicState({ suppressedForAudio: false });
          options?.onBlocked?.();
        } else {
          fallbackBrowserSpeech();
        }
      }
    } catch {
      fallbackBrowserSpeech();
    }
  };

  return { stop, play };
}
