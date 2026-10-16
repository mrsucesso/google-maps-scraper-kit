"""Small persistent, sequential website email enrichment service (stdlib only)."""
import csv, http.client, io, ipaddress, json, os, re, socket, ssl, threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit, urljoin, unquote
from urllib.request import urlopen
from html.parser import HTMLParser

ROOT = Path(os.environ.get('ENRICHMENT_DATA', '/data'))
BASE = os.environ.get('SCRAPER_URL', 'http://google-maps-scraper:8080')
LOCK = threading.Lock()
BUSY = threading.Lock()
ID = re.compile(r'^[a-f0-9-]{36}$')
EMAIL = re.compile(r'[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}', re.I)


def source(job):
    if not ID.fullmatch(job):
        raise ValueError('Busca inválida')
    with urlopen(f'{BASE}/api/v1/jobs/{job}/download', timeout=20) as r:
        return list(csv.DictReader(io.StringIO(r.read(20_000_000).decode('utf-8-sig'))))


def read(job):
    with LOCK:
        p = ROOT / f'{job}.json'
        return json.loads(p.read_text()) if p.exists() else {'status': 'idle', 'done': 0, 'total': 0, 'rows': {}}


def save(job, data):
    with LOCK:
        ROOT.mkdir(parents=True, exist_ok=True)
        p = ROOT / f'{job}.json'
        tmp = p.with_suffix('.tmp')
        tmp.write_text(json.dumps(data, ensure_ascii=False))
        tmp.replace(p)


def public_target(url):
    u = urlsplit(url)
    if u.scheme not in ('http', 'https') or not u.hostname or u.username or u.password:
        raise ValueError('Endereço de site inválido')
    port = u.port or (443 if u.scheme == 'https' else 80)
    if port not in (80, 443):
        raise ValueError('Porta não permitida')
    ips = list(dict.fromkeys(x[4][0] for x in socket.getaddrinfo(u.hostname, port, type=socket.SOCK_STREAM)))
    if not ips or any(not ipaddress.ip_address(ip).is_global for ip in ips):
        raise ValueError('Site deve usar endereço público')
    return u, port, ips[0]


class PinnedTLS(http.client.HTTPSConnection):
    def __init__(self, host, port, ip):
        super().__init__(host, port, timeout=8, context=ssl.create_default_context())
        self.ip = ip

    def connect(self):
        self.sock = self._context.wrap_socket(socket.create_connection((self.ip, self.port), self.timeout), server_hostname=self.host)


def fetch(url):
    for _ in range(4):
        u, port, ip = public_target(url)
        conn = PinnedTLS(u.hostname, port, ip) if u.scheme == 'https' else http.client.HTTPConnection(ip, port, timeout=8)
        try:
            conn.request('GET', (u.path or '/') + ('?' + u.query if u.query else ''), headers={'Host': u.hostname, 'User-Agent': 'MapsScraperKit/1.0 contact-discovery', 'Accept': 'text/html'})
            r = conn.getresponse()
            if r.status in (301, 302, 303, 307, 308):
                url = urljoin(url, r.getheader('Location', ''))
                continue
            if r.status != 200 or 'text/html' not in r.getheader('Content-Type', ''):
                raise ValueError(f'Site indisponível (HTTP {r.status})')
            return url, r.read(1_000_000).decode('utf-8', 'replace')
        finally:
            conn.close()
    raise ValueError('Redirecionamentos demais')


class Links(HTMLParser):
    def __init__(self):
        super().__init__(); self.links = []

    def handle_starttag(self, tag, attrs):
        if tag == 'a':
            self.links.extend(v for k, v in attrs if k == 'href' and v)


def find_emails(site):
    if not site.startswith(('https://', 'http://')):
        site = 'https://' + site
    final, html = fetch(site)
    parser = Links(); parser.feed(html)
    texts = [html]
    contacts = []
    for link in parser.links:
        target = urljoin(final, link)
        if urlsplit(target).hostname == urlsplit(final).hostname and re.search(r'contat|contact|sobre|about', urlsplit(target).path, re.I) and target not in contacts:
            contacts.append(target)
    for link in contacts[:2]:
        try:
            texts.append(fetch(link)[1])
        except (OSError, ValueError, http.client.HTTPException):
            pass
    emails = {e.lower() for e in EMAIL.findall(unquote('\n'.join(texts))) if not e.lower().endswith(('.png', '.jpg', '.jpeg', '.webp', '.svg'))}
    return sorted(emails)


def work(job, rows, indices):
    try:
        data = read(job)
        for i in indices:
            row = rows[i]
            old = data['rows'].get(str(i), {})
            try:
                if not row.get('website'):
                    result = {'emails': old.get('emails', row.get('emails', '')), 'status': 'Sem site informado'}
                else:
                    found = find_emails(row['website'])
                    existing = EMAIL.findall(old.get('emails', '') + ' ' + row.get('emails', ''))
                    result = {'emails': ', '.join(sorted(set(existing + found))), 'status': 'E-mail encontrado' if found else 'Nenhum e-mail público encontrado'}
            except Exception:
                result = {'emails': old.get('emails', row.get('emails', '')), 'status': 'Não foi possível acessar o site; tente novamente'}
            data['rows'][str(i)] = result
            data['done'] += 1
            save(job, data)
        data['status'] = 'done'
        save(job, data)
    finally:
        BUSY.release()


class Handler(BaseHTTPRequestHandler):
    def reply(self, status, data):
        raw = json.dumps(data, ensure_ascii=False).encode()
        self.send_response(status); self.send_header('Content-Type', 'application/json; charset=utf-8'); self.send_header('Content-Length', str(len(raw))); self.send_header('Cache-Control', 'no-store'); self.end_headers(); self.wfile.write(raw)

    def do_GET(self):
        job = self.path.split('/')[-1]
        if not ID.fullmatch(job):
            return self.reply(400, {'error': 'Busca inválida'})
        data = read(job)
        if data['status'] == 'working' and not BUSY.locked():
            data['status'] = 'interrupted'; save(job, data)
        self.reply(200, data)

    def do_POST(self):
        job = self.path.split('/')[-1]
        if not ID.fullmatch(job):
            return self.reply(400, {'error': 'Busca inválida'})
        # Browser mutations must be same-origin; no CORS, no cross-site form posts.
        origin = self.headers.get('Origin', '')
        if origin and urlsplit(origin).netloc != self.headers.get('Host'):
            return self.reply(403, {'error': 'Origem não permitida'})
        if self.headers.get('Content-Type', '').split(';')[0] != 'application/json':
            return self.reply(415, {'error': 'JSON obrigatório'})
        try:
            n = int(self.headers.get('Content-Length', 0))
            if not 0 < n <= 65536:
                raise ValueError('Pedido muito grande')
            body = json.loads(self.rfile.read(n))
            indices = sorted(set(body['indices']))
            rows = source(job)
            if not indices or len(indices) > 500 or any(type(i) is not int or not 0 <= i < len(rows) for i in indices):
                raise ValueError('Seleção inválida (máximo 500 por vez)')
        except Exception:
            return self.reply(400, {'error': 'Seleção ou busca inválida'})
        if not BUSY.acquire(blocking=False):
            return self.reply(409, {'error': 'Uma busca de e-mails já está em andamento. Aguarde.'})
        try:
            data = read(job); data.update(status='working', done=0, total=len(indices)); save(job, data)
            threading.Thread(target=work, args=(job, rows, indices), daemon=True).start()
        except Exception:
            BUSY.release(); raise
        self.reply(202, data)


if __name__ == '__main__':
    ThreadingHTTPServer(('0.0.0.0', 8090), Handler).serve_forever()
