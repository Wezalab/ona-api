#!/usr/bin/env python3
"""Re-deploy with fixed Dockerfile (npm install instead of npm ci)."""
import os, sys, tarfile, io
import paramiko

HOST     = "46.202.168.1"
USER     = "root"
PASSWORD = "Ch4ng3m32025?"
APP_DIR  = "/opt/ona-api"
LOCAL_SRC = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

EXCLUDE = {"node_modules", ".git", "dist", "coverage", "deploy", "__pycache__"}

def run(ssh, cmd, timeout=300):
    print(f"  $ {cmd[:100]}{'…' if len(cmd)>100 else ''}")
    _, stdout, stderr = ssh.exec_command(cmd, timeout=timeout, get_pty=True)
    out = stdout.read().decode(errors="replace")
    err = stderr.read().decode(errors="replace")
    rc  = stdout.channel.recv_exit_status()
    if out.strip(): print(out.strip())
    if err.strip() and rc != 0: print("ERR:", err.strip(), file=sys.stderr)
    return rc, out, err

def make_tarball():
    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode="w:gz") as tar:
        for root, dirs, files in os.walk(LOCAL_SRC):
            dirs[:] = [d for d in dirs if d not in EXCLUDE]
            for f in files:
                path = os.path.join(root, f)
                arcname = os.path.relpath(path, LOCAL_SRC)
                tar.add(path, arcname=arcname)
    return buf.getvalue()

def main():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    print(f"Connecting to {HOST}…")
    ssh.connect(HOST, username=USER, password=PASSWORD, timeout=15)
    print("Connected.")

    # Upload updated source (includes fixed Dockerfile)
    print("Uploading source…")
    tarball = make_tarball()
    sftp = ssh.open_sftp()
    sftp.putfo(io.BytesIO(tarball), f"{APP_DIR}/src.tar.gz")
    sftp.close()
    run(ssh, f"cd {APP_DIR} && tar -xzf src.tar.gz --strip-components=0 && rm src.tar.gz")

    # Rebuild and restart
    print("Rebuilding docker image…")
    run(ssh, f"cd {APP_DIR} && docker compose up -d --build 2>&1", timeout=600)
    print("Done.")
    run(ssh, f"cd {APP_DIR} && docker compose ps")
    ssh.close()

if __name__ == "__main__":
    main()
