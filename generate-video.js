import { GoogleGenAI } from "@google/genai";
import fs from "fs";

const ai = new GoogleGenAI({apiKey: "Your API Key"});
const prompt = `
Animate this real company CEO portrait into a polished 4-second corporate introduction video.
Keep the face and identity consistent with the uploaded photo.
Use subtle natural motion only: blinking, slight head movement, gentle breathing, and a slow cinematic push-in.
The person is a senior executive speaking in a calm, professional, confident tone.
He says: "We help businesses build scalable digital solutions with speed, trust, and innovation."
Ambient audio: subtle office room tone.
Style: clean corporate presentation, modern office background, natural expression, realistic movement.
`;

const imageBytes = fs.readFileSync("my-image.png").toString("base64");

let operation = await ai.models.generateVideos({
  model: "veo-3.1-generate-preview",
  prompt,
  image: {
    imageBytes,
    mimeType: "image/png",
  },
  config: {
    durationSeconds: 4,
  },
});

while (!operation.done) {
  console.log("Waiting for video generation to complete...");
  await new Promise((resolve) => setTimeout(resolve, 10000));
  operation = await ai.operations.getVideosOperation({
    operation,
  });
}

console.log("Final operation:", JSON.stringify(operation, null, 2));

if (operation.error) {
  throw new Error(
    `Video generation failed: ${operation.error.message || JSON.stringify(operation.error)}`
  );
}

const videos =
  operation?.response?.generatedVideos ||
  operation?.response?.generateVideoResponse?.generatedSamples;

if (!videos || !Array.isArray(videos) || videos.length === 0) {
  throw new Error(
    `No generated video found in response: ${JSON.stringify(operation.response, null, 2)}`
  );
}

const videoFile = videos[0].video;

if (!videoFile) {
  throw new Error(`Video object missing: ${JSON.stringify(videos[0], null, 2)}`);
}

await ai.files.download({
  file: videoFile,
  downloadPath: "accionlabs_intro_8s.mp4",
});

console.log("Generated video accionlabs_intro_4s.mp4");