# Security Policy

## Supported Versions

I only support the absolute latest release. Since the app updates automatically in the background, if you are not on the latest version, just wait a minute or restart the app. Older versions do not receive backported patches.

| Version | Supported |
| --- | --- |
| Latest | :white_check_mark: |
| Everything else | :x: |

## Reporting a Vulnerability

We take the security of Visual Network Intelligence (VNI) seriously. If you discover a security vulnerability within this project, please send an email to **home@s4m.dev**.

Please do not report security vulnerabilities through public GitHub issues. 

In your email, please include:
- A description of the vulnerability.
- Steps to reproduce the issue.
- (Optional) Any suggestions on how to mitigate the issue.

If you email a report, I might read it, and I might act on it. If I do fix the issue, the code will be silently updated in the background. I might give you credit in the release notes, but honestly, it's a 50/50 chance. Please do not expect a reply.

## Local Execution Context
Please note that VNI Engine performs raw network operations (`traceroute`/`tracert`) which inherently require local execution permissions. It is designed to run locally on the user's machine and only binds its internal API to `127.0.0.1` (localhost) to prevent external network access to the trace engine.
