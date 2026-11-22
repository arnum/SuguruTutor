@echo off
rem Compiles all sources into the folder out\. Needs Java 8 or newer.
cd /d "%~dp0"
if not exist out mkdir out
javac -encoding UTF-8 -d out src\*.java || exit /b 1
echo Done. Try: java -cp out SuguruBook --count 6 --size 6x6 --grade 3-5
