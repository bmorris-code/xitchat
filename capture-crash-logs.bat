@echo off
echo Clearing logcat...
adb -s 1MA75199ZA1G80B1P1X0407 logcat -c

echo.
echo Logcat cleared. Now run the app on your device.
echo Press CTRL+C to stop monitoring after the crash.
echo.
echo Monitoring for errors...
echo.

adb -s 1MA75199ZA1G80B1P1X0407 logcat -v time *:E AndroidRuntime:E
