package twk;

import java.io.ByteArrayOutputStream;
import java.io.DataInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.ServerSocket;
import java.net.Socket;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

/**
 * Capture/probe server for the Android build of Third World War of Kings
 * (ThirdWorld.apk), which connects to socket://mmog1.com:5005 with a NEW,
 * type-dispatched protocol (1 type byte -> handler), different from the 2009
 * J2ME FLAP protocol on port 2500.
 *
 * Purpose: point the (slightly modified) APK at this server and record exactly
 * what it sends, so the protocol can be reconstructed from real traffic.
 *
 *   - Every byte received is printed as an offset/hex/ASCII dump and, if
 *     --dump is given, appended raw to a file you can send back for analysis.
 *   - Optionally replays a scripted response (--reply=<hexfile>) so we can probe
 *     the handshake step by step: the server can speak first (--reply-on-connect)
 *     or answer after each client burst.
 *
 * Hex script format (--reply file): whitespace/newline separated hex bytes,
 * '#' starts a comment. Example:  "2a 01 00 01 00 04 00 01 00 00".
 */
public final class CaptureServer {

    public static void main(String[] args) throws IOException {
        int port = 5005;
        Path dumpFile = null;
        byte[] reply = null;
        boolean replyOnConnect = false;

        for (String a : args) {
            if (a.startsWith("--port=")) port = Integer.parseInt(a.substring(7));
            else if (a.startsWith("--dump=")) dumpFile = Path.of(a.substring(7));
            else if (a.startsWith("--reply=")) reply = readHexFile(a.substring(8));
            else if (a.equals("--reply-on-connect")) replyOnConnect = true;
        }

        try (ServerSocket server = new ServerSocket(port)) {
            log("Capture server listening on 0.0.0.0:" + port);
            log("Point the (modified) APK's host at this machine. Every byte the");
            log("client sends will be dumped here" + (dumpFile != null ? " and appended to " + dumpFile : "") + ".");
            if (reply != null) log("Loaded " + reply.length + "B reply script"
                    + (replyOnConnect ? " (sent on connect)" : " (sent after first client data)"));
            final byte[] fReply = reply;
            final boolean fOnConnect = replyOnConnect;
            final Path fDump = dumpFile;
            while (true) {
                Socket socket = server.accept();
                Thread t = new Thread(() -> handle(socket, fReply, fOnConnect, fDump));
                t.setDaemon(true);
                t.start();
            }
        }
    }

    private static void handle(Socket socket, byte[] reply, boolean replyOnConnect, Path dumpFile) {
        String who = socket.getInetAddress().getHostAddress() + ":" + socket.getPort();
        log("========== [" + who + "] CONNECTED ==========");
        try {
            socket.setTcpNoDelay(true);
            InputStream in = socket.getInputStream();
            OutputStream out = socket.getOutputStream();

            if (reply != null && replyOnConnect) {
                out.write(reply); out.flush();
                log("[" + who + "] >>> sent " + reply.length + "B reply on connect: " + Flap.hex(reply));
            }

            byte[] buf = new byte[4096];
            boolean repliedAfterData = false;
            long totalOffset = 0;
            int n;
            while ((n = in.read(buf)) != -1) {
                byte[] chunk = new byte[n];
                System.arraycopy(buf, 0, chunk, 0, n);
                log("[" + who + "] <<< received " + n + " bytes (stream offset " + totalOffset + "):");
                System.out.print(hexDump(chunk, totalOffset));
                System.out.flush();
                totalOffset += n;
                if (dumpFile != null) appendRaw(dumpFile, chunk);

                if (reply != null && !replyOnConnect && !repliedAfterData) {
                    out.write(reply); out.flush();
                    repliedAfterData = true;
                    log("[" + who + "] >>> sent " + reply.length + "B reply: " + Flap.hex(reply));
                }
            }
            log("========== [" + who + "] DISCONNECTED (EOF) ==========");
        } catch (IOException e) {
            log("[" + who + "] io: " + e);
        } finally {
            try { socket.close(); } catch (IOException ignored) {}
        }
    }

    private static synchronized void appendRaw(Path file, byte[] data) {
        try (FileOutputStream fos = new FileOutputStream(file.toFile(), true)) {
            fos.write(data);
        } catch (IOException e) {
            log("dump write failed: " + e);
        }
    }

    /** Classic offset | hex | ascii dump, 16 bytes per row. */
    static String hexDump(byte[] data, long baseOffset) {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < data.length; i += 16) {
            sb.append(String.format("  %08x  ", baseOffset + i));
            StringBuilder ascii = new StringBuilder();
            for (int j = 0; j < 16; j++) {
                if (i + j < data.length) {
                    int b = data[i + j] & 0xFF;
                    sb.append(String.format("%02x ", b));
                    ascii.append(b >= 32 && b < 127 ? (char) b : '.');
                } else {
                    sb.append("   ");
                }
                if (j == 7) sb.append(' ');
            }
            sb.append(" |").append(ascii).append("|\n");
        }
        return sb.toString();
    }

    static byte[] readHexFile(String path) throws IOException {
        String text = Files.readString(Path.of(path));
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        for (String tokenRaw : text.split("\\s+|,")) {
            String token = tokenRaw.trim();
            if (token.isEmpty()) continue;
            if (token.startsWith("#")) continue;
            if (token.startsWith("0x")) token = token.substring(2);
            if (token.length() == 2) out.write(Integer.parseInt(token, 16));
        }
        return out.toByteArray();
    }

    static void log(String msg) {
        System.out.println("[" + System.currentTimeMillis() + "] " + msg);
    }
}
