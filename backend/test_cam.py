import httpx, json, asyncio, os
from dotenv import load_dotenv

load_dotenv()
TRAFFIC_API_KEY = os.environ.get("TRAFFIC_API_KEY", os.environ.get("511NY_API_KEY", "9d2ff4d0-c3e7-4aae-9e76-5c56b0f99e52"))

async def f():
    r = await httpx.AsyncClient(timeout=15).get(f'https://511ny.org/api/getcameras?key={TRAFFIC_API_KEY}&format=json')
    d = r.json()
    # Find ones with VideoUrl (HLS stream)
    with_video = [c for c in d if not c.get('Disabled') and c.get('VideoUrl')]
    print(f"Total: {len(d)}, With VideoUrl: {len(with_video)}")
    for c in with_video[:5]:
        print(json.dumps({k: c.get(k) for k in ['ID','Name','Url','VideoUrl','DirectionOfTravel','RoadwayName']}, indent=2))
    
    # Check if there's a snapshot URL pattern 
    # 511NY CCTV snapshot format: https://511ny.org/cameras/cctv/{id}.jpg ?
    # Let's check what the Url field looks like for skyline cams
    skyline = [c for c in with_video if 'Skyline' in c.get('ID','')]
    print(f"\nSkyline cams with video: {len(skyline)}")
    print("First skyline:", json.dumps(skyline[0] if skyline else {}, indent=2))

asyncio.run(f())
