import Anthropic from '@anthropic-ai/sdk';
import * as FileSystem from 'expo-file-system';

const MODEL_VISION = 'claude-sonnet-4-6';            // Vision tasks: prescription scan, medicine ID
const MODEL_CHAT = 'claude-haiku-4-5-20251001';     // Chat & text tasks: 3–5x cheaper

function getClient() {
  const apiKey = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('EXPO_PUBLIC_ANTHROPIC_API_KEY is not set in your .env file');
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
}

async function uriToBase64(uri: string): Promise<string> {
  return FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
}

function getMediaType(uri: string): 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' {
  const u = uri.toLowerCase().split('?')[0];
  if (u.endsWith('.png')) return 'image/png';
  if (u.endsWith('.gif')) return 'image/gif';
  if (u.endsWith('.webp')) return 'image/webp';
  return 'image/jpeg';
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PrescriptionMedicine {
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string;
}

export interface PrescriptionAnalysisResult {
  medicines: PrescriptionMedicine[];
  rawText: string;
}

export interface MedicineInfoResult {
  name: string;
  genericName: string;
  category: string;
  price: string;
  description: string;
  sideEffects: string[];
  ingredients: string[];
  alternatives: string[];
  warnings: string[];
}

// ─── Prescription Analysis ────────────────────────────────────────────────────

/**
 * Analyze a prescription image URI using Claude vision.
 * Extracts all medicines, dosages, frequencies, and durations.
 */
export async function analyzePrescription(imageUri: string): Promise<PrescriptionAnalysisResult> {
  const client = getClient();
  const base64 = await uriToBase64(imageUri);
  const mediaType = getMediaType(imageUri);

  // Step 1: OCR — ask Claude vision to transcribe all text in the image
  const ocrResponse = await client.messages.create({
    model: MODEL_VISION,
    max_tokens: 2048,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
          {
            type: 'text',
            text: 'Transcribe ALL text visible in this image exactly as written. Include medicine names, dosages, frequencies, instructions, dates, doctor notes — everything. Do not summarize or skip anything.',
          },
        ],
      },
    ],
  });

  const rawText = ocrResponse.content[0].type === 'text' ? ocrResponse.content[0].text.trim() : '';
  if (!rawText) throw new Error('Could not read text from image — try a clearer photo');

  // Step 2: Parse — use a text model to structure the OCR output into medicines
  const parseResponse = await client.messages.create({
    model: MODEL_CHAT,
    max_tokens: 2048,
    messages: [
      {
        role: 'user',
        content: `You are a pharmacist. Extract all medicines from this prescription text and return ONLY valid JSON — no explanation, no markdown.

Prescription text:
"""
${rawText}
"""

Return this exact JSON format:
{
  "rawText": "copy the full prescription text here",
  "medicines": [
    {
      "name": "medicine brand/generic name",
      "dosage": "e.g. 500mg",
      "frequency": "e.g. Twice daily",
      "duration": "e.g. 7 days",
      "instructions": "e.g. After meals"
    }
  ]
}

Rules:
- Include every medicine mentioned, even vitamins and supplements
- If a field is not mentioned, use an empty string
- If no medicines found, use an empty array
- Return ONLY the JSON object, nothing else`,
      },
    ],
  });

  const parseText = parseResponse.content[0].type === 'text' ? parseResponse.content[0].text : '';
  const jsonMatch = parseText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Could not structure prescription data');
  return JSON.parse(jsonMatch[0]) as PrescriptionAnalysisResult;
}

// ─── Medicine Identification (Image) ─────────────────────────────────────────

/**
 * Identify a medicine from a photo and return detailed info.
 * Falls back to OpenFDA for structured drug data after identification.
 */
