import { z } from "zod";
import { notifyOwner } from "./notification";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./trpc";
import { ENV } from "./env";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_ASSETS = path.resolve(__dirname, "../../client/public/assets");

const ICON_PROMPT =
  "App icon for a premium AI advisory council app, dark background, abstract four-pointed star in purple and violet gradient, minimalist, elegant, glassmorphism aesthetic, no text, centered composition, 512x512";

async function generateIconViaForge(): Promise<Buffer> {
  const baseUrl = ENV.forgeApiUrl.endsWith("/") ? ENV.forgeApiUrl : `${ENV.forgeApiUrl}/`;
  const url = new URL("images.v1.ImageService/GenerateImage", baseUrl).toString();
  const res = await fetch(url, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "connect-protocol-version": "1",
      authorization: `Bearer ${ENV.forgeApiKey}`,
    },
    body: JSON.stringify({ prompt: ICON_PROMPT, original_images: [] }),
  });
  if (!res.ok) throw new Error(`FORGE API error ${res.status}`);
  const data = (await res.json()) as { image: { b64Json: string } };
  return Buffer.from(data.image.b64Json, "base64");
}

async function generateIconViaRunware(): Promise<Buffer> {
  const task = {
    taskType: "imageInference",
    taskUUID: crypto.randomUUID(),
    model: "runware:108@1",
    positivePrompt: ICON_PROMPT,
    width: 512,
    height: 512,
    steps: 30,
    outputFormat: "PNG",
  };
  const res = await fetch("https://api.runware.ai/v1", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ENV.runwareApiKey}`,
    },
    body: JSON.stringify([task]),
  });
  if (!res.ok) throw new Error(`Runware API error ${res.status}`);
  const result = (await res.json()) as { data: Array<{ imageURL?: string }> };
  const imageURL = result.data?.[0]?.imageURL;
  if (!imageURL) throw new Error("Runware did not return an imageURL");
  const imgRes = await fetch(imageURL);
  return Buffer.from(await imgRes.arrayBuffer());
}

export const systemRouter = router({
  health: publicProcedure
    .input(
      z.object({
        timestamp: z.number().min(0, "timestamp cannot be negative"),
      })
    )
    .query(() => ({
      ok: true,
    })),

  notifyOwner: adminProcedure
    .input(
      z.object({
        title: z.string().min(1, "title is required"),
        content: z.string().min(1, "content is required"),
      })
    )
    .mutation(async ({ input }) => {
      const delivered = await notifyOwner(input);
      return {
        success: delivered,
      } as const;
    }),

  generateAppIcon: protectedProcedure.mutation(async () => {
    const hasForge = ENV.forgeApiUrl && ENV.forgeApiKey;
    const hasRunware = !!ENV.runwareApiKey;

    if (!hasForge && !hasRunware) {
      throw new Error(
        "No image generation API configured. Set BUILT_IN_FORGE_API_URL/KEY or RUNWARE_API_KEY in .env"
      );
    }

    let buffer: Buffer;
    let source: string;
    try {
      if (hasForge) {
        buffer = await generateIconViaForge();
        source = "FORGE";
      } else {
        buffer = await generateIconViaRunware();
        source = "Runware";
      }
    } catch (err) {
      if (hasForge && hasRunware) {
        buffer = await generateIconViaRunware();
        source = "Runware (fallback)";
      } else {
        throw err;
      }
    }

    if (!fs.existsSync(PUBLIC_ASSETS)) {
      fs.mkdirSync(PUBLIC_ASSETS, { recursive: true });
    }
    fs.writeFileSync(path.join(PUBLIC_ASSETS, "app-icon-192.png"), buffer);
    fs.writeFileSync(path.join(PUBLIC_ASSETS, "app-icon-512.png"), buffer);

    return { success: true, source };
  }),
});
