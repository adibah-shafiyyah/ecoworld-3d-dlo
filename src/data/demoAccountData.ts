import {
  StudentRecordingSubmission,
  StudentWorkPortfolio,
  UserAccount,
} from '../types/game';

export const DEMO_USER_ID = 'DEMO_PENSYARAH';
export const DEMO_STUDENT_ID = 'DEMO-ECO3D';
export const DEMO_STUDENT_NAME = 'AKAUN DEMO MURID – ECOWORLD 3D';
export const DEMO_CLASS_NAME = 'Kelas Demonstrasi (Pensyarah)';

export const DEMO_AUDIO_SCRIPTS: Record<'m2' | 'm3' | 'm4' | 'm5', { title: string; fileName: string; text: string }> = {
  m2: {
    title: 'Rakaman Contoh Misi 02: Analisis Lisan Spontan Pencemaran Sungai & Udara',
    fileName: 'demo-misi02-analisis-punca-kesan.wav',
    text: 'Pada pendapat saya, kita tidak boleh membuang sampah ke dalam sungai kerana tindakan itu mencemarkan sumber air bersih, membunuh hidupan akuatik seperti ikan dan menyebabkan penduduk kampung terdedah kepada penyakit bawaan air.',
  },
  m3: {
    title: 'Rakaman Contoh Misi 03: Pembentangan Lisan Cadangan Hutan Harapan',
    fileName: 'demo-misi03-pembentangan-hutan-harapan.wav',
    text: 'Saya memilih Cadangan B iaitu Gotong-Royong Membersihkan Hutan kerana kelebihannya dapat membersihkan kawasan hutan dengan segera dan menjamin keselamatan habitat haiwan walaupun memerlukan kerjasama erat seluruh masyarakat.',
  },
  m4: {
    title: 'Rakaman Contoh Misi 04: Hujah Kritis & Kreatif Makmal Suara',
    fileName: 'demo-misi04-hujah-kritis-taman-harmoni.wav',
    text: 'Saya berpendirian bahawa pencemaran udara di Taman Harmoni perlu dihentikan segera. Buktinya, kenderaan mengeluarkan asap hitam dan pembakaran terbuka masih berlaku. Oleh itu, penguatkuasaan penapis asap dan pengangkutan awam hijau mesti dilaksanakan. Tegasnya, marilah kita bersama-sama menjaga kebersihan udara.',
  },
  m5: {
    title: 'Rakaman Contoh Misi 05: Kempen Audio Operasi Selamatkan EcoWorld',
    fileName: 'demo-misi05-kempen-selamatkan-ecoworld.wav',
    text: 'Salam sejahtera warga EcoWorld! Alam sekitar ialah tanggungjawab kita bersama. Hentikan pembakaran terbuka, pelihara sungai kita, dan hijaukan kembali bumi tercinta demi generasi masa hadapan. Selamatkan EcoWorld, suarakan perubahan!',
  },
};

