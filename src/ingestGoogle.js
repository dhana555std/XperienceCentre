import fs from "fs";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";

import { Pinecone } from "@pinecone-database/pinecone";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { PineconeStore } from "@langchain/pinecone";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ✅ Import pdfjs and set worker BEFORE any getDocument call
import {
  getDocument,
  GlobalWorkerOptions,
} from "pdfjs-dist/legacy/build/pdf.mjs";

// ✅ Point to the actual worker file using file:// URL
GlobalWorkerOptions.workerSrc = pathToFileURL(
  path.join(__dirname, "node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs"),
).href;

const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY,
});

const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 500,
  chunkOverlap: 100,
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function extractTextFromPDF(filepath) {
  const buffer = fs.readFileSync(filepath);
  const uint8Array = new Uint8Array(buffer);

  const loadingTask = getDocument({
    data: uint8Array,
    standardFontDataUrl: path.join(
      __dirname,
      "node_modules/pdfjs-dist/standard_fonts/",
    ),
    cMapUrl: path.join(__dirname, "node_modules/pdfjs-dist/cmaps/"),
    cMapPacked: true,
    useWorkerFetch: false,
    isEvalSupported: false,
    useSystemFonts: false,
  });

  const doc = await loadingTask.promise;
  console.log(`   📑 PDF has ${doc.numPages} pages`);

  const pageTexts = [];

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const text = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ")
      .trim();

    if (text.length > 0) {
      console.log(`   ✅ Page ${i}: extracted ${text.length} chars`);
      pageTexts.push(text);
    } else {
      console.log(`   ⚠️  Page ${i}: no text found (possibly image-based)`);
    }
  }

  return pageTexts.join("\n");
}

async function extractText(filepath, filename) {
  if (filename.toLowerCase().endsWith(".pdf")) {
    return await extractTextFromPDF(filepath);
  }
  return fs.readFileSync(filepath, "utf8");
}

async function uploadInBatches(
  documents,
  embeddings,
  index,
  batchSize = 20,
  delayMs = 5000,
) {
  const totalBatches = Math.ceil(documents.length / batchSize);

  for (let i = 0; i < documents.length; i += batchSize) {
    const batch = documents.slice(i, i + batchSize);
    const batchNum = Math.floor(i / batchSize) + 1;

    console.log(
      `   📤 Uploading batch ${batchNum}/${totalBatches} (${batch.length} chunks)...`,
    );

    let success = false;
    let attempts = 0;

    while (!success && attempts < 5) {
      try {
        await PineconeStore.fromDocuments(batch, embeddings, {
          pineconeIndex: index,
          maxConcurrency: 1,
        });
        success = true;
      } catch (err) {
        attempts++;
        const retryMatch = err.message.match(/retry in (\d+(\.\d+)?)s/i);
        const waitMs = retryMatch
          ? Math.ceil(parseFloat(retryMatch[1])) * 1000
          : delayMs * attempts;

        console.log(
          `   ⚠️  Batch ${batchNum} failed (attempt ${attempts}): ${err.message}`,
        );
        console.log(`   ⏳ Retrying in ${waitMs / 1000}s...`);
        await sleep(waitMs);
      }
    }

    if (!success) {
      throw new Error(`Batch ${batchNum} failed after 5 attempts. Aborting.`);
    }

    if (i + batchSize < documents.length) {
      console.log(`   ⏳ Waiting ${delayMs / 1000}s before next batch...`);
      await sleep(delayMs);
    }
  }
}

async function ingest() {
  try {
    const indexName = process.env.PINECONE_INDEX_NAME;

    if (!indexName) {
      throw new Error("PINECONE_INDEX_NAME missing in .env");
    }

    const index = pinecone.index(indexName);

    const embeddings = new GoogleGenerativeAIEmbeddings({
      apiKey: process.env.GOOGLE_API_KEY,
      model: "models/gemini-embedding-2",
    });

    const testVector = await embeddings.embedQuery("test");
    console.log("🔍 Embedding dimension:", testVector.length);

    if (testVector.length === 0) {
      throw new Error(
        "Embedding sanity check failed — dimension is 0. Check your GOOGLE_API_KEY.",
      );
    }

    const documents = [];
    const files = fs.readdirSync("./documents");

    console.log(`📂 Found ${files.length} files\n`);

    for (const file of files) {
      if (file.startsWith(".")) {
        console.log(`⏭️  Skipping system file: ${file}`);
        continue;
      }

      console.log(`📄 Reading ${file}`);

      const filepath = `./documents/${file}`;
      let content = "";

      try {
        content = await extractText(filepath, file);
      } catch (err) {
        console.log(`⚠️  Failed to extract text from ${file}: ${err.message}`);
        continue;
      }

      if (!content || content.trim().length === 0) {
        console.log(`⚠️  Skipping empty file: ${file}`);
        continue;
      }

      console.log(
        `   ✅ Extracted ${content.length} total characters from ${file}\n`,
      );

      const chunks = await splitter.splitText(content);

      chunks.forEach((chunk, i) => {
        if (chunk.trim().length > 0) {
          documents.push({
            pageContent: chunk,
            metadata: { filename: file, chunk: i },
          });
        }
      });
    }

    if (documents.length === 0) {
      throw new Error("No valid documents to upload.");
    }

    console.log(`\n🚀 Uploading ${documents.length} chunks in batches...\n`);

    await uploadInBatches(documents, embeddings, index);

    console.log("\n✅ Ingestion successful");
  } catch (error) {
    console.error("❌ Gemini ingest error:", error.message);
  }
}

ingest();
