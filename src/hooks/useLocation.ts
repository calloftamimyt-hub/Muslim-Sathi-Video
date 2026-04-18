import { useState, useEffect } from 'react';
import { auth, db, handleFirestoreError, OperationType } from '@/lib/firebase';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { Geolocation } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';

export interface LocationState {
  latitude: number | null;
  longitude: number | null;
  country: string | null;
  city: string | null;
  error: string | null;
  loading: boolean;
  isManual?: boolean;
}

export function useLocation(language: string = 'bn') {
  const [location, setLocation] = useState<LocationState>(() => {
    const saved = localStorage.getItem('userLocation');
    const savedLang = localStorage.getItem('userLocationLang');
    if (saved && savedLang === language) {
      return { ...JSON.parse(saved), loading: false };
    }
    return {
      latitude: null,
      longitude: null,
      country: null,
      city: null,
      error: null,
      loading: true,
    };
  });

  useEffect(() => {
    const handleLocationUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<LocationState>;
      setLocation(customEvent.detail);
    };

    window.addEventListener('locationUpdated', handleLocationUpdate);

    // Sync with Firestore if user is logged in
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const path = `users/${user.uid}`;
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists() && userDoc.data().location) {
            // Firestore data sync logic could go here
          }
        } catch (err) {
          handleFirestoreError(err, OperationType.GET, path);
        }
      }
    });

    // Only fetch if not already saved or if explicitly requested
    const saved = localStorage.getItem('userLocation');
    const savedLang = localStorage.getItem('userLocationLang');
    
    if (!saved || savedLang !== language) {
      const fetchByIP = async () => {
        try {
          const res = await fetch('https://ipapi.co/json/');
          const data = await res.json();
          if (data.latitude && data.longitude) {
            // Try to get localized city name using coordinates from IP
            try {
              const geoRes = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${data.latitude}&longitude=${data.longitude}&localityLanguage=${language}`);
              const geoData = await geoRes.json();
              const unknownCity = language === 'bn' ? 'অজানা স্থান' : language === 'ar' ? 'মوقع غير معروف' : language === 'hi' ? 'অज्ञात স্থান' : 'Unknown Location';
              const city = geoData.city || geoData.locality || data.city || data.region || unknownCity;
              const country = geoData.countryName || data.country_name || null;
              
              const newLocation = { 
                latitude: data.latitude, 
                longitude: data.longitude, 
                country,
                city, 
                error: null, 
                loading: false,
                isManual: false
              };
              setLocation(newLocation);
              localStorage.setItem('userLocation', JSON.stringify(newLocation));
              localStorage.setItem('userLocationLang', language);
              return true;
            } catch (e) {
              const unknownCity = language === 'bn' ? 'অজানা স্থান' : language === 'ar' ? 'মوقع غير معروف' : language === 'hi' ? 'অज्ञात স্থান' : 'Unknown Location';
              const newLocation = { 
                latitude: data.latitude, 
                longitude: data.longitude, 
                country: data.country_name || null,
                city: data.city || data.region || unknownCity, 
                error: null, 
                loading: false,
                isManual: false
              };
              setLocation(newLocation);
              localStorage.setItem('userLocation', JSON.stringify(newLocation));
              localStorage.setItem('userLocationLang', language);
              return true;
            }
          }
        } catch (e) {
          return false;
        }
        return false;
      };

      const handleSuccess = async (latitude: number, longitude: number, isManual: boolean = false) => {
        try {
          const res = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=${language}`);
          const data = await res.json();
          const unknownCity = language === 'bn' ? 'অজানা স্থান' : language === 'ar' ? 'মوقع غير معروف' : language === 'hi' ? 'অज्ञात স্থান' : 'Unknown Location';
          const city = data.city || data.locality || unknownCity;
          const country = data.countryName || null;
          
          const newLocation = { latitude, longitude, country, city, error: null, loading: false, isManual };
          setLocation(newLocation);
          localStorage.setItem('userLocation', JSON.stringify(newLocation));
          localStorage.setItem('userLocationLang', language);
        } catch (e) {
          const unknownCity = language === 'bn' ? 'অজানা স্থান' : language === 'ar' ? 'মوقع غير معروف' : language === 'hi' ? 'অज्ञात স্থান' : 'Unknown Location';
          const newLocation = { latitude, longitude, country: null, city: unknownCity, error: null, loading: false, isManual };
          setLocation(newLocation);
          localStorage.setItem('userLocation', JSON.stringify(newLocation));
          localStorage.setItem('userLocationLang', language);
        }
      };

      const handleError = async (error: any) => {
        console.error('Location error:', error);
        const success = await fetchByIP();
        if (!success) {
          const defaultCity = language === 'bn' ? 'ঢাকা' : language === 'ar' ? 'دকা' : language === 'hi' ? 'ढाকা' : 'Dhaka';
          const defaultError = language === 'bn' ? 'লোকেশন পাওয়া যায়নি। ডিফল্ট ঢাকা ব্যবহার করা হচ্ছে।' : language === 'ar' ? 'لم يتم العথور على الموقع. استخدام دكا الافتراضي.' : language === 'hi' ? 'স্থান नहीं मिला। ডিফল্ট ঢাকা ব্যবহার করা হচ্ছে।' : 'Location not found. Using default Dhaka.';
          const defaultLocation = { latitude: 23.8103, longitude: 90.4125, country: language === 'bn' ? 'বাংলাদেশ' : 'Bangladesh', city: defaultCity, error: defaultError, loading: false, isManual: false };
          setLocation(defaultLocation);
          localStorage.setItem('userLocation', JSON.stringify(defaultLocation));
          localStorage.setItem('userLocationLang', language);
        }
      };

      const requestLocation = async () => {
        const savedData = localStorage.getItem('userLocation');
        const parsedSaved = savedData ? JSON.parse(savedData) : null;

        // If manual location exists but language changed, just re-localize
        if (parsedSaved?.isManual && parsedSaved.latitude && parsedSaved.longitude) {
          handleSuccess(parsedSaved.latitude, parsedSaved.longitude, true);
          return;
        }

        if (Capacitor.isNativePlatform()) {
          try {
            const permission = await Geolocation.checkPermissions();
            if (permission.location !== 'granted') {
              await Geolocation.requestPermissions();
            }
            const position = await Geolocation.getCurrentPosition({
              enableHighAccuracy: true,
              timeout: 10000
            });
            handleSuccess(position.coords.latitude, position.coords.longitude);
          } catch (err) {
            handleError(err);
          }
        } else if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (pos) => handleSuccess(pos.coords.latitude, pos.coords.longitude),
            handleError,
            { timeout: 10000, enableHighAccuracy: true }
          );
        } else {
          fetchByIP().then(success => {
            if (!success) {
              handleError('Geolocation not supported');
            }
          });
        }
      };

      requestLocation();
    }

    return () => {
      window.removeEventListener('locationUpdated', handleLocationUpdate);
      unsubscribeAuth();
    };
  }, [language]);

  return location;
}

export const updateUserLocation = async (newLocation: Partial<LocationState>, language?: string) => {
  const saved = localStorage.getItem('userLocation');
  const current = saved ? JSON.parse(saved) : {
    latitude: 23.8103,
    longitude: 90.4125,
    country: 'Bangladesh',
    city: 'Dhaka',
    error: null,
    loading: false,
    isManual: false,
  };
  
  const updated = { ...current, ...newLocation, loading: false, isManual: true };
  localStorage.setItem('userLocation', JSON.stringify(updated));
  if (language) {
    localStorage.setItem('userLocationLang', language);
  }
  window.dispatchEvent(new CustomEvent('locationUpdated', { detail: updated }));

  // Update Firestore if user is logged in
  const user = auth.currentUser;
  if (user && updated.city) {
    const path = `users/${user.uid}`;
    try {
      await setDoc(doc(db, 'users', user.uid), {
        location: {
          city: updated.city,
          country: updated.country,
          latitude: updated.latitude,
          longitude: updated.longitude
        },
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  }
};
