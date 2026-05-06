import { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from './firebase';

export function useSyncPresets<T>(key: string, defaultVal: T) {
  const [presets, setPresets] = useState<T>(() => {
    try {
      const saved = localStorage.getItem(key);
      return saved ? JSON.parse(saved) : defaultVal;
    } catch {
      return defaultVal;
    }
  });

  const [loadingFirebase, setLoadingFirebase] = useState(true);

  // Sync to local storage
  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(presets));
  }, [presets, key]);

  // Load from Firebase
  useEffect(() => {
    const loadFromFirebase = async () => {
      if (!auth.currentUser) {
         setLoadingFirebase(false);
         return;
      }
      try {
        const docRef = doc(db, 'presets', `${auth.currentUser.uid}_${key}`);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.presets) {
             const remotePresets = JSON.parse(data.presets);
             
             // Merge logic for arrays of objects with 'id'
             setPresets(prev => {
                if (Array.isArray(prev) && Array.isArray(remotePresets)) {
                   const merged = [...prev];
                   remotePresets.forEach(rp => {
                      const idx = merged.findIndex(p => p.id === rp.id);
                      if (idx >= 0) {
                         // Decide if we should overwrite or not... let's overwrite local with remote
                         merged[idx] = rp;
                      } else {
                         merged.push(rp); // Add new remote ones
                      }
                   });
                   return merged as any as T;
                }
                return remotePresets;
             });
          }
        }
      } catch (err) {
        console.error("Error loading presets from Firebase:", err);
      } finally {
        setLoadingFirebase(false);
      }
    };

    
    // Auth state observer to trigger load
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        loadFromFirebase();
      } else {
        setLoadingFirebase(false);
      }
    });

    return () => unsubscribe();
  }, [key]);

  // Save to Firebase function
  const saveToFirebase = async (data: T) => {
    if (!auth.currentUser) return;
    try {
      const docRef = doc(db, 'presets', `${auth.currentUser.uid}_${key}`);
      await setDoc(docRef, {
        userId: auth.currentUser.uid,
        labId: key,
        presets: JSON.stringify(data),
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (err) {
      console.error("Error saving to Firebase:", err);
    }
  };

  // Wrapper for setPresets
  const updatePresets = (updater: T | ((prev: T) => T)) => {
    setPresets((prev) => {
       const nextVal = typeof updater === 'function' ? (updater as any)(prev) : updater;
       saveToFirebase(nextVal);
       return nextVal;
    });
  };

  return [presets, updatePresets, loadingFirebase] as const;
}
