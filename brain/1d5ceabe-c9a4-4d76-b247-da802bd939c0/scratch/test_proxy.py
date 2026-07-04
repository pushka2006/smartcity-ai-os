import httpx
from urllib.parse import urlparse, urljoin, quote, unquote

# A real active HLS stream manifest URL from 511NY
hls_url = "https://s51.nysdot.skyvdn.com:443/rtplive/R5_007/playlist.m3u8"

async def test():
    print(f"Fetching upstream manifest: {hls_url}")
    async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
        resp = await client.get(hls_url, headers={
            "User-Agent": "Mozilla/5.0 (compatible; NexusProxy/1.0)",
            "Accept": "*/*",
        })
    print("Upstream status:", resp.status_code)
    text = resp.text
    print("\n--- ORIGINAL MANIFEST ---")
    print("\n".join(text.splitlines()[:15]))
    
    # Let's apply our proposed relative path rewriting
    parsed = urlparse(hls_url)
    base_url = f"{parsed.scheme}://{parsed.netloc}{parsed.path.rsplit('/', 1)[0]}/"
    fresh_ts = 123456789
    
    rewritten_lines = []
    for line in text.splitlines():
        stripped = line.strip()
        if stripped.startswith("#") or stripped == "":
            rewritten_lines.append(line)
        else:
            if stripped.startswith("http://") or stripped.startswith("https://"):
                abs_url = stripped
            else:
                abs_url = urljoin(base_url, stripped)

            if abs_url.endswith(".m3u8"):
                encoded = quote(abs_url, safe="")
                # Proposed relative path rewriting (no leading slash)
                rewritten_lines.append(f"manifest?url={encoded}&_t={fresh_ts}")
            else:
                encoded = quote(abs_url, safe="")
                # Proposed relative path rewriting (no leading slash)
                rewritten_lines.append(f"segment?url={encoded}")
                
    rewritten = "\n".join(rewritten_lines)
    print("\n--- REWRITTEN MANIFEST (PROPOSED) ---")
    print("\n".join(rewritten.splitlines()[:15]))

import asyncio
asyncio.run(test())
