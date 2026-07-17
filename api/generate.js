export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { imageBase64, filterType } = req.body;

    if (!imageBase64 || !filterType) {
      return res.status(400).json({ error: 'Missing imageBase64 or filterType' });
    }

    const filterConfig = {
      paper_camera: {
        hfInstruction: 'Transform into a hand-drawn travel postcard illustration with flat colors, crisp outlines, cartoon details, and storybook aesthetics. Keep subject identity.',
        hfStrength: 0.70,
        geminiPrompt: 'Transform this photo into a clean hand-drawn doodle travel-postcard illustration with flat colors, crisp outlines, charming cartoon details, storybook aesthetics. Preserve the exact identity of the original subject.'
      },
      cartoon_doodle: {
        hfInstruction: 'Transform into a mixed-media cartoon doodle illustration with bright colorful outlines, cartoon overlays, hand-drawn sketch lines, hearts and stars decorations.',
        hfStrength: 0.80,
        geminiPrompt: 'Transform the entire scene into a mixed-media illustration with hand-drawn cartoon overlays, bright colorful fills, doodle annotations, swirling lines, cartoon clouds. Keep subjects realistic.'
      },
      magazine: {
        hfInstruction: 'Transform into a Japanese lifestyle magazine editorial illustration, warm vintage tone, hand-drawn ink outlines, stylish urban aesthetic.',
        hfStrength: 0.65,
        geminiPrompt: 'Japanese fashion magazine-inspired, turn into hand-drawn lifestyle magazine page, relaxed urban, effortlessly stylish, editorial annotations, ink outlines.'
      },
      folk_art: {
        hfInstruction: 'Transform into a decorative folk art illustration with bold bright flat colors, simplified shapes, childlike fairy-tale mood, cute naive whimsical style.',
        hfStrength: 0.80,
        geminiPrompt: 'TRANSFORM THE ENTIRE IMAGE INTO A DECORATIVE FOLK ILLUSTRATION. FLAT STYLE, DOODLE ELEMENTS, BOLD BRIGHT PLAYFUL COLORS, SIMPLIFIED FLAT SHAPES, CHILDLIKE FAIRY-TALE MOOD.'
      },
      pixel_retro: {
        hfInstruction: 'Transform into 32-bit pixel art with NES/SNES color palette, hard pixel edges, retro game sprite style, no anti-aliasing.',
        hfStrength: 0.85,
        geminiPrompt: 'Transform into clean 32-bit pixel art sprite. NES/SNES palette, uniform pixel grid, hard edges only, no blur or gradients, flat 2-tone shading, retro game aesthetic.'
      },
      pen_sketch: {
        hfInstruction: 'Transform into a hand-drawn portrait in red and yellow pen on notebook paper, expressive spontaneous lines, doodle art annotations, handwritten notes around the subject.',
        hfStrength: 0.75,
        geminiPrompt: 'Hand drawn portrait illustration in red and yellow pen on notebook paper, doodle art, comic annotations, expressive lines, bold outline glow, handwritten notes around, realistic pen stroke texture.'
      },
      pastel_coder: {
        hfInstruction: 'Transform into pastel scribble art with soft colors, hand-drawn outlines, casual handwritten coding notes, IT/tech theme annotations, grain texture.',
        hfStrength: 0.70,
        geminiPrompt: 'Add hand-drawn pastel scribble lines, outlines, swirls, arrows, cute IT & coding annotations. Soft clean grain texture, Instagram aesthetic, minimal yet artistic.'
      },
      comic_action: {
        hfInstruction: 'Transform into high-energy comic book action illustration, bold cel-shading, sharp linework, graphic novel style, vibrant colors, intense contrast.',
        hfStrength: 0.80,
        geminiPrompt: 'Transform into high-energy comic-book action illustration. Bold cel-shaded rendering, sharp linework, graphic novel style, vibrant colors, intense contrast.'
      }
    };

    const config = filterConfig[filterType];
    if (!config) {
      return res.status(400).json({ error: 'Invalid or unsupported filter type' });
    }

    const base64Data = imageBase64.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, '');

    // ─── STAGE 1: Fal.ai (Super Fast & High Quality - Paid/Trial) ─────────────
    const falKey = process.env.FAL_API_KEY;
    if (falKey && falKey !== 'your_fal_key_here') {
      console.log('[FAL] Trying Fal.ai...');
      try {
        const falRes = await fetch('https://fal.run/fal-ai/fast-sdxl/image-to-image', {
          method: 'POST',
          headers: {
            'Authorization': `Key ${falKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            image_url: `data:image/jpeg;base64,${base64Data}`,
            prompt: config.geminiPrompt,
            strength: config.hfStrength
          }),
          signal: AbortSignal.timeout(35000)
        });

        if (falRes.ok) {
          const falData = await falRes.json();
          if (falData.images && falData.images.length > 0) {
            const imageUrl = falData.images[0].url;
            // Fetch the image from the URL to convert to Base64 for the frontend
            const imgRes = await fetch(imageUrl);
            const buffer = await imgRes.arrayBuffer();
            const imgBase64 = Buffer.from(buffer).toString('base64');
            
            console.log(`[FAL] ✅ Success!`);
            return res.status(200).json({
              success: true,
              imageBase64: `data:image/jpeg;base64,${imgBase64}`
            });
          }
        } else {
          const errText = await falRes.text().catch(()=>'');
          console.warn(`[FAL] Failed: ${falRes.status} — ${errText.substring(0, 100)}`);
        }
      } catch (falErr) {
        console.warn(`[FAL] Network error:`, falErr.message);
      }
      console.log('[FAL] Fal.ai failed (out of credits?), falling through to HuggingFace...');
    }

    // ─── STAGE 2: HuggingFace InstructPix2Pix (Free Keys Rotation) ────────────
    const hfKeysStr = process.env.HUGGINGFACE_API_KEYS;
    if (hfKeysStr) {
      console.log('[HF] Trying InstructPix2Pix...');
      const hfKeys = hfKeysStr.split(',').map(k => k.trim()).filter(k => k.length > 0 && k !== 'your_hf_key_here');
      
      if (hfKeys.length > 0) {
        const startIndex = Math.floor(Math.random() * hfKeys.length);
        let hfSuccess = false;

        for (let i = 0; i < hfKeys.length; i++) {
          const keyIndex = (startIndex + i) % hfKeys.length;
          const hfKey = hfKeys[keyIndex];

          try {
            const hfRes = await fetch('https://api-inference.huggingface.co/models/timbrooks/instruct-pix2pix', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${hfKey}`,
                'Content-Type': 'application/json',
                'x-wait-for-model': 'true'
              },
              body: JSON.stringify({
                inputs: config.hfInstruction,
                parameters: {
                  image: base64Data,
                  num_inference_steps: 20,
                  image_guidance_scale: 1.5,
                  guidance_scale: 7.5,
                  strength: config.hfStrength
                }
              }),
              signal: AbortSignal.timeout(30000)
            });

            if (hfRes.ok) {
              const contentType = hfRes.headers.get('content-type') || '';
              if (contentType.includes('image')) {
                const buffer = await hfRes.arrayBuffer();
                const imgBase64 = Buffer.from(buffer).toString('base64');
                console.log(`[HF] ✅ Success with Key ${keyIndex + 1}/${hfKeys.length}`);
                return res.status(200).json({
                  success: true,
                  imageBase64: `data:image/jpeg;base64,${imgBase64}`
                });
              }
            } else {
              const errText = await hfRes.text().catch(()=>'');
              console.warn(`[HF] Key ${keyIndex + 1} Failed: ${hfRes.status} — ${errText.substring(0, 100)}`);
              // If we get a 429 Too Many Requests, it will loop to the next key automatically
            }
          } catch (hfErr) {
            console.warn(`[HF] Key ${keyIndex + 1} Network error:`, hfErr.message);
          }
        }
      }
      console.log('[HF] All HuggingFace keys failed or blocked, falling through to OpenRouter & Gemini...');
    }

    // ─── STAGE 3: OpenRouter Vision Analysis ──────────────────────────────────
    const orKey = process.env.OPENROUTER_API_KEY;
    let stylePrompt = config.geminiPrompt; // fallback prompt
    
    if (orKey) {
      console.log(`[AI] Step 1: Analyzing image with Gemini via OpenRouter...`);
      try {
        const analysisRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${orKey}`,
            'HTTP-Referer': 'http://localhost:3000',
            'X-Title': 'UITS IT Photo Booth'
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            max_tokens: 512,
            messages: [{
              role: 'user',
              content: [
                { type: 'text', text: 'Analyze this photo in detail. Then write a generation prompt to: ' + config.geminiPrompt },
                { type: 'image_url', image_url: { url: `data:image/png;base64,${base64Data}` } }
              ]
            }]
          })
        });

        const analysisData = await analysisRes.json();
        if (!analysisData.error && analysisRes.ok) {
          stylePrompt = analysisData.choices?.[0]?.message?.content || config.geminiPrompt;
          console.log(`[AI] OpenRouter success. Generated dynamic prompt.`);
        } else {
          console.warn('[AI] OpenRouter vision failed, using fallback prompt.');
        }
      } catch (visionErr) {
        console.warn('[AI] OpenRouter network error:', visionErr.message);
      }
    }

    // ─── STAGE 4: Gemini Image Generation ─────────────────────────────────────
    const apiKeysStr = process.env.GEMINI_API_KEYS;
    let lastError = 'No Gemini keys configured';

    if (apiKeysStr) {
      const apiKeys = apiKeysStr.split(',').map(k => k.trim()).filter(k => k.length > 0);
      const imageModels = [
        'gemini-2.5-flash-image',
        'gemini-3.1-flash-image',
        'gemini-3-pro-image'
      ];

      const startIndex = Math.floor(Math.random() * apiKeys.length);

      outerLoop:
      for (let i = 0; i < apiKeys.length; i++) {
        const keyIndex = (startIndex + i) % apiKeys.length;
        const apiKey = apiKeys[keyIndex];

        for (const model of imageModels) {
          const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
          try {
            const response = await fetch(geminiUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{
                  parts: [
                    { text: stylePrompt },
                    { inline_data: { mime_type: 'image/png', data: base64Data } }
                  ]
                }],
                generationConfig: { responseModalities: ['image', 'text'] }
              }),
              signal: AbortSignal.timeout(15000)
            });

            if (!response.ok) {
              lastError = `Key ${keyIndex + 1}/${model}: ${response.status}`;
              console.warn(`[Gemini] ${lastError}`);
              continue; // try next model or key
            }

            const data = await response.json();
            const imgPart = data.candidates?.[0]?.content?.parts?.find(p => p.inline_data);
            if (imgPart) {
              console.log(`[Gemini] ✅ Success with Key ${keyIndex + 1}/${model}`);
              return res.status(200).json({ 
                success: true, 
                imageBase64: `data:${imgPart.inline_data.mime_type};base64,${imgPart.inline_data.data}` 
              });
            }
          } catch (err) {
            lastError = err.message;
            console.warn(`[Gemini] ${model} error:`, err.message);
          }
        }
      }
    }

    // ─── If we reach here, all AI failed ──────────────────────────────────────
    console.error(`[AI] All image generation attempts failed. Last error: ${lastError}`);
    return res.status(502).json({ error: 'AI generation failed. Quota limits reached.' });

  } catch (error) {
    console.error('Server error:', error);
    return res.status(500).json({ error: 'Internal server error: ' + error.message });
  }
}
