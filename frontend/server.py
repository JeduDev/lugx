#!/usr/bin/env python3
"""
Servidor HTTP simple con CORS habilitado para desarrollo
Uso: python server.py [puerto]
"""

import http.server
import socketserver
import sys
from urllib.parse import urlparse

class CORSRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

def run_server(port=8000):
    try:
        with socketserver.TCPServer(("", port), CORSRequestHandler) as httpd:
            print(f"🚀 Servidor iniciado en http://localhost:{port}")
            print(f"📁 Sirviendo archivos desde: {httpd.server_address}")
            print("🔗 Panel de administración: http://localhost:{}/panel/".format(port))
            print("⏹️  Presiona Ctrl+C para detener el servidor")
            httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n🛑 Servidor detenido")
    except OSError as e:
        if e.errno == 98:
            print(f"❌ Error: El puerto {port} ya está en uso")
            print(f"💡 Intenta con otro puerto: python server.py {port + 1}")
        else:
            print(f"❌ Error: {e}")

if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    run_server(port)