import re
import time
import socket
import ipaddress
from urllib.parse import urlparse, urljoin

import requests

HEADERS = {"User-Agent": "VenturelyxBot/1.0 (+https://venturelyx.com)"}


def _normalize_url(raw: str) -> str:
    raw = raw.strip()
    if not raw.startswith(("http://", "https://")):
        raw = "https://" + raw
    return raw


def _is_private_host(hostname: str) -> bool:
    try:
        infos = socket.getaddrinfo(hostname, None)
    except Exception:
        return True  # cannot resolve -> block
    for info in infos:
        ip = info[4][0]
        try:
            addr = ipaddress.ip_address(ip)
        except ValueError:
            continue
        if addr.is_private or addr.is_loopback or addr.is_link_local or addr.is_reserved or addr.is_multicast:
            return True
    return False


def _grade(score: int) -> str:
    if score >= 90:
        return "A"
    if score >= 75:
        return "B"
    if score >= 60:
        return "C"
    if score >= 40:
        return "D"
    return "F"


def scan_website(raw_url: str) -> dict:
    url = _normalize_url(raw_url)
    parsed = urlparse(url)
    host = parsed.hostname or ""
    if not host or "." not in host:
        return {"error": "Please enter a valid website address."}
    if _is_private_host(host):
        return {"error": "For security, we can't scan private, local, or internal addresses."}

    checks = []
    started = time.time()
    try:
        resp = requests.get(url, headers=HEADERS, timeout=15, allow_redirects=True)
        elapsed = round((time.time() - started) * 1000)
        html = resp.text or ""
        final_url = resp.url
    except requests.exceptions.SSLError:
        return {"error": "The website's SSL certificate could not be verified.", "url": url}
    except Exception:
        return {"error": "We couldn't reach that website. Check the address and try again.", "url": url}

    def add(key, label, ok, detail, severity, recommendation):
        checks.append({
            "key": key, "label": label, "status": "pass" if ok else "fail",
            "detail": detail, "severity": severity, "recommendation": recommendation,
        })

    # HTTPS
    is_https = final_url.startswith("https://")
    add("https", "Secure connection (HTTPS)", is_https,
        "Your site loads securely over HTTPS." if is_https else "Your site is not served over HTTPS.",
        "critical", "Install an SSL certificate so customers and Google trust your site.")

    # Response time
    fast = elapsed <= 1500
    add("speed", "Page load speed", fast,
        f"Server responded in {elapsed} ms.",
        "high", "Speed up your server or hosting — slow pages lose customers and rankings.")

    # Title
    title_m = re.search(r"<title[^>]*>(.*?)</title>", html, re.I | re.S)
    title = re.sub(r"\s+", " ", title_m.group(1)).strip() if title_m else ""
    title_ok = 10 <= len(title) <= 65
    add("title", "Page title tag", bool(title) and title_ok,
        f'Title: "{title}" ({len(title)} chars)' if title else "No title tag found.",
        "critical", "Add a clear 50-60 character title with your main service and city.")

    # Meta description
    meta_m = re.search(r'<meta[^>]+name=["\']description["\'][^>]*content=["\'](.*?)["\']', html, re.I | re.S)
    meta = re.sub(r"\s+", " ", meta_m.group(1)).strip() if meta_m else ""
    meta_ok = 50 <= len(meta) <= 165
    add("meta", "Meta description", bool(meta) and meta_ok,
        f"Description is {len(meta)} characters." if meta else "No meta description found.",
        "high", "Write a 120-160 character description that makes people want to click.")

    # H1
    h1s = re.findall(r"<h1[^>]*>(.*?)</h1>", html, re.I | re.S)
    h1_ok = len(h1s) == 1
    add("h1", "Main heading (H1)", h1_ok,
        f"Found {len(h1s)} H1 heading(s)." if h1s else "No H1 heading found.",
        "high", "Use exactly one H1 that states what you do and where.")

    # Image alt text
    imgs = re.findall(r"<img\b[^>]*>", html, re.I)
    with_alt = [i for i in imgs if re.search(r'alt=["\'][^"\']+["\']', i, re.I)]
    alt_ratio = (len(with_alt) / len(imgs)) if imgs else 1
    alt_ok = alt_ratio >= 0.8
    add("alt", "Image alt text", alt_ok,
        f"{len(with_alt)}/{len(imgs)} images have alt text." if imgs else "No images found.",
        "medium", "Add descriptive alt text to images for accessibility and image search.")

    # Canonical
    canonical_ok = bool(re.search(r'<link[^>]+rel=["\']canonical["\']', html, re.I))
    add("canonical", "Canonical tag", canonical_ok,
        "Canonical tag present." if canonical_ok else "No canonical tag found.",
        "medium", "Add a canonical tag to avoid duplicate-content confusion.")

    # Viewport / mobile
    viewport_ok = bool(re.search(r'<meta[^>]+name=["\']viewport["\']', html, re.I))
    add("mobile", "Mobile friendly", viewport_ok,
        "Viewport meta tag present." if viewport_ok else "No viewport tag — site may not be mobile friendly.",
        "high", "Add a responsive viewport meta tag so the site works on phones.")

    # Broken internal links (sample up to 8)
    hrefs = re.findall(r'<a\b[^>]*href=["\']([^"\'#]+)["\']', html, re.I)
    internal = []
    for h in hrefs:
        if h.startswith("mailto:") or h.startswith("tel:") or h.startswith("javascript:"):
            continue
        full = urljoin(final_url, h)
        if urlparse(full).hostname == host and full not in internal:
            internal.append(full)
        if len(internal) >= 8:
            break
    broken = []
    for link in internal:
        try:
            hr = requests.head(link, headers=HEADERS, timeout=6, allow_redirects=True)
            if hr.status_code >= 400:
                broken.append(link)
        except Exception:
            broken.append(link)
    links_ok = len(broken) == 0
    add("links", "Broken links", links_ok,
        f"Checked {len(internal)} links, {len(broken)} broken." if internal else "No internal links found to check.",
        "medium", "Fix or remove broken links so visitors and Google don't hit dead ends.")

    weights = {"critical": 22, "high": 15, "medium": 8}
    total_weight = sum(weights[c["severity"]] for c in checks)
    earned = sum(weights[c["severity"]] for c in checks if c["status"] == "pass")
    score = round((earned / total_weight) * 100) if total_weight else 0

    issues = [c for c in checks if c["status"] == "fail"]
    sev_order = {"critical": 0, "high": 1, "medium": 2}
    issues.sort(key=lambda c: sev_order[c["severity"]])

    return {
        "url": final_url,
        "score": score,
        "grade": _grade(score),
        "response_ms": elapsed,
        "checks": checks,
        "issues": issues,
        "passed": len([c for c in checks if c["status"] == "pass"]),
        "total": len(checks),
    }
