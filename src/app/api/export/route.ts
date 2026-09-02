import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, BorderStyle } from 'docx';
import { Meeting } from '@/types';

const SEED_MEETING_DEFAULT: Meeting = {
  id: 'demo-1',
  title: 'Sprint 14 Planning & Architecture Sync',
  date: '2026-08-17',
  duration: '34 min',
  sentiment: 'action-oriented',
  language: 'en',
  createdAt: new Date().toISOString(),
  summary: 'The engineering team aligned on migrating authentication to Supabase SSR, delegating Google Calendar OAuth integration to Alex, and enforcing Gemini structured JSON mode across all AI pipeline endpoints.',
  keyDecisions: [
    'Adopt Supabase SSR client as primary auth & session manager',
    'Use AssemblyAI API for speaker diarization before passing text to Gemini',
    'Enforce JSON Schema output mode for all Gemini LLM API calls'
  ],
  healthScore: {
    score: 92,
    talkTimeBalance: 88,
    decisionDensity: 94,
    unassignedPenalty: 5,
    suggestions: ['Great participation balance across all 4 speakers']
  },
  speakerSegments: [
    { id: 's1', speaker: 'Sarah Chen', timestamp: '00:12', text: "Let's align on the architecture for Echoes. First, how are we handling speaker diarization?" },
    { id: 's2', speaker: 'Alex Kumar', timestamp: '00:45', text: "I recommend AssemblyAI for audio-to-text with speaker labels. It produces clean speaker turns before we invoke Gemini." },
    { id: 's3', speaker: 'Priya Patel', timestamp: '01:20', text: "Agreed. Gemini will receive the diarized transcript text and generate structured action items with strict JSON schema." },
    { id: 's4', speaker: 'Marcus Vance', timestamp: '02:05', text: "I'll take ownership of the Google Calendar OAuth sync endpoints." }
  ],
  actionItems: [
    { id: 't1', meetingId: 'demo-1', title: 'Wire AssemblyAI audio diarization endpoint', assignee: 'Alex Kumar', priority: 'urgent', status: 'in_progress', dueDate: '2026-08-18', speakerSource: 'Alex Kumar' },
    { id: 't2', meetingId: 'demo-1', title: 'Verify Gemini JSON mode schema parameters', assignee: 'Sarah Chen', priority: 'high', status: 'todo', dueDate: '2026-08-19', speakerSource: 'Priya Patel' },
    { id: 't3', meetingId: 'demo-1', title: 'Implement Google Calendar OAuth endpoint', assignee: 'Marcus Vance', priority: 'medium', status: 'todo', dueDate: '2026-08-20', speakerSource: 'Marcus Vance' }
  ]
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const format = (body.format || 'pdf').toLowerCase();
    const meeting: Meeting = body.meeting || SEED_MEETING_DEFAULT;

    console.log(`[Export API] Generating ${format.toUpperCase()} export for meeting: "${meeting.title}"`);

    // 1. DOCX GENERATION
    if (format === 'docx') {
      const doc = new Document({
        sections: [
          {
            properties: {},
            children: [
              new Paragraph({
                text: "Echoes AI Meeting Summary Report",
                heading: HeadingLevel.TITLE,
              }),
              new Paragraph({
                children: [
                  new TextRun({ text: `Title: `, bold: true }),
                  new TextRun(`${meeting.title}\n`),
                  new TextRun({ text: `Date: `, bold: true }),
                  new TextRun(`${meeting.date} | `),
                  new TextRun({ text: `Duration: `, bold: true }),
                  new TextRun(`${meeting.duration} | `),
                  new TextRun({ text: `Health Score: `, bold: true }),
                  new TextRun(`${meeting.healthScore?.score || 85}/100\n\n`),
                ],
              }),

              new Paragraph({
                text: "Executive Summary",
                heading: HeadingLevel.HEADING_1,
              }),
              new Paragraph({
                text: meeting.summary,
              }),

              new Paragraph({
                text: "Key Decisions Made",
                heading: HeadingLevel.HEADING_1,
              }),
              ...meeting.keyDecisions.map(
                (decision) =>
                  new Paragraph({
                    text: `• ${decision}`,
                    bullet: { level: 0 },
                  })
              ),

              new Paragraph({
                text: "Diarized Speaker Transcript",
                heading: HeadingLevel.HEADING_1,
              }),
              ...meeting.speakerSegments.map(
                (seg) =>
                  new Paragraph({
                    children: [
                      new TextRun({ text: `[${seg.timestamp}] `, bold: true, color: "4F46E5" }),
                      new TextRun({ text: `${seg.speaker}: `, bold: true }),
                      new TextRun(`"${seg.text}"`),
                    ],
                  })
              ),

              new Paragraph({
                text: "Extracted Action Items",
                heading: HeadingLevel.HEADING_1,
              }),
              new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                rows: [
                  new TableRow({
                    children: [
                      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Action Item", bold: true })] })] }),
                      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Assignee", bold: true })] })] }),
                      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Priority", bold: true })] })] }),
                      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Due Date", bold: true })] })] }),
                    ],
                  }),
                  ...meeting.actionItems.map(
                    (item) =>
                      new TableRow({
                        children: [
                          new TableCell({ children: [new Paragraph(item.title)] }),
                          new TableCell({ children: [new Paragraph(item.assignee)] }),
                          new TableCell({ children: [new Paragraph(item.priority.toUpperCase())] }),
                          new TableCell({ children: [new Paragraph(item.dueDate)] }),
                        ],
                      })
                  ),
                ],
              }),
            ],
          },
        ],
      });

      const buffer = await Packer.toBuffer(doc);
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'Content-Disposition': `attachment; filename="echoes-${meeting.id}.docx"`,
        },
      });
    }

    // 2. PDF GENERATION (Using pdf-lib)
    const pdfDoc = await PDFDocument.create();
    let page = pdfDoc.addPage([595, 842]); // A4 Size
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

    const { width, height } = page.getSize();
    let y = height - 50;

    // Header Banner
    page.drawRectangle({
      x: 30,
      y: y - 40,
      width: width - 60,
      height: 50,
      color: rgb(0.31, 0.27, 0.90), // Indigo #4F46E5
    });

    page.drawText('ECHOES AI MEETING SUMMARY REPORT', {
      x: 45,
      y: y - 25,
      size: 16,
      font: fontBold,
      color: rgb(1, 1, 1),
    });

    y -= 60;

    // Meeting Title & Meta
    page.drawText(meeting.title.substring(0, 50), {
      x: 30,
      y,
      size: 14,
      font: fontBold,
      color: rgb(0.1, 0.1, 0.1),
    });

    y -= 20;
    page.drawText(`Date: ${meeting.date}   |   Duration: ${meeting.duration}   |   Health Score: ${meeting.healthScore?.score || 85}/100`, {
      x: 30,
      y,
      size: 10,
      font: fontRegular,
      color: rgb(0.4, 0.4, 0.4),
    });

    y -= 30;

    // Executive Summary
    page.drawText('EXECUTIVE SUMMARY', { x: 30, y, size: 11, font: fontBold, color: rgb(0.31, 0.27, 0.90) });
    y -= 15;

    // Wrap summary text
    const summaryLines = wrapText(meeting.summary, 85);
    for (const line of summaryLines) {
      page.drawText(line, { x: 30, y, size: 9, font: fontRegular, color: rgb(0.2, 0.2, 0.2) });
      y -= 12;
    }

    y -= 15;

    // Key Decisions
    page.drawText('KEY DECISIONS MADE', { x: 30, y, size: 11, font: fontBold, color: rgb(0.06, 0.62, 0.45) });
    y -= 15;

    for (const dec of meeting.keyDecisions) {
      page.drawText(`• ${dec}`, { x: 35, y, size: 9, font: fontRegular, color: rgb(0.2, 0.2, 0.2) });
      y -= 14;
    }

    y -= 15;

    // Action Items (Placed prominently right after Key Decisions!)
    if (y < 120) {
      page = pdfDoc.addPage([595, 842]);
      y = height - 50;
    }

    page.drawText('ACTION ITEMS & ASSIGNMENTS', { x: 30, y, size: 11, font: fontBold, color: rgb(0.31, 0.27, 0.90) });
    y -= 15;

    const itemsToDraw = (meeting.actionItems && meeting.actionItems.length > 0)
      ? meeting.actionItems
      : [];

    if (itemsToDraw.length === 0) {
      page.drawText('• No action items created for this meeting.', { x: 35, y, size: 9, font: fontRegular, color: rgb(0.4, 0.4, 0.4) });
      y -= 14;
    } else {
      for (const task of itemsToDraw) {
        if (y < 50) {
          page = pdfDoc.addPage([595, 842]);
          y = height - 50;
        }
        const prio = (task.priority || 'medium').toUpperCase();
        const title = task.title || 'Untitled Task';
        const assignee = task.assignee || 'Unassigned';
        const due = task.dueDate ? ` (Due: ${task.dueDate})` : '';

        const itemText = wrapText(`[${prio}] ${title} — Assignee: ${assignee}${due}`, 85);
        for (const itline of itemText) {
          page.drawText(itline, {
            x: 35,
            y,
            size: 9,
            font: fontBold,
            color: rgb(0.2, 0.2, 0.2),
          });
          y -= 12;
        }
        y -= 3;
      }
    }

    y -= 15;

    // Diarized Speaker Transcript (Placed at the bottom of report)
    if (y < 120) {
      page = pdfDoc.addPage([595, 842]);
      y = height - 50;
    }

    page.drawText('DIARIZED SPEAKER TRANSCRIPT', { x: 30, y, size: 11, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
    y -= 15;

    const segmentsToDraw = (meeting.speakerSegments && meeting.speakerSegments.length > 0)
      ? meeting.speakerSegments
      : [];

    if (segmentsToDraw.length === 0) {
      page.drawText('• No transcript segments recorded for this meeting.', { x: 35, y, size: 9, font: fontRegular, color: rgb(0.4, 0.4, 0.4) });
      y -= 14;
    } else {
      for (const seg of segmentsToDraw) {
        if (y < 60) {
          page = pdfDoc.addPage([595, 842]);
          y = height - 50;
        }
        const spkName = (seg as any).speakerName || seg.speaker || 'Speaker';
        page.drawText(`[${seg.timestamp || '00:00'}] ${spkName}:`, { x: 35, y, size: 9, font: fontBold, color: rgb(0.31, 0.27, 0.90) });
        y -= 12;
        const textLines = wrapText(`"${seg.text || ''}"`, 80);
        for (const tline of textLines) {
          page.drawText(tline, { x: 45, y, size: 8, font: fontRegular, color: rgb(0.3, 0.3, 0.3) });
          y -= 11;
        }
        y -= 4;
      }
    }

    const pdfBytes = await pdfDoc.save();
    return new NextResponse(new Uint8Array(pdfBytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="echoes-${meeting.id}.pdf"`,
      },
    });

  } catch (error: any) {
    console.error('[Export API Error]:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Export generation error' },
      { status: 500 }
    );
  }
}

// Simple text wrapper for PDF lines
function wrapText(text: string, maxCharsPerLine: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    if ((currentLine + ' ' + word).length > maxCharsPerLine) {
      lines.push(currentLine.trim());
      currentLine = word;
    } else {
      currentLine += (currentLine ? ' ' : '') + word;
    }
  }
  if (currentLine) lines.push(currentLine.trim());
  return lines;
}
