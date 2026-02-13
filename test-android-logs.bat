@echo off
REM XitChat Android H6 Log Monitor
REM Device: 1MA75199ZA1G80B1P1X0407

echo ========================================
echo XitChat Android H6 Log Monitor
echo ========================================
echo.
echo Monitoring device: 1MA75199ZA1G80B1P1X0407
echo Press Ctrl+C to stop
echo.
echo Looking for:
echo - Network initialization
echo - Peer discovery
echo - Message sending/receiving
echo - Connection events
echo ========================================
echo.

adb -s 1MA75199ZA1G80B1P1X0407 logcat -c
adb -s 1MA75199ZA1G80B1P1X0407 logcat -s chromium:I *:E | findstr /i "xitchat mesh nostr wifi bluetooth webrtc peer message initialized connected"
