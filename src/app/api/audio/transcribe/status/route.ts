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

export async function GET(req: NextRequest) {
  try {
    const apiKey = process.env.ASSEMBLYAI_API_KEY;
    const { searchParams } = new URL(req.url);
    const transcriptId = searchParams.get('transcriptId');

    if (!transcriptId) {
      return NextResponse.json({ success: false, error: 'Missing transcriptId parameter' }, { status: 400 });
    }

    if (!apiKey) {
      return NextResponse.json({ success: false, error: 'ASSEMBLYAI_API_KEY environment variable missing' }, { status: 500 });
    }

    const pollRes = await fetch(`https://api.assemblyai.com/v2/transcript/${transcriptId}`, {
      headers: { authorization: apiKey },
      cache: 'no-store',
    });

    const parsed = await safeParseJsonResponse(pollRes);
    if (!parsed.success || !parsed.data) {
      return NextResponse.json({ success: false, status: 'error', error: parsed.error || 'Failed to poll AssemblyAI' }, { status: 500 });
    }

    const pollingData = parsed.data;
    const status = pollingData.status;

    if (status === 'error') {
      const rawErr = pollingData.error || '';
      let errMsg = `AssemblyAI processing error: ${rawErr}`;
      if (rawErr.includes('no spoken audio') || rawErr.includes('language_detection')) {
        errMsg = 'No spoken speech detected in audio recording. Please ensure your microphone is unmuted and speak clearly for at least 3-4 seconds.';
      }
      return NextResponse.json({ success: false, status: 'error', error: errMsg }, { status: 400 });
    }

    if (status === 'queued' || status === 'processing') {
      return NextResponse.json({
        success: true,
        status: 'processing',
        transcriptId,
      });
    }

    if (status === 'completed') {
      const utterances = pollingData.utterances || [];
      const speakerMap: Record<string, string> = {
        A: 'Speaker A',
        B: 'Speaker B',
        C: 'Speaker C',
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
            speaker: 'Speaker A',
            timestamp: '00:00',
            text: pollingData.text,
          },
        ];
      } else {
        diarizedSegments = [
          {
            id: 'aai-mic-empty',
            speaker: 'Speaker A',
            timestamp: '00:00',
            text: '[No spoken words detected in audio recording]',
          },
        ];
      }

      const finalTranscribedText = pollingData.text || (diarizedSegments.map((s) => `${s.speaker}: ${s.text}`).join('\n'));

      return NextResponse.json({
        success: true,
        status: 'completed',
        engine: 'AssemblyAI-Async-Diarization',
        speakerCount: new Set(diarizedSegments.map((s) => s.speaker)).size,
        segments: diarizedSegments,
        rawText: finalTranscribedText,
      });
    }

    return NextResponse.json({ success: true, status: 'processing' });

  } catch (error: any) {
    console.error('[Transcribe Status API Error]:', error);
    return NextResponse.json({ success: false, status: 'error', error: error.message || 'Status check error' }, { status: 500 });
  }
}
