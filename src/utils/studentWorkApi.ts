import {
  MissionActivityResponse,
  MissionWorkRecord,
  StudentAudioAttachment,
  StudentRecordingSubmission,
  StudentWorkPortfolio,
  SubmissionMediaType,
  UserAccount,
} from '../types/game';
import { DEMO_USER_ID } from '../data/demoAccountData';

function buildAuthHeaders(user: UserAccount): Record<string, string> {
  return {
    'x-ecoworld-role': user.role,
    'x-ecoworld-user-id': user.id,
  };
}

export async function fetchAllStudentWork(
  viewer: UserAccount
): Promise<Partial<StudentWorkPortfolio>[]> {
  const res = await fetch('/api/student-work', {
    headers: buildAuthHeaders(viewer),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Gagal memuatkan rekod hasil kerja murid.');
  }
  const data = (await res.json()) as { portfolios?: Partial<StudentWorkPortfolio>[] };
  return data.portfolios || [];
}

export async function syncMissionWork(
  user: UserAccount | null | undefined,
  payload: {
    missionId: number;
    missionTitle: string;
    score: number;
    status: 'Selesai' | 'Belum Selesai';
    activities: MissionActivityResponse[];
    taskOutput?: string;
  }
): Promise<void> {
  if (!user || user.role !== 'murid' || user.isDemo || user.id === DEMO_USER_ID) {
    return;
  }
  try {
    await fetch('/api/student-work/mission', {
      method: 'POST',
      headers: {
        ...buildAuthHeaders(user),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        studentName: user.fullName,
        studentId: user.studentId || '',
        className: user.className || '6 Bestari',
        missionId: payload.missionId,
        missionTitle: payload.missionTitle,
        score: payload.score,
        status: payload.status,
        activities: payload.activities,
        taskOutput: payload.taskOutput,
      }),
    });
  } catch {
    // Non-blocking background sync; localStorage still persists state locally
  }
}

