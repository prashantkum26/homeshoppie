interface WelcomeEmailOptions {
  userName: string
  shopUrl: string
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

export function buildWelcomeEmail({
  userName,
  shopUrl,
}: WelcomeEmailOptions): string {
  const safeName = escapeHtml(userName.trim() || 'there')
  const safeUrl = escapeHtml(shopUrl)

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <title>Welcome to HomeShoppie</title>
</head>
<body style="margin:0;padding:0;background:#f3f5f7;
font-family:Arial,Helvetica,sans-serif;color:#172033;">

  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
    Welcome to HomeShoppie. Discover something wonderful for your home.
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
            <td align="center" style="padding:34px 26px 12px;">
              <div style="width:64px;height:64px;line-height:64px;
                border-radius:50%;background:#dcfce7;
                color:#166534;font-size:30px;">
                &#10003;
              </div>
              <h1 style="margin:22px 0 12px;font-size:27px;
                line-height:1.35;color:#172033;">
                Welcome to HomeShoppie!
              </h1>
              <p style="margin:0;font-size:15px;line-height:1.8;
                color:#64748b;">
                We're delighted to have you here.
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:16px 28px 30px;">
              <p style="font-size:15px;line-height:1.8;">
                Hello ${safeName},
              </p>

              <p style="font-size:14px;line-height:1.9;color:#475569;">
                Thank you for joining HomeShoppie. We're here to
                help you discover traditional favourites, everyday
                essentials, and products for your home.
              </p>

              <table role="presentation" width="100%" cellpadding="0"
                cellspacing="0" border="0" bgcolor="#f0fdf4"
                style="margin:24px 0;border:1px solid #dcfce7;
                border-radius:10px;">
                <tr>
                  <td style="padding:20px;">
                    <p style="margin:0 0 8px;font-size:15px;
                      font-weight:bold;color:#166534;">
                      Your shopping journey starts here
                    </p>
                    <p style="margin:0;font-size:13px;
                      line-height:1.8;color:#475569;">
                      Browse our collection and find products
                      that bring a little more convenience to
                      your everyday life.
                    </p>
                  </td>
                </tr>
              </table>

              <table role="presentation" width="100%" cellpadding="0"
                cellspacing="0" border="0" style="margin:26px 0;">
                <tr>
                  <td align="center" bgcolor="#15803d"
                    style="border-radius:8px;">
                    <a href="${safeUrl}" target="_blank"
                      style="display:block;padding:17px 20px;
                      color:#ffffff;text-decoration:none;
                      font-size:15px;font-weight:bold;">
                      Explore HomeShoppie
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:26px 0 0;font-size:14px;
                line-height:1.8;color:#475569;">
                Happy shopping,<br>
                <strong style="color:#166534;">
                  The HomeShoppie Team
                </strong>
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
                You're receiving this email because you registered
                for a HomeShoppie account.
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