import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { 
  initializeFirestore, 
  doc, 
  getDocFromServer, 
  terminate,
  clearIndexedDbPersistence
} from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

// Use initializeFirestore to allow setting experimentalForceLongPolling
// This helps in environments where WebSockets might be blocked or flaky
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
}, (firebaseConfig as any).firestoreDatabaseId && (firebaseConfig as any).firestoreDatabaseId !== '(default)' 
    ? (firebaseConfig as any).firestoreDatabaseId 
    : undefined);

export const auth = getAuth(app);
export const storage = getStorage(app);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  
  const errInfo: FirestoreErrorInfo = {
    error: errorMessage,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path
  }
  
  const jsonError = JSON.stringify(errInfo);
  console.error('Firestore Error: ', jsonError);

  // If offline, we might want to provide a more user-friendly message
  if (errorMessage.toLowerCase().includes('offline')) {
    console.warn("Firestore appears to be offline. Local cache will be used if available. Check if Firestore is enabled in Firebase Console.");
  }
  
  throw new Error(jsonError);
}

export async function testConnection() {
  try {
    // Attempting to fetch a dummy doc to verify connectivity
    // Using getDocFromServer specifically to force a network check
    console.log("Testing Firebase connectivity...");
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log("✅ Firebase connection verified.");
  } catch (error: any) {
    const msg = error?.message || String(error);
    if (msg.toLowerCase().includes('offline')) {
      console.error(`❌ Firebase is offline. Raw error: ${msg}\nPossible causes:\n1. Firestore is not initialized in the console for project "${firebaseConfig.projectId}".\n2. Network restricts WebSockets/Long Polling.\n3. API Key restricted.`);
    } else {
      console.warn("⚠️ Connection test reached server but returned an error (likely doc doesn't exist, which is fine):", msg);
    }
  }
}
