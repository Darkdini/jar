#!/bin/sh
# Build (if needed) and run the server.
#   ./run.sh                 -> listen on 2500
#   ./run.sh --port=2500     -> explicit port
#   ./run.sh --no-resources  -> don't push the starter resource packet
set -e
cd "$(dirname "$0")"
[ -f out/twk/ThirdWorldServer.class ] || ./build.sh
exec java -cp out twk.ThirdWorldServer "$@"