export function createDemoStudentAccount(): UserAccount {
  return {
    id: DEMO_USER_ID,
    role: 'murid',
    username: 'demo_pensyarah',
    password: '',
    fullName: DEMO_STUDENT_NAME,
    studentId: DEMO_STUDENT_ID,
    className: DEMO_CLASS_NAME,
    classCode: 'DEMO',
    avatar: 'suara',
    xp: 1030,
    unlockedMission: 5,
    isDemo: true,
    progress: {
      m1: {
        completed: true,
        score: 100,
        tersuratScore: 100,
        tersiratScore: 100,
        evidence: [
          'Paip Sisa Kimia: Paip saliran kilang tekstil mengalirkan cecair berwarna hitam pekat terus ke dalam sungai pada waktu malam.',
          'Ikan Mati Terapung: Puluhan ikan sungai ditemui mati terapung di permukaan air akibat kekurangan oksigen dan keracunan kimia.',
          'Tong Sisa Berbau Busuk: Tong bahan kimia tanpa label ditinggalkan di tepi tebing sungai dan mengeluarkan bau busuk yang menyengat.',
          'Bukti Udara 3D (3/3): Paip Sisa Kimia, Ikan Mati Terapung, Tong Sisa Berbau Busuk | Inferens: Pihak kilang sengaja membuang sisa kimia pada waktu tengah malam ketika semua penduduk sedang tidur nyenyak bagi mengelakkan perbuatan mereka dikesan atau ditangkap oleh pihak berkuasa.',
        ],
      },
      m2: {
        completed: true,
        score: 96,
        kbatScore: 95,
        thinkingMap: {
          punca:
            'Pembakaran terbuka, pembuangan sampah ke sungai, penebangan pokok secara berlebihan dan pelepasan asap kenderaan serta kilang tanpa penapis.',
          kesan:
            'Udara tercemar oleh jerebu tebal, air sungai menjadi kotor dan beracun, haiwan kehilangan habitat semula jadi serta kesihatan pernafasan penduduk terjejas.',
        },
        kbatAnswer:
          'Rakaman suara spontan dijawab (Soalan 1, Soalan 2, Soalan 3) dengan huraian sebab-akibat jangka panjang terhadap ekosistem dan kesihatan masyarakat.',
      },
      m3: {
        completed: true,
        score: 98,
        chosenOption: 'CADANGAN B: Gotong-Royong Membersihkan Hutan (Pilihan Seimbang)',
        justification:
          'Pembentangan lisan spontan dirakam (18s): menilai kelebihan Cadangan B yang membersihkan hutan dengan pantas dan selamat serta mengatasi cabaran melalui kerjasama erat masyarakat dan pihak sekolah.',
      },
      m4: {
        completed: true,
        score: 95,
        argument: {
          pendirian:
            'Saya berpendapat masalah pencemaran udara di Taman Harmoni perlu dibendung dengan tindakan segera dan bersepadu.',
          bukti:
            'Buktinya, laporan menunjukkan banyak kenderaan mengeluarkan asap hitam dan aktiviti pembakaran terbuka masih berlaku sehingga menjejaskan keselesaan penduduk.',
          huraian:
            'Oleh itu, masyarakat perlu menghentikan pembakaran terbuka, mengamalkan pengangkutan awam mesra alam serta mewajibkan penapis asap pada kenderaan berat dan kilang.',
          kesimpulan:
            'Tegasnya, marilah kita bersama-sama menjaga kebersihan udara demi kesejahteraan generasi kini dan akan datang.',
        },
        hasRecording: true,
      },
      m5: {
        completed: true,
        submitted: true,
        link: '/api/demo/audio/m5',
        title: 'Kempen Selamatkan EcoWorld: Suara Generasi Prihatin (Demonstrasi)',
        stepsDone: [0, 1, 2, 3, 4, 5, 6, 7, 8],
        rubricScore: 98,
        reflection:
          'Melalui kesemua 5 misi EcoWorld 3D, murid dapat menguasai kemahiran mendengar maklumat tersurat dan tersirat, menganalisis punca serta kesan pencemaran, menilai cadangan penyelesaian secara kritis dan menyampaikan hujah kempen kesedaran dengan sebutan Bahasa Melayu baku serta intonasi yang meyakinkan.',
      },
    },
    badges: [
      'eco_explorer',
      'listening_detective',
      'critical_thinker',
      'brilliant_speaker',
      'eco_hero',
    ],
    teacherFeedback:
      'Contoh Demonstrasi Pensyarah: Penyampaian hujah kritis amat jelas, tersusun mengikut struktur SP 1.2.2 dan disertakan bukti lengkap.',
    aiApprovedByTeacher: true,
    peerFeedback:
      'Sebutan Bahasa Melayu baku jelas, fakta tersurat dan tersirat tepat serta nada penyampaian meyakinkan.',
  };
}

export function createDemoSubmissionPreview(): StudentRecordingSubmission {
  return {
    id: 'demo_sub_m5',
    studentUserId: DEMO_USER_ID,
    studentName: DEMO_STUDENT_NAME,
    studentId: DEMO_STUDENT_ID,
    className: DEMO_CLASS_NAME,
    missionId: 5,
    mediaType: 'audio',
    mimeType: 'audio/wav',
    fileName: DEMO_AUDIO_SCRIPTS.m5.fileName,
    fileSize: 48000,
    campaignTitle: 'Kempen Selamatkan EcoWorld: Suara Generasi Prihatin (Demonstrasi)',
    status: 'BERJAYA',
    submittedAt: '2026-11-19T08:30:00.000Z',
    teacherComment:
      'Contoh rakaman demonstrasi untuk semakan pensyarah. Audio jelas dengan struktur hujah lengkap.',
    teacherScore: 98,
    teacherGrade: 'Cemerlang',
    reviewedAt: '2026-11-19T08:45:00.000Z',
    reviewedBy: 'Cikgu Amina binti Razak (Simulasi Demo)',
    mediaUrl: '/api/demo/audio/m5',
  };
}

