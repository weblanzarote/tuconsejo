import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import dotenv from 'dotenv';
import url from 'node:url';

const __dirname = url.fileURLToPath(new URL('.', import.meta.url));
const envPath = path.resolve(__dirname, '../../.env');
dotenv.config({ path: envPath });

const API_KEY = process.env.RUNWARE_API_KEY;
if (!API_KEY) {
  console.error("No RUNWARE_API_KEY found in .env");
  process.exit(1);
}

const API_URL = 'https://api.runware.ai/v1';

const BATCHES = [
  {
    name: 'background-dark.webp',
    prompt: 'abstract dark background, blurred glowing neon, deep rich colors, subtle cyber aesthetics, 8k resolution, smooth depth of field, premium ui background, cinematic lighting, glassmorphism vibe, very blurred, dark mode interface, elegant, sophisticated',
    model: 'runware:108@1',
    width: 1920,
    height: 1080
  },
  {
    name: 'advisor-economia.webp',
    prompt: 'A highly professional cinematic portrait of a financial advisor, sharp suit, confident aura, holding a holographic coin, dark neon green abstract background, extremely detailed, 8k, photorealistic, neon accents, dark mode aesthetic',
    model: 'runware:108@1',
    width: 512,
    height: 512
  },
  {
    name: 'advisor-carrera.webp',
    prompt: 'A highly professional cinematic portrait of a career mentor, wearing stylish smart casual, holding a tablet, confident, elegant posture, dark neon blue abstract background, extremely detailed, 8k, photorealistic, dark mode aesthetic',
    model: 'runware:108@1',
    width: 512,
    height: 512
  },
  {
    name: 'advisor-salud.webp',
    prompt: 'A cinematic portrait of a health coach, athletic, vibrant energy, subtle biometric aura, dark neon red and bright white ambient light background, extremely detailed, 8k, photorealistic, dark mode aesthetic',
    model: 'runware:108@1',
    width: 512,
    height: 512
  },
  {
    name: 'advisor-relaciones.webp',
    prompt: 'A warm yet cinematic portrait of a relationships counselor, empathetic and calm expression, soft neon purple and pink gradient abstract background, extremely detailed, 8k, photorealistic, dark mode aesthetic',
    model: 'runware:108@1',
    width: 512,
    height: 512
  },
  {
    name: 'advisor-familia.webp',
    prompt: 'A beautiful cinematic portrait of a family therapist, mature, wise, welcoming smile, wearing earthy tones, dark neon gold and amber abstract background, extremely detailed, 8k, photorealistic, dark mode aesthetic',
    model: 'runware:108@1',
    width: 512,
    height: 512
  },
  {
    name: 'advisor-guardian.webp',
    prompt: 'A cinematic portrait of a cybersecurity AI guardian, glowing cybernetic eyes, futuristic hooded techwear, deep purple and black abstract data stream background, extremely detailed, 8k, photorealistic, dark mode neon aesthetic',
    model: 'runware:108@1',
    width: 512,
    height: 512
  },
  {
    name: 'advisor-sala_juntas.webp',
    prompt: 'A majestic cinematic depiction of a global boardroom command center AI, holographic globe interface, deep teal and silver neon abstract background, extremely detailed, 8k, photorealistic, dark mode aesthetic',
    model: 'runware:108@1',
    width: 512,
    height: 512
  }
];

async function generateAssets() {
  const assetsDir = path.resolve(__dirname, '../../client/public/assets');
  if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir, { recursive: true });
  }

  const tasks = BATCHES.map(batch => ({
    taskType: "imageInference",
    taskUUID: crypto.randomUUID(),
    model: batch.model,
    positivePrompt: batch.prompt,
    width: batch.width,
    height: batch.height,
    steps: 30,
    outputFormat: "WEBP"
  }));

  console.log(`Sending request for ${tasks.length} images...`);

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify(tasks)
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Runware API Error (${response.status}): ${errText}`);
    }

    const result = await response.json();
    if (!result.data || !Array.isArray(result.data)) {
        throw new Error("Unexpected API response structure " + JSON.stringify(result));
    }

    console.log("Images generated. Downloading...");

    await Promise.all(result.data.map(async (item, i) => {
      const batch = BATCHES[i];
      if (item.imageURL) {
        const imgRes = await fetch(item.imageURL);
        const arrayBuffer = await imgRes.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const filePath = path.join(assetsDir, batch.name);
        fs.writeFileSync(filePath, buffer);
        console.log(`Saved ${batch.name} to ${filePath}`);
      } else {
        console.log(`❌ Failed to get imageURL for ${batch.name}`, item);
      }
    }));
    
    console.log("All assets generated successfully!");
  } catch (error) {
    console.error("Fatal Error:", error.message);
  }
}

generateAssets();
