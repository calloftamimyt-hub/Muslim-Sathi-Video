import { Device } from '@capacitor/device';
import { collection, query, where, getDocs, doc, setDoc } from 'firebase/firestore';
import { db, auth } from './firebase';
import { signOut, deleteUser } from 'firebase/auth';

export const getDeviceId = async (): Promise<string> => {
  try {
    const info = await Device.getId();
    if (info && info.identifier) {
      return info.identifier;
    }
  } catch (e) {
    console.warn('Capacitor Device plugin not available, falling back to localStorage');
  }

  // Fallback for web or if plugin fails
  let deviceId = localStorage.getItem('app_device_id');
  if (!deviceId) {
    deviceId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    localStorage.setItem('app_device_id', deviceId);
  }
  return deviceId;
};

export const checkAndRegisterDevice = async (uid: string, isNewRegistration: boolean = false): Promise<boolean> => {
  try {
    const deviceId = await getDeviceId();
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('deviceId', '==', deviceId));
    const snapshot = await getDocs(q);

    let deviceUsedByOther = false;
    snapshot.forEach(doc => {
      if (doc.id !== uid) {
        deviceUsedByOther = true;
      }
    });

    if (deviceUsedByOther) {
      if (isNewRegistration && auth.currentUser) {
        await deleteUser(auth.currentUser).catch(console.error);
      } else {
        await signOut(auth);
      }
      throw new Error("এই ডিভাইসে ইতিমধ্যে একটি অ্যাকাউন্ট খোলা আছে। একটি ডিভাইসে একাধিক অ্যাকাউন্ট ব্যবহার করা নিষেধ।");
    }

    // If safe, register this device to the current user
    await setDoc(doc(db, 'users', uid), { deviceId }, { merge: true });
    return true;
  } catch (error: any) {
    if (error.message.includes("একাধিক অ্যাকাউন্ট")) {
      throw error;
    }
    console.error("Device check error:", error);
    return true;
  }
};

