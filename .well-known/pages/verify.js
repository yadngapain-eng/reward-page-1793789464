export async function onRequestPost(context) {
  try {
    const body = await context.request.json();
    const { imageBase64, missionTitle } = body;

    if (!imageBase64 || !missionTitle) {
      return new Response(JSON.stringify({ error: "Data tidak lengkap" }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    const prompt = 'Kamu adalah sistem verifikasi otomatis. User mengaku telah menyelesaikan misi: "' + missionTitle + '". Periksa gambar ini. Apakah gambar ini adalah bukti valid bahwa user benar-benar menyelesaikan misi tersebut? Jawab HANYA dengan format JSON: {"valid": true, "reason": "alasan singkat"} atau {"valid": false, "reason": "alasan"}.';

    // Cek binding AI
    if (!context.env.AI) {
      return new Response(JSON.stringify({ error: "Binding AI tidak ditemukan." }), { status: 500, headers: { "Content-Type": "application/json" } });
    }

    const aiResponse = await context.env.AI.run(
      "@cf/llava-hf/llava-1.5-7b-hf", 
      { image: imageBase64, prompt: prompt, max_tokens: 256 }
    );

    let aiText = aiResponse.description || "";
    let result = { valid: false, reason: "Format AI tidak dikenali" };
    
    try {
      const jsonMatch = aiText.match(/\{.*\}/s);
      if (jsonMatch) result = JSON.parse(jsonMatch[0]);
    } catch (err) {
      result.reason = aiText.substring(0, 100);
    }

    return new Response(JSON.stringify(result), { headers: { "Content-Type": "application/json" } });

  } catch (error) {
    return new Response(JSON.stringify({ error: "AI Error: " + error.message }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
}
