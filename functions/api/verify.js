export async function onRequestPost(context) {
  // Tangani CORS Preflight
  if (context.request.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      }
    });
  }

  try {
    const body = await context.request.json();
    let { imageBase64, missionTitle } = body;

    if (!imageBase64 || !missionTitle) {
      return new Response(JSON.stringify({ error: "Data tidak lengkap" }), { status: 400, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
    }

    if (!context.env.AI) {
      return new Response(JSON.stringify({ error: "Binding AI tidak ditemukan di server." }), { status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
    }

    const base64Data = imageBase64.split(',')[1] || imageBase64;
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }

    const prompt = 'Kamu adalah sistem verifikasi otomatis. User mengaku telah menyelesaikan misi: "' + missionTitle + '". Periksa gambar ini. Apakah gambar ini adalah bukti valid bahwa user benar-benar menyelesaikan misi tersebut? Jawab HANYA dengan format JSON: {"valid": true, "reason": "alasan singkat"} atau {"valid": false, "reason": "alasan"}.';

    const aiResponse = await context.env.AI.run(
      "@cf/llava-hf/llava-1.5-7b-hf", 
      { image: Array.from(bytes), prompt: prompt, max_tokens: 256 }
    );

    let aiText = aiResponse.description || "";
    let result = { valid: false, reason: "Format AI tidak dikenali" };
    
    try {
      const jsonMatch = aiText.match(/\{.*\}/s);
      if (jsonMatch) result = JSON.parse(jsonMatch[0]);
    } catch (err) {
      result.reason = aiText.substring(0, 100);
    }

    return new Response(JSON.stringify(result), { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });

  } catch (error) {
    return new Response(JSON.stringify({ error: "Detail Error: " + error.message }), { status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
  }
}
