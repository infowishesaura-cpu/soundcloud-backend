export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const { url } = req.query;
  if (!url) { res.status(400).json({ error: 'URL required' }); return; }

  try {
    const scUrl = `https://api-v2.soundcloud.com/resolve?url=${encodeURIComponent(url)}&client_id=iZIs9mchVcX5lhVRyQGGAYlNPVldzAoX`;
    const scRes = await fetch(scUrl);
    const scData = await scRes.json();

    if (scData.kind === 'playlist' || scData.kind === 'system-playlist') {
      const tracks = scData.tracks.map(t => ({
        title: t.title,
        download_url: t.media?.transcodings?.[0]?.url || null
      }));
      res.status(200).json({ type: 'playlist', tracks });
    } else {
      const downloadUrl = scData.media?.transcodings?.[0]?.url || null;
      res.status(200).json({ type: 'track', download_url: downloadUrl, title: scData.title });
    }
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
}
