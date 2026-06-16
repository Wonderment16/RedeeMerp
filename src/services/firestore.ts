import { initializeApp, type FirebaseApp } from "firebase/app";
import { getFirestore, collection, addDoc, serverTimestamp } from "firebase/firestore";

let app: FirebaseApp | null = null;

function getFirebaseConfig() {
  const rawConfig = import.meta.env.VITE_FIREBASE_CONFIG;
  if (!rawConfig) return null;

  try {
    return JSON.parse(rawConfig) as Record<string, string>;
  } catch {
    console.warn("[firestore] VITE_FIREBASE_CONFIG must be valid JSON.");
    return null;
  }
}

export async function logNavigationEvent(eventName: string, payload: Record<string, unknown>) {
  const config = getFirebaseConfig();
  if (!config) return;

  app ??= initializeApp(config);
  const db = getFirestore(app);
  await addDoc(collection(db, "navigationEvents"), {
    eventName,
    payload,
    createdAt: serverTimestamp(),
  });
}
