#!/bin/sh
# Compile the server into ./out
set -e
cd "$(dirname "$0")"
mkdir -p out
javac -d out src/twk/*.java
echo "Built into $(pwd)/out"
