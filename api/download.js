export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const { url } = req.query;
  if (!url) { res.status(400).json({ error: 'URL required' }); return; }

  try {
    const pageRes = await fetch('https://soundcloud.com', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    const pageHtml = await pageRes.text();
    const scriptUrls = [...pageHtml.matchAll(/src="(https:\/\/a-v2\.sndcdn\.com\/assets\/[^"]+\.js)"/g)].map(m => m[1]);
    
    let clientId = null;
    for (const scriptUrl of scriptUrls.slice(-5)) {
      try {
        const scriptRes = await fetch(scriptUrl);
        const scriptText = await scriptRes.text();
        const match = scriptText.match(/client_id:"([a-zA-Z0-9]{32})"/);
        if (match) { clientId = match[1]; break; }
      } catch(e) {}
    }

    if (!clientId) throw new Error('Could not find client_id');

    const resolveRes = await fetch(
      `https://api-v2.soundcloud.com/resolve?url=${encodeURIComponent(url)}&client_id=${clientId}`,
      { headers: { 'User-Agent': 'Mozilla/5.0' } }
    );
    const data = await resolveRes.json();

    const getStreamUrl = (transcodings) => {
      if (!transcodings || transcodings.length === 0) return null;
      // Progressive prefer karo, warna HLS
      const progressive = transcodings.find(x => x.format?.protocol === 'progressive');
      const hls = transcodings.find(x => x.format?.protocol === 'hls');
      return (progressive || hls)?.url || null;
    };

    if (data.kind === 'playlist' || data.kind === 'system-playlist') {
      const tracks = (data.tracks || []).map(t => ({
        title: t.title,
        id: t.id,
        stream_url: getStreamUrl(t.media?.transcodings),
        client_id: clientId
      }));
      res.status(200).json({ type: 'playlist', title: data.title, tracks });
    } else {
      const stream_url = getStreamUrl(data.media?.transcodings);
      res.status(200).json({ 
        type: 'track', 
        title: data.title, 
        stream_url,
        client_id: clientId 
      });
    }
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
}
