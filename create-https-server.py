#!/usr/bin/env python3
import http.server
import ssl
import socketserver
import os
from pathlib import Path

# Create self-signed certificate for HTTPS
def create_certificate():
    cert_file = 'cert.pem'
    key_file = 'key.pem'
    
    if not os.path.exists(cert_file) or not os.path.exists(key_file):
        print("Creating self-signed certificate...")
        os.system(f"""
openssl req -new -x509 -keyout {key_file} -out {cert_file} -days 365 -nodes \
-subj "/C=US/ST=CA/L=SF/O=AR-Hotel/CN=localhost"
        """)
        print(f"Certificate created: {cert_file}, {key_file}")
    
    return cert_file, key_file

# Find free port
def find_free_port():
    import socket
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(('', 0))
        s.listen(1)
        port = s.getsockname()[1]
    return port

class CORSHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.send_header('Cross-Origin-Embedder-Policy', 'require-corp')
        self.send_header('Cross-Origin-Opener-Policy', 'same-origin')
        super().end_headers()

    def guess_type(self, path):
        mimetype = super().guess_type(path)
        if path.endswith('.glb'):
            return ('model/gltf-binary', None)
        if path.endswith('.usdz'):
            return ('model/vnd.usdz+zip', None)
        return mimetype

PORT = find_free_port()

# Change to script directory
os.chdir(os.path.dirname(os.path.abspath(__file__)))

# Create certificate
cert_file, key_file = create_certificate()

# Create HTTPS server
httpd = socketserver.TCPServer(("", PORT), CORSHTTPRequestHandler)

# Add SSL
context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
context.load_cert_chain(cert_file, key_file)
httpd.socket = context.wrap_socket(httpd.socket, server_side=True)

print(f"HTTPS Server running at https://localhost:{PORT}/")
print(f"Access from Quest at https://[YOUR-COMPUTER-IP]:{PORT}/")
print("Note: You'll need to accept the self-signed certificate warning")
print("\nPress Ctrl+C to stop")

try:
    httpd.serve_forever()
except KeyboardInterrupt:
    print("\nServer stopped")
    httpd.shutdown()