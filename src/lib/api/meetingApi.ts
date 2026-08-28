import { SpeakerSegment, Meeting } from '@/types';
import { saveMeeting } from '../store/localStore';
import { safeParseJsonResponse } from './safeFetch';

export interface TranscribeResponse {
  success: boolean;
  engine: string;
  speakerCount?: number;
  segments?: SpeakerSegment[];
  rawText?: string;
  warning?: string;
  error?: string;
  transcriptId?: string;
  status?: string;
}

export interface ProcessMeetingResponse {
  success: boolean;
  engine: string;
  meeting?: Meeting;
  warning?: string;
  error?: string;
}

// Client-side Polling Helper for AssemblyAI Async Transcription
export async function pollTranscriptionStatus(
  transcriptId: string,
  onProgress?: (attempt: number) => void
): Promise<TranscribeResponse> {
  let attempts = 0;
  const maxAttempts = 120; // Up to 6 minutes for 60+ minute meetings

  while (attempts < maxAttempts) {
    await new Promise((resolve) => setTimeout(resolve, 3000));
    attempts++;
    if (onProgress) onProgress(attempts);

    try {
      const res = await fetch(`/api/audio/transcribe/status?transcriptId=${encodeURIComponent(transcriptId)}`);
      const parsed = await safeParseJsonResponse<any>(res);

      if (!parsed.success || !parsed.data) {
        if (attempts >= maxAttempts) {
          return { success: false, engine: 'AssemblyAI-Error', error: parsed.error || 'Polling status check failed' };
        }
        continue;
      }

      const data = parsed.data;
      if (data.status === 'completed') {
        return {
          success: true,
          engine: data.engine || 'AssemblyAI-Async-Diarization',
          speakerCount: data.speakerCount,
          segments: data.segments,
          rawText: data.rawText,
        };
      }

      if (data.status === 'error') {
        return {
          success: false,
          engine: 'AssemblyAI-Error',
          error: data.error || 'AssemblyAI processing failed',
        };
      }

      // Still queued or processing... continue polling
    } catch (err: any) {
      console.warn(`[Transcription Poll #${attempts}] Exception:`, err.message);
    }
  }

  return {
    success: false,
    engine: 'AssemblyAI-Timeout',
    error: 'Transcription polling timed out after 6 minutes.',
  };
}

// ASYNC CALL 1: AssemblyAI / Whisper Audio Transcribe & Diarize
export async function transcribeAudio(
  payload: {
    audioUrl?: string;
    rawText?: string;
    sampleMode?: 'default' | 'gujarati';
  },
  onProgress?: (stageText: string) => void
): Promise<TranscribeResponse> {
  try {
    const res = await fetch('/api/audio/transcribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const parsed = await safeParseJsonResponse<TranscribeResponse>(res);
    if (!parsed.success || !parsed.data) {
      return {
        success: false,
        engine: 'Error-Boundary',
        error: parsed.error || `Audio transcription failed (${res.status})`,
      };
    }

    const data = parsed.data;

    // If response returns an async transcriptId, poll until completion on client side
    if (data.transcriptId && data.status === 'processing') {
      if (onProgress) onProgress('AssemblyAI is transcribing audio & identifying speakers…');
      return await pollTranscriptionStatus(data.transcriptId, (attempt) => {
        if (onProgress) {
          onProgress(`Transcribing audio & identifying speakers… (${attempt * 3}s)`);
        }
      });
    }

    return data;
  } catch (err: any) {
    console.error('Transcribe API call error:', err);
    return {
      success: false,
      engine: 'Error-Boundary',
      error: err.message || 'Failed to connect to transcription service.',
    };
  }
}

// ASYNC CALL 2: Gemini AI Structured Extraction from Diarized Transcript
export async function processMeetingWithAI(payload: {
  title: string;
  speakerSegments: SpeakerSegment[];
  language?: string;
}): Promise<ProcessMeetingResponse> {
  try {
    const res = await fetch('/api/ai/process-meeting', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const parsed = await safeParseJsonResponse<ProcessMeetingResponse>(res);
    if (!parsed.success || !parsed.data) {
      return {
        success: false,
        engine: 'Error-Boundary',
        error: parsed.error || `AI processing failed (${res.status})`,
      };
    }

    const data = parsed.data;
    if (data.success && data.meeting) {
      // Save processed meeting to persistence store
      saveMeeting(data.meeting);
    }
    return data;
  } catch (err: any) {
    console.error('Process Meeting API call error:', err);
    return {
      success: false,
      engine: 'Error-Boundary',
      error: err.message || 'Failed to process meeting notes with Gemini AI.',
    };
  }
}
