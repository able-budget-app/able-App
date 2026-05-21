#!/usr/bin/env python3
"""
Ping IndexNow with URLs that just changed (new/updated/deleted).

IndexNow is a shared push-notification protocol — one POST notifies Bing,
Yandex, Naver, Seznam, and Microsoft's broader network. Google does NOT
participate yet; submit the sitemap via Search Console for Google.

Usage:
  scripts/indexnow-ping.py https://becomeable.app/budgeting/new-article/
  scripts/indexnow-ping.py url1 url2 url3
  cat urls.txt | scripts/indexnow-ping.py -

Returns nonzero on HTTP failure. Sleep is unnecessary — IndexNow accepts up
to 10,000 URLs per call.
"""
import json
import sys
import urllib.request

HOST = "becomeable.app"
KEY = "9f92dd20c9c5cb59d3144fba02f7f182"
KEY_LOCATION = f"https://{HOST}/{KEY}.txt"
ENDPOINT = "https://api.indexnow.org/IndexNow"


def ping(urls: list[str]) -> int:
    urls = [u.strip() for u in urls if u.strip()]
    if not urls:
        print("No URLs to submit.", file=sys.stderr)
        return 1
    if len(urls) > 10000:
        print(f"IndexNow accepts max 10,000 URLs per call ({len(urls)} given).", file=sys.stderr)
        return 2
    body = json.dumps({
        "host": HOST,
        "key": KEY,
        "keyLocation": KEY_LOCATION,
        "urlList": urls,
    }).encode("utf-8")
    req = urllib.request.Request(
        ENDPOINT,
        data=body,
        headers={"Content-Type": "application/json; charset=utf-8"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            code = resp.status
            print(f"IndexNow → {code} for {len(urls)} URL(s)")
            return 0 if 200 <= code < 300 else 3
    except urllib.error.HTTPError as e:
        # 200 OK, 202 Accepted, 400 Bad request, 403 Forbidden (key invalid),
        # 422 Unprocessable (URL doesn't match host), 429 Too many requests
        print(f"IndexNow HTTP {e.code}: {e.reason}", file=sys.stderr)
        try:
            print(e.read().decode("utf-8", errors="ignore"), file=sys.stderr)
        except Exception:
            pass
        return e.code
    except urllib.error.URLError as e:
        print(f"IndexNow connection failed: {e.reason}", file=sys.stderr)
        return 4


def main():
    args = sys.argv[1:]
    if not args:
        print(__doc__, file=sys.stderr)
        sys.exit(1)
    if args == ["-"]:
        urls = [line for line in sys.stdin]
    else:
        urls = args
    sys.exit(ping(urls))


if __name__ == "__main__":
    main()