export async function identifyMedicine(imageUri: string): Promise<MedicineInfoResult> {
  const client = getClient();
  const base64 = await uriToBase64(imageUri);
  const mediaType = getMediaType(imageUri);

  // Step 1: Identify the medicine name from the image
  const identifyResponse = await client.messages.create({
    model: MODEL_VISION,
    max_tokens: 256,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mediaType, data: base64 },
          },
          {
            type: 'text',
            text: 'What medicine is shown in this image? Reply with only the medicine brand name and generic name in this format: BRAND_NAME|GENERIC_NAME. If unsure, give your best guess.',
          },
        ],
      },
    ],
  });

  const identifyText = identifyResponse.content[0].type === 'text' ? identifyResponse.content[0].text.trim() : '';
  const [brandName] = identifyText.split('|');

  // Step 2: Get full info using the identified name
  return getMedicineInfo(brandName.trim());
}

// ─── Medicine Info by Name ────────────────────────────────────────────────────

/**
 * Get medicine info by name.
 * Uses OpenFDA for drug label data + Claude to enrich and structure the response.
 */
export async function getMedicineInfo(name: string): Promise<MedicineInfoResult> {
  // Fetch from OpenFDA drug label API
  const fdaUrl = `https://api.fda.gov/drug/label.json?search=openfda.brand_name:"${encodeURIComponent(name)}"&limit=1`;
  const fdaRes = await fetch(fdaUrl);

  let fdaContext = '';
  if (fdaRes.ok) {
    const fdaData = await fdaRes.json();
    const result = fdaData.results?.[0];
    if (result) {
      fdaContext = JSON.stringify({
        brand_name: result.openfda?.brand_name?.[0],
        generic_name: result.openfda?.generic_name?.[0],
        manufacturer: result.openfda?.manufacturer_name?.[0],
        purpose: result.purpose?.[0],
        warnings: result.warnings?.[0],
        adverse_reactions: result.adverse_reactions?.[0],
        active_ingredient: result.active_ingredient?.[0],
        inactive_ingredient: result.inactive_ingredient?.[0],
      });
    }
  }

  // Use Claude to structure into a clean response
  const client = getClient();
  const response = await client.messages.create({
    model: MODEL_CHAT,
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `You are a pharmacist assistant. Using the medicine name "${name}" and the following OpenFDA data (if available):
${fdaContext || 'No FDA data found — use your medical knowledge.'}

Return ONLY a JSON object in this exact format, no extra text:
{
  "name": "Brand name",
  "genericName": "Generic / chemical name",
  "category": "Drug category e.g. Analgesic",
  "price": "Approximate price range e.g. $5–$15",
  "description": "2-3 sentence description of what this medicine does",
  "sideEffects": ["side effect 1", "side effect 2"],
  "ingredients": ["active ingredient 1", "inactive ingredient 1"],
  "alternatives": ["alternative medicine 1", "alternative medicine 2"],
  "warnings": ["warning 1", "warning 2"]
}`,
      },
    ],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Could not get medicine info');
  return JSON.parse(jsonMatch[0]) as MedicineInfoResult;
}

// ─── AI Chat ──────────────────────────────────────────────────────────────────

const CHAT_SYSTEM_PROMPT = `You are Medbro AI, a knowledgeable medical assistant. You help users understand their medicines, dosages, side effects, and general health queries.

Rules:
- Be clear, concise, and empathetic
- Always recommend consulting a doctor for diagnoses, prescriptions, or serious symptoms
- Never suggest stopping prescribed medicines without doctor advice
- If the query involves chest pain, difficulty breathing, severe allergic reactions, or emergencies — immediately advise calling emergency services
- End responses with a note to consult a healthcare professional when the topic warrants it

You are informational only — not a substitute for professional medical advice.`;

/**
 * Chat with Claude about health and medicine queries.
 * Returns the response and a flag indicating if doctor consultation is advised.
 */
export async function chat(
  messages: { role: 'user' | 'assistant'; content: string }[]
): Promise<{ content: string; consultDoctor: boolean }> {
  const client = getClient();

  const response = await client.messages.create({
    model: MODEL_CHAT,
    max_tokens: 1024,
    system: CHAT_SYSTEM_PROMPT,
    messages,
  });

  const content = response.content[0].type === 'text' ? response.content[0].text : '';

  // Flag if the response recommends seeing a doctor
  const consultDoctor =
    /consult\s+a\s+(doctor|physician|healthcare|specialist)|seek\s+medical|emergency|call\s+9[01][01]/i.test(content);

  return { content, consultDoctor };
}
