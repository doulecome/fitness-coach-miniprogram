#!/usr/bin/env python3
# 本地 HTTP 代理：把 git 的 HTTPS(CONNECT) 请求经 SOCKS5(127.0.0.1:7897) 隧道转发出去。
# 用法：python socks_http_proxy.py [listen_port] [socks_host] [socks_port]
# git 设置：git config http.proxy http://127.0.0.1:<listen_port>
import socket, threading, sys, struct, select

LISTEN_PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8899
SOCKS_HOST = sys.argv[2] if len(sys.argv) > 2 else '127.0.0.1'
SOCKS_PORT = int(sys.argv[3]) if len(sys.argv) > 3 else 7897


def socks5_connect(host, port):
    """通过 SOCKS5 代理建立到 (host,port) 的 TCP 隧道，返回 socket。"""
    s = socket.create_connection((SOCKS_HOST, SOCKS_PORT), timeout=15)
    # 握手：VERSION=5, 1 method, method=0(no auth)
    s.sendall(b'\x05\x01\x00')
    resp = s.recv(2)
    if len(resp) < 2 or resp[0] != 0x05:
        raise RuntimeError('SOCKS5 握手失败: %r' % resp)
    # 请求：VERSION=5, CMD=1(connect), RSV=0, ATYP=3(domain)
    if isinstance(host, str):
        hostb = host.encode('idna') if host.isascii() is False else host.encode('ascii')
    else:
        hostb = host
    req = b'\x05\x01\x00\x03' + bytes([len(hostb)]) + hostb + struct.pack('>H', port)
    s.sendall(req)
    # 完整读取 SOCKS5 应答，避免残留字节污染 TLS 流
    head = b''
    while len(head) < 4:
        chunk = s.recv(4 - len(head))
        if not chunk:
            raise RuntimeError('SOCKS5 应答截断')
        head += chunk
    if head[1] != 0x00:
        s.close()
        raise RuntimeError('SOCKS5 连接被拒: %r' % head)
    atyp = head[3]
    if atyp == 0x01:       # IPv4
        need = 4
    elif atyp == 0x04:     # IPv6
        need = 16
    elif atyp == 0x03:     # 域名
        l = s.recv(1)
        need = (l[0] if l else 0)
    else:
        s.close()
        raise RuntimeError('SOCKS5 未知 ATYP: %d' % atyp)
    # 读地址 + 2 字节端口，全部丢弃（仅用于建立隧道）
    remaining = need + 2
    while remaining > 0:
        chunk = s.recv(remaining)
        if not chunk:
            break
        remaining -= len(chunk)
    return s


def pipe(a, b):
    try:
        while True:
            r, _, _ = select.select([a, b], [], [], 60)
            if not r:
                break
            for src, dst in ((a, b), (b, a)):
                if src in r:
                    data = src.recv(65536)
                    if not data:
                        return
                    dst.sendall(data)
    except OSError:
        pass
    finally:
        try: a.close()
        except OSError: pass
        try: b.close()
        except OSError: pass


def handle(client):
    try:
        client.settimeout(15)
        req = b''
        while b'\r\n\r\n' not in req:
            chunk = client.recv(4096)
            if not chunk:
                return
            req += chunk
            if len(req) > 65536:
                return
        header, _, _ = req.partition(b'\r\n\r\n')
        line = header.split(b'\r\n')[0].decode('ascii')
        method, target, ver = line.split()
        if method.upper() == 'CONNECT':
            host, _, port = target.partition(':')
            port = int(port) if port else 443
            try:
                remote = socks5_connect(host, port)
            except Exception as e:
                client.sendall(b'HTTP/1.1 502 Bad Gateway\r\n\r\n')
                print('[proxy] CONNECT %s:%d 失败: %s' % (host, port, e))
                return
            client.sendall(b'HTTP/1.1 200 Connection Established\r\n\r\n')
            pipe(client, remote)
        else:
            # 普通 HTTP（git 走 https 基本用不到，做简单转发以便完整）
            client.sendall(b'HTTP/1.1 405 Method Not Allowed\r\n\r\n')
    except Exception as e:
        print('[proxy] 处理异常: %s' % e)
    finally:
        try: client.close()
        except OSError: pass


def main():
    srv = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    srv.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    srv.bind(('127.0.0.1', LISTEN_PORT))
    srv.listen(128)
    print('[proxy] SOCKS5 HTTP 代理已启动: 127.0.0.1:%d -> SOCKS5 %s:%d' % (LISTEN_PORT, SOCKS_HOST, SOCKS_PORT))
    sys.stdout.flush()
    while True:
        try:
            c, _ = srv.accept()
        except KeyboardInterrupt:
            break
        t = threading.Thread(target=handle, args=(c,), daemon=True)
        t.start()


if __name__ == '__main__':
    main()
