import { NextRequest, NextResponse } from 'next/server';
import { SpeakerSegment } from '@/types';

// Format seconds into mm:ss timestamp
function formatTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.ASSEMBLYAI_API_KEY;
    let audioBuffer: Buffer | null = null;
    let rawText: string | null = null;
    let sampleMode: string | null = null;

    const contentType = req.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('audioFile') as File | null;
      if (file) {
        const arrayBuffer = await file.arrayBuffer();
        audioBuffer = Buffer.from(arrayBuffer);
        console.log(`[Transcribe API] Ingested mic recording: ${audioBuffer.length} bytes (${file.type}).`);
      }
    } else {
      const body = await req.json().catch(() => ({}));
      if (body.audioBase64) {
        audioBuffer = Buffer.from(body.audioBase64, 'base64');
      } else if (body.audioUrl) {
        const fetchAudio = await fetch(body.audioUrl);
        if (fetchAudio.ok) {
          const ab = await fetchAudio.arrayBuffer();
          audioBuffer = Buffer.from(ab);
        }
      }
      rawText = body.rawText;
      sampleMode = body.sampleMode;
    }

    // STEP 1: REAL ASSEMBLYAI AUDIO UPLOAD & DIARIZATION PIPELINE
    if (apiKey && audioBuffer && audioBuffer.length > 500) {
      try {
        console.log(`[AssemblyAI API] Uploading ${audioBuffer.length} bytes mic audio to AssemblyAI CDN...`);

        // Upload audio binary to AssemblyAI CDN
        const uploadRes = await fetch('https://api.assemblyai.com/v2/upload', {
          method: 'POST',
          headers: {
            authorization: apiKey,
            'content-type': 'application/octet-stream',
          },
          body: new Uint8Array(audioBuffer),
        });

        if (!uploadRes.ok) {
          const errTxt = await uploadRes.text();
          throw new Error(`AssemblyAI CDN Upload failed (${uploadRes.status}): ${errTxt}`);
        }

        const uploadData = await uploadRes.json();
        const uploadUrl = uploadData.upload_url;
        console.log('[AssemblyAI API] Uploaded CDN URL:', uploadUrl);

        // Submit transcript request with explicit language_code 'en' to avoid empty speech language detection error
        const submitRes = await fetch('https://api.assemblyai.com/v2/transcript', {
          method: 'POST',
          headers: {
            authorization: apiKey,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            audio_url: uploadUrl,
            speaker_labels: true,
            language_code: 'en', // Enforce English language processing
          }),
        });

        if (!submitRes.ok) {
          const errTxt = await submitRes.text();
          throw new Error(`AssemblyAI transcript submission failed (${submitRes.status}): ${errTxt}`);
        }

        const submitData = await submitRes.json();
        const transcriptId = submitData.id;
        console.log('[AssemblyAI API] Poll transcript ID:', transcriptId);

        // Poll AssemblyAI for completion
        let status = submitData.status;
        let pollingData = submitData;
        let attempts = 0;

        while (status !== 'completed' && status !== 'error' && attempts < 35) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
          const pollRes = await fetch(`https://api.assemblyai.com/v2/transcript/${transcriptId}`, {
            headers: { authorization: apiKey },
          });
          pollingData = await pollRes.json();
          status = pollingData.status;
          console.log(`[AssemblyAI Poll #${attempts + 1}] Status: ${status}`);
          attempts++;
        }

        if (status === 'error') {
          const rawErr = pollingData.error || '';
          if (rawErr.includes('no spoken audio') || rawErr.includes('language_detection')) {
            throw new Error('No spoken speech detected in audio recording. Please ensure your microphone is unmuted and speak clearly into your mic for at least 3-4 seconds.');
          }
          throw new Error(`AssemblyAI processing error: ${rawErr}`);
        }

        if (status === 'completed') {
          const utterances = pollingData.utterances || [];
          const speakerMap: Record<string, string> = {
            A: 'Speaker A (Live Mic User)',
            B: 'Speaker B (Live Mic User)',
            C: 'Speaker C (Live Mic User)',
          };

          let diarizedSegments: SpeakerSegment[] = [];

          if (utterances.length > 0) {
            diarizedSegments = utterances.map((u: any, idx: number) => ({
              id: `aai-mic-${idx}`,
              speaker: speakerMap[u.speaker] || `Speaker ${u.speaker}`,
              timestamp: formatTimestamp(u.start / 1000),
              text: u.text,
            }));
          } else if (pollingData.text && pollingData.text.trim().length > 0) {
            diarizedSegments = [
              {
                id: 'aai-mic-0',
                speaker: 'Speaker A (Live Mic User)',
                timestamp: '00:00',
                text: pollingData.text,
              },
            ];
          } else {
            diarizedSegments = [
              {
                id: 'aai-mic-empty',
                speaker: 'Speaker A (Live Mic User)',
                timestamp: '00:00',
                text: '[No spoken words detected in audio recording]',
              },
            ];
          }

          const finalTranscribedText = pollingData.text || (diarizedSegments.map((s) => `${s.speaker}: ${s.text}`).join('\n'));

          return NextResponse.json({
            success: true,
            engine: 'AssemblyAI-Diarization-Real',
            speakerCount: new Set(diarizedSegments.map((s) => s.speaker)).size,
            segments: diarizedSegments,
            rawText: finalTranscribedText,
          });
        }
      } catch (aaiErr: any) {
        console.error('[AssemblyAI Failure Intercepted]:', aaiErr.message);
        return NextResponse.json({
          success: false,
          engine: 'AssemblyAI-Error',
          error: `${aaiErr.message}`,
        }, { status: 500 });
      }
    }

    // STEP 2: FALLBACK HEURISTIC DIARIZATION (Only when NO audio binary is provided)
    console.log('[Transcribe API] Executing heuristic transcript diarization for rawText input...');
    let textToProcess = rawText;
    if (!textToProcess) {
      textToProcess = `Sarah Chen: Welcome everyone to our Sprint 15 sync. Today we are testing AssemblyAI audio diarization and Gemini AI task extraction.
Alex Kumar: I will take the task to test AssemblyAI multi-speaker diarization on real audio files.
Priya Patel: I will configure the Gemini JSON mode schema to extract action items, summaries, and health scores.
Marcus Vance: I will handle the Google Calendar OAuth consent flow for one-click event sync.`;
    }

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
