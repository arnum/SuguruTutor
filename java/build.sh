#!/bin/sh
# Oversætter alle kilder til mappen out/. Kræver Java 8 eller nyere.
set -e
cd "$(dirname "$0")"
mkdir -p out
javac -encoding UTF-8 -d out src/*.java
echo "Klar. Prøv: java -cp out SuguruBook --antal 6 --str 6x6 --grad 3-5"
