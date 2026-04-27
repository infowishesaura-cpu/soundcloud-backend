export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const { url } = req.query;
  if (!url) { res.status(400).json({ error: 'URL required' }); return; }

  try {
    // Step 1: client_id fetch karo
    const pageRes = await fetch('https://soundcloud.com', {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const pageHtml = await pageRes.text();
    const scriptUrls = [...pageHtml.matchAll(/src="(https:\/\/a-v2\.sndcdn\.com\/assets\/[^"]+\.js)"/g)].map(m => m[1]);
    
    let clientId = null;
    for (const scriptUrl of scriptUrls.slice(-3)) {
      const scriptRes = await fetch(scriptUrl);
      const scriptText = await scriptRes.text();
      const match = scriptText.match(/client_id:"([a-zA-Z0-9]+)"/);
      if (match) { clientId = match[1]; break; }
    }

    if (!clientId) throw new Error('Could not find client_id');

    // Step 2: URL resolve karo
    const resolveRes = await fetch(
      `https://api-v2.soundcloud.com/resolve?url=${encodeURIComponent(url)}&client_id=${clientId}`
    );
    const data = await resolveRes.json();

    if (data.kind === 'playlist' || data.kind === 'system-playlist') {
      const tracks = (data.tracks || []).map(t => ({
        title: t.title,
        id: t.id,
        artwork: t.artwork_url,
        stream_url: t.media?.transcodings?.find(x => x.format?.protocol === 'progressive')?.url || null,
        client_id: clientId
      }));
      res.status(200).json({ type: 'playlist', title: data.title, tracks });
    } else {
      const streamUrl = data.media?.transcodings?.find(x => x.format?.protocol === 'progressive')?.url || null;
      res.status(200).json({ type: 'track', title: data.title, stream_url: streamUrl, client_id: clientId });
    }
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
}
