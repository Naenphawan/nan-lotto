import { initializeApp, getApps, getApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: "AIzaSyAyhKiUXljKm29-ewUn8edKdjDvP87nP18",
  authDomain: "nan-lotto.firebaseapp.com",
  projectId: "nan-lotto",
  storageBucket: "nan-lotto.firebasestorage.app",
  messagingSenderId: "303095849746",
  appId: "1:303095849746:web:f8d4429e6ee627c9d649cb",
}

// 🔥 กัน init ซ้ำ (Next จะ import หลายรอบ)
const app = !getApps().length
  ? initializeApp(firebaseConfig)
  : getApp()

export const db = getFirestore(app)
