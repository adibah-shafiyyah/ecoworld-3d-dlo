import 'dotenv/config';
import crypto from 'crypto';
import express from 'express';
import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: '1mb' }));

const PORT = process.env.NODE_ENV === 'production' ? Number(process.env.PORT) || 3000 : 3000;

// Persistent local filesystem storage for Mission 5 student recordings & teacher reviews
const DATA_DIR = path.resolve(__dirname, 'data');
const RECORDINGS_DIR = path.join(DATA_DIR, 'recordings');
const SUBMISSIONS_FILE = path.join(DATA_DIR, 'submissions.json');
const STUDENT_WORK_FILE = path.join(DATA_DIR, 'student-work.json');
const MEDIA_SIGNING_SECRET =
  process.env.SESSION_SECRET ||
  crypto.createHash('sha256').update(`ecoworld3d:${__dirname}`).digest('hex');

interface StoredSubmission {
  id: string;
  studentUserId: string;
  studentName: string;
  studentId: string;
  className: string;
  missionId: number;
  mediaType: 'audio' | 'video';
  mimeType: string;
  fileName: string;
  fileSize: number;
  campaignTitle: string;
  status: 'BERJAYA';
  submittedAt: string;
  teacherComment: string;
  teacherScore: number | null;
  teacherGrade: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
}

interface StoredMissionActivity {
  activityName: string;
  prompt?: string;
  answer: string;
}

interface StoredMissionWork {
  missionId: number;
  missionTitle: string;
  status: 'Selesai' | 'Belum Selesai';
  score: number;
  completedAt: string;
  activities: StoredMissionActivity[];
  taskOutput?: string;
}

interface StoredAudioAttachment {
  id: string;
  studentUserId: string;
  studentName: string;
  studentId: string;
  className: string;
  missionId: number;
  missionTitle: string;
  activityName: string;
  mediaType: 'audio' | 'video';
  fileName: string;
  mimeType: string;
  fileSize: number;
  durationSec?: number;
  transcript?: string;
  submittedAt: string;
}

interface StoredStudentWorkRecord {
  studentUserId: string;
  studentName: string;
  studentId: string;
  className: string;
  updatedAt: string;
  missions: Partial<Record<'m1' | 'm2' | 'm3' | 'm4' | 'm5', StoredMissionWork>>;
  audioAttachments: StoredAudioAttachment[];
}

async function ensureStorageReady(): Promise<void> {
  await fsp.mkdir(RECORDINGS_DIR, { recursive: true });
}

async function readSubmissions(): Promise<StoredSubmission[]> {
  await ensureStorageReady();
  try {
    const raw = await fsp.readFile(SUBMISSIONS_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as StoredSubmission[]) : [];
  } catch {
    return [];
  }
}

async function writeSubmissions(list: StoredSubmission[]): Promise<void> {
  await ensureStorageReady();
  const tmpFile = `${SUBMISSIONS_FILE}.tmp`;
  await fsp.writeFile(tmpFile, JSON.stringify(list, null, 2), 'utf8');
  await fsp.rename(tmpFile, SUBMISSIONS_FILE);
}

async function readStudentWorks(): Promise<StoredStudentWorkRecord[]> {
  await ensureStorageReady();
  try {
    const raw = await fsp.readFile(STUDENT_WORK_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as StoredStudentWorkRecord[]) : [];
  } catch {
    return [];
  }
}

async function writeStudentWorks(list: StoredStudentWorkRecord[]): Promise<void> {
  await ensureStorageReady();
  const tmpFile = `${STUDENT_WORK_FILE}.tmp`;
  await fsp.writeFile(tmpFile, JSON.stringify(list, null, 2), 'utf8');
  await fsp.rename(tmpFile, STUDENT_WORK_FILE);
}

function getAuthContext(req: express.Request): {
  role: 'admin' | 'guru' | 'murid' | null;
  userId: string;
} {
  const roleRaw = String(req.header('x-ecoworld-role') || '').trim().toLowerCase();
  const userId = String(req.header('x-ecoworld-user-id') || '').trim();
  if (roleRaw === 'admin' || roleRaw === 'guru' || roleRaw === 'murid') {
    return { role: roleRaw, userId };
  }
  return { role: null, userId: '' };
}

function signMediaToken(submissionId: string, viewerScope: string): string {
  const exp = Date.now() + 12 * 60 * 60 * 1000; // 12h valid session playback token
  const payload = `${submissionId}:${viewerScope}:${exp}`;
  const sig = crypto
    .createHmac('sha256', MEDIA_SIGNING_SECRET)
    .update(payload)
    .digest('hex');
  return Buffer.from(`${payload}:${sig}`).toString('base64url');
}

