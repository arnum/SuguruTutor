#!/bin/sh
# Compiles all sources into the folder out/. Needs Java 8 or newer.
set -e
cd "$(dirname "$0")"
mkdir -p out
javac -encoding UTF-8 -d out src/*.java
echo "Done. Try: java -cp out SuguruBook --count 6 --size 6x6 --grade 3-5"
