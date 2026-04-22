import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import dotenv from 'dotenv';
import url from 'node:url';

const __dirname = url.fileURLToPath(new URL('.', import.meta.url));
const envPath = path.resolve(__dirname, '../../.env');
dotenv.config({ path: envPath });

const API_KEY = process.env.RUNWARE_API_KEY;
const API_URL = 'https://api.runware.ai/v1';

async function generateBg() {
  const assetsDir = path.resolve(__dirname, '../../client/public/assets');
  
  const tasks = [{
    taskType: "imageInference",
    taskUUID: crypto.randomUUID(),
    model: 'runware:108@1',
    // Strong prompt for pure abstract gradient
    positivePrompt: 'very dark pure abstract background, 3d smooth liquid gradient blur, deep rich black and neon colors, subtle cyber ambient light, 8k resolution, premium ui desktop wallpaper, glassmorphism vibe, out of focus, minimalist, elegant, modern, extremely dark lighting',
    negativePrompt: 'person, face, human, character, text, logo, sharp details, object, shape',
    width: 1920,
    height: 1080,
    steps: 30,
    outputFormat: "WEBP"
  }];

  console.log(`Generating new abstract background...`);

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify(tasks)
    });

    const result = await response.json();
    if (result.data && result.data[0] && result.data[0].imageURL) {
      console.log("Downloading new background...");
      const imgRes = await fetch(result.data[0].imageURL);
      const arrayBuffer = await imgRes.arrayBuffer();
      const filePath = path.join(assetsDir, 'background-dark.webp');
      fs.writeFileSync(filePath, Buffer.from(arrayBuffer));
      console.log(`Saved pristine abstract background-dark.webp`);
    } else {
      console.error("API did not return a valid image URL", result);
    }
  } catch (error) {
    console.error("Error:", error);
  }
}

generateBg();