function verifyMediaToken(token: string, submissionId: string, ownerUserId: string): boolean {
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf8');
    const parts = decoded.split(':');
    if (parts.length !== 4) return false;
    const [subId, scope, expStr, sig] = parts;
    if (subId !== submissionId) return false;
    const exp = Number(expStr);
    if (!Number.isFinite(exp) || Date.now() > exp) return false;
    if (scope !== 'staff' && scope !== ownerUserId) return false;
    const expectedSig = crypto
      .createHmac('sha256', MEDIA_SIGNING_SECRET)
      .update(`${subId}:${scope}:${expStr}`)
      .digest('hex');
    return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig));
  } catch {
    return false;
  }
}

function inferExtension(mimeType: string, mediaType: 'audio' | 'video'): string {
  const lower = mimeType.toLowerCase();
  if (lower.includes('mp4')) return mediaType === 'video' ? 'mp4' : 'm4a';
  if (lower.includes('ogg')) return 'ogg';
  if (lower.includes('wav')) return 'wav';
  return 'webm';
}

// Cache synthesized TTS WAV buffers in memory (bounded LRU) for instant replay
const MAX_TTS_CACHE_ENTRIES = 150;
const ttsCache = new Map<string, string>();

const ALLOWED_TTS_VOICES = new Set(['Kore', 'Zephyr', 'Puck', 'Charon', 'Fenrir']);

const EMOTION_DIRECTION_MAP: Record<string, string> = {
  welcome: 'Warm, smiling, cheerful, and genuinely welcoming Malaysian mentor voice.',
  mission_intro: 'Enthusiastic, engaging, and intriguing storytelling tone that sparks curiosity.',
  instruction: 'Calm, crystal-clear, steady, and easy-to-follow instructional tone.',
  hint: 'Gentle, supportive, guiding, and encouraging soft tone.',
  warning: 'Earnest, firm, serious, and composed urgency that conveys real importance.',
  correct: 'Happy, bright, excited, and warmly praising tone.',
  wrong: 'Gentle, positive, patient, and encouraging tone inviting the pupil to try again.',
  encouragement: 'Motivating, confident, heartfelt, and reassuring tone.',
  congrats: 'Very cheerful, proud, celebratory, and deeply appreciative Malaysian tone.',
  closing: 'Warm, touching, sincere, and inspiring closing tone.',
  report: 'Articulate, observant, natural Malaysian broadcast/field reporter tone.',
};

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

const STRICT_MALAYSIAN_MS_MY_STYLE =
  'Speak strictly in authentic, natural Malaysian Bahasa Melayu (Bahasa Melayu baku Malaysia, Kuala Lumpur / RTM broadcast standard, locale ms-MY). ' +
  'Articulate every Malay syllable clearly and naturally like a real Malaysian speaker talking directly to primary school pupils, with natural soft vowel cadence and Malaysian phrasing. ' +
  'NEVER use an Indonesian (id-ID / Jakarta) accent, intonation, or stiff mechanical robotic delivery. ' +
  'Maintain a comfortable, moderate conversational pace — never rushed, never monotonous, never over-acted — with brief natural pauses at commas, colons, question marks, and paragraph breaks, and clean endings without clipping.';

function buildExpressiveMalaysianStyle(
  rawText: string,
  requestedStyle: string,
  emotion: string
): string {
  const lower = rawText.toLowerCase();
  const arcHints: string[] = [];

  if (/salam sejahtera|selamat datang|hai rakan|helo/.test(lower)) {
    arcHints.push('Begin with a warm, friendly welcoming smile in the voice.');
  }
  if (/perhatian|bahaya|ancaman|terancam|busuk|hitam pekat|mati terapung|jerebu/.test(lower)) {
    arcHints.push('Shift to an earnest, serious, and concerned tone when describing environmental threats or pollution.');
  }
  if (rawText.includes('?')) {
    arcHints.push('Use a gentle, natural rising questioning inflection on questions.');
  }
  if (/namun|harapan|ayuh|jadilah wira|ingat|tanggungjawab/.test(lower)) {
    arcHints.push('Build warm, sincere motivation and inspiring conviction on encouraging or closing lines.');
  }
  if (/tahniah|syabas|hebat|berbangga/.test(lower)) {
    arcHints.push('Radiate genuine Malaysian pride, joy, and celebratory warmth without sounding exaggerated.');
  }

  const parts = [STRICT_MALAYSIAN_MS_MY_STYLE];
  if (emotion && EMOTION_DIRECTION_MAP[emotion]) {
    parts.push(`Primary Delivery Emotion: ${EMOTION_DIRECTION_MAP[emotion]}`);
  }
  if (arcHints.length > 0) {
    parts.push(`Dynamic Emotional Pacing: ${arcHints.join(' ')}`);
  }
  if (requestedStyle) {
    parts.push(`Character & Scene Context: ${requestedStyle}`);
  } else {
    parts.push(
      'Character & Scene Context: Natural, caring Malaysian mentor speaking clearly and warmly to Year 6 primary school pupils.'
    );
  }
  return parts.join(' ');
}

