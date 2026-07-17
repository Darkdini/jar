# Third World War of Kings 2D — server

A from-scratch server for the 2009 J2ME mobile game **Third World War of Kings
2D** (vendor *Fenix-Soft*), reconstructed from the decompiled client that ships
in `../Third_World_War_of_Kings_2D.jar.src.zip`.

The client is **not modified in any way**. It still connects to its hard-coded
address (`socket://mmog1.com:2500`); you only redirect that host to the machine
running this server. Everything in the client stays exactly where it was.

## What it does

The client speaks an OSCAR/FLAP-style binary protocol over a raw TCP socket.
This server reproduces that framing and drives the connection through the
client's login state machine until the client switches to its game canvas and
renders the world:

```
S -> C  ch1 family1  sub0    hello (server speaks first)
C -> S  ch1 family1  sub1    screen size  [w:u16][h:u16]
C -> S  ch1 family4  sub12   saved id (optional)
C -> S  ch1 family1  sub0    client version "28092009x3"
S -> C  ch1 family4  sub0    -> client shows its login form
C -> S  ch1 family4  sub5    login: TLV1=login, TLV2=password
S -> C  ch1 family4  sub5    login OK: [userId:u32]  -> client session state 3
C -> S  ch2 family10 sub0    "enter game"
S -> C  ch2 family10 sub0    -> client shows the game canvas
S -> C  ch2 family10 sub6    starter resources (optional)
```

Any login is accepted (an account id is minted on the fly). The client carries a
default map, so once it reaches the game canvas it draws a playable world even
before the server streams any tiles.

### Scope / honesty

This gets the **unmodified client to connect, authenticate and enter the game
world** — the "make it launch" goal. It is **not** a full game simulation:
economy ticks, building, combat, chat, ratings and registration are server-side
rules that do not exist in the client and cannot be recovered from it. Every
in-game packet the server doesn't implement is logged (family/subtype + hex) so
the protocol can be extended incrementally from real traffic. The wire framing,
TLV handling and the whole login handshake are complete and faithful.

## Build & run

Requires a JDK (uses only the standard library).

```sh
./build.sh          # compiles into ./out
./run.sh            # listens on 0.0.0.0:2500
./run.sh --port=2500 --no-resources
```

Port 2500 is the client's hard-coded port. Binding it may need elevated
privileges on some systems; run as needed or use `authbind`.

## Point the client at the server

The client resolves `mmog1.com`. Redirect it without touching the client:

- **Emulator / desktop:** add to the machine's hosts file
  (`/etc/hosts`, or `C:\Windows\System32\drivers\etc\hosts`):

  ```
  127.0.0.1   mmog1.com
  ```

- **Real device / other host:** point `mmog1.com` at the server's LAN IP via
  local DNS, or run the server on a host that answers for that name.

Then launch the MIDlet as usual.

## Test

`./test.sh` starts the server and runs `twk.TestClient`, a protocol-level
harness that replays the exact bytes the real J2ME client sends (from classes
`ag`, `x`, `d`, `f`, `g`) and asserts the handshake reaches the game world.
Exit code 0 = success.

```sh
./test.sh
```

## Layout

```
server/
  src/twk/Flap.java             framing + TLV + big-endian helpers (mirror of the client)
  src/twk/ThirdWorldServer.java TCP server + login/enter-game state machine
  src/twk/TestClient.java       emulated-client end-to-end handshake test
  build.sh  run.sh  test.sh
```

## Protocol notes (for extending)

- **Frame:** `0x2A | channel(1) | seq(u16) | len(u16) | payload(len)`, all
  integers big-endian.
- **Channels:** `1` = login/service, `2` = game engine (client class `k`).
- **Payload (SNAC):** `family(u16) | subtype(u16) | data`.
- **TLV:** `type(u16) | len(u16) | value` repeated inside `data`.
- Cyrillic text is a CP1251-like single-byte encoding; `Flap.decodeText`
  reverses the client's `g.b(...)` mapping.
- Game families seen in `k.a(d)`: `10` (map/buildings/resources/units),
  `11` (dialogs/SMS), `12`. Subtypes are documented inline where handled.
