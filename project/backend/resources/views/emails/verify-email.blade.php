@php($theme = config('mail-theme'))
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light">
    <title>Verify your e-mail address</title>
</head>
<body style="margin:0;padding:0;background-color:{{ $theme['background'] }};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
        Confirm your e-mail to finish setting up your FindIT account.
    </div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:{{ $theme['background'] }};padding:32px 16px;">
        <tr>
            <td align="center">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background-color:{{ $theme['surface'] }};border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(15,23,42,0.08);">
                    <tr>
                        <td align="center" style="background-color:{{ $theme['surface'] }};border-top:4px solid {{ $theme['primary'] }};border-bottom:1px solid {{ $theme['border_color'] }};padding:28px 24px;">
                            <span style="font-size:32px;font-weight:700;letter-spacing:0.3px;color:{{ $theme['text_primary'] }};">Find<span style="color:{{ $theme['primary'] }};">IT</span></span>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:36px 32px 8px;color:{{ $theme['text_primary'] }};">
                            <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;font-weight:700;">Hi {{ $username }}, welcome to FindIT!</h1>
                            <p style="margin:0 0 24px;font-size:16px;line-height:1.6;color:{{ $theme['text_primary'] }};">
                                Thanks for signing up. Please confirm that this is your e-mail address so we know your account is really yours. Until then you won’t be able to create posts or send messages.
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <td align="center" style="padding:0 32px 24px;">
                            <a href="{{ $url }}" style="display:inline-block;background-color:{{ $theme['primary'] }};color:{{ $theme['surface'] }};text-decoration:none;font-size:16px;font-weight:600;padding:14px 36px;border-radius:10px;">Verify e-mail address</a>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:0 32px 32px;">
                            <p style="margin:0;font-size:14px;line-height:1.6;color:{{ $theme['text_secondary'] }};">
                                This link can be used once and expires in {{ $expiresInMinutes }} minutes. If you didn't create an account, you can safely ignore this e-mail.
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:20px 32px;background-color:{{ $theme['background'] }};border-top:1px solid {{ $theme['border_color'] }};">
                            <p style="margin:0 0 6px;font-size:12px;line-height:1.5;color:{{ $theme['text_secondary'] }};">
                                Button not working? Copy and paste this link into your browser:
                            </p>
                            <p style="margin:0;font-size:12px;line-height:1.5;word-break:break-all;">
                                <a href="{{ $url }}" style="color:{{ $theme['primary'] }};">{{ $url }}</a>
                            </p>
                        </td>
                    </tr>
                </table>
                <p style="margin:16px 0 0;font-size:12px;color:{{ $theme['text_secondary'] }};">&copy; {{ date('Y') }} FindIT</p>
            </td>
        </tr>
    </table>
</body>
</html>