function setBoundedTtsCache(key: string, val: string): void {
  if (ttsCache.has(key)) {
    ttsCache.delete(key);
  } else if (ttsCache.size >= MAX_TTS_CACHE_ENTRIES) {
    const oldestKey = ttsCache.keys().next().value;
    if (oldestKey) ttsCache.delete(oldestKey);
  }
  ttsCache.set(key, val);
}

app.post('/api/tts', async (req, res) => {
  try {
    const rawText = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
    const requestedStyle =
      typeof req.body?.style === 'string' && req.body.style.trim() ? req.body.style.trim() : '';
    const requestedVoice =
      typeof req.body?.voiceName === 'string' && ALLOWED_TTS_VOICES.has(req.body.voiceName.trim())
        ? req.body.voiceName.trim()
        : 'Kore';
    const emotion =
      typeof req.body?.emotion === 'string' && req.body.emotion.trim()
        ? req.body.emotion.trim().toLowerCase()
        : '';

    if (!rawText) {
      return res.status(400).json({ error: 'Teks diperlukan untuk penjanaan suara Bahasa Melayu.', code: 'BAD_REQUEST' });
    }

    const style = buildExpressiveMalaysianStyle(rawText, requestedStyle, emotion);
    const cacheKey = `${requestedVoice}::${style}::${rawText}`;
    const cached = ttsCache.get(cacheKey);
    if (cached) {
      return res.json({ audioBase64: cached, mimeType: 'audio/wav', voiceName: requestedVoice, provider: 'gemini-ai' });
    }

    const ai = getGeminiClient();
    if (!ai) {
      return res.status(503).json({
        error: 'GEMINI_API_KEY belum ditetapkan dalam Settings > Secrets.',
        code: 'NO_API_KEY',
      });
    }

    // Prioritize flagship expressive gemini-3.8-flash-tts for natural human prosody & emotion
    const ttsModels = ['gemini-3.8-flash-tts', 'gemini-3.8-flash-lite-tts'] as const;
    let base64Audio: string | undefined;
    let mimeType = 'audio/wav';
    let lastError: unknown = null;

    for (const modelName of ttsModels) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: rawText,
                  speechMetadata: {
                    style,
                  },
                },
              ],
            },
          ],
          config: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: requestedVoice },
              },
            },
          },
        });

        const parts = response.candidates?.[0]?.content?.parts || [];
        const audioPart = parts.find((p) => Boolean(p?.inlineData?.data));
        if (audioPart?.inlineData?.data) {
          base64Audio = audioPart.inlineData.data;
          mimeType = audioPart.inlineData.mimeType || 'audio/wav';
          break;
        }
      } catch (modelErr) {
        lastError = modelErr;
      }
    }

    if (!base64Audio) {
      console.error('Gemini TTS failed across models:', lastError);
      return res.status(502).json({
        error: 'Audio AI Bahasa Melayu gagal dijana buat sementara.',
        code: 'TTS_FAILED',
      });
    }

    setBoundedTtsCache(cacheKey, base64Audio);
    return res.json({ audioBase64: base64Audio, mimeType, voiceName: requestedVoice, provider: 'gemini-ai' });
  } catch (err) {
    console.error('TTS error:', err);
    return res.status(500).json({ error: 'Gagal menjana audio suara Bahasa Melayu Malaysia.', code: 'SERVER_ERROR' });
  }
});

// ============================================================================
// MISSION 5 RECORDING SUBMISSIONS & TEACHER EVALUATION API
// ============================================================================

