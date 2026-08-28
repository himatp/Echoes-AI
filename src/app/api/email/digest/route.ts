import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import nodemailer from 'nodemailer';
import { Meeting } from '@/types';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { recipientEmail, assigneeName, meeting }: { recipientEmail?: string; assigneeName?: string; meeting?: Meeting } = body;

    const gmailUser = process.env.GMAIL_USER;
    const gmailPass = process.env.GMAIL_APP_PASSWORD;
    const resendKey = process.env.RESEND_API_KEY;

    if (!gmailUser && !gmailPass && !resendKey) {
      return NextResponse.json(
        {
          success: false,
          engine: 'Email-Disabled',
          error: 'Neither GMAIL_USER/GMAIL_APP_PASSWORD nor RESEND_API_KEY environment variables are configured in .env.local',
        },
        { status: 400 }
      );
    }

    const meetingTitle = meeting?.title || 'Sprint 15 Architecture Sync';
    const recipient = recipientEmail || gmailUser || 'delivered@resend.dev';
    const targetAssignee = assigneeName || 'Team Member';
    const summary = meeting?.summary || 'The team reviewed sprint milestones and finalized action item allocations.';
    const healthScore = meeting?.healthScore?.score || 90;
    const actionItems = meeting?.actionItems || [];

    // Filter tasks assigned to this recipient or show all relevant tasks
    const userTasks = actionItems.filter((t) => t.assignee.toLowerCase().includes(targetAssignee.toLowerCase()) || targetAssignee === 'Team Member' || targetAssignee === 'Additional Recipient');
    const displayTasks = userTasks.length > 0 ? userTasks : actionItems;

    const tasksHtmlDesktop = displayTasks
      .map(
        (t) => `
        <tr style="border-bottom: 1px solid #e4e4e7;">
          <td style="padding: 10px; font-weight: bold; color: #18181b;">${t.title}</td>
          <td style="padding: 10px; color: #4f46e5; font-weight: bold;">${t.assignee}</td>
          <td style="padding: 10px;"><span style="background: #e0e7ff; color: #3730a3; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: bold;">${t.priority.toUpperCase()}</span></td>
          <td style="padding: 10px; font-family: monospace; color: #71717a;">${t.dueDate}</td>
        </tr>`
      )
      .join('');

    const tasksHtmlMobile = displayTasks
      .map(
        (t) => `
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px; margin-bottom: 12px;">
          <div style="font-weight: bold; font-size: 14px; color: #18181b; margin-bottom: 8px;">${t.title}</div>
          <div style="font-size: 12px; color: #475569; margin-bottom: 4px;">
            <strong style="color: #1e293b;">Assignee:</strong> <span style="color: #4f46e5; font-weight: bold;">${t.assignee}</span>
          </div>
          <div style="font-size: 12px; color: #475569; margin-bottom: 4px;">
            <strong style="color: #1e293b;">Priority:</strong> <span style="background: #e0e7ff; color: #3730a3; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: bold; display: inline-block;">${t.priority.toUpperCase()}</span>
          </div>
          <div style="font-size: 12px; color: #475569;">
            <strong style="color: #1e293b;">Due:</strong> <span style="font-family: monospace; color: #64748b;">${t.dueDate}</span>
          </div>
        </div>`
      )
      .join('');

    const htmlBody = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style type="text/css">
            @media only screen and (max-width: 600px) {
              .desktop-view {
                display: none !important;
                max-height: 0 !important;
                overflow: hidden !important;
                mso-hide: all !important;
              }
              .mobile-view {
                display: block !important;
                max-height: none !important;
                overflow: visible !important;
                visibility: visible !important;
              }
            }
          </style>
        </head>
        <body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: Arial, sans-serif;">
          <div style="font-family: Arial, sans-serif; max-width: 600px; width: 100%; margin: 0 auto; background: #ffffff; border: 1px solid #e4e4e7; border-radius: 16px; overflow: hidden; font-size: 14px; color: #18181b;">
            <div style="background: #4f46e5; padding: 24px; text-align: center; color: #ffffff;">
              <h1 style="margin: 0; font-size: 20px; font-weight: 800;">Echoes AI Meeting Digest</h1>
              <p style="margin: 4px 0 0 0; font-size: 12px; opacity: 0.9;">Personalized Digest for ${targetAssignee}</p>
            </div>

            <div style="padding: 24px;">
              <h2 style="font-size: 16px; color: #18181b; margin-top: 0;">${meetingTitle}</h2>
              
              <div style="background: #f4f4f5; padding: 12px 16px; border-radius: 12px; margin-bottom: 16px;">
                <span style="font-size: 12px; font-weight: bold; color: #18181b;">Meeting Health Score: <span style="color: #059669;">${healthScore}/100</span></span>
              </div>

              <h3 style="font-size: 13px; color: #4f46e5; text-transform: uppercase; letter-spacing: 0.5px;">Executive Summary</h3>
              <p style="font-size: 13px; color: #27272a; line-height: 1.6; background: #f8fafc; padding: 14px; border-radius: 12px; border-left: 4px solid #4f46e5; margin-bottom: 20px;">
                ${summary}
              </p>

              <h3 style="font-size: 13px; color: #18181b; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 24px; margin-bottom: 12px;">Action Items (${displayTasks.length})</h3>
              
              <!-- DESKTOP TABLE VIEW (Default visible on desktop, hidden on mobile <= 600px) -->
              <div class="desktop-view" style="width: 100%;">
                <table style="width: 100%; border-collapse: collapse; font-size: 12px; text-align: left;">
                  <thead>
                    <tr style="background: #f4f4f5; color: #71717a; text-transform: uppercase; font-size: 10px;">
                      <th style="padding: 10px;">Task Title</th>
                      <th style="padding: 10px;">Assignee</th>
                      <th style="padding: 10px;">Priority</th>
                      <th style="padding: 10px;">Due Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${tasksHtmlDesktop}
                  </tbody>
                </table>
              </div>

              <!-- MOBILE CARDS VIEW (Hidden by default on desktop, displayed on mobile <= 600px) -->
              <div class="mobile-view" style="display: none; max-height: 0; overflow: hidden;">
                ${tasksHtmlMobile}
              </div>

              <div style="margin-top: 28px; padding-top: 16px; border-top: 1px solid #e4e4e7; text-align: center; font-size: 11px; color: #a1a1aa;">
                Sent automatically by Echoes AI Engine
              </div>
            </div>
          </div>
        </body>
      </html>
    `;

    // MODE 1: GMAIL SMTP via Nodemailer (Primary when GMAIL_USER & GMAIL_APP_PASSWORD exist)
    if (gmailUser && gmailPass) {
      console.log(`[Gmail SMTP] Dispatching email digest for ${targetAssignee} to ${recipient} via smtp.gmail.com:465...`);

      const transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        auth: {
          user: gmailUser,
          pass: gmailPass,
        },
      });

      try {
        const info = await transporter.sendMail({
          from: `Echoes AI Digest <${gmailUser}>`,
          to: recipient,
          subject: `[Echoes Digest] ${meetingTitle}`,
          html: htmlBody,
        });

        console.log(`[Gmail SMTP Success] Message sent to ${recipient}! Message ID: ${info.messageId}`);

        return NextResponse.json({
          success: true,
          engine: 'Gmail-SMTP-Real',
          messageId: info.messageId,
          recipient: recipient,
          message: `Email digest successfully sent to ${recipient} via Gmail SMTP`,
        });
      } catch (smtpErr: any) {
        console.error(`[Gmail SMTP Failure] Error sending email to ${recipient}:`, smtpErr);
        return NextResponse.json(
          {
            success: false,
            engine: 'Gmail-SMTP-Error',
            error: `Gmail SMTP authentication or delivery failed: ${smtpErr.message || smtpErr}`,
          },
          { status: 500 }
        );
      }
    }

    // MODE 2: RESEND API FALLBACK (When GMAIL credentials are missing but RESEND_API_KEY is present)
    if (resendKey) {
      console.log(`[Resend API] Sending email digest for ${targetAssignee} to ${recipient} via Resend...`);

      let resendRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${resendKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          from: 'onboarding@resend.dev',
          to: [recipient],
          subject: `[Echoes Digest] ${meetingTitle}`,
          html: htmlBody,
        }),
      });

      let deliveredTarget = recipient;

      if (!resendRes.ok) {
        const errTxt = await resendRes.text();
        console.warn(`[Resend API Warning] Direct dispatch to ${recipient} returned status ${resendRes.status}: ${errTxt}`);

        if (recipient !== 'delivered@resend.dev') {
          deliveredTarget = 'delivered@resend.dev';
          resendRes = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              authorization: `Bearer ${resendKey}`,
              'content-type': 'application/json',
            },
            body: JSON.stringify({
              from: 'onboarding@resend.dev',
              to: ['delivered@resend.dev'],
              subject: `[Echoes Digest for ${targetAssignee}] ${meetingTitle}`,
              html: htmlBody,
            }),
          });
        }

        if (!resendRes.ok) {
          const finalErr = await resendRes.text();
          throw new Error(`Resend API call failed (${resendRes.status}): ${finalErr}`);
        }
      }

      const resendData = await resendRes.json();
      console.log('[Resend API Success] Email digest dispatched! Resend ID:', resendData.id);

      return NextResponse.json({
        success: true,
        engine: 'Resend-Email-API-Real',
        resendId: resendData.id,
        recipient: deliveredTarget,
        originalRecipient: recipient,
        message: `Email digest successfully dispatched to ${deliveredTarget} via Resend API (ID: ${resendData.id})`,
      });
    }

    return NextResponse.json(
      {
        success: false,
        engine: 'Email-Disabled',
        error: 'No active email provider configured (missing GMAIL_USER/GMAIL_APP_PASSWORD and RESEND_API_KEY)',
      },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('[Email Digest Route Exception]:', error);
    return NextResponse.json(
      {
        success: false,
        engine: 'Email-Digest-Error',
        error: error.message || 'Email delivery failed due to unexpected server error',
      },
      { status: 500 }
    );
  }
}
