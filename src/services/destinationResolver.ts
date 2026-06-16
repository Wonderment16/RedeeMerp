import { GoogleGenerativeAI } from "@google/generative-ai";
import { RCCG_CAMP_LOCATIONS } from "../constants/locations";
import type { Destination } from "../types";

type GeminiResolution = {
  destinationId: string | null;
  confidence?: number;
  interpretation?: string;
};

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function diceCoefficient(a: string, b: string) {
  const left = normalize(a);
  const right = normalize(b);
  if (!left || !right) return 0;
  if (left === right) return 1;

  const bigrams = (value: string) => {
    const padded = ` ${value} `;
    const pairs: string[] = [];
    for (let i = 0; i < padded.length - 1; i += 1) {
      pairs.push(padded.slice(i, i + 2));
    }
    return pairs;
  };

  const leftPairs = bigrams(left);
  const rightPairs = bigrams(right);
  const rightCounts = new Map<string, number>();
  rightPairs.forEach((pair) => rightCounts.set(pair, (rightCounts.get(pair) ?? 0) + 1));

  let matches = 0;
  leftPairs.forEach((pair) => {
    const count = rightCounts.get(pair) ?? 0;
    if (count > 0) {
      matches += 1;
      rightCounts.set(pair, count - 1);
    }
  });

  return (2 * matches) / (leftPairs.length + rightPairs.length);
}

function getDestinationById(destinationId: string | null | undefined) {
  return RCCG_CAMP_LOCATIONS.find((destination) => destination.id === destinationId) ?? null;
}

function fuzzyResolve(transcript: string): Destination | null {
  const query = normalize(transcript);
  let best: { destination: Destination; score: number } | null = null;

  for (const destination of RCCG_CAMP_LOCATIONS) {
    const candidates = [destination.name, destination.category, ...destination.aliases];
    const keywordHit = candidates.some((candidate) => query.includes(normalize(candidate)));
    const score = Math.max(...candidates.map((candidate) => diceCoefficient(query, candidate)));
    const boostedScore = keywordHit ? Math.max(score, 0.86) : score;

    if (!best || boostedScore > best.score) {
      best = { destination, score: boostedScore };
    }
  }

  return best && best.score >= 0.42 ? best.destination : null;
}

function parseGeminiJson(text: string): GeminiResolution | null {
  const jsonText = text.replace(/```json|```/g, "").trim();
  const match = jsonText.match(/\{[\s\S]*\}/);
  if (!match) return null;

  try {
    return JSON.parse(match[0]) as GeminiResolution;
  } catch {
    return null;
  }
}

export async function resolveDestination(transcript: string): Promise<Destination | null> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  const fallback = () => fuzzyResolve(transcript);

  if (!apiKey) {
    return fallback();
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const destinationsJson = JSON.stringify(
      RCCG_CAMP_LOCATIONS.map(({ id, name, aliases, category }) => ({
        id,
        name,
        aliases,
        category,
      })),
    );

    const prompt = `You are a navigation assistant for RCCG Camp, Nigeria. Given a user's voice input, identify which of the following destinations they want to reach. Return ONLY a JSON object with: { destinationId: string, confidence: number, interpretation: string }. If no match, return { destinationId: null }. Destinations: ${destinationsJson}\n\nUser input: "${transcript}"`;

    const result = await Promise.race([
      model.generateContent(prompt),
      new Promise<never>((_, reject) =>
        window.setTimeout(() => reject(new Error("Gemini timed out")), 4500),
      ),
    ]);
    const responseText = result.response.text();
    const parsed = parseGeminiJson(responseText);
    const geminiDestination = getDestinationById(parsed?.destinationId);

    return geminiDestination ?? fallback();
  } catch (error) {
    console.warn("[destinationResolver] Gemini failed, using fuzzy fallback:", error);
    return fallback();
  }
}