app.get('/api/submissions', async (req, res) => {
  try {
    const auth = getAuthContext(req);
    if (!auth.role || !auth.userId) {
      return res.status(403).json({ error: 'Akses ditolak. Sila log masuk terlebih dahulu.' });
    }

    const list = await readSubmissions();
    const filtered =
      auth.role === 'guru' || auth.role === 'admin'
        ? list
        : list.filter((item) => item.studentUserId === auth.userId);

    const viewerScope = auth.role === 'guru' || auth.role === 'admin' ? 'staff' : auth.userId;
    const sorted = [...filtered].sort(
      (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
    );

    return res.json({
      submissions: sorted.map((item) => ({
        ...item,
        mediaUrl: `/api/submissions/${encodeURIComponent(item.id)}/media?token=${encodeURIComponent(
          signMediaToken(item.id, viewerScope)
        )}`,
      })),
    });
  } catch (err) {
    console.error('GET /api/submissions failed:', err);
    return res.status(500).json({ error: 'Gagal memuatkan rekod rakaman.' });
  }
});

app.post(
  '/api/submissions',
  express.raw({
    type: ['audio/*', 'video/*', 'application/octet-stream'],
    limit: '35mb',
  }),
  async (req, res) => {
    try {
      const auth = getAuthContext(req);
      if (auth.role !== 'murid' || !auth.userId) {
        return res.status(403).json({ error: 'Hanya murid yang log masuk dibenarkan menghantar rakaman.' });
      }
      if (auth.userId === 'DEMO_PENSYARAH') {
        return res.status(403).json({
          error: 'Akaun demo tidak dibenarkan mengubah rekod murid sebenar.',
        });
      }

      const rawMeta = req.header('x-submission-meta');
      if (!rawMeta) {
        return res.status(400).json({ error: 'Maklumat penghantaran tidak lengkap.' });
      }

      const meta = JSON.parse(decodeURIComponent(rawMeta)) as {
        studentUserId?: string;
        studentName?: string;
        studentId?: string;
        className?: string;
        mediaType?: 'audio' | 'video';
        campaignTitle?: string;
      };

      if (meta.studentUserId !== auth.userId) {
        return res.status(403).json({ error: 'Akses murid tidak sepadan.' });
      }

      if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
        return res.status(400).json({ error: 'Fail rakaman kosong atau tidak sah.' });
      }

      const mediaType: 'audio' | 'video' = meta.mediaType === 'video' ? 'video' : 'audio';
      const contentTypeHeader = String(req.header('content-type') || '').split(';')[0].trim();
      const mimeType =
        contentTypeHeader && (contentTypeHeader.startsWith('audio/') || contentTypeHeader.startsWith('video/'))
          ? contentTypeHeader
          : mediaType === 'video'
          ? 'video/webm'
          : 'audio/webm';

      await ensureStorageReady();
      const id = `sub_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
      const ext = inferExtension(mimeType, mediaType);
      const fileName = `${id}.${ext}`;
      const filePath = path.join(RECORDINGS_DIR, fileName);

      await fsp.writeFile(filePath, req.body);

      const record: StoredSubmission = {
        id,
        studentUserId: auth.userId,
        studentName: String(meta.studentName || 'Murid EcoWorld').trim(),
        studentId: String(meta.studentId || '').trim().toUpperCase(),
        className: String(meta.className || '6 Bestari').trim(),
        missionId: 5,
        mediaType,
        mimeType,
        fileName,
        fileSize: req.body.length,
        campaignTitle: String(meta.campaignTitle || 'Kempen Selamatkan EcoWorld').trim(),
        status: 'BERJAYA',
        submittedAt: new Date().toISOString(),
        teacherComment: '',
        teacherScore: null,
        teacherGrade: '',
        reviewedAt: null,
        reviewedBy: null,
      };

      const existing = await readSubmissions();
      existing.push(record);
      await writeSubmissions(existing);

      return res.status(201).json({
        submission: {
          ...record,
          mediaUrl: `/api/submissions/${encodeURIComponent(record.id)}/media?token=${encodeURIComponent(
            signMediaToken(record.id, auth.userId)
          )}`,
        },
      });
    } catch (err) {
      console.error('POST /api/submissions failed:', err);
      return res.status(500).json({ error: 'Gagal menyimpan fail rakaman ke pelayan.' });
    }
  }
);

app.get('/api/submissions/:id/media', async (req, res) => {
  try {
    const id = String(req.params.id || '').trim();
    const list = await readSubmissions();
    const item = list.find((s) => s.id === id);
    if (!item) {
      return res.status(404).json({ error: 'Fail rakaman tidak ditemui.' });
    }

    const auth = getAuthContext(req);
    const token = typeof req.query.token === 'string' ? req.query.token : '';
    const allowedByHeader =
      auth.role === 'guru' ||
      auth.role === 'admin' ||
      (auth.role === 'murid' && auth.userId === item.studentUserId);
    const allowedByToken = token ? verifyMediaToken(token, item.id, item.studentUserId) : false;

    if (!allowedByHeader && !allowedByToken) {
      return res.status(403).json({ error: 'Akses kepada rakaman murid ini adalah terhad.' });
    }

    const safeName = path.basename(item.fileName);
    const filePath = path.join(RECORDINGS_DIR, safeName);
    let stat: fs.Stats;
    try {
      stat = await fsp.stat(filePath);
    } catch {
      return res.status(404).json({ error: 'Fail media tiada dalam storan.' });
    }

    const total = stat.size;
    const range = req.headers.range;
    res.setHeader('Content-Type', item.mimeType || (item.mediaType === 'video' ? 'video/webm' : 'audio/webm'));
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'private, max-age=3600');
    if (req.query.download === '1') {
      res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
    }

    if (range) {
      const match = /bytes=(\d+)-(\d*)/.exec(range);
      if (match) {
        const start = Number(match[1]);
        const end = match[2] ? Math.min(Number(match[2]), total - 1) : total - 1;
        if (start >= total || start > end) {
          return res.status(416).setHeader('Content-Range', `bytes */${total}`).end();
        }
        res.status(206);
        res.setHeader('Content-Range', `bytes ${start}-${end}/${total}`);
        res.setHeader('Content-Length', end - start + 1);
        fs.createReadStream(filePath, { start, end }).pipe(res);
        return;
      }
    }

    res.setHeader('Content-Length', total);
    fs.createReadStream(filePath).pipe(res);
  } catch (err) {
    console.error('GET /api/submissions/:id/media failed:', err);
    return res.status(500).json({ error: 'Gagal memainkan fail rakaman.' });
  }
});

app.patch('/api/submissions/:id/review', async (req, res) => {
  try {
    const auth = getAuthContext(req);
    if (auth.role !== 'guru' && auth.role !== 'admin') {
      return res.status(403).json({ error: 'Hanya guru atau pentadbir dibenarkan memberi penilaian.' });
    }

    const id = String(req.params.id || '').trim();
    const list = await readSubmissions();
    const target = list.find((s) => s.id === id);
    if (!target) {
      return res.status(404).json({ error: 'Rekod rakaman tidak ditemui.' });
    }

    const comment =
      typeof req.body?.teacherComment === 'string' ? req.body.teacherComment.trim() : target.teacherComment;
    const rawScore = req.body?.teacherScore;
    const parsedScore =
      rawScore === null || rawScore === '' || rawScore === undefined
        ? null
        : Math.max(0, Math.min(100, Math.round(Number(rawScore))));
    const grade =
      typeof req.body?.teacherGrade === 'string' ? req.body.teacherGrade.trim() : target.teacherGrade;
    const reviewer =
      typeof req.body?.reviewedBy === 'string' && req.body.reviewedBy.trim()
        ? req.body.reviewedBy.trim()
        : 'Guru EcoWorld';

    target.teacherComment = comment;
    target.teacherScore = Number.isNaN(parsedScore as number) ? null : parsedScore;
    target.teacherGrade = grade;
    target.reviewedAt = new Date().toISOString();
    target.reviewedBy = reviewer;

    await writeSubmissions(list);

    return res.json({
      submission: {
        ...target,
        mediaUrl: `/api/submissions/${encodeURIComponent(target.id)}/media?token=${encodeURIComponent(
          signMediaToken(target.id, 'staff')
        )}`,
      },
    });
  } catch (err) {
    console.error('PATCH /api/submissions/:id/review failed:', err);
    return res.status(500).json({ error: 'Gagal menyimpan penilaian guru.' });
  }
});

// ============================================================================
// COMPREHENSIVE STUDENT WORK PORTFOLIO & MULTI-MISSION AUDIO ATTACHMENTS API
// ============================================================================

const DEMO_SCRIPTS_MAP: Record<string, { fileName: string; text: string }> = {
  m2: {
    fileName: 'demo-misi02-analisis-punca-kesan.wav',
    text: 'Pada pendapat saya, kita tidak boleh membuang sampah ke dalam sungai kerana tindakan itu mencemarkan sumber air bersih, membunuh hidupan akuatik seperti ikan dan menyebabkan penduduk kampung terdedah kepada penyakit bawaan air.',
  },
  m3: {
    fileName: 'demo-misi03-pembentangan-hutan-harapan.wav',
    text: 'Saya memilih Cadangan B iaitu Gotong-Royong Membersihkan Hutan kerana kelebihannya dapat membersihkan kawasan hutan dengan segera dan menjamin keselamatan habitat haiwan walaupun memerlukan kerjasama erat seluruh masyarakat.',
  },
  m4: {
    fileName: 'demo-misi04-hujah-kritis-taman-harmoni.wav',
    text: 'Saya berpendirian bahawa pencemaran udara di Taman Harmoni perlu dihentikan segera. Buktinya, kenderaan mengeluarkan asap hitam dan pembakaran terbuka masih berlaku. Oleh itu, penguatkuasaan penapis asap dan pengangkutan awam hijau mesti dilaksanakan. Tegasnya, marilah kita bersama-sama menjaga kebersihan udara.',
  },
  m5: {
    fileName: 'demo-misi05-kempen-selamatkan-ecoworld.wav',
    text: 'Salam sejahtera warga EcoWorld! Alam sekitar ialah tanggungjawab kita bersama. Hentikan pembakaran terbuka, pelihara sungai kita, dan hijaukan kembali bumi tercinta demi generasi masa hadapan. Selamatkan EcoWorld, suarakan perubahan!',
  },
};

const demoWavCache = new Map<string, Buffer>();

function buildSynthDemoWav(key: string): Buffer {
  const sampleRate = 22050;
  const freqsByKey: Record<string, number[]> = {
    m2: [440, 554.37, 659.25, 880],
    m3: [392, 493.88, 587.33, 783.99],
    m4: [523.25, 659.25, 783.99, 1046.5],
    m5: [523.25, 587.33, 659.25, 783.99, 1046.5],
  };
  const notes = freqsByKey[key] || freqsByKey.m5;
  const noteDur = 0.65;
  const totalSec = notes.length * noteDur + 0.35;
  const numSamples = Math.floor(sampleRate * totalSec);
  const dataSize = numSamples * 2;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const noteIdx = Math.min(notes.length - 1, Math.floor(t / noteDur));
    const localT = t - noteIdx * noteDur;
    const freq = notes[noteIdx];
    const env =
      t >= notes.length * noteDur
        ? Math.max(0, 1 - (t - notes.length * noteDur) / 0.35)
        : Math.min(1, localT / 0.04) * Math.exp(-localT * 2.1);
    const val =
      (Math.sin(2 * Math.PI * freq * t) * 0.68 +
        Math.sin(2 * Math.PI * (freq * 1.5) * t) * 0.16) *
      env;
    const pcm = Math.max(-32767, Math.min(32767, Math.round(val * 12000)));
    buffer.writeInt16LE(pcm, 44 + i * 2);
  }
  return buffer;
}

app.get('/api/demo/audio/:key', async (req, res) => {
  try {
    const key = String(req.params.key || 'm5').toLowerCase();
    const spec = DEMO_SCRIPTS_MAP[key] || DEMO_SCRIPTS_MAP.m5;
    let wavBuf = demoWavCache.get(key);

    if (!wavBuf) {
      const ai = getGeminiClient();
      if (ai) {
        try {
          const style = buildExpressiveMalaysianStyle(
            spec.text,
            'Expressive, confident Year 6 Malaysian pupil delivering a natural oral presentation in standard Bahasa Melayu Malaysia.',
            'encouragement'
          );
          for (const demoModel of ['gemini-3.8-flash-tts', 'gemini-3.8-flash-lite-tts'] as const) {
            try {
              const response = await ai.models.generateContent({
                model: demoModel,
                contents: [
                  {
                    role: 'user',
                    parts: [{ text: spec.text, speechMetadata: { style } }],
                  },
                ],
                config: {
                  responseModalities: ['AUDIO'],
                  speechConfig: {
                    voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
                  },
                },
              });
              const audioPart = (response.candidates?.[0]?.content?.parts || []).find((p) =>
                Boolean(p?.inlineData?.data)
              );
              if (audioPart?.inlineData?.data) {
                wavBuf = Buffer.from(audioPart.inlineData.data, 'base64');
                break;
              }
            } catch {
              // try next model
            }
          }
        } catch {
          // Fall back cleanly to synthesized playable WAV below
        }
      }
      if (!wavBuf) {
        wavBuf = buildSynthDemoWav(key);
      }
      demoWavCache.set(key, wavBuf);
    }

    const total = wavBuf.length;
    res.setHeader('Content-Type', 'audio/wav');
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    if (req.query.download === '1') {
      res.setHeader('Content-Disposition', `attachment; filename="${spec.fileName}"`);
    }

    const range = req.headers.range;
    if (range) {
      const match = /bytes=(\d+)-(\d*)/.exec(range);
      if (match) {
        const start = Number(match[1]);
        const end = match[2] ? Math.min(Number(match[2]), total - 1) : total - 1;
        if (start >= total || start > end) {
          return res.status(416).setHeader('Content-Range', `bytes */${total}`).end();
        }
        res.status(206);
        res.setHeader('Content-Range', `bytes ${start}-${end}/${total}`);
        res.setHeader('Content-Length', end - start + 1);
        return res.send(wavBuf.subarray(start, end + 1));
      }
    }

    res.setHeader('Content-Length', total);
    return res.send(wavBuf);
  } catch (err) {
    console.error('GET /api/demo/audio/:key failed:', err);
    return res.status(500).json({ error: 'Gagal memainkan audio demonstrasi.' });
  }
});

app.get('/api/student-work', async (req, res) => {
  try {
    const auth = getAuthContext(req);
    if (!auth.role || !auth.userId) {
      return res.status(403).json({ error: 'Akses ditolak. Sila log masuk terlebih dahulu.' });
    }

    const works = await readStudentWorks();
    const filtered =
      auth.role === 'guru' || auth.role === 'admin'
        ? works
        : works.filter((w) => w.studentUserId === auth.userId);
    const viewerScope = auth.role === 'guru' || auth.role === 'admin' ? 'staff' : auth.userId;

    return res.json({
      portfolios: filtered.map((record) => ({
        ...record,
        audioAttachments: (record.audioAttachments || []).map((att) => ({
          ...att,
          mediaUrl: `/api/student-work/audio/${encodeURIComponent(
            att.id
          )}/media?token=${encodeURIComponent(signMediaToken(att.id, viewerScope))}`,
        })),
      })),
    });
  } catch (err) {
    console.error('GET /api/student-work failed:', err);
    return res.status(500).json({ error: 'Gagal memuatkan lampiran hasil kerja murid.' });
  }
});

app.post('/api/student-work/mission', async (req, res) => {
  try {
    const auth = getAuthContext(req);
    if (auth.role !== 'murid' || !auth.userId) {
      return res.status(403).json({ error: 'Hanya murid sebenar dibenarkan menyimpan hasil kerja.' });
    }
    if (auth.userId === 'DEMO_PENSYARAH' || req.body?.isDemo === true) {
      return res.status(403).json({
        error: 'Akaun demo tidak dibenarkan mengubah atau mencampurkan rekod murid sebenar.',
      });
    }

    const missionId = Number(req.body?.missionId);
    if (![1, 2, 3, 4, 5].includes(missionId)) {
      return res.status(400).json({ error: 'Nombor misi tidak sah.' });
    }

    const key = `m${missionId}` as 'm1' | 'm2' | 'm3' | 'm4' | 'm5';
    const studentName = String(req.body?.studentName || 'Murid EcoWorld').trim();
    const studentId = String(req.body?.studentId || '').trim().toUpperCase();
    const className = String(req.body?.className || '6 Bestari').trim();
    const missionTitle = String(req.body?.missionTitle || `MISI 0${missionId}`).trim();
    const status = req.body?.status === 'Belum Selesai' ? 'Belum Selesai' : 'Selesai';
    const score = Number.isFinite(Number(req.body?.score)) ? Number(req.body.score) : 0;
    const rawActivities = Array.isArray(req.body?.activities) ? req.body.activities : [];
    const activities: StoredMissionActivity[] = rawActivities
      .filter((a: unknown): a is StoredMissionActivity =>
        Boolean(a && typeof (a as StoredMissionActivity).activityName === 'string')
      )
      .map((a: StoredMissionActivity) => ({
        activityName: String(a.activityName).trim(),
        prompt: a.prompt ? String(a.prompt).trim() : undefined,
        answer: String(a.answer || '').trim(),
      }));
    const taskOutput =
      typeof req.body?.taskOutput === 'string' ? req.body.taskOutput.trim() : undefined;
    const nowIso = new Date().toISOString();

    const list = await readStudentWorks();
    let record = list.find((item) => item.studentUserId === auth.userId);
    if (!record) {
      record = {
        studentUserId: auth.userId,
        studentName,
        studentId,
        className,
        updatedAt: nowIso,
        missions: {},
        audioAttachments: [],
      };
      list.push(record);
    } else {
      record.studentName = studentName;
      record.studentId = studentId;
      record.className = className;
      record.updatedAt = nowIso;
    }

    record.missions[key] = {
      missionId,
      missionTitle,
      status,
      score,
      completedAt: nowIso,
      activities,
      taskOutput,
    };

    await writeStudentWorks(list);
    return res.json({ ok: true, updatedAt: nowIso });
  } catch (err) {
    console.error('POST /api/student-work/mission failed:', err);
    return res.status(500).json({ error: 'Gagal menyimpan rekod jawapan murid.' });
  }
});

app.post(
  '/api/student-work/audio',
  express.raw({
    type: ['audio/*', 'video/*', 'application/octet-stream'],
    limit: '35mb',
  }),
  async (req, res) => {
    try {
      const auth = getAuthContext(req);
      if (auth.role !== 'murid' || !auth.userId) {
        return res.status(403).json({ error: 'Hanya murid sebenar dibenarkan menghantar rakaman.' });
      }
      if (auth.userId === 'DEMO_PENSYARAH') {
        return res.status(403).json({
          error: 'Akaun demo tidak dibenarkan menyimpan rakaman ke rekod murid sebenar.',
        });
      }

      const rawMeta = req.header('x-audio-meta');
      if (!rawMeta) {
        return res.status(400).json({ error: 'Maklumat rakaman audio tidak lengkap.' });
      }
      const meta = JSON.parse(decodeURIComponent(rawMeta)) as {
        studentUserId?: string;
        studentName?: string;
        studentId?: string;
        className?: string;
        missionId?: number;
        missionTitle?: string;
        activityName?: string;
        durationSec?: number;
        transcript?: string;
        mediaType?: 'audio' | 'video';
      };

      if (meta.studentUserId !== auth.userId) {
        return res.status(403).json({ error: 'Akses murid tidak sepadan.' });
      }
      if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
        return res.status(400).json({ error: 'Fail audio kosong atau tidak sah.' });
      }

      const missionId = Number(meta.missionId) || 2;
      const mediaType: 'audio' | 'video' = meta.mediaType === 'video' ? 'video' : 'audio';
      const contentTypeHeader = String(req.header('content-type') || '').split(';')[0].trim();
      const mimeType =
        contentTypeHeader &&
        (contentTypeHeader.startsWith('audio/') || contentTypeHeader.startsWith('video/'))
          ? contentTypeHeader
          : mediaType === 'video'
          ? 'video/webm'
          : 'audio/webm';

      await ensureStorageReady();
      const id = `aud_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
      const ext = inferExtension(mimeType, mediaType);
      const fileName = `${id}.${ext}`;
      const filePath = path.join(RECORDINGS_DIR, fileName);
      await fsp.writeFile(filePath, req.body);

      const nowIso = new Date().toISOString();
      const studentName = String(meta.studentName || 'Murid EcoWorld').trim();
      const studentId = String(meta.studentId || '').trim().toUpperCase();
      const className = String(meta.className || '6 Bestari').trim();

      const attachment: StoredAudioAttachment = {
        id,
        studentUserId: auth.userId,
        studentName,
        studentId,
        className,
        missionId,
        missionTitle: String(meta.missionTitle || `MISI 0${missionId}`).trim(),
        activityName: String(meta.activityName || `Rakaman Audio Misi 0${missionId}`).trim(),
        mediaType,
        fileName,
        mimeType,
        fileSize: req.body.length,
        durationSec: typeof meta.durationSec === 'number' ? meta.durationSec : undefined,
        transcript: meta.transcript ? String(meta.transcript).trim() : undefined,
        submittedAt: nowIso,
      };

      const list = await readStudentWorks();
      let record = list.find((item) => item.studentUserId === auth.userId);
      if (!record) {
        record = {
          studentUserId: auth.userId,
          studentName,
          studentId,
          className,
          updatedAt: nowIso,
          missions: {},
          audioAttachments: [],
        };
        list.push(record);
      } else {
        record.studentName = studentName;
        record.studentId = studentId;
        record.className = className;
        record.updatedAt = nowIso;
      }

      record.audioAttachments.unshift(attachment);
      await writeStudentWorks(list);

      return res.status(201).json({
        attachment: {
          ...attachment,
          mediaUrl: `/api/student-work/audio/${encodeURIComponent(
            attachment.id
          )}/media?token=${encodeURIComponent(signMediaToken(attachment.id, auth.userId))}`,
        },
      });
    } catch (err) {
      console.error('POST /api/student-work/audio failed:', err);
      return res.status(500).json({ error: 'Gagal menyimpan rakaman audio ke pelayan.' });
    }
  }
);

