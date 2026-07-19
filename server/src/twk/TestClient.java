package twk;

import java.io.ByteArrayOutputStream;
import java.io.DataInputStream;
import java.io.OutputStream;
import java.net.Socket;

/**
 * Protocol-level test harness.  It is NOT the game — it reproduces the exact
 * byte exchange the real J2ME client performs (see classes ag, x, d, f, g), so
 * we can prove the server drives a connection all the way from the FLAP hello
 * to "in the game world" without needing a phone emulator.
 *
 * Usage:  java -cp out twk.TestClient [host] [port]
 * Exit code 0 = handshake reached the game world, non-zero = failure.
 */
public final class TestClient {

    public static void main(String[] args) throws Exception {
        String host = args.length > 0 ? args[0] : "127.0.0.1";
        int port = args.length > 1 ? Integer.parseInt(args[1]) : ThirdWorldServer.DEFAULT_PORT;

        try (Socket s = new Socket(host, port)) {
            s.setTcpNoDelay(true);
            DataInputStream in = new DataInputStream(s.getInputStream());
            OutputStream out = s.getOutputStream();

            // 1. Server speaks first: expect ch1 family1 sub0 (hello).
            Flap.Message hello = Flap.read(in);
            expect(hello, 1, 1, 0, "server hello");

            // 2. Client -> screen size (240x320), like i.a / i.b.
            send(out, Flap.frame(1, 1, 1, 1, sizeBytes(240, 320)));
            // 3. Client -> saved id (fam4/sub12).
            send(out, Flap.frame(1, 1, 4, 12, Flap.u32Bytes(0)));
            // 4. Client -> version string (fam1/sub0), exactly what g.a() sends.
            send(out, Flap.frame(1, 1, 1, 0, "28092009x3".getBytes()));

            // 5. Expect the login form (fam4/sub0).
            Flap.Message form = Flap.read(in);
            expect(form, 1, 4, 0, "login form request");

            // 6. Client -> login request (fam4/sub5) with TLV1=login, TLV2=pass.
            send(out, Flap.frame(1, 1, 4, 5, loginData("player1", "secret")));

            // 7. Expect login OK (fam4/sub5) carrying a 32-bit user id.
            Flap.Message ok = Flap.read(in);
            expect(ok, 1, 4, 5, "login response");
            if (ok.data.length < 4) fail("login response has no user id");
            long userId = Flap.u32(ok.data, 0);
            System.out.println("PASS: logged in, userId=" + userId);

            // 8. Client -> enter game (ch2 family10 sub0), like ag.run() state 3.
            send(out, Flap.frame(2, 1, 10, 0, new byte[0]));

            // 9. Expect the game canvas switch (ch2 family10 sub0).
            Flap.Message enter = Flap.read(in);
            expect(enter, 2, 10, 0, "game canvas");
            System.out.println("PASS: server switched client to the game canvas");

            // 10. Optionally the resources packet (ch2 family10 sub6).
            // 11. Drain the post-enter packets (resources + map), decoding the
            //     map exactly like the client's k.a(d) case 10/1 does.
            s.setSoTimeout(1500);
            try {
                while (true) {
                    Flap.Message pkt = Flap.read(in);
                    if (pkt.family == 10 && pkt.subtype == 6) {
                        System.out.println("PASS: received resources packet (" + pkt.data.length + "B)");
                    } else if (pkt.family == 10 && pkt.subtype == 1) {
                        System.out.println("PASS: received map packet (" + pkt.data.length + "B)");
                        decodeAndPrintMap(pkt.data);
                    } else {
                        System.out.println("INFO: extra packet " + pkt);
                    }
                }
            } catch (java.net.SocketTimeoutException e) {
                // no more packets
            }

            System.out.println();
            System.out.println("SUCCESS: unmodified-client handshake reaches the game world.");
        }
    }

    /** Decode a fam10/sub1 map payload the way k.a(d) does, print the 7x7 grid. */
    private static void decodeAndPrintMap(byte[] data) {
        int mapId = -1;
        byte[] tiles = null;
        for (Flap.Tlv t : Flap.parseTlvs(data)) {
            if (t.type == 8) mapId = t.value[0] & 0xFF;
            else if (t.type == 9) tiles = t.value;
        }
        String[] names = { "castle", "storage", "mbase", "barracks", "market",
                "farm", "house", "sawmill", "quarry", "iron" };
        System.out.println("      mapId=" + mapId + " (0=home) tiles=" + (tiles == null ? 0 : tiles.length));
        if (mapId == 0 && tiles != null && tiles.length >= 49) {
            for (int row = 0; row < 7; row++) {
                StringBuilder sb = new StringBuilder("      ");
                for (int col = 0; col < 7; col++) {
                    int v = tiles[row * 7 + col];
                    sb.append(v < 0 ? " .. " : String.format("%3d ", v));
                }
                System.out.println(sb.toString());
            }
            for (int i = 0; i < 49; i++) {
                int v = tiles[i];
                if (v >= 0 && v < names.length)
                    System.out.println("      [" + (i / 7) + "][" + (i % 7) + "] = " + names[v]);
            }
        }
    }

    private static byte[] sizeBytes(int w, int h) {
        ByteArrayOutputStream o = new ByteArrayOutputStream();
        Flap.putU16(o, w);
        Flap.putU16(o, h);
        return o.toByteArray();
    }

    private static byte[] loginData(String login, String pass) {
        ByteArrayOutputStream o = new ByteArrayOutputStream();
        Flap.tlv(o, 1, login.getBytes());
        Flap.tlv(o, 2, pass.getBytes());
        return o.toByteArray();
    }

    private static void send(OutputStream out, byte[] frame) throws Exception {
        Flap.send(out, frame);
    }

    private static void expect(Flap.Message m, int ch, int fam, int sub, String what) {
        if (m.channel != ch || m.family != fam || m.subtype != sub) {
            fail("expected " + what + " (ch=" + ch + " family=" + fam + " subtype=" + sub
                    + ") but got " + m);
        }
        System.out.println("OK  : " + what + " -> " + m);
    }

    private static void fail(String msg) {
        System.out.println("FAIL: " + msg);
        System.exit(1);
    }
}