export function createDemoPortfolio(): StudentWorkPortfolio {
  const demoUser = createDemoStudentAccount();
  const p = demoUser.progress!;
  const demoTs = '2026-11-19T08:30:00.000Z';

  return {
    studentUserId: DEMO_USER_ID,
    studentName: DEMO_STUDENT_NAME,
    studentId: DEMO_STUDENT_ID,
    className: DEMO_CLASS_NAME,
    isDemo: true,
    updatedAt: demoTs,
    missions: {
      m1: {
        missionId: 1,
        missionTitle: 'MISI 01 – Zon Sungai Tercemar',
        status: 'Selesai',
        score: p.m1.score,
        completedAt: demoTs,
        activities: [
          {
            activityName: 'Aktiviti 1: Soalan Maklumat Tersurat 1 (Keadaan Air Sungai)',
            prompt: 'Bagaimanakah keadaan air Sungai Jernih mengikut laporan Puan Aminah?',
            answer: 'Kehitaman dan berbau busuk seperti bahan kimia.',
          },
          {
            activityName: 'Aktiviti 2: Soalan Maklumat Tersurat 2 (Masa Pembuangan Sisa)',
            prompt: 'Bilakah lori tangki dan kilang melepaskan sisa buangan melalui paip rahsia?',
            answer: 'Pada waktu tengah malam.',
          },
          {
            activityName: 'Aktiviti 3: Soalan Maklumat Tersirat (Inferens Kritis)',
            prompt: 'Mengapakah pihak kilang memilih waktu tengah malam ketika penduduk sedang tidur?',
            answer:
              'Pihak kilang sengaja membuang sisa kimia pada waktu tengah malam ketika semua penduduk sedang tidur nyenyak bagi mengelakkan perbuatan mereka dikesan atau ditangkap oleh pihak berkuasa.',
          },
        ],
        taskOutput:
          'Bukti 3D Terkumpul (3/3): Paip Sisa Kimia, Ikan Mati Terapung, Tong Sisa Berbau Busuk. (Tersurat: 100% · Tersirat: 100%)',
      },
      m2: {
        missionId: 2,
        missionTitle: 'MISI 02 – Operasi Jejak Punca dan Kesan',
        status: 'Selesai',
        score: p.m2.score,
        completedAt: demoTs,
        activities: [
          {
            activityName: 'Aktiviti 1: Padanan Interaktif Punca & Kesan Pencemaran (4 Pasangan)',
            answer:
              '1) Pembakaran terbuka → Asap mencemarkan udara. 2) Pembuangan sampah ke dalam sungai → Air sungai menjadi kotor. 3) Penebangan pokok berlebihan → Haiwan kehilangan tempat tinggal. 4) Asap kenderaan → Kesihatan manusia terjejas.',
          },
          {
            activityName: 'Aktiviti 2: Peta Pemikiran Punca & Kesan',
            answer: `Punca: ${p.m2.thinkingMap!.punca} | Kesan: ${p.m2.thinkingMap!.kesan}`,
          },
          {
            activityName: 'Aktiviti 3: Tugasan Rakaman Suara Spontan (Soalan 1–3)',
            answer: p.m2.kbatAnswer,
          },
        ],
        taskOutput:
          'Sungai dan udara berjaya dipulihkan (Skor KBAT: 95%, Rakaman Lisan Demonstrasi Tersedia).',
      },
      m3: {
        missionId: 3,
        missionTitle: 'MISI 03 – Hutan Harapan',
        status: 'Selesai',
        score: p.m3.score,
        completedAt: demoTs,
        activities: [
          {
            activityName: 'Aktiviti 1: Penerokaan 3 Cadangan Pemulihan Hutan Harapan',
            answer:
              'Menilai kelebihan dan cabaran Cadangan A (Penanaman Pokok), Cadangan B (Gotong-Royong Membersihkan Hutan) dan Cadangan C (Kempen Kesedaran).',
          },
          {
            activityName: 'Aktiviti 2: Keputusan Pilihan Cadangan Terbaik',
            answer: p.m3.chosenOption,
          },
        ],
        taskOutput: p.m3.justification,
      },
      m4: {
        missionId: 4,
        missionTitle: 'MISI 04 – Makmal Suara',
        status: 'Selesai',
        score: p.m4.score,
        completedAt: demoTs,
        activities: [
          {
            activityName: 'Komponen 1: Pendirian',
            answer: p.m4.argument!.pendirian,
          },
          {
            activityName: 'Komponen 2: Bukti Utama (Laporan Taman Harmoni)',
            answer: p.m4.argument!.bukti,
          },
          {
            activityName: 'Komponen 3: Huraian & Cadangan',
            answer: p.m4.argument!.huraian,
          },
          {
            activityName: 'Komponen 4: Seruan / Kesimpulan',
            answer: p.m4.argument!.kesimpulan,
          },
        ],
        taskOutput: `Semakan Kendiri: ${demoUser.peerFeedback}`,
      },
      m5: {
        missionId: 5,
        missionTitle: 'MISI 05 – Operasi Selamatkan EcoWorld',
        status: 'Selesai',
        score: p.m5.rubricScore,
        completedAt: demoTs,
        activities: [
          {
            activityName: 'Aktiviti 1: Perancangan Kempen Digital (9 Langkah Projek)',
            answer: 'Kesemua 9/9 langkah perancangan kempen digital telah disempurnakan.',
          },
          {
            activityName: 'Aktiviti 2: Projek & Penyerahan Kempen',
            answer: `Tajuk: ${p.m5.title} | Skor Rubrik Kendiri: ${p.m5.rubricScore}%`,
          },
          {
            activityName: 'Aktiviti 3: Refleksi Akhir Pembelajaran',
            answer: p.m5.reflection,
          },
        ],
        taskOutput: `Status: Kempen Dilancarkan & Disimpan (${p.m5.rubricScore}%)`,
      },
    },
    audioAttachments: [
      {
        id: 'demo_audio_m2',
        studentUserId: DEMO_USER_ID,
        studentName: DEMO_STUDENT_NAME,
        studentId: DEMO_STUDENT_ID,
        className: DEMO_CLASS_NAME,
        missionId: 2,
        missionTitle: 'MISI 02 – Operasi Jejak Punca dan Kesan',
        activityName: DEMO_AUDIO_SCRIPTS.m2.title,
        mediaType: 'audio',
        fileName: DEMO_AUDIO_SCRIPTS.m2.fileName,
        mimeType: 'audio/wav',
        fileSize: 44100,
        durationSec: 12,
        transcript: DEMO_AUDIO_SCRIPTS.m2.text,
        submittedAt: demoTs,
        mediaUrl: '/api/demo/audio/m2',
        isDemo: true,
      },
      {
        id: 'demo_audio_m3',
        studentUserId: DEMO_USER_ID,
        studentName: DEMO_STUDENT_NAME,
        studentId: DEMO_STUDENT_ID,
        className: DEMO_CLASS_NAME,
        missionId: 3,
        missionTitle: 'MISI 03 – Hutan Harapan',
        activityName: DEMO_AUDIO_SCRIPTS.m3.title,
        mediaType: 'audio',
        fileName: DEMO_AUDIO_SCRIPTS.m3.fileName,
        mimeType: 'audio/wav',
        fileSize: 44100,
        durationSec: 14,
        transcript: DEMO_AUDIO_SCRIPTS.m3.text,
        submittedAt: demoTs,
        mediaUrl: '/api/demo/audio/m3',
        isDemo: true,
      },
      {
        id: 'demo_audio_m4',
        studentUserId: DEMO_USER_ID,
        studentName: DEMO_STUDENT_NAME,
        studentId: DEMO_STUDENT_ID,
        className: DEMO_CLASS_NAME,
        missionId: 4,
        missionTitle: 'MISI 04 – Makmal Suara',
        activityName: DEMO_AUDIO_SCRIPTS.m4.title,
        mediaType: 'audio',
        fileName: DEMO_AUDIO_SCRIPTS.m4.fileName,
        mimeType: 'audio/wav',
        fileSize: 48000,
        durationSec: 16,
        transcript: DEMO_AUDIO_SCRIPTS.m4.text,
        submittedAt: demoTs,
        mediaUrl: '/api/demo/audio/m4',
        isDemo: true,
      },
      {
        id: 'demo_audio_m5',
        studentUserId: DEMO_USER_ID,
        studentName: DEMO_STUDENT_NAME,
        studentId: DEMO_STUDENT_ID,
        className: DEMO_CLASS_NAME,
        missionId: 5,
        missionTitle: 'MISI 05 – Operasi Selamatkan EcoWorld',
        activityName: DEMO_AUDIO_SCRIPTS.m5.title,
        mediaType: 'audio',
        fileName: DEMO_AUDIO_SCRIPTS.m5.fileName,
        mimeType: 'audio/wav',
        fileSize: 52000,
        durationSec: 15,
        transcript: DEMO_AUDIO_SCRIPTS.m5.text,
        submittedAt: demoTs,
        mediaUrl: '/api/demo/audio/m5',
        isDemo: true,
      },
    ],
  };
}
