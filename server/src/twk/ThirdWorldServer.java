package twk;

import java.io.ByteArrayOutputStream;
import java.io.DataInputStream;
import java.io.EOFException;
import java.io.IOException;
import java.io.OutputStream;
import java.net.ServerSocket;
import java.net.Socket;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Minimal but faithful server for the 2009 J2ME MIDlet
 * "Third World War of Kings 2D" (Fenix-Soft).
 *
 * Goal: let the UNMODIFIED client connect (it targets mmog1.com:2500), pass the
 * OSCAR/FLAP handshake, log in, and enter the rendered game world.  The client
 * ships with a default map, so once it reaches the game canvas it draws a world
 * even before the server streams tiles.
 *
 * Handshake reproduced from the client (classes ag, x, d, f, g):
 *
 *   S -> C  ch1 family1  sub0   (hello; the client's g.a() reacts to this)
 *   C -> S  ch1 family1  sub1   [w:u16][h:u16]        screen size
 *   C -> S  ch1 family4  sub12  [u32]                 saved id (optional)
 *   C -> S  ch1 family1  sub0   "28092009x3"          client build/version
 *   S -> C  ch1 family4  sub0                          -> client shows login form
 *   C -> S  ch1 family4  sub5   TLV1=login TLV2=pass   login request
 *   S -> C  ch1 family4  sub5   [u32 userId]           -> client session state 3
 *   C -> S  ch2 family10 sub0                          -> "enter game"
 *   S -> C  ch2 family10 sub0                          -> client shows game canvas
 *   S -> C  ch2 family10 sub6   resources (optional)
 */
public final class ThirdWorldServer {

    public static final int DEFAULT_PORT = 2500;

    // Families / subtypes used in the handshake.
    static final int FAM_SERVICE = 1;
    static final int FAM_AUTH     = 4;
    static final int FAM_GAME     = 10;

    static final int SUB_HELLO       = 0;  // fam1: server hello / client version
    static final int SUB_SCREEN      = 1;  // fam1: client screen size
    static final int SUB_AUTH_FORM   = 0;  // fam4: show login form
    static final int SUB_AUTH_LOGIN  = 5;  // fam4: login request/response
    static final int SUB_AUTH_SAVEDID = 12; // fam4: client saved id
    static final int SUB_GAME_ENTER  = 0;  // fam10: enter game / show canvas
    static final int SUB_GAME_MAP    = 1;  // fam10: map data
    static final int SUB_GAME_RES    = 6;  // fam10: resources

    private static final AtomicInteger USER_IDS = new AtomicInteger(1000);

    private final int port;
    private final boolean sendResources;

    ThirdWorldServer(int port, boolean sendResources) {
        this.port = port;
        this.sendResources = sendResources;
    }

    public static void main(String[] args) throws IOException {
        int port = DEFAULT_PORT;
        boolean sendResources = true;
        for (String a : args) {
            if (a.startsWith("--port=")) port = Integer.parseInt(a.substring(7));
            else if (a.equals("--no-resources")) sendResources = false;
        }
        new ThirdWorldServer(port, sendResources).run();
    }

    void run() throws IOException {
        try (ServerSocket server = new ServerSocket(port)) {
            log("Third World War of Kings 2D - server listening on 0.0.0.0:" + port);
            log("Point the client's host (mmog1.com) at this machine.");
            while (true) {
                Socket socket = server.accept();
                Thread t = new Thread(() -> handle(socket), "client-" + socket.getPort());
                t.setDaemon(true);
                t.start();
            }
        }
    }

    private void handle(Socket socket) {
        String who = socket.getInetAddress().getHostAddress() + ":" + socket.getPort();
        log("[" + who + "] connected");
        try {
            socket.setTcpNoDelay(true);
            DataInputStream in = new DataInputStream(socket.getInputStream());
            OutputStream out = socket.getOutputStream();
            new Session(who, in, out).loop();
        } catch (EOFException e) {
            log("[" + who + "] disconnected");
        } catch (IOException e) {
            log("[" + who + "] io error: " + e);
        } finally {
            try { socket.close(); } catch (IOException ignored) {}
            log("[" + who + "] closed");
        }
    }

    /** Per-connection state machine. */
    private final class Session {
        final String who;
        final DataInputStream in;
        final OutputStream out;
        int seq = 1;
        boolean versionSeen = false;
        boolean loggedIn = false;
        int userId = -1;
        String login = "?";

        Session(String who, DataInputStream in, OutputStream out) {
            this.who = who; this.in = in; this.out = out;
        }

        void send(int channel, int family, int subtype, byte[] data) throws IOException {
            byte[] frame = Flap.frame(channel, seq++, family, subtype, data);
            Flap.send(out, frame);
            log("[" + who + "] S->C ch=" + channel + " family=" + family
                    + " subtype=" + subtype + " (" + (data == null ? 0 : data.length) + "B)");
        }

        void loop() throws IOException {
            // The server speaks first: the client waits for this hello and then
            // replies with its screen size and version.
            send(Flap.CH_SERVICE, FAM_SERVICE, SUB_HELLO, null);

            while (true) {
                Flap.Message m = Flap.read(in);
                log("[" + who + "] C->S " + m);
                dispatch(m);
            }
        }

        void dispatch(Flap.Message m) throws IOException {
            if (m.channel == Flap.CH_SERVICE) {
                dispatchService(m);
            } else if (m.channel == Flap.CH_GAME) {
                dispatchGame(m);
            } else {
                log("[" + who + "] ignoring unknown channel " + m.channel);
            }
        }

        void dispatchService(Flap.Message m) throws IOException {
            if (m.family == FAM_SERVICE && m.subtype == SUB_SCREEN) {
                if (m.data.length >= 4) {
                    log("[" + who + "] screen " + Flap.u16(m.data, 0) + "x" + Flap.u16(m.data, 2));
                }
            } else if (m.family == FAM_SERVICE && m.subtype == SUB_HELLO) {
                // Client version string, e.g. "28092009x3".
                log("[" + who + "] client version \"" + new String(m.data) + "\"");
                versionSeen = true;
                // Ask the client to show its login form.
                send(Flap.CH_SERVICE, FAM_AUTH, SUB_AUTH_FORM, null);
            } else if (m.family == FAM_AUTH && m.subtype == SUB_AUTH_SAVEDID) {
                log("[" + who + "] saved id " + (m.data.length >= 4 ? Flap.u32(m.data, 0) : "-"));
            } else if (m.family == FAM_AUTH && m.subtype == SUB_AUTH_LOGIN) {
                handleLogin(m);
            } else {
                log("[" + who + "] unhandled service family=" + m.family + " subtype=" + m.subtype);
                // If we haven't sent the login form yet and the client is idle,
                // send it so the user is never stuck on a blank screen.
                if (!versionSeen) {
                    send(Flap.CH_SERVICE, FAM_AUTH, SUB_AUTH_FORM, null);
                    versionSeen = true;
                }
            }
        }

        void handleLogin(Flap.Message m) throws IOException {
            List<Flap.Tlv> tlvs = m.tlvs();
            String user = "", pass = "";
            for (Flap.Tlv t : tlvs) {
                if (t.type == 1) user = Flap.decodeText(t.value);
                else if (t.type == 2) pass = Flap.decodeText(t.value);
            }
            login = user;
            // Auto-accept every login: create an account on the fly.  This is
            // what "just make the client run" needs; real credential checking
            // would live here.
            userId = USER_IDS.incrementAndGet();
            loggedIn = true;
            log("[" + who + "] login user=\"" + user + "\" pass=\"" + pass
                    + "\" -> userId=" + userId + " (accepted)");
            // Reply on fam4/sub5 with the 32-bit user id.  The client reads it
            // (g.c) and advances its session state to 3, which makes it send the
            // channel-2 "enter game" request.
            send(Flap.CH_SERVICE, FAM_AUTH, SUB_AUTH_LOGIN, Flap.u32Bytes(userId));
        }

        void dispatchGame(Flap.Message m) throws IOException {
            if (m.family == FAM_GAME && m.subtype == SUB_GAME_ENTER) {
                log("[" + who + "] enter-game request");
                // Tell the client to switch to the game canvas (class k reacts to
                // fam10/sub0 by making itself the current screen).
                send(Flap.CH_GAME, FAM_GAME, SUB_GAME_ENTER, null);
                if (sendResources) {
                    send(Flap.CH_GAME, FAM_GAME, SUB_GAME_RES, buildResources());
                }
                // Push the home map so the client renders a populated world
                // instead of its built-in default.
                send(Flap.CH_GAME, FAM_GAME, SUB_GAME_MAP, buildHomeMap());
                log("[" + who + "] user \"" + login + "\" is in the game world");
            } else {
                log("[" + who + "] game family=" + m.family + " subtype=" + m.subtype
                        + " (not implemented, ignored)");
            }
        }
    }

    /**
     * Build a fam10/sub1 home-map payload, parsed by k.a(d) case 10/1:
     *   TLV 8: mapId (0 = home 7x7)
     *   TLV 7: flag (1 = make this the current map)
     *   TLV 9: 49 bytes, building index per cell (row*7+col); -1 = empty.
     * Building indices match the client's c[] image array (0=castle,1=storage,
     * 3=barracks,4=market,5=farm,6=house,7=sawmill,8=quarry,9=ironmine,...).
     */
    private static byte[] buildHomeMap() {
        byte[] tiles = new byte[49];
        java.util.Arrays.fill(tiles, (byte) -1); // empty grass
        // row*7 + col
        tiles[3 * 7 + 3] = 0; // castle (center)
        tiles[3 * 7 + 2] = 1; // storage
        tiles[2 * 7 + 3] = 3; // barracks
        tiles[4 * 7 + 3] = 4; // market
        tiles[2 * 7 + 2] = 7; // sawmill (wood)
        tiles[4 * 7 + 4] = 8; // quarry (stone)
        tiles[2 * 7 + 4] = 9; // iron mine
        tiles[4 * 7 + 2] = 5; // farm (food)
        tiles[3 * 7 + 4] = 6; // house

        ByteArrayOutputStream data = new ByteArrayOutputStream();
        Flap.tlv(data, 8, new byte[] { 0 }); // mapId = home
        Flap.tlv(data, 7, new byte[] { 1 }); // flag i3 = 1 (current map)
        Flap.tlv(data, 9, tiles);            // tile/building array
        return data.toByteArray();
    }

    /**
     * Build a fam10/sub6 resource payload, parsed by k.d(d):
     *   TLV 10: 5 x u32  current stock  (p,q,r,s,t)
     *   TLV 11: 5 x u16  (u,v,w,x,y)
     *   TLV 12: 5 x u32  (z,A,B,C,D)
     */
    private static byte[] buildResources() {
        ByteArrayOutputStream stock = new ByteArrayOutputStream();
        long[] amounts = { 1000, 1000, 1000, 1000, 500 };
        for (long a : amounts) Flap.putU32(stock, a);

        ByteArrayOutputStream caps = new ByteArrayOutputStream();
        int[] cap = { 5000, 5000, 5000, 5000, 100 };
        for (int c : cap) Flap.putU16(caps, c);

        ByteArrayOutputStream rates = new ByteArrayOutputStream();
        long[] rate = { 10, 10, 10, 10, 1 };
        for (long r : rate) Flap.putU32(rates, r);

        ByteArrayOutputStream data = new ByteArrayOutputStream();
        Flap.tlv(data, 10, stock.toByteArray());
        Flap.tlv(data, 11, caps.toByteArray());
        Flap.tlv(data, 12, rates.toByteArray());
        return data.toByteArray();
    }

    static void log(String msg) {
        System.out.println("[" + System.currentTimeMillis() + "] " + msg);
    }
}
