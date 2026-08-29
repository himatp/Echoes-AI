import { NextRequest, NextResponse } from 'next/server';
import { SpeakerSegment } from '@/types';
import { safeParseJsonResponse } from '@/lib/api/safeFetch';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function formatTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.ASSEMBLYAI_API_KEY;
    let audioBuffer: Buffer | null = null;
    let directAudioUrl: string | null = null;
    let rawText: string | null = null;
    let sampleMode: string | null = null;

    const contentType = req.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('audioFile') as File | null;
      if (file) {
        const arrayBuffer = await file.arrayBuffer();
        audioBuffer = Buffer.from(arrayBuffer);
        console.log(`[Transcribe API] Ingested mic recording formData: ${audioBuffer.length} bytes (${file.type}).`);
      }
    } else {
      const body = await req.json().catch(() => ({}));
      if (body.audioUrl) {
        directAudioUrl = body.audioUrl;
        console.log(`[Transcribe API] Received direct audioUrl: ${directAudioUrl}`);
      } else if (body.audioBase64) {
        audioBuffer = Buffer.from(body.audioBase64, 'base64');
      }
      rawText = body.rawText;
      sampleMode = body.sampleMode;
    }

    // STEP 1: ASYNC SUBMIT PIPELINE TO ASSEMBLYAI
    if (apiKey && (directAudioUrl || (audioBuffer && audioBuffer.length > 500))) {
      try {
        let uploadUrl = directAudioUrl;

        // If directAudioUrl is not provided, upload buffer to AssemblyAI CDN
        if (!uploadUrl && audioBuffer) {
          console.log(`[AssemblyAI API] Uploading ${audioBuffer.length} bytes audio to AssemblyAI CDN...`);

          const uploadRes = await fetch('https://api.assemblyai.com/v2/upload', {
            method: 'POST',
            headers: {
              authorization: apiKey,
              'content-type': 'application/octet-stream',
            },
            body: new Uint8Array(audioBuffer),
          });

          const uploadParsed = await safeParseJsonResponse(uploadRes);
          if (!uploadParsed.success || !uploadParsed.data?.upload_url) {
            throw new Error(`AssemblyAI CDN Upload failed: ${uploadParsed.error || 'Failed to get upload URL'}`);
          }
          uploadUrl = uploadParsed.data.upload_url;
          console.log('[AssemblyAI API] Uploaded CDN URL:', uploadUrl);
        }

        console.log('[AssemblyAI API] Submitting async transcript job for audio URL:', uploadUrl);

        // Submit transcript job with language_detection for automatic language & accent support
        const submitRes = await fetch('https://api.assemblyai.com/v2/transcript', {
          method: 'POST',
          headers: {
            authorization: apiKey,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            audio_url: uploadUrl,
            speaker_labels: true,
            language_detection: true,
          }),
        });

        const submitParsed = await safeParseJsonResponse(submitRes);
        if (!submitParsed.success || !submitParsed.data?.id) {
          throw new Error(`AssemblyAI transcript submission failed: ${submitParsed.error || 'No transcript ID returned'}`);
        }

        const submitData = submitParsed.data;
        const transcriptId = submitData.id;
        console.log('[AssemblyAI API] Async job submitted successfully! Transcript ID:', transcriptId);

        // RETURN IMMEDIATELY (< 500ms) with transcriptId to prevent Vercel 10s/60s function timeout!
        return NextResponse.json({
          success: true,
          status: 'processing',
          transcriptId,
        });

      } catch (aaiErr: any) {
        console.error('[AssemblyAI Job Submit Error]:', aaiErr.message);
        return NextResponse.json({
          success: false,
          engine: 'AssemblyAI-Error',
          error: `${aaiErr.message}`,
        }, { status: 500 });
      }
    }

    // STEP 2: FALLBACK HEURISTIC DIARIZATION (Only when rawText input is explicitly provided)
    if (!rawText || !rawText.trim()) {
      return NextResponse.json({
        success: false,
        engine: 'Error-Boundary',
        error: 'No audio recording, uploaded audio file, or transcript text provided. Please record mic audio or upload an audio file first.',
      }, { status: 400 });
    }

    console.log('[Transcribe API] Executing transcript diarization for rawText input...');
    const textToProcess = rawText.trim();

    const lines = textToProcess.split('\n').filter((l: string) => l.trim().length > 0);
    const fallbackSegments: SpeakerSegment[] = lines.map((line: string, idx: number) => {
      const match = line.match(/^([^:]+):\s*(.*)$/);
      let speaker = `Speaker ${(idx % 3) + 1}`;
      let content = line;

      if (match) {
        speaker = match[1].trim();
        content = match[2].trim();
      }

      return {
        id: `seg-fallback-${idx}`,
        speaker,
        timestamp: formatTimestamp(idx * 35),
        text: content,
      };
    });

    return NextResponse.json({
      success: true,
      status: 'completed',
      engine: apiKey ? 'AssemblyAI-Fallback-Heuristic' : 'Client-Heuristic-Diarizer (ASSEMBLYAI_API_KEY missing)',
      warning: apiKey ? undefined : 'ASSEMBLYAI_API_KEY variable not set. Using graceful heuristic speaker attribution.',
      speakerCount: new Set(fallbackSegments.map((s) => s.speaker)).size,
      segments: fallbackSegments,
      rawText: textToProcess,
    });

  } catch (error: any) {
    console.error('[Transcribe API Error]:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Audio transcription error' },
      { status: 500 }
    );
  }
}
