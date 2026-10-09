interface VerificationEmailOptions {
  verificationUrl: string
}

export function buildVerificationEmail({
  verificationUrl,
}: VerificationEmailOptions): string {
  // Escape dynamic HTML attributes and content.
  const safeUrl = verificationUrl
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/'/g, '&#39;')

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>Verify your HomeShoppie account</title>
</head>

<body style="margin:0;padding:0;background-color:#f3f5f7;
  font-family:Arial,Helvetica,sans-serif;color:#1f2937;">

  <div style="display:none;max-height:0;overflow:hidden;
    opacity:0;color:transparent;">
    Verify your email address to finish setting up your HomeShoppie account.
  </div>

  <table role="presentation" width="100%" cellpadding="0"
    cellspacing="0" border="0" style="background:#f3f5f7;">
    <tr>
      <td align="center" style="padding:32px 12px;">

        <table role="presentation" width="100%" cellpadding="0"
          cellspacing="0" border="0"
          style="max-width:560px;background:#ffffff;
          border-radius:16px;overflow:hidden;">

          <!-- Brand header -->
          <tr>
            <td align="center" style="padding:30px 24px 26px;
              border-bottom:1px solid #edf0f2;">
              <div style="font-size:27px;font-weight:700;
                letter-spacing:-0.7px;color:#166534;">
                HomeShoppie
              </div>
              <div style="font-size:10px;letter-spacing:2px;
                color:#64748b;margin-top:8px;">
                YOUR HOME, YOUR EVERYDAY ESSENTIALS
              </div>
            </td>
          </tr>

          <!-- Main content -->
          <tr>
            <td align="center" style="padding:36px 28px 12px;">
              <div style="display:inline-block;width:60px;height:60px;
                line-height:60px;border-radius:50%;
                background:#dcfce7;color:#166534;
                font-size:28px;font-weight:700;">
                &#10003;
              </div>

              <h1 style="margin:22px 0 12px;font-size:26px;
                line-height:1.3;color:#172033;font-weight:700;">
                Verify your email address
              </h1>

              <p style="margin:0;font-size:15px;line-height:1.8;
                color:#64748b;">
                You're one step away from getting started.
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:16px 28px 32px;">
              <p style="margin:0 0 16px;font-size:15px;
                line-height:1.8;color:#334155;">
                Hello there,
              </p>

              <p style="margin:0 0 26px;font-size:15px;
                line-height:1.8;color:#475569;">
                Welcome to HomeShoppie! We're happy to have you
                here. Please confirm your email address to finish
                setting up your account and help keep it secure.
              </p>

              <!-- CTA button -->
              <table role="presentation" cellpadding="0"
                cellspacing="0" border="0" align="center"
                width="100%">
                <tr>
                  <td align="center">
                    <a href="${safeUrl}"
                      target="_blank"
                      style="display:block;box-sizing:border-box;
                      width:100%;padding:17px 20px;
                      background:#15803d;color:#ffffff;
                      text-decoration:none;text-align:center;
                      font-size:16px;font-weight:700;
                      line-height:20px;border-radius:9px;">
                      Verify My Email Address
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Expiry notice -->
              <table role="presentation" width="100%"
                cellpadding="0" cellspacing="0" border="0"
                style="margin-top:26px;background:#f8fafc;
                border:1px solid #e2e8f0;border-radius:10px;">
                <tr>
                  <td style="padding:16px;">
                    <p style="margin:0 0 7px;font-size:14px;
                      font-weight:700;color:#334155;">
                      &#9200; Link expires in 24 hours
                    </p>
                    <p style="margin:0;font-size:13px;
                      line-height:1.7;color:#64748b;">
                      For your security, don't share this link
                      with anyone.
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Fallback URL -->
              <p style="margin:26px 0 8px;font-size:13px;
                line-height:1.7;color:#64748b;">
                If the button doesn't work, copy and paste this
                link into your browser:
              </p>

              <p style="margin:0;overflow-wrap:anywhere;
                word-break:break-word;font-size:12px;line-height:1.8;">
                <a href="${safeUrl}" target="_blank"
                  style="color:#15803d;text-decoration:underline;">
                  ${safeUrl}
                </a>
              </p>

              <div style="height:1px;background:#edf0f2;
                margin:28px 0;"></div>

              <p style="margin:0;font-size:13px;
                line-height:1.8;color:#64748b;">
                If you didn't create a HomeShoppie account,
                you can safely ignore this email.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding:24px 20px;
              background:#f8fafc;border-top:1px solid #edf0f2;">
              <p style="margin:0 0 8px;font-size:15px;
                font-weight:700;color:#166534;">
                HomeShoppie
              </p>
              <p style="margin:0 0 12px;font-size:12px;
                line-height:1.7;color:#64748b;">
                Bringing everyday essentials closer to home.
              </p>
              <p style="margin:0;font-size:11px;
                line-height:1.7;color:#94a3b8;">
                This is an automated account security email.
                Please do not reply to this message.
              </p>
            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>
</body>
</html>
  `
}