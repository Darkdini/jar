package twk;

import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.ServerSocket;
import java.net.Socket;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Man-in-the-middle sniffing proxy for the Android build of
 * "Third World War of Kings" (ThirdWorld.apk).
 *
 * The APK connects to socket://mmog1.com:5005. Point it at THIS proxy instead;
 * the proxy relays every byte to the real upstream server and logs the whole
 * conversation in both directions. That yields the real, complete protocol —
 * far better than guessing statically or answering blind.
 *
 * Run it on a machine with normal internet (your PC), because it needs to reach
 * the real mmog1.com:5005.
 *
 *   java -cp out twk.ProxyServer --port=5005 --upstream=mmog1.com:5005 --dump=cap
 *
 * Writes:
 *   cap.<conn>.c2s.bin   raw bytes client -> server
 *   cap.<conn>.s2c.bin   raw bytes server -> client
 * and prints a merged, timestamped hex-dump timeline (C->S / S->C) to stdout.
 *
 * If mmog1 is down, pass --upstream=mmog2.com:5005.
 */
public final class ProxyServer {

    private static final AtomicInteger CONN = new AtomicInteger();

    public static void main(String[] args) throws IOException {
        int listenPort = 5005;
        String upHost = "mmog1.com";
        int upPort = 5005;
        String dumpPrefix = null;

        for (String a : args) {
            if (a.startsWith("--port=")) listenPort = Integer.parseInt(a.substring(7));
            else if (a.startsWith("--upstream=")) {
                String v = a.substring(11);
                int c = v.lastIndexOf(':');
                upHost = v.substring(0, c);
                upPort = Integer.parseInt(v.substring(c + 1));
            } else if (a.startsWith("--dump=")) dumpPrefix = a.substring(7);
        }

        final String fUpHost = upHost;
        final int fUpPort = upPort;
        final String fDump = dumpPrefix;

        try (ServerSocket server = new ServerSocket(listenPort)) {
            log("Proxy listening on 0.0.0.0:" + listenPort
                    + "  ->  upstream " + upHost + ":" + upPort);
            log("Point the (modified) APK's host at this machine.");
            while (true) {
                Socket client = server.accept();
                Thread t = new Thread(() -> handle(client, fUpHost, fUpPort, fDump));
                t.setDaemon(true);
                t.start();
            }
        }
    }

    private static void handle(Socket client, String upHost, int upPort, String dumpPrefix) {
        int id = CONN.incrementAndGet();
        String who = client.getInetAddress().getHostAddress() + ":" + client.getPort();
        log("== conn#" + id + " [" + who + "] connecting to upstream " + upHost + ":" + upPort + " ==");
        Socket upstream = null;
        try {
            client.setTcpNoDelay(true);
            upstream = new Socket(upHost, upPort);
            upstream.setTcpNoDelay(true);
            log("== conn#" + id + " upstream connected ==");

            OutputStream c2sDump = dumpPrefix != null
                    ? new FileOutputStream(dumpPrefix + "." + id + ".c2s.bin") : null;
            OutputStream s2cDump = dumpPrefix != null
                    ? new FileOutputStream(dumpPrefix + "." + id + ".s2c.bin") : null;

            Socket up = upstream;
            Thread c2s = new Thread(() -> pump(id, "C->S", client, up, c2sDump));
            Thread s2c = new Thread(() -> pump(id, "S->C", up, client, s2cDump));
            c2s.start();
            s2c.start();
            c2s.join();
            s2c.join();
        } catch (Exception e) {
            log("conn#" + id + " error: " + e);
        } finally {
            closeQuietly(client);
            closeQuietly(upstream);
            log("== conn#" + id + " closed ==");
        }
    }

    /** Copy from in->out, logging every chunk (hex dump) and mirroring to dump. */
    private static void pump(int id, String dir, Socket in, Socket out, OutputStream dump) {
        try {
            InputStream is = in.getInputStream();
            OutputStream os = out.getOutputStream();
            byte[] buf = new byte[8192];
            long offset = 0;
            int n;
            while ((n = is.read(buf)) != -1) {
                os.write(buf, 0, n);
                os.flush();
                byte[] chunk = new byte[n];
                System.arraycopy(buf, 0, chunk, 0, n);
                synchronized (ProxyServer.class) {
                    log("conn#" + id + " " + dir + "  " + n + " bytes (offset " + offset + "):");
                    System.out.print(CaptureServer.hexDump(chunk, offset));
                    System.out.flush();
                }
                if (dump != null) { dump.write(chunk); dump.flush(); }
                offset += n;
            }
        } catch (IOException e) {
            // peer closed; normal at end of session
        } finally {
            if (dump != null) try { dump.close(); } catch (IOException ignored) {}
            // closing one side ends the other pump too
            try { in.shutdownInput(); } catch (IOException ignored) {}
            try { out.shutdownOutput(); } catch (IOException ignored) {}
        }
    }

    private static void closeQuietly(Socket s) {
        if (s != null) try { s.close(); } catch (IOException ignored) {}
    }

    static void log(String msg) {
        System.out.println("[" + System.currentTimeMillis() + "] " + msg);
    }
}
