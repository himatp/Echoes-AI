"use client";

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { PillBadge } from '@/components/ui/PillBadge';
import { LiveTimer } from '@/components/ui/LiveTimer';
import { AudioWaveform } from '@/components/ui/AudioWaveform';
import { transcribeAudio, processMeetingWithAI, pollTranscriptionStatus } from '@/lib/api/meetingApi';
import { saveMeeting, getStoredMeetings, getMeetingById, updateMeetingStatus } from '@/lib/store/localStore';
import { getStoredTeamMembers, getStoredMeetingGroups } from '@/lib/store/teamStore';
import { uploadAudioToSupabaseStorage, fetchPersonalMemberWorkspaceData } from '@/lib/supabase/client';
import { safeParseJsonResponse } from '@/lib/api/safeFetch';
import { SpeakerSegment, Meeting, ActionItem, TeamMember, MeetingGroup } from '@/types';
import { matchSpeakerToMember } from '@/lib/matching/speakerMatcher';
import { Mic, MicOff, Sparkles, AlertTriangle, CheckCircle2, ArrowRight, FileText, UserCheck, Layers, Plus, Volume2, Check, RefreshCw, Radio, ShieldAlert, Upload, FileAudio, Users, History } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { useAuth } from '@/components/auth/AuthProvider';

import LogoLoader from '@/components/ui/LogoLoader';
import { MemberPortalView } from '@/components/portal/MemberPortalView';

const DEMO_TRANSCRIPT_DEFAULT = `Sarah Chen: Welcome everyone to our Sprint 15 sync. Today we are reviewing product delivery milestones and action item assignments.
Alex Kumar: I will take the task to finalize the automated meeting summary & speaker timeline feature.
Priya Patel: I will configure the action item tracking board and verify completion velocity.
Marcus Vance: I will handle the Google Calendar sync integration for team meetings.`;

