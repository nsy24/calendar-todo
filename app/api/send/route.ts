import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM = "onboarding@resend.dev";
/** お問い合わせの送信先（ここにメールアドレスを記載） */
const TO = "nexora.tokyo@gmail.com";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim() : "";
    const subject = typeof body.subject === "string" ? body.subject.trim() : "";
    const message = typeof body.message === "string" ? body.message.trim() : "";

    if (!name || !email || !subject || !message) {
      return NextResponse.json(
        { error: "name, email, subject, message are required" },
        { status: 400 }
      );
    }

    if (!process.env.RESEND_API_KEY?.trim()) {
      console.error("[send] RESEND_API_KEY is not set");
      return NextResponse.json(
        { error: "Email service is not configured" },
        { status: 500 }
      );
    }

    if (!TO || TO === "YOUR_EMAIL@example.com") {
      console.error("[send] 送信先メールアドレスが未設定です。app/api/send/route.ts の TO を編集してください。");
      return NextResponse.json(
        { error: "Recipient email is not configured" },
        { status: 500 }
      );
    }

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>お問い合わせ</title>
</head>
<body style="margin:0; padding:0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background:#f8fafc; color:#0f172a;">
  <div style="max-width:560px; margin:0 auto; padding:32px 24px;">
    <div style="background:#fff; border-radius:16px; border:1px solid #e2e8f0; box-shadow:0 4px 6px -1px rgba(0,0,0,0.06); overflow:hidden;">
      <div style="background:linear-gradient(135deg, #64748b 0%, #475569 100%); padding:24px 28px;">
        <h1 style="margin:0; font-size:20px; font-weight:700; color:#fff; letter-spacing:0.02em;">お問い合わせフォーム</h1>
        <p style="margin:8px 0 0; font-size:13px; color:rgba(255,255,255,0.85);">Webサイトから送信されました</p>
      </div>
      <div style="padding:28px;">
        <table style="width:100%; border-collapse:collapse;">
          <tr>
            <td style="padding:12px 0; border-bottom:1px solid #f1f5f9; font-size:12px; font-weight:600; color:#64748b; width:100px;">お名前</td>
            <td style="padding:12px 0; border-bottom:1px solid #f1f5f9; font-size:14px; color:#0f172a;">${escapeHtml(name)}</td>
          </tr>
          <tr>
            <td style="padding:12px 0; border-bottom:1px solid #f1f5f9; font-size:12px; font-weight:600; color:#64748b;">メール</td>
            <td style="padding:12px 0; border-bottom:1px solid #f1f5f9; font-size:14px; color:#0f172a;"><a href="mailto:${escapeHtml(email)}" style="color:#2563eb; text-decoration:none;">${escapeHtml(email)}</a></td>
          </tr>
          <tr>
            <td style="padding:12px 0; border-bottom:1px solid #f1f5f9; font-size:12px; font-weight:600; color:#64748b;">件名</td>
            <td style="padding:12px 0; border-bottom:1px solid #f1f5f9; font-size:14px; color:#0f172a;">${escapeHtml(subject)}</td>
          </tr>
        </table>
        <div style="margin-top:20px;">
          <p style="margin:0 0 8px; font-size:12px; font-weight:600; color:#64748b;">メッセージ</p>
          <div style="background:#f8fafc; border-radius:12px; padding:20px; font-size:14px; line-height:1.7; color:#334155; white-space:pre-wrap;">${escapeHtml(message)}</div>
        </div>
      </div>
      <div style="padding:16px 28px; background:#f8fafc; border-top:1px solid #e2e8f0; font-size:11px; color:#94a3b8;">このメールは Resend 経由で送信されています。</div>
    </div>
  </div>
</body>
</html>
`.trim();

    const { data, error } = await resend.emails.send({
      from: FROM,
      to: [TO],
      replyTo: email,
      subject: `[お問い合わせ] ${subject}`,
      html,
    });

    if (error) {
      console.error("[send] Resend error", { error, name: name.slice(0, 20), subject });
      return NextResponse.json(
        { error: error.message ?? "Failed to send email" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, id: data?.id });
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    console.error("[send] Unexpected error", { message: err.message, stack: err.stack });
    return NextResponse.json(
      { error: "Send failed" },
      { status: 500 }
    );
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
