interface PasswordResetEmailOptions {
  resetUrl: string
  userName?: string
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }
    return entities[char]
  })
}

export function buildPasswordResetEmail({
  resetUrl,
  userName,
}: PasswordResetEmailOptions): string {
  const safeUrl = escapeHtml(resetUrl)
  const safeName = escapeHtml(userName?.trim() || 'there')

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <title>Reset your HomeShoppie password</title>
</head>
<body style="margin:0;padding:0;background:#f3f5f7;
font-family:Arial,Helvetica,sans-serif;color:#172033;">

  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
    Reset your HomeShoppie password securely.
  </div>

  <table role="presentation" width="100%" cellpadding="0"
    cellspacing="0" border="0" bgcolor="#f3f5f7">
    <tr>
      <td align="center" style="padding:32px 12px;">

        <table role="presentation" width="100%" cellpadding="0"
          cellspacing="0" border="0" bgcolor="#ffffff"
          style="max-width:560px;border:1px solid #e5e7eb;
          border-radius:14px;">

          <tr>
            <td align="center" style="padding:28px 20px;
              border-bottom:1px solid #edf0f2;">
              <div style="font-size:27px;font-weight:bold;
                letter-spacing:-0.7px;color:#166534;">
                HomeShoppie
              </div>
              <p style="margin:8px 0 0;font-size:10px;
                letter-spacing:1.8px;color:#64748b;">
                AUTHENTIC TRADITIONAL PRODUCTS
              </p>
            </td>
          </tr>

          <tr>
            <td align="center" style="padding:32px 24px 12px;">
              <div style="width:58px;height:58px;line-height:58px;
                border-radius:50%;background:#fef3c7;color:#92400e;
                font-size:25px;font-weight:bold;">
                &#128274;
              </div>
              <h1 style="margin:20px 0 12px;font-size:25px;
                line-height:1.35;color:#172033;">
                Reset your password
              </h1>
              <p style="margin:0;font-size:14px;line-height:1.8;
                color:#64748b;">
                Let's help you get back into your account.
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:16px 28px 30px;">
              <p style="font-size:15px;line-height:1.8;">
                Hello ${safeName},
              </p>

              <p style="font-size:14px;line-height:1.9;color:#475569;">
                We received a request to reset your HomeShoppie
                account password. Click below to choose a new one.
              </p>

              <table role="presentation" width="100%" cellpadding="0"
                cellspacing="0" border="0" style="margin:26px 0;">
                <tr>
                  <td align="center" bgcolor="#15803d"
                    style="border-radius:8px;">
                    <a href="${safeUrl}" target="_blank"
                      style="display:block;padding:17px 20px;
                      color:#ffffff;text-decoration:none;
                      font-size:15px;font-weight:bold;">
                      Reset My Password
                    </a>
                  </td>
                </tr>
              </table>

              <table role="presentation" width="100%" cellpadding="0"
                cellspacing="0" border="0" bgcolor="#f8fafc"
                style="border:1px solid #e5e7eb;border-radius:9px;">
                <tr>
                  <td style="padding:16px;">
                    <p style="margin:0 0 7px;font-size:13px;
                      font-weight:bold;color:#334155;">
                      &#9200; Expires in 1 hour
                    </p>
                    <p style="margin:0;font-size:12px;
                      line-height:1.8;color:#64748b;">
                      For your protection, this password-reset link
                      is time-limited. Never share it with anyone.
                    </p>
                  </td>
                </tr>
              </table>

              <p style="margin:24px 0 8px;font-size:12px;
                line-height:1.8;color:#64748b;">
                If the button doesn't work, copy this link into
                your browser:
              </p>

              <p style="margin:0;font-size:12px;line-height:1.8;
                overflow-wrap:anywhere;word-break:break-word;">
                <a href="${safeUrl}" style="color:#15803d;">
                  ${safeUrl}
                </a>
              </p>

              <div style="height:1px;background:#edf0f2;
                margin:26px 0;"></div>

              <p style="margin:0;font-size:13px;line-height:1.8;
                color:#64748b;">
                Didn't request this change? You can ignore this email.
                Your password will remain unchanged unless you
                complete the reset.
              </p>
            </td>
          </tr>

          <tr>
            <td align="center" bgcolor="#f8fafc"
              style="padding:22px 18px;border-top:1px solid #edf0f2;">
              <p style="margin:0 0 8px;font-size:14px;
                font-weight:bold;color:#166534;">
                HomeShoppie
              </p>
              <p style="margin:0;font-size:12px;
                line-height:1.8;color:#64748b;">
                Bringing everyday essentials closer to home.
              </p>
              <p style="margin:10px 0 0;font-size:11px;
                color:#94a3b8;">
                Automated account security email.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}