function NewMeetingContent() {
  const router = useRouter();
  const { user, activeOrg, isRestrictedMember, personalMemberData, isLoading: isAuthLoading } = useAuth();
  const [meetingTitle, setMeetingTitle] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [transcriptText, setTranscriptText] = useState('');
  const [isLiveMicTranscribed, setIsLiveMicTranscribed] = useState(false);

  // Attendees & Meeting Groups State
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [meetingGroups, setMeetingGroups] = useState<MeetingGroup[]>([]);
  const [selectedAttendeeIds, setSelectedAttendeeIds] = useState<string[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [showSampleScript, setShowSampleScript] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    const members = getStoredTeamMembers();
    const groups = getStoredMeetingGroups();
    setTeamMembers(members);
    setMeetingGroups(groups);
    if (groups.length > 0) {
      setSelectedGroupId(groups[0].id);
      setSelectedAttendeeIds(groups[0].memberIds);
    } else {
      setSelectedAttendeeIds(members.map((m) => m.id));
    }
  }, []);

  const handleSelectGroup = (groupId: string) => {
    setSelectedGroupId(groupId);
    if (!groupId) return;
    const targetGroup = meetingGroups.find((g) => g.id === groupId);
    if (targetGroup) {
      setSelectedAttendeeIds(targetGroup.memberIds);
    }
  };

  const handleSameAsLastMeeting = () => {
    const meetings = getStoredMeetings();
    const lastMeeting = meetings[0];
    if (lastMeeting && lastMeeting.attendeeIds && lastMeeting.attendeeIds.length > 0) {
      setSelectedAttendeeIds(lastMeeting.attendeeIds);
      setSelectedGroupId('');
    } else {
      alert('No prior meeting with saved attendees found.');
    }
  };

  const handleToggleAttendee = (memberId: string) => {
    if (selectedAttendeeIds.includes(memberId)) {
      setSelectedAttendeeIds(selectedAttendeeIds.filter((id) => id !== memberId));
    } else {
      setSelectedAttendeeIds([...selectedAttendeeIds, memberId]);
    }
  };

  // Audio Recording & WebSpeech API Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recognitionRef = useRef<any>(null);
  const recordingStartTimeRef = useRef<number>(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Live Task States
  const [voiceParsedTasks, setVoiceParsedTasks] = useState<Partial<ActionItem>[]>([]);
  const [manualTasksList, setManualTasksList] = useState<Partial<ActionItem>[]>([]);
  const [voiceLogStream, setVoiceLogStream] = useState<string[]>([]);

  // Manual Form Inputs
  const [manualTaskInput, setManualTaskInput] = useState('');
  const [manualTaskAssignee, setManualTaskAssignee] = useState('');
  const [manualTaskPriority, setManualTaskPriority] = useState<'urgent' | 'high' | 'medium' | 'low'>('high');
  const [manualTaskSuccessMsg, setManualTaskSuccessMsg] = useState<string | null>(null);

  // Pipeline Processing States
  const [isDiarizing, setIsDiarizing] = useState(false);
  const [diarizeStageLabel, setDiarizeStageLabel] = useState('Transcribing audio & identifying speakers…');
  const [isExtracting, setIsExtracting] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);

  // Output States
  const [diarizedEngine, setDiarizedEngine] = useState<string | null>(null);
  const [diarizedSegments, setDiarizedSegments] = useState<SpeakerSegment[] | null>(null);
  const [processedMeeting, setProcessedMeeting] = useState<Meeting | null>(null);

  // Errors & Permission States
  const [diarizeError, setDiarizeError] = useState<string | null>(null);
  const [micPermissionError, setMicPermissionError] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [engineWarning, setEngineWarning] = useState<string | null>(null);

  // Initialize Web Speech API for real-time voice command listener
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const rec = new SpeechRecognition();
        rec.continuous = true;
        rec.interimResults = true;
        rec.lang = 'en-US';

        rec.onresult = (event: any) => {
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              handleParseSpeechCommand(transcript);
            }
          }
        };

        rec.onerror = (err: any) => {
          console.warn('[WebSpeech API Warning]:', err.error);
        };

        recognitionRef.current = rec;
      }
    }
  }, []);

  // Voice Command Regex Parser
  const handleParseSpeechCommand = (speechText: string) => {
    const logEntry = `Speech Recognized: "${speechText.trim()}"`;
    setVoiceLogStream((prev) => [logEntry, ...prev]);

    const commandMatch = speechText.match(/(?:add\s+task|task|action\s+item)\s+(?:for|to|assigned\s+to)\s+([A-Za-z]+)\s+(?:to|:)\s+(.+?)(?:\s+by\s+(.+))?$/i);
    
    if (commandMatch) {
      const assigneeName = commandMatch[1].trim();
      const actionDesc = commandMatch[2].trim();

      const newTask: Partial<ActionItem> = {
        id: `voice-task-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        title: actionDesc.charAt(0).toUpperCase() + actionDesc.slice(1),
        assignee: assigneeName.charAt(0).toUpperCase() + assigneeName.slice(1),
        priority: 'high',
        status: 'todo',
        dueDate: new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0],
        speakerSource: 'Voice Command Stream',
      };

      setVoiceParsedTasks((prev) => [newTask, ...prev]);
      setTranscriptText((prev) => `${prev}\n${newTask.assignee}: ${newTask.title}`);
    }
  };

  const rawAudioBlobRef = useRef<Blob | null>(null);
  const activeMeetingIdRef = useRef<string | null>(null);
  const activeAudioUrlRef = useRef<string | null>(null);
  const lastProcessedTranscriptRef = useRef<string | null>(null);
  const searchParams = useSearchParams();
  const resumeId = searchParams?.get('resumeId');
  const [resumedMeeting, setResumedMeeting] = useState<Meeting | null>(null);

  // STAGE 1: AUTO-SAVE ON UPLOAD HELPER FUNCTION
  const autoSaveUploadedStage = async (audioUrl: string, rawTitle?: string) => {
    const mtgId = activeMeetingIdRef.current || `mtg-${Date.now()}`;
    activeMeetingIdRef.current = mtgId;
    activeAudioUrlRef.current = audioUrl;

    const titleToUse = meetingTitle.trim() || rawTitle || `Untitled Recording — ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

    const uploadedMeeting: Meeting = {
      id: mtgId,
      organizationId: activeOrg?.id,
      title: titleToUse.replace(/\.[^/.]+$/, ''),
      date: new Date().toISOString().split('T')[0],
      duration: '0 min',
      sentiment: 'neutral',
      summary: '',
      keyDecisions: [],
      actionItems: [],
      speakerSegments: [],
      healthScore: { score: 0, talkTimeBalance: 0, decisionDensity: 0, unassignedPenalty: 0, suggestions: [] },
      language: 'en',
      status: 'uploaded',
      audioUrl,
      createdAt: new Date().toISOString(),
    };

    console.log(`[Stage 1 Auto-Save] Auto-saving uploaded audio meeting ${mtgId} with status='uploaded'...`);
    saveMeeting(uploadedMeeting);
    return uploadedMeeting;
  };

  // REAL-TIME TITLE SYNC HELPER
  const handleTitleChange = (val: string) => {
    setMeetingTitle(val);

    if (activeMeetingIdRef.current) {
      const existing = getMeetingById(activeMeetingIdRef.current);
      if (existing) {
        const cleanTitle = val.trim() ? val.trim().replace(/\.[^/.]+$/, '') : 'Untitled Meeting';
        const updatedMeeting = { ...existing, title: cleanTitle };
        saveMeeting(updatedMeeting);
      }
    }
  };

  // STAGE 2: AUTO-SAVE ON TRANSCRIPTION HELPER FUNCTION
  const autoSaveTranscribedStage = async (audioUrl: string | undefined, rawTitle: string, segments: SpeakerSegment[]) => {
    const mtgId = activeMeetingIdRef.current || `mtg-${Date.now()}`;
    activeMeetingIdRef.current = mtgId;

    const titleToUse = meetingTitle.trim() || rawTitle || `Transcribed Meeting — ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

    const transcribedMeeting: Meeting = {
      id: mtgId,
      organizationId: activeOrg?.id,
      title: titleToUse.replace(/\.[^/.]+$/, ''),
      date: new Date().toISOString().split('T')[0],
      duration: '0 min',
      sentiment: 'neutral',
      summary: '',
      keyDecisions: [],
      actionItems: [],
      speakerSegments: segments,
      healthScore: { score: 0, talkTimeBalance: 0, decisionDensity: 0, unassignedPenalty: 0, suggestions: [] },
      language: 'en',
      status: 'transcribed',
      audioUrl: audioUrl || activeAudioUrlRef.current || undefined,
      createdAt: new Date().toISOString(),
    };

    console.log(`[Stage 2 Auto-Save] Auto-saving transcribed meeting ${mtgId} with status='transcribed'...`);
    saveMeeting(transcribedMeeting);
    return transcribedMeeting;
  };

  const autoTriggeredRef = useRef(false);

  // Role Guard: Redirect invited teammates away from Live Recorder
  useEffect(() => {
    if (user?.id) {
      fetchPersonalMemberWorkspaceData(user.id).then((data) => {
        const isOwnerOrAdmin = data.organizationMember?.role === 'owner' || data.organizationMember?.role === 'admin';
        if (data.dataScope === 'assigned_only' && !isOwnerOrAdmin) {
          router.push('/');
        }
      });
    }
  }, [user?.id, router]);

  // Handle Resuming an Uploaded/Transcribed Meeting & Automatically Start Processing Pipeline
  useEffect(() => {
    if (resumeId && !autoTriggeredRef.current) {
      const existing = getMeetingById(resumeId);
      if (existing) {
        activeMeetingIdRef.current = existing.id;
        if (existing.audioUrl) activeAudioUrlRef.current = existing.audioUrl;
        setMeetingTitle(existing.title);
        setUploadedFileName(existing.title);
        setResumedMeeting(existing);

        // Populate speaker segments AND clean continuous transcript text area!
        if (existing.speakerSegments && existing.speakerSegments.length > 0) {
          setDiarizedSegments(existing.speakerSegments);
          const cleanContinuousTranscript = existing.speakerSegments
            .map((s) => s.text.trim())
            .filter(Boolean)
            .join(' ');
          setTranscriptText(cleanContinuousTranscript);
          lastProcessedTranscriptRef.current = cleanContinuousTranscript.trim();
        }

        // If meeting is in uploaded, transcribed, or draft state, automatically trigger the processing pipeline!
        if (existing.status === 'uploaded' || existing.status === 'transcribed' || existing.status === 'draft') {
          autoTriggeredRef.current = true;
          console.log(`[Auto-Resume Pipeline] Automatically starting processing pipeline for meeting ${existing.id} (status: ${existing.status})...`);
          setTimeout(() => {
            handleStartPipeline();
          }, 300);
        }
      }
    }
  }, [resumeId]);

  // Toggle Live Microphone Recording & Real AssemblyAI Audio Upload
  const handleToggleRecording = async () => {
    setMicPermissionError(null);
    setDiarizeError(null);

    if (!isRecording) {
      // START RECORDING
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];
        recordingStartTimeRef.current = Date.now();

        mediaRecorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        mediaRecorder.onstop = async () => {
          const durationSecs = (Date.now() - recordingStartTimeRef.current) / 1000;
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          rawAudioBlobRef.current = audioBlob;
          console.log(`[Mic Recorder] Captured ${audioBlob.size} bytes over ${durationSecs.toFixed(1)}s recording.`);
          
          if (durationSecs < 1.5) {
            setDiarizeError('Audio recording was too short (under 2 seconds). Please record for at least 3-4 seconds while speaking clearly into your mic.');
            return;
          }

          if (audioBlob.size > 500) {
            setIsDiarizing(true);
            setDiarizeStageLabel('Uploading recorded audio to storage…');

            // Direct browser-to-Supabase Storage upload (bypasses Vercel 4.5MB function limit)
            const uploadRes = await uploadAudioToSupabaseStorage(audioBlob, 'mic-recording.webm');

            let reqBody: any;
            if (uploadRes.success && uploadRes.publicUrl) {
              reqBody = JSON.stringify({ audioUrl: uploadRes.publicUrl });
              console.log('[Mic Recorder] Direct Supabase Storage upload success. Audio URL:', uploadRes.publicUrl);
              await autoSaveUploadedStage(uploadRes.publicUrl, meetingTitle || 'Live Mic Recording');
            } else {
              // Fallback for smaller recordings (< 3MB) if Supabase storage is unconfigured
              if (audioBlob.size < 3 * 1024 * 1024) {
                console.warn('[Mic Recorder] Supabase storage upload warning/fallback, sending formData directly:', uploadRes.error);
                const formData = new FormData();
                formData.append('audioFile', audioBlob, 'mic-recording.webm');
                reqBody = formData;
              } else {
                setIsDiarizing(false);
                setDiarizeError(uploadRes.error || 'Failed to upload audio to storage.');
                return;
              }
            }

            setDiarizeStageLabel('Transcribing audio & identifying speakers…');

            try {
              const isFormData = reqBody instanceof FormData;
              const res = await fetch('/api/audio/transcribe', {
                method: 'POST',
                headers: isFormData ? undefined : { 'Content-Type': 'application/json' },
                body: reqBody,
              });

              const parsed = await safeParseJsonResponse(res);

              if (parsed.success && parsed.data?.success) {
                let data = parsed.data;

                // Handle async job submission (transcriptId) -> Client-side polling
                if (data.transcriptId && data.status === 'processing') {
                  setDiarizeStageLabel('Transcribing audio & identifying speakers…');
                  data = await pollTranscriptionStatus(data.transcriptId, (attempt) => {
                    setDiarizeStageLabel(`Transcribing audio & identifying speakers… (${attempt * 3}s)`);
                  });
                }

                setIsDiarizing(false);

                if (data.success && data.rawText) {
                  setTranscriptText(data.rawText);
                  setIsLiveMicTranscribed(true);
                  setDiarizedEngine(data.engine);
                  setDiarizedSegments(data.segments);
                  if (data.warning) setEngineWarning(data.warning);
                } else {
                  setDiarizeError(data.error || 'AssemblyAI audio transcription failed.');
                  if (data.engine) setDiarizedEngine(data.engine);
                }
              } else {
                setIsDiarizing(false);
                const errText = parsed.error || parsed.data?.error || 'AssemblyAI audio transcription failed.';
                setDiarizeError(errText);
                if (parsed.data?.engine) setDiarizedEngine(parsed.data.engine);
              }
            } catch (err: any) {
              setIsDiarizing(false);
              setDiarizeError('Transcribe API call error: ' + err.message);
            }
          }
        };

        // Push audio data chunks every 250ms
        mediaRecorder.start(250);
        setIsRecording(true);

        if (recognitionRef.current) {
          try { recognitionRef.current.start(); } catch (e) {}
        }

      } catch (err: any) {
        console.error('[Microphone Permission Error]:', err);
        setMicPermissionError('Microphone Access Denied: Please allow microphone permission in your browser address bar to record live audio.');
      }
    } else {
      // STOP RECORDING
      setIsRecording(false);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
      }
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (e) {}
      }
    }
  };

  // Process Selected or Dropped Local Audio File
  const processSelectedAudioFile = async (file: File) => {
    rawAudioBlobRef.current = file;
    setUploadedFileName(file.name);
    setDiarizeError(null);
    setAiError(null);
    setEngineWarning(null);
    setDiarizedSegments(null);
    setProcessedMeeting(null);
    setDiarizedEngine(null);

    const draftTitle = meetingTitle.trim() || 'Uploaded Audio Meeting';

    setIsDiarizing(true);
    setDiarizeStageLabel('Saving uploaded audio draft…');

    // 1. Upload audio file to Supabase Storage
    const uploadRes = await uploadAudioToSupabaseStorage(file, file.name);

    if (uploadRes.success && uploadRes.publicUrl) {
      activeAudioUrlRef.current = uploadRes.publicUrl;
      // 2. Auto-save Stage 1 draft with status: 'uploaded' (Appears under "Needs Review" on Dashboard)
      await autoSaveUploadedStage(uploadRes.publicUrl, draftTitle);
      console.log('[File Upload] Stage 1 draft saved with status=uploaded. Audio URL:', uploadRes.publicUrl);
    } else {
      console.warn('[File Upload] Storage upload fallback:', uploadRes.error);
    }

    setIsDiarizing(false);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) await processSelectedAudioFile(file);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      if (file.type.startsWith('audio/') || file.type.startsWith('video/') || /\.(mp3|wav|m4a|webm|mp4|ogg|aac)$/i.test(file.name)) {
        await processSelectedAudioFile(file);
      } else {
        setDiarizeError('⚠️ Invalid file format. Please drop a valid audio file (.mp3, .wav, .m4a, .webm, .mp4).');
      }
    }
  };

  // Guaranteed Manual "+ Add Task Fallback" Form Handler
  const handleManualAddTask = () => {
    if (!manualTaskInput.trim()) return;

    const newTask: Partial<ActionItem> = {
      id: `manual-task-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      title: manualTaskInput.trim(),
      assignee: manualTaskAssignee,
      priority: manualTaskPriority,
      status: 'todo',
      dueDate: new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0],
      speakerSource: 'Manual Fallback Form',
    };

    setManualTasksList((prev) => [newTask, ...prev]);
    setManualTaskSuccessMsg(`Task card created for ${manualTaskAssignee}: "${manualTaskInput.trim()}"`);
    setManualTaskInput('');

    setTimeout(() => setManualTaskSuccessMsg(null), 4000);
  };

  // Reset to Demo Transcript
  const handleResetDemoTranscript = () => {
    setTranscriptText(DEMO_TRANSCRIPT_DEFAULT);
    setIsLiveMicTranscribed(false);
    setDiarizedEngine(null);
    setUploadedFileName(null);
    rawAudioBlobRef.current = null;
  };

  // Run AssemblyAI + Gemini Pipeline & Save Meeting
  const handleStartPipeline = async () => {
    setDiarizeError(null);
    setAiError(null);
    setEngineWarning(null);

    // 1. PRE-CHECK VALIDATION: Ensure audio or transcript text is present!
    if (!rawAudioBlobRef.current && !activeAudioUrlRef.current && !transcriptText.trim()) {
      setDiarizeError('⚠️ No audio recording, uploaded audio file, or transcript detected. Please record audio via microphone or upload an audio file first before processing.');
      return;
    }

    // 2. PRE-CHECK VALIDATION: Ensure Meeting Title is entered!
    if (!meetingTitle.trim()) {
      setDiarizeError('⚠️ Meeting Title Missing: Please enter a meeting title in the Meeting Title field before processing.');
      return;
    }

    // 3. PRE-CHECK VALIDATION: Ensure at least 1 Expected Attendee is selected!
    if (selectedAttendeeIds.length === 0) {
      setDiarizeError('⚠️ Expected Attendees Missing: Please select at least 1 expected meeting attendee before processing.');
      return;
    }

    // 4. Upload audio file/blob to storage if not yet uploaded
    if (rawAudioBlobRef.current && !activeAudioUrlRef.current) {
      setIsDiarizing(true);
      setDiarizeStageLabel('Uploading audio file to storage…');
      const fileName = uploadedFileName || `Meeting_Audio_${Date.now()}.mp3`;
      const uploadRes = await uploadAudioToSupabaseStorage(rawAudioBlobRef.current, fileName);

      if (uploadRes.success && uploadRes.publicUrl) {
        activeAudioUrlRef.current = uploadRes.publicUrl;
        await autoSaveUploadedStage(uploadRes.publicUrl, meetingTitle.trim() || fileName);
      }
    }

    let segmentsToProcess = diarizedSegments;

    if (!segmentsToProcess || segmentsToProcess.length === 0) {
      setIsDiarizing(true);
      setDiarizeStageLabel('Transcribing audio & identifying speakers with AssemblyAI…');
      const diarizeRes = await transcribeAudio({ 
        rawText: transcriptText,
        audioUrl: activeAudioUrlRef.current || undefined,
      });
      setIsDiarizing(false);

      if (!diarizeRes.success || !diarizeRes.segments) {
        setDiarizeError(diarizeRes.error || 'Diarization pipeline failed.');
        return;
      }

      setDiarizedEngine(diarizeRes.engine);
      setDiarizedSegments(diarizeRes.segments);
      segmentsToProcess = diarizeRes.segments;
      if (diarizeRes.warning) setEngineWarning(diarizeRes.warning);

      // Always sync clean continuous audio transcript to the transcript text area
      const cleanContinuousTranscript = diarizeRes.segments
        .map((s) => s.text.trim())
        .filter(Boolean)
        .join(' ');
      setTranscriptText(cleanContinuousTranscript);

      // Auto-save Stage 2 draft with status: 'transcribed'
      const stage2Title = meetingTitle.trim() || uploadedFileName?.replace(/\.[^/.]+$/, '') || 'Transcribed Meeting';
      await autoSaveTranscribedStage(activeAudioUrlRef.current || undefined, stage2Title, diarizeRes.segments);
    }

    // VALIDATION: Prevent empty audio transcription from proceeding to extraction
    const totalSpokenLength = (segmentsToProcess || []).reduce((acc, seg) => {
      const text = seg.text || '';
      if (!text.includes('[No spoken words detected') && !text.includes('[No audio text')) {
        return acc + text.trim().length;
      }
      return acc;
    }, 0);

    if (totalSpokenLength < 10) {
      setDiarizeError('No spoken speech detected in audio file. Please ensure the audio contains audible spoken speech in English or a supported language.');
      return;
    }

    const effectiveTitle = meetingTitle.trim() || (uploadedFileName ? uploadedFileName.replace(/\.[^/.]+$/, '') : 'Untitled Meeting');

    // STEP 2: GEMINI EXTRACTION
    setIsExtracting(true);
    const aiRes = await processMeetingWithAI({
      title: effectiveTitle,
      speakerSegments: segmentsToProcess!,
      existingMeetingId: activeMeetingIdRef.current || undefined,
    });
    setIsExtracting(false);

    if (!aiRes.success || !aiRes.meeting) {
      setAiError(aiRes.error || 'Gemini AI structured extraction failed.');
      return;
    }

    // Ensure title remains user-entered effectiveTitle
    aiRes.meeting.title = effectiveTitle;

    // STEP 3: UPLOAD RAW AUDIO BLOB TO SUPABASE STORAGE
    if (rawAudioBlobRef.current) {
      const uploadRes = await uploadAudioToSupabaseStorage(
        rawAudioBlobRef.current,
        uploadedFileName || 'mic-recording.webm'
      );
      if (uploadRes.success && uploadRes.publicUrl) {
        aiRes.meeting.audioUrl = uploadRes.publicUrl;
      }
    }

    // Merge voice & manual tasks into final action items payload
    const extraTasks = [...voiceParsedTasks, ...manualTasksList];
    if (extraTasks.length > 0) {
      const mergedItems = [
        ...aiRes.meeting.actionItems,
        ...extraTasks.map((t, i) => ({
          id: t.id || `extra-${Date.now()}-${i}`,
          meetingId: aiRes.meeting!.id,
          title: t.title || 'Action Item',
          assignee: t.assignee || 'Alex Kumar',
          priority: t.priority || 'high',
          status: 'todo' as const,
          dueDate: t.dueDate || new Date().toISOString().split('T')[0],
          speakerSource: t.speakerSource || 'Manual/Voice Input',
        })),
      ];
      aiRes.meeting.actionItems = mergedItems;
    }

    // Run Speaker Matching against Selected Attendees & Global Team
    const attendeeMembers = teamMembers.filter((m) => selectedAttendeeIds.includes(m.id));
    aiRes.meeting.actionItems = aiRes.meeting.actionItems.map((item) => {
      const matchResult = matchSpeakerToMember(item.assignee, attendeeMembers, teamMembers);
      if (matchResult.member) {
        return {
          ...item,
          assignee: matchResult.member.name,
          linkedMemberId: matchResult.member.id,
          unlinkedSpeaker: undefined,
        };
      } else {
        return {
          ...item,
          linkedMemberId: undefined,
          unlinkedSpeaker: item.assignee,
        };
      }
    });

    // Attach selected attendee IDs to meeting record
    aiRes.meeting.attendeeIds = selectedAttendeeIds;

    // STAGE 2: AUTO-SAVE ON EXTRACTION COMPLETE
    if (activeMeetingIdRef.current) {
      aiRes.meeting.id = activeMeetingIdRef.current;
    } else {
      activeMeetingIdRef.current = aiRes.meeting.id;
    }

    aiRes.meeting.status = 'draft';
    if (activeAudioUrlRef.current) {
      aiRes.meeting.audioUrl = activeAudioUrlRef.current;
    }

    console.log(`[Stage 2 Auto-Save] Updating existing meeting ${aiRes.meeting.id} with status='draft'...`);
    saveMeeting(aiRes.meeting);
    setProcessedMeeting(aiRes.meeting);
    lastProcessedTranscriptRef.current = transcriptText.trim();
  };

  if (isRestrictedMember) {
    return (
      <MemberPortalView
        initialMeetings={personalMemberData?.meetings || []}
        initialActionItems={personalMemberData?.actionItems || []}
        initialTeamMember={personalMemberData?.teamMember}
        initialOrgMember={personalMemberData?.organizationMember}
      />
    );
  }

  return (
    <div className="min-h-screen bg-canvas pb-16">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 lg:px-8 pt-8">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-zinc-900 dark:text-white tracking-tight flex items-center gap-2.5 sm:gap-3 leading-tight">
              <Mic className="w-7 h-7 sm:w-8 sm:h-8 text-indigo-600 dark:text-indigo-400 flex-shrink-0" />
              <span>New Meeting Recorder</span>
            </h1>

            {/* Compact Stereo Mix Warning Badge with Hover Popup Tooltip */}
            <div className="relative group inline-block">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-950/80 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-300 text-xs font-bold cursor-help hover:bg-amber-200 dark:hover:bg-amber-900/80 transition-all shadow-sm">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                <span>Mic Setup Notice</span>
              </span>

              {/* Hover Popup Tooltip Card */}
              <div className="absolute top-full left-0 sm:left-auto mt-2 w-80 sm:w-96 p-4 rounded-2xl bg-zinc-900 text-white border border-amber-500/40 shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 pointer-events-none group-hover:pointer-events-auto">
                <p className="font-extrabold text-amber-400 text-xs mb-1 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                  <span>Microphone Setup Reminder</span>
                </p>
                <p className="text-[11px] text-zinc-300 leading-relaxed">
                  Make sure you have your physical <span className="font-bold text-emerald-400">Microphone (or Headset Mic)</span> selected as your active browser input device, rather than Stereo Mix (which records internal PC sound).
                </p>
                <p className="text-[11px] text-zinc-300 mt-2 font-semibold bg-amber-950/60 p-2 rounded-xl border border-amber-800/60">
                  👉 Click the microphone icon in your browser address bar (top left of URL bar) to verify your selected audio device.
                </p>
              </div>
            </div>
          </div>

          <LiveTimer isRunning={isRecording} label={isRecording ? "LIVE MIC RECORDING" : "RECORDER READY"} />
        </div>

        {/* Resumed Upload Banner */}
        {resumedMeeting && (
          <div className="mb-6 p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-500 flex items-center justify-center flex-shrink-0">
                <FileAudio className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-indigo-900 dark:text-indigo-200">
                  Resuming Uploaded Meeting: {resumedMeeting.title}
                </h3>
                <p className="text-xs text-indigo-700 dark:text-indigo-400 font-medium">
                  Audio file stored securely. Click "Process Meeting & Save Notes" below to generate AI notes.
                </p>
              </div>
            </div>

            {resumedMeeting.audioUrl && (
              <audio controls src={resumedMeeting.audioUrl} className="max-w-xs h-9 text-xs" />
            )}
          </div>
        )}

        {/* Mic Permission Error Alert Box */}
        {micPermissionError && (
          <div className="mb-6 p-4 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-red-900 dark:text-red-200 text-xs font-medium flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-bold text-red-900 dark:text-red-200 mb-0.5">Microphone Permission Denied</p>
              <p className="text-red-800 dark:text-red-300 leading-relaxed">{micPermissionError}</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Column: Recording, File Upload & Manual Fallback */}
          <div className="lg:col-span-5 space-y-6">

            {/* EXPECTED MEETING ATTENDEES CARD */}
            <div className="card-white p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-4">
                <h2 className="text-sm font-bold text-zinc-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                  <Users className="w-4 h-4 text-indigo-600 dark:text-indigo-400 flex-shrink-0" />
                  <span>Expected Meeting Attendees ({selectedAttendeeIds.length})</span>
                </h2>

                <button
                  type="button"
                  onClick={handleSameAsLastMeeting}
                  className="px-3 py-1.5 min-h-[36px] rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-xs font-bold hover:bg-indigo-100 flex items-center justify-center gap-1.5 transition-all self-start sm:self-auto"
                >
                  <History className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>Same as last meeting</span>
                </button>
              </div>

              {/* Option A: Pick Saved Meeting Group */}
              <div className="mb-4">
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  Option A: Pick Saved Meeting Group
                </label>
                <select
                  value={selectedGroupId}
                  onChange={(e) => handleSelectGroup(e.target.value)}
                  className="w-full max-w-full truncate px-3.5 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs font-semibold text-zinc-900 dark:text-zinc-100 focus:outline-none"
                >
                  <option value="">Custom Selection / Individual Toggles</option>
                  {meetingGroups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name} ({g.memberIds.length} members) {g.isDemo ? '[Demo Group]' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Option B: Individual Member Toggles */}
              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-2">
                  Option B: Individual Contact Toggles ({selectedAttendeeIds.length}/{teamMembers.length} selected)
                </label>
                <div className="space-y-2 max-h-40 overflow-y-auto p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800">
                  {teamMembers.map((m) => {
                    const isChecked = selectedAttendeeIds.includes(m.id);
                    return (
                      <label key={m.id} className="flex items-center justify-between cursor-pointer text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleAttendee(m.id)}
                            className="rounded accent-indigo-600 w-4 h-4"
                          />
                          <span>{m.name}</span>
                        </div>
                        <span className="text-[10px] text-zinc-400 font-mono">{m.email}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Live Recording & Audio File Upload Card */}
            <div className="card-white p-6">
              <h2 className="text-sm font-bold text-zinc-900 dark:text-white uppercase tracking-wider mb-4 flex items-center gap-2">
                <Mic className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                Microphone Recording & Audio Upload
              </h2>

              <div className="mb-4">
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">Meeting Title</label>
                <input
                  type="text"
                  value={meetingTitle}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  placeholder="e.g. Sprint 15 Architecture & Task Allocation"
                  className="w-full px-3.5 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-sm font-semibold text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 placeholder:font-normal"
                />
              </div>

              {/* Mic Controls */}
              <div className="p-4 rounded-xl bg-zinc-900 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
                <div>
                  <p className="text-xs font-bold text-zinc-200">
                    {isRecording ? "Recording live mic audio (speak for 4-5s)..." : "Microphone ready"}
                  </p>
                  <p className="text-[11px] text-zinc-400 font-medium">Click mic to record spoken audio & tasks</p>
                </div>

                <div className="flex items-center justify-between w-full sm:w-auto gap-3">
                  <AudioWaveform isRecording={isRecording} barCount={8} />
                  <button
                    onClick={handleToggleRecording}
                    aria-label="Toggle recording"
                    className={`w-12 h-12 min-w-[48px] min-h-[48px] rounded-full font-bold transition-all flex items-center justify-center flex-shrink-0 active:scale-95 ${
                      isRecording ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse shadow-md' : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-hero'
                    }`}
                  >
                    {isRecording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* Drag & Drop Audio Upload Dropzone */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`mb-4 p-4 rounded-2xl border-2 transition-all cursor-pointer group ${
                  isDragging
                    ? 'border-dashed border-indigo-500 bg-indigo-500/10 dark:bg-indigo-950/80 scale-[1.01] shadow-lg ring-2 ring-indigo-500/20'
                    : uploadedFileName
                    ? 'border-solid border-emerald-500/40 bg-emerald-500/5 dark:bg-emerald-950/20'
                    : 'border-dashed border-zinc-300 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-900/60 hover:bg-zinc-100 dark:hover:bg-zinc-900 hover:border-indigo-400 dark:hover:border-indigo-600'
                }`}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="audio/*,.mp3,.wav,.m4a,.webm,.mp4"
                  onChange={handleFileUpload}
                  className="hidden"
                />

                <div className="flex flex-col items-center justify-center text-center space-y-2 py-1">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-transform ${
                    isDragging
                      ? 'bg-indigo-500 text-white scale-110'
                      : uploadedFileName
                      ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                      : 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 group-hover:scale-105'
                  }`}>
                    {uploadedFileName ? <Check className="w-5 h-5" /> : <Upload className="w-5 h-5" />}
                  </div>

                  <div>
                    <p className="text-xs font-bold text-zinc-900 dark:text-white mb-0.5">
                      {isDragging
                        ? 'Drop your audio file here!'
                        : uploadedFileName
                        ? `Selected File: ${uploadedFileName}`
                        : 'Drag & Drop Audio File here, or click to browse'}
                    </p>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium">
                      {uploadedFileName
                        ? 'Draft saved — click "Process Meeting & Save Notes" below when ready'
                        : 'Supports .mp3, .wav, .m4a, .webm, .mp4 files'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Optional Sample Script Toggle (Demo Scaffolding Gated) */}
              <div className="mb-4">
                <button
                  type="button"
                  onClick={() => setShowSampleScript(!showSampleScript)}
                  className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1.5 transition-all"
                >
                  <Sparkles className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>{showSampleScript ? "Hide sample recording script" : "Show sample recording script (for testing)"}</span>
                </button>

                {showSampleScript && (
                  <div className="mt-2.5 p-3 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/60 text-xs">
                    <p className="font-bold text-indigo-950 dark:text-indigo-100 mb-1 flex items-center gap-1.5">
                      <Volume2 className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 flex-shrink-0" />
                      <span>Sample Mic Test Script:</span>
                    </p>
                    <p className="text-[11px] text-indigo-800 dark:text-indigo-300 italic leading-relaxed bg-white/80 dark:bg-zinc-900/80 p-2.5 rounded-lg border border-indigo-200/60 dark:border-indigo-800/60 font-serif">
                      "Hello, this is a live microphone test for Echoes. Alex will verify the product design by Friday, and Sarah will review the team notes."
                    </p>
                  </div>
                )}
              </div>

              {/* Web Speech Log Stream */}
              {voiceLogStream.length > 0 && (
                <div className="mb-4 p-3.5 rounded-xl bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/60 text-xs">
                  <p className="font-bold text-indigo-900 dark:text-indigo-300 mb-1.5 flex items-center gap-1.5">
                    <Radio className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    Live Speech Recognition Stream:
                  </p>
                  <div className="space-y-1 max-h-24 overflow-y-auto pr-1">
                    {voiceLogStream.map((log, i) => (
                      <p key={i} className="text-[11px] font-mono text-indigo-800 dark:text-indigo-200 leading-snug">• {log}</p>
                    ))}
                  </div>
                </div>
              )}

              {/* Voice Parsed Task Cards */}
              {voiceParsedTasks.length > 0 && (
                <div className="mb-4 p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60">
                  <p className="text-xs font-bold text-emerald-900 dark:text-emerald-300 mb-2 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    Voice-Parsed Task Cards ({voiceParsedTasks.length})
                  </p>
                  <div className="space-y-2">
                    {voiceParsedTasks.map((vt) => (
                      <div key={vt.id} className="p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-emerald-200 dark:border-emerald-900/60 text-xs flex items-center justify-between gap-2 shadow-sm">
                        <div>
                          <p className="font-bold text-zinc-900 dark:text-zinc-100">{vt.title}</p>
                          <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium mt-0.5">Assignee: <span className="font-semibold text-zinc-700 dark:text-zinc-300">{vt.assignee}</span> • {vt.speakerSource}</p>
                        </div>
                        <PillBadge priority={vt.priority || 'high'} size="sm" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Manually Created Task Cards Display */}
              {manualTasksList.length > 0 && (
                <div className="mb-4 p-3.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900/60">
                  <p className="text-xs font-bold text-indigo-900 dark:text-indigo-300 mb-2 flex items-center gap-1.5">
                    <Plus className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    Manually Created Task Cards ({manualTasksList.length})
                  </p>
                  <div className="space-y-2">
                    {manualTasksList.map((mt) => (
                      <div key={mt.id} className="p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-indigo-200 dark:border-indigo-900/60 text-xs flex items-center justify-between gap-2 shadow-sm">
                        <div>
                          <p className="font-bold text-zinc-900 dark:text-zinc-100">{mt.title}</p>
                          <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium mt-0.5">Assignee: <span className="font-semibold text-zinc-700 dark:text-zinc-300">{mt.assignee}</span> • Manual Fallback</p>
                        </div>
                        <PillBadge priority={mt.priority || 'high'} size="sm" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Add a Task Form */}
              <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800">
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  Add a Task
                </label>
                
                <div className="space-y-2">
                  <input
                    type="text"
                    placeholder="Type task action (e.g. Finalize Q3 roadmap)..."
                    value={manualTaskInput}
                    onChange={(e) => setManualTaskInput(e.target.value)}
                    className="w-full truncate px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs font-medium text-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-zinc-400 dark:placeholder-zinc-500"
                  />

                  <div className="flex flex-col sm:flex-row gap-2.5 w-full">
                    <div className="flex gap-2 flex-1">
                      {(() => {
                        const activeAttendees = teamMembers.filter((m) => selectedAttendeeIds.includes(m.id));
                        const displayAttendees = activeAttendees.length > 0 ? activeAttendees : teamMembers;
                        const currentAssignee = manualTaskAssignee || (displayAttendees[0]?.name || 'Unassigned');

                        return (
                          <select
                            value={currentAssignee}
                            onChange={(e) => setManualTaskAssignee(e.target.value)}
                            className="flex-1 px-3 py-2 min-h-[44px] rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs font-semibold text-zinc-800 dark:text-zinc-100 focus:outline-none"
                          >
                            {displayAttendees.length === 0 ? (
                              <option value="Unassigned">Unassigned</option>
                            ) : (
                              displayAttendees.map((m) => (
                                <option key={m.id} value={m.name}>
                                  {m.name}
                                </option>
                              ))
                            )}
                          </select>
                        );
                      })()}

                      <select
                        value={manualTaskPriority}
                        onChange={(e: any) => setManualTaskPriority(e.target.value)}
                        className="px-3 py-2 min-h-[44px] rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs font-semibold text-zinc-800 dark:text-zinc-100 focus:outline-none"
                      >
                        <option value="urgent">Urgent</option>
                        <option value="high">High</option>
                        <option value="medium">Medium</option>
                        <option value="low">Low</option>
                      </select>
                    </div>

                    <button
                      onClick={handleManualAddTask}
                      className="w-full sm:w-auto px-4 py-2.5 min-h-[44px] rounded-xl bg-zinc-900 dark:bg-indigo-600 text-white text-xs font-bold hover:bg-zinc-800 dark:hover:bg-indigo-700 flex items-center justify-center gap-1.5 transition-all shadow-sm active:scale-95 flex-shrink-0"
                    >
                      <Plus className="w-4 h-4 text-indigo-400 dark:text-indigo-200 flex-shrink-0" />
                      <span>Add Task</span>
                    </button>
                  </div>

                  {manualTaskSuccessMsg && (
                    <div className="p-2.5 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 text-[11px] font-bold flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                      <span>{manualTaskSuccessMsg}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Transcript Card (White Card) */}
            <div className="card-white p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-3">
                <h2 className="text-sm font-bold text-zinc-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                  <FileText className="w-4 h-4 text-indigo-600 dark:text-indigo-400 flex-shrink-0" />
                  <span>Meeting Transcript</span>
                </h2>
              </div>

              {/* LIVE AUDIO STATUS BANNER */}
              {isLiveMicTranscribed && diarizedEngine === 'AssemblyAI-Diarization-Real' && (
                <div className="mb-3 px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 text-[11px] font-bold border border-emerald-200 dark:border-emerald-800/60 flex flex-col xs:flex-row xs:items-center justify-between gap-1.5">
                  <span className="flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                    <span>Populated from live audio recording</span>
                  </span>
                  <PillBadge label="Live Audio" variant="ai" size="sm" />
                </div>
              )}

              <textarea
                rows={7}
                value={transcriptText}
                onChange={(e) => setTranscriptText(e.target.value)}
                placeholder="Transcript text will appear here during live recording or audio processing..."
                className="w-full p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs font-mono text-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 leading-relaxed placeholder:text-zinc-400 dark:placeholder:text-zinc-600 font-sans"
              />

              {(() => {
                const isTranscriptDirty = Boolean(
                  processedMeeting &&
                  lastProcessedTranscriptRef.current !== null &&
                  transcriptText.trim() !== lastProcessedTranscriptRef.current.trim()
                );

                const isProcessedAndClean = Boolean(processedMeeting) && !isTranscriptDirty;

                return (
                  <button
                    onClick={handleStartPipeline}
                    disabled={isDiarizing || isExtracting || isAuthLoading || !activeOrg?.id || isProcessedAndClean}
                    className={`w-full mt-4 py-3 rounded-xl font-bold text-xs shadow-hero flex items-center justify-center gap-2 transition-all min-h-[44px] ${
                      isAuthLoading || !activeOrg?.id
                        ? 'bg-indigo-600 opacity-50 text-white cursor-not-allowed'
                        : isDiarizing || isExtracting
                        ? 'bg-indigo-600 text-white animate-pulse'
                        : isProcessedAndClean
                        ? 'bg-emerald-500/10 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 cursor-default opacity-85'
                        : isTranscriptDirty
                        ? 'bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer shadow-lg'
                        : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                    }`}
                  >
                    {isAuthLoading ? (
                      <span>Resolving workspace session...</span>
                    ) : !activeOrg?.id ? (
                      <span>No Active Workspace — Select/Join Workspace to Save</span>
                    ) : isDiarizing ? (
                      <span>1/2 Transcribing audio & identifying speakers...</span>
                    ) : isExtracting ? (
                      <span>2/2 Generating summaries & tasks...</span>
                    ) : isProcessedAndClean ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                        <span>✓ Notes & Tasks Extracted</span>
                      </>
                    ) : isTranscriptDirty ? (
                      <>
                        <RefreshCw className="w-4 h-4 text-indigo-200 flex-shrink-0" />
                        <span>Re-process Updated Transcript ↺</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 text-indigo-200 flex-shrink-0" />
                        <span>Process Meeting & Save Notes</span>
                        <ArrowRight className="w-4 h-4 flex-shrink-0" />
                      </>
                    )}
                  </button>
                );
              })()}
            </div>
          </div>

          {/* Right Column: Execution Output & Speaker Attribution */}
          <div className="lg:col-span-7 space-y-6">

            {/* Warnings */}
            {engineWarning && (
              <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-amber-900 dark:text-amber-200 text-xs font-medium flex items-start gap-3">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-bold text-amber-900 dark:text-amber-200 mb-0.5">Processing Notice</p>
                  <p className="text-amber-800 dark:text-amber-300 leading-relaxed">{engineWarning}</p>
                </div>
              </div>
            )}

            {/* Errors */}
            {(diarizeError || aiError) && (
              <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-red-900 dark:text-red-200 text-xs font-medium flex items-start gap-3">
                <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-bold text-red-900 dark:text-red-200 mb-0.5">Processing Error</p>
                  <p className="text-red-800 dark:text-red-300 leading-relaxed">{diarizeError || aiError}</p>
                </div>
              </div>
            )}

            {/* STEP 1 OUTPUT: SPEAKER TIMELINE */}
            <div className="card-white p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold text-zinc-900 dark:text-white tracking-tight flex items-center gap-2">
                    <UserCheck className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                    Conversation Timeline
                  </h3>
                </div>
              </div>

              {isDiarizing ? (
                <div className="p-8 text-center bg-zinc-50 dark:bg-zinc-900/60 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-800 flex items-center justify-center">
                  <LogoLoader size="md" label={diarizeStageLabel} />
                </div>
              ) : diarizedSegments ? (
                <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                  {diarizedSegments.map((seg) => (
                    <div key={seg.id} className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/80 border border-zinc-200/80 dark:border-zinc-800 hover:bg-white dark:hover:bg-zinc-800 transition-colors">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-xs text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-indigo-500" />
                          {seg.speaker}
                        </span>
                        <span className="text-[11px] font-mono text-zinc-400 dark:text-zinc-500 font-semibold">{seg.timestamp}</span>
                      </div>
                      <p className="text-xs text-zinc-800 dark:text-zinc-200 font-normal leading-relaxed pl-3 border-l-2 border-indigo-200 dark:border-indigo-800">
                        "{seg.text}"
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center bg-zinc-50 dark:bg-zinc-900/60 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                  Click "Process Meeting & Save Notes" or stop live mic recording to generate timeline.
                </div>
              )}
            </div>

            {/* STEP 2 OUTPUT: AI EXTRACTED SUMMARY & TASKS */}
            <div className="card-white p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold text-zinc-900 dark:text-white tracking-tight flex items-center gap-2">
                    <Layers className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    AI Extracted Notes & Tasks
                  </h3>
                </div>

                {processedMeeting && (
                  <span className="px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-xs font-bold">
                    Health Score: {processedMeeting.healthScore.score}/100
                  </span>
                )}
              </div>

              {isExtracting ? (
                <div className="p-8 text-center bg-zinc-50 dark:bg-zinc-900/60 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-800 flex items-center justify-center">
                  <LogoLoader size="md" label="Analyzing meeting & extracting action items…" />
                </div>
              ) : processedMeeting ? (
                <div className="space-y-4">
                  {/* Summary Box */}
                  <div className="p-4 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/60">
                    <h4 className="text-xs font-bold text-indigo-900 dark:text-indigo-300 uppercase tracking-wider mb-1">Executive Summary</h4>
                    <p className="text-xs text-indigo-950 dark:text-indigo-100 font-normal leading-relaxed">{processedMeeting.summary}</p>
                  </div>

                  {/* Key Decisions */}
                  <div>
                    <h4 className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-2">Key Decisions Made</h4>
                    <ul className="space-y-1.5">
                      {processedMeeting.keyDecisions.map((dec, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-xs text-zinc-800 dark:text-zinc-200">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mt-0.5 flex-shrink-0" />
                          <span>{dec}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Extracted Tasks */}
                  <div>
                    <h4 className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-2">
                      Extracted Action Items ({processedMeeting.actionItems.length})
                    </h4>
                    <div className="space-y-2">
                      {processedMeeting.actionItems.map((task) => (
                        <div key={task.id} className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-3">
                          <div>
                            <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100">{task.title}</p>
                            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium mt-0.5">
                              Assignee: <span className="font-semibold text-zinc-700 dark:text-zinc-300">{task.assignee}</span> • Source: {task.speakerSource || 'Attributed'}
                            </p>
                          </div>

                          <div className="flex items-center gap-2">
                            <PillBadge priority={task.priority} size="sm" />
                            <span className="text-[11px] font-mono text-zinc-400 dark:text-zinc-500">{task.dueDate}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="pt-2">
                    <button
                      onClick={() => {
                        if (processedMeeting) {
                          console.log(`[Stage 3 Finalization] Marking meeting ${processedMeeting.id} as status='completed'...`);
                          updateMeetingStatus(processedMeeting.id, 'completed');
                        }
                        router.push('/');
                      }}
                      className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-hero"
                    >
                      Finalize Meeting & View on Dashboard &rarr;
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center bg-zinc-50 dark:bg-zinc-900/60 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                  Awaiting audio pipeline run.
                </div>
              )}
            </div>

          </div>

        </div>

      </main>
    </div>
  );
}

export default function NewMeetingPage() {
  return (
    <Suspense fallback={<LogoLoader size="fullscreen" label="Loading Meeting Recorder…" />}>
      <NewMeetingContent />
    </Suspense>
  );
}
