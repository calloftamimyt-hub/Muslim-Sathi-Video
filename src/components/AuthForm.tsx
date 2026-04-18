import React, { useState } from 'react';
import { Mail, Lock, Phone, User, LogIn, UserPlus } from 'lucide-react';
import { auth, db } from '../lib/firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { checkAndRegisterDevice } from '../lib/device';

interface AuthFormProps {
  initialMode?: 'login' | 'register';
  onSuccess?: () => void;
}

export function AuthForm({ initialMode = 'login', onSuccess }: AuthFormProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    emailOrPhone: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const isValidEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      if (mode === 'register') {
        if (formData.password !== formData.confirmPassword) {
          throw new Error("Passwords do not match!");
        }
        if (formData.password.length < 6) {
          throw new Error("Password must be at least 6 characters!");
        }

        const userCredential = await createUserWithEmailAndPassword(auth, formData.email.trim(), formData.password);
        await checkAndRegisterDevice(userCredential.user.uid, true);
        await updateProfile(userCredential.user, {
          displayName: `${formData.firstName.trim()} ${formData.lastName.trim()}`,
        });
        
        // Save user data to Firestore
        let formattedPhone = formData.phone.trim();
        if (formattedPhone.startsWith('01')) {
          formattedPhone = '+88' + formattedPhone;
        }
        
        try {
          await setDoc(doc(db, 'users', userCredential.user.uid), {
            displayName: `${formData.firstName.trim()} ${formData.lastName.trim()}`,
            phoneNumber: formattedPhone,
            role: 'client',
            updatedAt: serverTimestamp(),
          }, { merge: true });
        } catch (e) {
          console.error("Failed to create user document:", e);
        }

        // Initialize user balance
        try {
          await setDoc(doc(db, 'user_balances', userCredential.user.uid), {
            userId: userCredential.user.uid,
            totalEarned: 0,
            currentBalance: 0,
            depositBalance: 0,
            updatedAt: serverTimestamp(),
          }, { merge: true });
        } catch (e) {
          console.error("Failed to initialize balance:", e);
        }
        
        if (onSuccess) onSuccess();
      } else {
        if (!isValidEmail(formData.emailOrPhone.trim())) {
          throw new Error("Please enter a valid email address.");
        }
        const userCredential = await signInWithEmailAndPassword(auth, formData.emailOrPhone.trim(), formData.password);
        await checkAndRegisterDevice(userCredential.user.uid, false);
        
        if (onSuccess) onSuccess();
      }
    } catch (err: any) {
      console.error("Auth Error:", err);
      let errorMessage = err.message || "Something went wrong. Please try again.";
      
      if (err.code === 'auth/invalid-email') {
        errorMessage = "Invalid email address.";
      } else if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        errorMessage = "Incorrect email or password.";
      } else if (err.code === 'auth/email-already-in-use') {
        errorMessage = "An account already exists with this email.";
      } else if (err.code === 'auth/weak-password') {
        errorMessage = "Password is too weak. Use at least 6 characters.";
      } else if (err.code === 'auth/network-request-failed') {
        errorMessage = "Check your internet connection.";
      } else if (err.code === 'auth/operation-not-allowed') {
        errorMessage = "Email/Password login is not enabled. Contact admin.";
      } else if (err.message && err.message.includes("একাধিক অ্যাকাউন্ট")) {
        errorMessage = err.message;
      } else if (err.message && err.message.includes("Firebase:")) {
        // Hide raw firebase errors if not caught by above
        errorMessage = "Something went wrong. Please try again.";
      }

      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full h-full min-h-screen flex flex-col justify-center max-w-md mx-auto px-4 py-4 bg-white dark:bg-slate-950">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">
          {mode === 'login' ? 'Welcome Back' : 'Create Account'}
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {mode === 'login' ? 'Login to your account' : 'Fill in the details below to register'}
        </p>
      </div>

      <div className="flex space-x-2 mb-4 bg-slate-100 dark:bg-slate-900 p-1 rounded-lg">
          <button
            onClick={() => { setMode('login'); setError(''); setSuccess(''); }}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
              mode === 'login' 
                ? 'bg-white dark:bg-slate-800 text-primary dark:text-primary-light shadow-sm' 
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            Login
          </button>
          <button
            onClick={() => { setMode('register'); setError(''); setSuccess(''); }}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
              mode === 'register' 
                ? 'bg-white dark:bg-slate-800 text-primary dark:text-primary-light shadow-sm' 
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            Registration
          </button>
        </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-lg border border-red-100 dark:border-red-900/30">
          {error}
        </div>
      )}
      
      {success && (
        <div className="mb-4 p-3 bg-primary-light/20 dark:bg-primary-dark/20 text-primary dark:text-primary-light text-sm rounded-lg border border-primary-light/30 dark:border-primary-dark/30">
          {success}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        {mode === 'register' ? (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400">First Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    name="firstName"
                    required
                    value={formData.firstName}
                    onChange={handleChange}
                    className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none dark:text-white"
                    placeholder="First Name"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Last Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    name="lastName"
                    required
                    value={formData.lastName}
                    onChange={handleChange}
                    className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none dark:text-white"
                    placeholder="Last Name"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="email"
                  name="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none dark:text-white"
                  placeholder="your@email.com"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Mobile Number</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="tel"
                  name="phone"
                  required
                  value={formData.phone}
                  onChange={handleChange}
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none dark:text-white"
                  placeholder="01XXXXXXXXX"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="password"
                  name="password"
                  required
                  value={formData.password}
                  onChange={handleChange}
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none dark:text-white"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Confirm Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="password"
                  name="confirmPassword"
                  required
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none dark:text-white"
                  placeholder="••••••••"
                />
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Email</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="email"
                  name="emailOrPhone"
                  required
                  value={formData.emailOrPhone}
                  onChange={handleChange}
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none dark:text-white"
                  placeholder="your@email.com"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="password"
                  name="password"
                  required
                  value={formData.password}
                  onChange={handleChange}
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none dark:text-white"
                  placeholder="••••••••"
                />
              </div>
            </div>
          </>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center bg-primary text-white px-4 py-2.5 rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-70 font-medium mt-2"
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : mode === 'login' ? (
            <>
              <LogIn className="w-4 h-4 mr-2" />
              Login
            </>
          ) : (
            <>
              <UserPlus className="w-4 h-4 mr-2" />
              Create Account
            </>
          )}
        </button>
      </form>
    </div>
  );
}
