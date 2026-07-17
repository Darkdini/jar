#!/bin/sh
# End-to-end protocol test: start the server, run the emulated-client handshake,
# assert it reaches the game world, then stop the server.
set -e
cd "$(dirname "$0")"
./build.sh
PORT=${1:-2599}
java -cp out twk.ThirdWorldServer --port="$PORT" > /tmp/twk-server-test.log 2>&1 &
SRV=$!
trap 'kill $SRV 2>/dev/null' EXIT
sleep 1
java -cp out twk.TestClient 127.0.0.1 "$PORT"
