const fs = require("fs");
const path = require("path");

const DEFAULT_HIDDEN_FLAG = "FLAG{w3lc0m3_t0_th3_m4tr1x}";

function buildSetupScript() {
    return [
        "set -eu",
        "mkdir -p /home/ctf/workspace /home/ctf/challenges/level1 /home/ctf/challenges/level2 /home/ctf/challenges/level3 /home/ctf/tools",
        "touch /home/ctf/workspace/.gitkeep",
        "cat > /home/ctf/README.txt <<'EOF'",
        "Welcome to the CTF terminal.",
        "",
        "Rules:",
        "1. Work inside /home/ctf/workspace for your own notes and outputs.",
        "2. Challenge files live under /home/ctf/challenges/.",
        "3. Use Linux tooling (ls -la, cat, file, xxd, tar, python3) to recover flags.",
        "EOF",
        "cat > /home/ctf/.hidden_flag <<'EOF'",
        DEFAULT_HIDDEN_FLAG,
        "EOF",
        "cat > /home/ctf/challenges/level1/instructions.txt <<'EOF'",
        "QmFzZTY0IGhpbnQ6IGRlY29kZSB0aGlzLCB0aGVuIGFwcGx5IENhZXNhciAtMyB0byB0aGUgY2lwaGVyIHRleHQu",
        "EOF",
        "cat > /home/ctf/challenges/level1/cipher.txt <<'EOF'",
        "iodjv duh riwhq klgghq lq sodlq vljkw",
        "EOF",
        "cat > /home/ctf/challenges/level1/.secret <<'EOF'",
        "FLAG{l3v3l1_h1dd3n_",
        "EOF",
        "echo '464c41477b6865785f69735f616c736f5f66756e7d' | tr -d '\\n' | xxd -r -p > /home/ctf/challenges/level2/binary_data.bin",
        "python3 - <<'PY'",
        "data = b'FLAG{xor_can_be_reversed}'",
        "key = 23",
        "encoded = bytes([byte ^ key for byte in data])",
        "with open('/home/ctf/challenges/level2/decode_me.txt', 'wb') as f:",
        "    f.write(encoded)",
        "PY",
        "mkdir -p /home/ctf/challenges/level3/payload/deep",
        "cat > /home/ctf/challenges/level3/payload/deep/flag.txt <<'EOF'",
        "FLAG{t4r_w4s_n0t_th3_end}",
        "EOF",
        "tar -czf /home/ctf/challenges/level3/archive.tar.gz -C /home/ctf/challenges/level3 payload",
        "rm -rf /home/ctf/challenges/level3/payload",
        "cat > /home/ctf/challenges/level3/hint.txt <<'EOF'",
        "Hint: archive.tar.gz contains another directory tree. Extract and keep digging.",
        "EOF",
        "cat > /home/ctf/tools/decoder.py <<'PY'",
        "#!/usr/bin/env python3",
        "import argparse",
        "import base64",
        "",
        "def caesar_decode(text: str, shift: int) -> str:",
        "    out = []",
        "    for ch in text:",
        "        if 'a' <= ch <= 'z':",
        "            out.append(chr((ord(ch) - ord('a') - shift) % 26 + ord('a')))",
        "        elif 'A' <= ch <= 'Z':",
        "            out.append(chr((ord(ch) - ord('A') - shift) % 26 + ord('A')))",
        "        else:",
        "            out.append(ch)",
        "    return ''.join(out)",
        "",
        "def xor_decode(raw: bytes, key: int) -> bytes:",
        "    return bytes([b ^ key for b in raw])",
        "",
        "def main() -> None:",
        "    parser = argparse.ArgumentParser(description='CTF helper decoder')",
        "    parser.add_argument('--base64', help='Decode base64 text')",
        "    parser.add_argument('--caesar', help='Decode Caesar text with --shift')",
        "    parser.add_argument('--shift', type=int, default=3)",
        "    parser.add_argument('--xor-file', help='Path of XOR encoded file')",
        "    parser.add_argument('--key', type=int, default=23)",
        "    args = parser.parse_args()",
        "",
        "    if args.base64:",
        "        print(base64.b64decode(args.base64).decode('utf-8', errors='ignore'))",
        "    if args.caesar:",
        "        print(caesar_decode(args.caesar, args.shift))",
        "    if args.xor_file:",
        "        with open(args.xor_file, 'rb') as f:",
        "            decoded = xor_decode(f.read(), args.key)",
        "        print(decoded.decode('utf-8', errors='ignore'))",
        "",
        "if __name__ == '__main__':",
        "    main()",
        "PY",
        "chmod +x /home/ctf/tools/decoder.py",
        "cat > /home/ctf/tools/README.md <<'EOF'",
        "Tooling:",
        "- python3 decoder.py --base64 \"<text>\"",
        "- python3 decoder.py --caesar \"<text>\" --shift 3",
        "- python3 decoder.py --xor-file /home/ctf/challenges/level2/decode_me.txt --key 23",
        "EOF",
        "grep -qxF 'export PS1=\"\\\\u@\\\\h:\\\\w\\\\$ \"' /root/.bashrc || echo 'export PS1=\"\\\\u@\\\\h:\\\\w\\\\$ \"' >> /root/.bashrc",
        "grep -qxF 'export TERM=xterm-256color' /root/.bashrc || echo 'export TERM=xterm-256color' >> /root/.bashrc",
        "grep -qxF 'alias ll=\"ls -la\"' /root/.bashrc || echo 'alias ll=\"ls -la\"' >> /root/.bashrc",
        "grep -qxF 'alias cls=\"clear\"' /root/.bashrc || echo 'alias cls=\"clear\"' >> /root/.bashrc"
    ].join("\n");
}

