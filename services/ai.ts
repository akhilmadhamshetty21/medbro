import Anthropic from '@anthropic-ai/sdk';
import * as FileSystem from 'expo-file-system';

const MODEL_VISION = 'claude-sonnet-4-6';            // Vision tasks: prescription scan, medicine ID
const MODEL_CHAT = 'claude-haiku-4-5-20251001';     // Chat & text tasks: 3–5x cheaper

function getClient() {
  const apiKey = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('EXPO_PUBLIC_ANTHROPIC_API_KEY is not set in your .env file');
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
}

/** Convert a local file URI to base64 string */
async function uriToBase64(uri: string): Promise<string> {
  const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
  return base64;
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

  const response = await client.messages.create({
    model: MODEL_VISION,
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: 'image/jpeg', data: base64 },
          },
          {
            type: 'text',
            text: `You are a medical assistant reading a prescription. Extract all medicines and return ONLY a JSON object in this exact format, with no extra text:
{
  "rawText": "<full text you read from the prescription>",
  "medicines": [
    {
      "name": "Medicine name",
      "dosage": "e.g. 500mg",
      "frequency": "e.g. Twice daily",
      "duration": "e.g. 7 days",
      "instructions": "e.g. After meals"
    }
  ]
}
If you cannot read a field clearly, use an empty string. Return only valid JSON.`,
          },
        ],
      },
    ],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Could not parse prescription — try a clearer photo');
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
            source: { type: 'base64', media_type: 'image/jpeg', data: base64 },
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
