# Security Policy

## Supported Versions

Currently, only the latest release of VNI is actively supported with security updates. 

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

We take the security of Visual Network Intelligence (VNI) seriously. If you discover a security vulnerability within this project, please send an email to **home@s4m.dev**.

Please do not report security vulnerabilities through public GitHub issues. 

In your email, please include:
- A description of the vulnerability.
- Steps to reproduce the issue.
- (Optional) Any suggestions on how to mitigate the issue.

We will acknowledge receipt of your vulnerability report within 72 hours and strive to send you regular updates about our progress. If you report a vulnerability, we will gladly credit you in our release notes (unless you prefer to remain anonymous).

## Local Execution Context
Please note that VNI Engine performs raw network operations (`traceroute`/`tracert`) which inherently require local execution permissions. It is designed to run locally on the user's machine and only binds its internal API to `127.0.0.1` (localhost) to prevent external network access to the trace engine.