function writeFileIfMissing(targetPath, content, encoding = "utf8") {
    if (!fs.existsSync(targetPath)) {
        fs.writeFileSync(targetPath, content, encoding);
    }
}

function ensureDir(dirPath) {
    fs.mkdirSync(dirPath, { recursive: true });
}

function seedHostWorkspace(workspaceDir) {
    const level1Dir = path.join(workspaceDir, "challenges", "level1");
    const level2Dir = path.join(workspaceDir, "challenges", "level2");
    const level3Dir = path.join(workspaceDir, "challenges", "level3");
    const toolsDir = path.join(workspaceDir, "tools");

    ensureDir(path.join(workspaceDir, "workspace"));
    ensureDir(level1Dir);
    ensureDir(level2Dir);
    ensureDir(level3Dir);
    ensureDir(toolsDir);

    writeFileIfMissing(path.join(workspaceDir, "README.txt"), "CTF fallback workspace (host mode).\n");
    writeFileIfMissing(path.join(workspaceDir, ".hidden_flag"), `${DEFAULT_HIDDEN_FLAG}\n`);
    writeFileIfMissing(path.join(workspaceDir, "workspace", ".gitkeep"), "");
    writeFileIfMissing(path.join(level1Dir, "instructions.txt"), "QmFzZTY0IGRlY29kZSBoaW50LiBUaGVuIHVzZSBDYWVzYXIu\n");
    writeFileIfMissing(path.join(level1Dir, "cipher.txt"), "iodjv duh riwhq klgghq lq sodlq vljkw\n");
    writeFileIfMissing(path.join(level1Dir, ".secret"), "FLAG{l3v3l1_h1dd3n_\n");

    const binaryDataPath = path.join(level2Dir, "binary_data.bin");
    if (!fs.existsSync(binaryDataPath)) {
        fs.writeFileSync(binaryDataPath, Buffer.from("464c41477b6865785f69735f616c736f5f66756e7d", "hex"));
    }

    const xorPath = path.join(level2Dir, "decode_me.txt");
    if (!fs.existsSync(xorPath)) {
        const source = Buffer.from("FLAG{xor_can_be_reversed}", "utf8");
        const encoded = Buffer.from(source.map((byte) => byte ^ 23));
        fs.writeFileSync(xorPath, encoded);
    }

    writeFileIfMissing(path.join(level3Dir, "archive.tar.gz"), "fallback archive placeholder\n");
    writeFileIfMissing(path.join(level3Dir, "hint.txt"), "Hint: Use tar extraction recursively in Docker mode.\n");
    writeFileIfMissing(path.join(toolsDir, "decoder.py"), "#!/usr/bin/env python3\nprint('Use Docker mode for full toolset')\n");
    writeFileIfMissing(path.join(toolsDir, "README.md"), "Fallback mode has limited tooling.\n");
}

module.exports = {
    buildSetupScript,
    seedHostWorkspace
};
