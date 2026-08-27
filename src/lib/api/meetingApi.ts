import { SpeakerSegment, Meeting } from '@/types';
import { saveMeeting } from '../store/localStore';

export interface TranscribeResponse {
  success: boolean;
  engine: string;
  speakerCount?: number;
  segments?: SpeakerSegment[];
  rawText?: string;
  warning?: string;
  error?: string;
}

export interface ProcessMeetingResponse {
  success: boolean;
  engine: string;
  meeting?: Meeting;
  warning?: string;
  error?: string;
}

// ASYNC CALL 1: AssemblyAI / Whisper Audio Transcribe & Diarize
export async function transcribeAudio(payload: {
  audioUrl?: string;
  rawText?: string;
  sampleMode?: 'default' | 'gujarati';
}): Promise<TranscribeResponse> {
  try {
    const res = await fetch('/api/audio/transcribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Audio transcription API error (${res.status})`);
    }

    const data: TranscribeResponse = await res.json();
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

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `AI processing API error (${res.status})`);
    }

    const data: ProcessMeetingResponse = await res.json();
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
