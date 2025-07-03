#!/usr/bin/env python3
"""
Simple HTTPS server for Quest 3 WebXR
No external dependencies - uses Python built-ins
"""
import http.server
import ssl
import socketserver
import tempfile
import os
from pathlib import Path

def create_temp_cert():
    """Create a temporary self-signed certificate"""
    import subprocess
    import tempfile
    
    temp_dir = tempfile.mkdtemp()
    cert_file = os.path.join(temp_dir, 'cert.pem')
    key_file = os.path.join(temp_dir, 'key.pem')
    
    # Create self-signed certificate
    cmd = [
        'openssl', 'req', '-x509', '-newkey', 'rsa:4096',
        '-keyout', key_file, '-out', cert_file,
        '-days', '365', '-nodes',
        '-subj', '/CN=localhost'
    ]
    
    try:
        subprocess.run(cmd, check=True, capture_output=True)
        return cert_file, key_file
    except (subprocess.CalledProcessError, FileNotFoundError):
        print("OpenSSL not found. Please use one of the online options:")
        print("1. Netlify Drop: https://app.netlify.com/drop")
        print("2. GitHub Pages: Create repo and enable Pages")
        print("3. Vercel: https://vercel.com")
        return None, None

class HTTPSHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cross-Origin-Embedder-Policy', 'require-corp')
        self.send_header('Cross-Origin-Opener-Policy', 'same-origin')
        super().end_headers()

PORT = 8443  # Standard HTTPS port alternative

# Change to AR directory
os.chdir(os.path.dirname(os.path.abspath(__file__)))

print("🔐 Setting up HTTPS server for Quest 3...")
print("Note: This creates a self-signed certificate")
print("Your Quest will show a security warning - click 'Advanced' and 'Proceed'")
print()

cert_file, key_file = create_temp_cert()

if cert_file and key_file:
    # Create HTTPS server
    with socketserver.TCPServer(("", PORT), HTTPSHandler) as httpd:
        context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        context.load_cert_chain(cert_file, key_file)
        httpd.socket = context.wrap_socket(httpd.socket, server_side=True)
        
        print(f"✅ HTTPS Server running!")
        print(f"🖥️  Computer: https://localhost:{PORT}/")
        print(f"🥽 Quest 3: https://192.168.0.107:{PORT}/quest-auto.html")
        print()
        print("⚠️  On Quest 3:")
        print("   1. You'll see 'Not Secure' warning")
        print("   2. Tap 'Advanced'")
        print("   3. Tap 'Proceed to 192.168.0.107 (unsafe)'")
        print("   4. Then WebXR will work!")
        print()
        print("Press Ctrl+C to stop")
        
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n🛑 Server stopped")
else:
    print("❌ Could not create HTTPS certificate")
    print("Please use one of these free online options instead:")
    print()
    print("🌐 EASIEST: Netlify Drop")
    print("   1. Go to: https://app.netlify.com/drop")
    print("   2. Drag your AR folder onto the page")
    print("   3. Get instant HTTPS link")
    print()
    print("📱 GitHub Pages")
    print("   1. Upload folder to GitHub")
    print("   2. Enable Pages in repo settings")
    print("   3. Access via: https://username.github.io/repo-name")