export async function uploadMissionAudio(params: {
  user: UserAccount | null | undefined;
  blob: Blob;
  missionId: number;
  missionTitle: string;
  activityName: string;
  durationSec?: number;
  transcript?: string;
  mediaType?: SubmissionMediaType;
}): Promise<StudentAudioAttachment | null> {
  const { user, blob, missionId, missionTitle, activityName, durationSec, transcript, mediaType } =
    params;
  if (!user || user.role !== 'murid' || user.isDemo || user.id === DEMO_USER_ID) {
    return null;
  }

  const meta = {
    studentUserId: user.id,
    studentName: user.fullName,
    studentId: user.studentId || '',
    className: user.className || '6 Bestari',
    missionId,
    missionTitle,
    activityName,
    durationSec,
    transcript,
    mediaType: mediaType || 'audio',
  };

  try {
    const res = await fetch('/api/student-work/audio', {
      method: 'POST',
      headers: {
        ...buildAuthHeaders(user),
        'Content-Type': blob.type || (mediaType === 'video' ? 'video/webm' : 'audio/webm'),
        'x-audio-meta': encodeURIComponent(JSON.stringify(meta)),
      },
      body: blob,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { attachment?: StudentAudioAttachment };
    return data.attachment || null;
  } catch {
    return null;
  }
}

function buildFallbackMissionRecords(user: UserAccount): Record<'m1' | 'm2' | 'm3' | 'm4' | 'm5', MissionWorkRecord> {
  const p = user.progress;
  const emptyTs = '';
  const m1Done = Boolean(p?.m1.completed);
  const m2Done = Boolean(p?.m2.completed);
  const m3Done = Boolean(p?.m3.completed);
  const m4Done = Boolean(p?.m4.completed);
  const m5Done = Boolean(p?.m5.submitted || p?.m5.completed);

  return {
    m1: {
      missionId: 1,
      missionTitle: 'MISI 01 – Zon Sungai Tercemar',
      status: m1Done ? 'Selesai' : 'Belum Selesai',
      score: p?.m1.score || 0,
      completedAt: emptyTs,
      activities: m1Done
        ? [
            {
              activityName: 'Penilaian Mendengar (Tersurat & Tersirat)',
              answer: `Skor Tersurat: ${p?.m1.tersuratScore || 0}% · Skor Tersirat: ${p?.m1.tersiratScore || 0}%`,
            },
            {
              activityName: 'Bukti & Inferens Terkumpul',
              answer: (p?.m1.evidence || []).join(' | ') || 'Tiada catatan bukti direkodkan.',
            },
          ]
        : [],
      taskOutput: m1Done ? `Skor keseluruhan Misi 01: ${p?.m1.score || 0}%` : undefined,
    },
    m2: {
      missionId: 2,
      missionTitle: 'MISI 02 – Operasi Jejak Punca dan Kesan',
      status: m2Done ? 'Selesai' : 'Belum Selesai',
      score: p?.m2.score || 0,
      completedAt: emptyTs,
      activities: m2Done
        ? [
            {
              activityName: 'Peta Pemikiran Punca & Kesan',
              answer: p?.m2.thinkingMap
                ? `Punca: ${p.m2.thinkingMap.punca} | Kesan: ${p.m2.thinkingMap.kesan}`
                : 'Belum dilengkapkan',
            },
            {
              activityName: 'Jawapan KBAT / Analisis Lisan',
              answer: p?.m2.kbatAnswer || 'Tiada jawapan direkodkan.',
            },
          ]
        : [],
      taskOutput: m2Done ? `Skor KBAT: ${p?.m2.kbatScore || 0}%` : undefined,
    },
    m3: {
      missionId: 3,
      missionTitle: 'MISI 03 – Hutan Harapan',
      status: m3Done ? 'Selesai' : 'Belum Selesai',
      score: p?.m3.score || 0,
      completedAt: emptyTs,
      activities: m3Done
        ? [
            {
              activityName: 'Cadangan Penyelesaian Dipilih',
              answer: p?.m3.chosenOption || 'Belum dipilih',
            },
            {
              activityName: 'Justifikasi & Pembentangan Lisan',
              answer: p?.m3.justification || 'Tiada justifikasi direkodkan.',
            },
          ]
        : [],
      taskOutput: m3Done ? `Pilihan Misi 03: ${p?.m3.chosenOption || '-'}` : undefined,
    },
    m4: {
      missionId: 4,
      missionTitle: 'MISI 04 – Makmal Suara',
      status: m4Done ? 'Selesai' : 'Belum Selesai',
      score: p?.m4.score || 0,
      completedAt: emptyTs,
      activities: p?.m4.argument
        ? [
            { activityName: 'Komponen 1: Pendirian', answer: p.m4.argument.pendirian || '-' },
            { activityName: 'Komponen 2: Bukti Utama', answer: p.m4.argument.bukti || '-' },
            { activityName: 'Komponen 3: Huraian & Cadangan', answer: p.m4.argument.huraian || '-' },
            { activityName: 'Komponen 4: Seruan / Kesimpulan', answer: p.m4.argument.kesimpulan || '-' },
          ]
        : [],
      taskOutput: user.peerFeedback ? `Semakan Kendiri / Rakan: ${user.peerFeedback}` : undefined,
    },
    m5: {
      missionId: 5,
      missionTitle: 'MISI 05 – Operasi Selamatkan EcoWorld',
      status: m5Done ? 'Selesai' : 'Belum Selesai',
      score: p?.m5.rubricScore || 0,
      completedAt: emptyTs,
      activities: m5Done
        ? [
            {
              activityName: 'Langkah Perancangan Projek (9 Langkah)',
              answer: `${p?.m5.stepsDone?.length || 0}/9 langkah disemak`,
            },
            {
              activityName: 'Tajuk & Pautan Projek Kempen',
              answer: `${p?.m5.title || '-'} (${p?.m5.link || 'Tiada pautan'})`,
            },
            {
              activityName: 'Refleksi Pembelajaran Akhir',
              answer: p?.m5.reflection || 'Tiada refleksi direkodkan.',
            },
          ]
        : [],
      taskOutput: m5Done ? `Skor Rubrik Kendiri: ${p?.m5.rubricScore || 0}%` : undefined,
    },
  };
}

export function buildMergedStudentPortfolio(
  student: UserAccount,
  serverPortfolio: Partial<StudentWorkPortfolio> | undefined,
  m5Submissions: StudentRecordingSubmission[]
): StudentWorkPortfolio {
  const fallbackMissions = buildFallbackMissionRecords(student);
  const serverMissions: Partial<Record<'m1' | 'm2' | 'm3' | 'm4' | 'm5', MissionWorkRecord>> =
    serverPortfolio?.missions || {};

  const mergedMissions: Record<'m1' | 'm2' | 'm3' | 'm4' | 'm5', MissionWorkRecord> = {
    m1: serverMissions.m1 || fallbackMissions.m1,
    m2: serverMissions.m2 || fallbackMissions.m2,
    m3: serverMissions.m3 || fallbackMissions.m3,
    m4: serverMissions.m4 || fallbackMissions.m4,
    m5: serverMissions.m5 || fallbackMissions.m5,
  };

  // Merge multi-mission audio attachments from student-work.json + Mission 5 submissions.json
  const workAudio = serverPortfolio?.audioAttachments || [];
  const m5Audio: StudentAudioAttachment[] = m5Submissions
    .filter((sub) => sub.studentUserId === student.id)
    .map((sub) => ({
      id: sub.id,
      studentUserId: sub.studentUserId,
      studentName: sub.studentName,
      studentId: sub.studentId,
      className: sub.className,
      missionId: sub.missionId || 5,
      missionTitle: 'MISI 05 – Operasi Selamatkan EcoWorld',
      activityName: `Kempen Digital: ${sub.campaignTitle}`,
      mediaType: sub.mediaType,
      fileName: sub.fileName,
      mimeType: sub.mimeType,
      fileSize: sub.fileSize,
      transcript: sub.teacherComment
        ? `Ulasan Guru (${sub.teacherGrade || 'Dinilai'}): ${sub.teacherComment}`
        : undefined,
      submittedAt: sub.submittedAt,
      mediaUrl: sub.mediaUrl || '',
    }));

  const seenIds = new Set<string>();
  const combinedAudio: StudentAudioAttachment[] = [];
  for (const att of [...workAudio, ...m5Audio]) {
    if (!seenIds.has(att.id)) {
      seenIds.add(att.id);
      combinedAudio.push(att);
    }
  }
  combinedAudio.sort(
    (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
  );

  return {
    studentUserId: student.id,
    studentName: student.fullName,
    studentId: student.studentId || '',
    className: student.className || '6 Bestari',
    isDemo: false,
    updatedAt: serverPortfolio?.updatedAt || '',
    missions: mergedMissions,
    audioAttachments: combinedAudio,
  };
}
