package twk;

import java.io.ByteArrayOutputStream;
import java.io.DataInputStream;
import java.io.EOFException;
import java.io.IOException;
import java.io.OutputStream;
import java.util.ArrayList;
import java.util.List;

/**
 * Wire protocol of "Third World War of Kings 2D" (Fenix-Soft, 2009).
 *
 * The J2ME client talks an OSCAR/FLAP-style binary protocol over a raw TCP
 * socket ("socket://mmog1.com:2500").  This class reproduces exactly the
 * framing the client's own classes build and parse:
 *
 *   x.java / d.java  -> outer FLAP frame
 *   ab.java / g.java -> TLV records and big-endian integer helpers
 *
 * Frame layout (both directions):
 *
 *   offset 0      : 0x2A            marker (the client literally calls it "FLAP")
 *   offset 1      : channel (byte)  1 = login/service, 2 = game engine
 *   offset 2..3   : sequence (u16)  big-endian, informational
 *   offset 4..5   : length   (u16)  big-endian, number of payload bytes
 *   offset 6..    : payload         `length` bytes
 *
 * For every channel the client uses, the payload is a SNAC-like record:
 *
 *   payload[0..1] : family  (u16)
 *   payload[2..3] : subtype (u16)
 *   payload[4..]  : data
 *
 * `data` is usually a sequence of TLV records:  type(u16) len(u16) value[len].
 */
public final class Flap {

    public static final int MARKER = 0x2A;

    public static final int CH_SERVICE = 1; // login / handshake
    public static final int CH_GAME    = 2; // in-game engine (class k)

    private Flap() {}

    /** One decoded message from the client. */
    public static final class Message {
        public final int channel;
        public final int seq;
        public final int family;
        public final int subtype;
        public final byte[] data;

        Message(int channel, int seq, int family, int subtype, byte[] data) {
            this.channel = channel;
            this.seq = seq;
            this.family = family;
            this.subtype = subtype;
            this.data = data;
        }

        /** Parse the payload as TLV records (type -> value). */
        public List<Tlv> tlvs() {
            return Flap.parseTlvs(data);
        }

        @Override public String toString() {
            return "ch=" + channel + " family=" + family + " subtype=" + subtype
                    + " dataLen=" + data.length + " data=" + hex(data);
        }
    }

    /** A single TLV record. */
    public static final class Tlv {
        public final int type;
        public final byte[] value;
        Tlv(int type, byte[] value) { this.type = type; this.value = value; }
        @Override public String toString() { return "TLV(" + type + ", " + hex(value) + ")"; }
    }

    // ---- big-endian integer helpers (mirror of g.java) ----

    public static int u16(byte[] b, int off) {
        return ((b[off] << 8) & 0xFF00) | (b[off + 1] & 0xFF);
    }

    public static long u32(byte[] b, int off) {
        return ((long) (b[off]     & 0xFF) << 24)
             | ((long) (b[off + 1] & 0xFF) << 16)
             | ((long) (b[off + 2] & 0xFF) << 8)
             | ((long) (b[off + 3] & 0xFF));
    }

    static void putU16(ByteArrayOutputStream out, int v) {
        out.write((v >> 8) & 0xFF);
        out.write(v & 0xFF);
    }

    static void putU32(ByteArrayOutputStream out, long v) {
        out.write((int) ((v >> 24) & 0xFF));
        out.write((int) ((v >> 16) & 0xFF));
        out.write((int) ((v >> 8) & 0xFF));
        out.write((int) (v & 0xFF));
    }

    // ---- TLV building (mirror of ab.a) ----

    /** Append a TLV record: type(u16) len(u16) value[len]. */
    public static void tlv(ByteArrayOutputStream out, int type, byte[] value) {
        putU16(out, type);
        putU16(out, value.length);
        out.write(value, 0, value.length);
    }

    public static byte[] u16Bytes(int v) {
        ByteArrayOutputStream o = new ByteArrayOutputStream();
        putU16(o, v);
        return o.toByteArray();
    }

    public static byte[] u32Bytes(long v) {
        ByteArrayOutputStream o = new ByteArrayOutputStream();
        putU32(o, v);
        return o.toByteArray();
    }

    // ---- TLV parsing (mirror of ab.a / ab.b) ----

    public static List<Tlv> parseTlvs(byte[] data) {
        List<Tlv> out = new ArrayList<>();
        int i = 0;
        while (i + 4 <= data.length) {
            int type = u16(data, i);
            int len = u16(data, i + 2);
            if (i + 4 + len > data.length) break;
            byte[] value = new byte[len];
            System.arraycopy(data, i + 4, value, 0, len);
            out.add(new Tlv(type, value));
            i += 4 + len;
        }
        return out;
    }

    // ---- frame encode / decode ----

    /**
     * Build a complete FLAP frame carrying a SNAC record (family/subtype/data).
     */
    public static byte[] frame(int channel, int seq, int family, int subtype, byte[] data) {
        if (data == null) data = new byte[0];
        int payloadLen = 4 + data.length;
        ByteArrayOutputStream out = new ByteArrayOutputStream(6 + payloadLen);
        out.write(MARKER);
        out.write(channel & 0xFF);
        putU16(out, seq);
        putU16(out, payloadLen);
        putU16(out, family);
        putU16(out, subtype);
        out.write(data, 0, data.length);
        return out.toByteArray();
    }

    public static synchronized void send(OutputStream os, byte[] frame) throws IOException {
        os.write(frame);
        os.flush();
    }

    /**
     * Read one frame from the client stream.  Mirrors ag.run(): read the 6-byte
     * header, verify the marker, then read `length` payload bytes.
     */
    public static Message read(DataInputStream in) throws IOException {
        byte[] header = new byte[6];
        in.readFully(header);
        if ((header[0] & 0xFF) != MARKER) {
            throw new IOException("bad FLAP marker: " + (header[0] & 0xFF));
        }
        int channel = header[1] & 0xFF;
        int seq = u16(header, 2);
        int len = u16(header, 4);
        byte[] payload = new byte[len];
        if (len > 0) in.readFully(payload);

        int family = 0, subtype = 0;
        byte[] data = new byte[0];
        if (len >= 4) {
            family = u16(payload, 0);
            subtype = u16(payload, 2);
            data = new byte[len - 4];
            System.arraycopy(payload, 4, data, 0, len - 4);
        }
        return new Message(channel, seq, family, subtype, data);
    }

    public static String hex(byte[] b) {
        if (b == null) return "null";
        StringBuilder sb = new StringBuilder(b.length * 3);
        for (int i = 0; i < b.length; i++) {
            if (i > 0) sb.append(' ');
            String h = Integer.toHexString(b[i] & 0xFF);
            if (h.length() == 1) sb.append('0');
            sb.append(h);
        }
        return sb.toString();
    }

    /** Decode the client's CP1251-ish text bytes back to a Java String (mirror of g.b). */
    public static String decodeText(byte[] b) {
        StringBuilder sb = new StringBuilder(b.length);
        for (byte value : b) {
            int c = value & 0xFF;
            if (c >= 192 && c <= 255) sb.append((char) (c + 1040 - 192));
            else sb.append((char) c);
        }
        return sb.toString();
    }
}
