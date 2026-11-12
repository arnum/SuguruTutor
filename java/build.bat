@echo off
rem Oversaetter alle kilder til mappen out\. Kraever Java 8 eller nyere.
cd /d "%~dp0"
if not exist out mkdir out
javac -encoding UTF-8 -d out src\*.java || exit /b 1
echo Klar. Proev: java -cp out SuguruBook --antal 6 --str 6x6 --grad 3-5