app.get('/api/student-work/audio/:id/media', async (req, res) => {
  try {
    const id = String(req.params.id || '').trim();
    const list = await readStudentWorks();
    let found: StoredAudioAttachment | null = null;
    for (const record of list) {
      const match = (record.audioAttachments || []).find((a) => a.id === id);
      if (match) {
        found = match;
        break;
      }
    }
    if (!found) {
      return res.status(404).json({ error: 'Fail rakaman audio tidak ditemui.' });
    }

    const auth = getAuthContext(req);
    const token = typeof req.query.token === 'string' ? req.query.token : '';
    const allowedByHeader =
      auth.role === 'guru' ||
      auth.role === 'admin' ||
      (auth.role === 'murid' && auth.userId === found.studentUserId);
    const allowedByToken = token ? verifyMediaToken(token, found.id, found.studentUserId) : false;

    if (!allowedByHeader && !allowedByToken) {
      return res.status(403).json({ error: 'Akses kepada rakaman murid ini adalah terhad.' });
    }

    const safeName = path.basename(found.fileName);
    const filePath = path.join(RECORDINGS_DIR, safeName);
    let stat: fs.Stats;
    try {
      stat = await fsp.stat(filePath);
    } catch {
      return res.status(404).json({ error: 'Fail audio tiada dalam storan.' });
    }

    const total = stat.size;
    res.setHeader('Content-Type', found.mimeType || 'audio/webm');
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'private, max-age=3600');
    if (req.query.download === '1') {
      res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
    }

    const range = req.headers.range;
    if (range) {
      const match = /bytes=(\d+)-(\d*)/.exec(range);
      if (match) {
        const start = Number(match[1]);
        const end = match[2] ? Math.min(Number(match[2]), total - 1) : total - 1;
        if (start >= total || start > end) {
          return res.status(416).setHeader('Content-Range', `bytes */${total}`).end();
        }
        res.status(206);
        res.setHeader('Content-Range', `bytes ${start}-${end}/${total}`);
        res.setHeader('Content-Length', end - start + 1);
        fs.createReadStream(filePath, { start, end }).pipe(res);
        return;
      }
    }

    res.setHeader('Content-Length', total);
    fs.createReadStream(filePath).pipe(res);
  } catch (err) {
    console.error('GET /api/student-work/audio/:id/media failed:', err);
    return res.status(500).json({ error: 'Gagal memainkan rakaman audio murid.' });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`EcoWorld server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});

