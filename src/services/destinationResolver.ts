import { GoogleGenerativeAI } from "@google/generative-ai";
import { RCCG_CAMP_LOCATIONS } from "../constants/locations";
import { Destination } from "../types";

const apiKey =
  process.env.EXPO_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY || "";
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

const GEMINI_TIMEOUT_MS = 5000;
const FUZZY_THRESHOLD = 0.25;

type GeminiDestinationResponse = {
  destinationId: string | null;
  confidence?: number;
  interpretation?: string;
};

export interface DestinationResolutionResult {
  destination: Destination | null;
  candidates: Destination[];
  source: "gemini" | "fuzzy" | "confirmation" | "none";
  interpretation: string;
}

export async function resolveDestination(
  transcript: string,
): Promise<Destination | null> {
  const result = await resolveDestinationDetailed(transcript);
  return result.destination;
}

/**
 * Resolves voice input with a demo-safe fallback chain: Gemini first, offline
 * fuzzy match second, and finally a short confirmation list so judges never hit
 * a dead-end error after saying an unexpected destination phrase.
 */
export async function resolveDestinationDetailed(
  transcript: string,
): Promise<DestinationResolutionResult> {
  const normalizedTranscript = normalizeText(transcript);
  if (!normalizedTranscript) {
    return {
      destination: null,
      candidates: RCCG_CAMP_LOCATIONS.slice(0, 3),
      source: "none",
      interpretation: transcript,
    };
  }

  if (genAI) {
    const geminiMatch = await resolveWithGemini(transcript);
    if (geminiMatch) {
      return {
        destination: geminiMatch,
        candidates: [],
        source: "gemini",
        interpretation: transcript,
      };
    }
  }

  const fuzzyMatch = fuzzyMatchDestination(transcript);
  if (fuzzyMatch) {
    return {
      destination: fuzzyMatch,
      candidates: [],
      source: "fuzzy",
      interpretation: transcript,
    };
  }

  return {
    destination: null,
    candidates: getDestinationCandidates(transcript),
    source: "confirmation",
    interpretation: transcript,
  };
}

async function resolveWithGemini(
  transcript: string,
): Promise<Destination | null> {
  try {
    const destinationsJson = JSON.stringify(
      RCCG_CAMP_LOCATIONS.map((destination) => ({
        id: destination.id,
        name: destination.name,
        aliases: destination.aliases,
        category: destination.category,
      })),
    );

    const systemPrompt = `You are a navigation assistant for RCCG Camp, Nigeria. Given a user's voice input, identify which of the following destinations they want to reach. Return ONLY a JSON object with: { destinationId: string, confidence: number, interpretation: string }. If no match, return { destinationId: null }. Destinations: ${destinationsJson}`;

    const model = genAI!.getGenerativeModel({
      model: "gemini-1.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
      },
    });

    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    try {
      const response = await Promise.race([
        model.generateContent({
          contents: [
            {
              role: "user",
              parts: [
                { text: `${systemPrompt}\n\nVoice input: "${transcript}"` },
              ],
            },
          ],
        }),
        new Promise<never>((_, reject) => {
          timeoutId = setTimeout(
            () => reject(new Error("Gemini destination resolution timed out")),
            GEMINI_TIMEOUT_MS,
          );
        }),
      ]);

      const parsed = parseGeminiJson(response.response.text());
      if (!parsed.destinationId) {
        return null;
      }

      return (
        RCCG_CAMP_LOCATIONS.find(
          (destination) => destination.id === parsed.destinationId,
        ) ?? null
      );
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  } catch (error) {
    console.warn(
      "[destinationResolver] Gemini failed; using offline fallback:",
      error,
    );
    return null;
  }
}

function parseGeminiJson(rawText: string): GeminiDestinationResponse {
  const trimmed = rawText.trim();
  const jsonText =
    trimmed.match(/```json\s*([\s\S]*?)```/i)?.[1] ??
    trimmed.match(/```\s*([\s\S]*?)```/)?.[1] ??
    trimmed;

  return JSON.parse(jsonText) as GeminiDestinationResponse;
}

function fuzzyMatchDestination(transcript: string): Destination | null {
  const normalizedInput = normalizeText(transcript);
  const inputWords = normalizedInput.split(/\s+/).filter(Boolean);

  if (inputWords.length === 0) {
    return null;
  }

  const phraseMatch = matchCommonPhrase(normalizedInput);
  if (phraseMatch) {
    return phraseMatch;
  }

  let bestMatch: Destination | null = null;
  let bestScore = 0;

  for (const destination of RCCG_CAMP_LOCATIONS) {
    const candidates = [
      destination.name,
      destination.category,
      ...destination.aliases,
    ];

    for (const candidate of candidates) {
      const score = scoreCandidate(normalizedInput, inputWords, candidate);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = destination;
      }
    }
  }

  return bestScore >= FUZZY_THRESHOLD ? bestMatch : null;
}

function matchCommonPhrase(normalizedInput: string): Destination | null {
  const phraseRules: Array<{ terms: string[]; destinationId: string }> = [
    {
      terms: ["food", "eat", "hungry", "restaurant", "canteen", "eateries"],
      destinationId: "eateries",
    },
    {
      terms: ["bus", "buses", "terminal", "park", "transport", "shuttle"],
      destinationId: "bus-terminal",
    },
    {
      terms: ["pray", "prayer", "altar"],
      destinationId: "prayer-ground",
    },
    {
      terms: ["big church", "main church", "auditorium", "3km", "arena"],
      destinationId: "main-auditorium",
    },
    {
      terms: ["youth", "youth centre", "youth center", "youth church"],
      destinationId: "youth-centre",
    },
  ];

  const matchedRule = phraseRules.find((rule) =>
    rule.terms.some((term) => normalizedInput.includes(term)),
  );

  if (!matchedRule) {
    return null;
  }

  return (
    RCCG_CAMP_LOCATIONS.find(
      (destination) => destination.id === matchedRule.destinationId,
    ) ?? null
  );
}

function scoreCandidate(
  normalizedInput: string,
  inputWords: string[],
  candidate: string,
) {
  const normalizedCandidate = normalizeText(candidate);
  const candidateWords = normalizedCandidate.split(/\s+/).filter(Boolean);

  if (!normalizedCandidate) {
    return 0;
  }

  if (normalizedInput === normalizedCandidate) {
    return 1;
  }

  if (
    normalizedInput.includes(normalizedCandidate) ||
    normalizedCandidate.includes(normalizedInput)
  ) {
    const shorter = Math.min(normalizedInput.length, normalizedCandidate.length);
    const longer = Math.max(normalizedInput.length, normalizedCandidate.length);
    return 0.55 + (shorter / longer) * 0.35;
  }

  const overlap = inputWords.filter((word) =>
    candidateWords.includes(word),
  ).length;

  return candidateWords.length + inputWords.length > 0
    ? (2 * overlap) / (candidateWords.length + inputWords.length)
    : 0;
}

export function getDestinationCandidates(transcript: string, limit = 3) {
  const normalizedInput = normalizeText(transcript);
  const inputWords = normalizedInput.split(/\s+/).filter(Boolean);

  return RCCG_CAMP_LOCATIONS.map((destination) => {
    const candidates = [
      destination.name,
      destination.category,
      ...destination.aliases,
    ];
    const score = Math.max(
      ...candidates.map((candidate) =>
        scoreCandidate(normalizedInput, inputWords, candidate),
      ),
      0,
    );
    return { destination, score };
  })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((item) => item.destination);
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[.,/#!$%^&*;:{}=\-_`~()?]/g, "")
    .replace(/\s+/g, " ");
}
