'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  UtensilsCrossed,
  Store,
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Globe2,
  DollarSign,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Sparkles,
  Coffee,
  Flame,
  Wine,
  ShieldCheck,
  Building2,
  Loader2
} from 'lucide-react';
import toast from 'react-hot-toast';
import { cloudApi } from '@/lib/api';

const COUNTRIES = [
  { code: 'IN', name: 'India', currency: 'INR', symbol: '₹', timezone: 'Asia/Kolkata' },
  { code: 'AE', name: 'United Arab Emirates', currency: 'AED', symbol: 'AED', timezone: 'Asia/Dubai' },
  { code: 'US', name: 'United States', currency: 'USD', symbol: '$', timezone: 'America/New_York' },
  { code: 'GB', name: 'United Kingdom', currency: 'GBP', symbol: '£', timezone: 'Europe/London' },
  { code: 'SA', name: 'Saudi Arabia', currency: 'SAR', symbol: 'SAR', timezone: 'Asia/Riyadh' },
  { code: 'SG', name: 'Singapore', currency: 'SGD', symbol: 'S$', timezone: 'Asia/Singapore' },
  { code: 'CA', name: 'Canada', currency: 'CAD', symbol: 'CA$', timezone: 'America/Toronto' },
  { code: 'AU', name: 'Australia', currency: 'AUD', symbol: 'A$', timezone: 'Australia/Sydney' },
];

export default function SaaSQuickRegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Form State
  const [restaurantName, setRestaurantName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedCountry, setSelectedCountry] = useState(COUNTRIES[0]);
  const [serviceModel, setServiceModel] = useState<'qsr' | 'cafe' | 'finedine'>('qsr');

  const handleStep1Submit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!restaurantName.trim() || restaurantName.length < 2) {
      toast.error('Please enter a valid restaurant name');
      return;
    }
    if (!ownerName.trim() || ownerName.length < 2) {
      toast.error('Please enter the owner or manager name');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      toast.error('Please enter a valid email address');
      return;
    }
    if (!password || password.length < 8) {
      toast.error('Password must be at least 8 characters long');
      return;
    }

    setStep(2);
  };

  const handleFinalSubmit = async () => {
    setLoading(true);

    try {
      const response = await cloudApi.post('/api/auth/register', {
        restaurant_name: restaurantName.trim(),
        owner_name: ownerName.trim(),
        email: email.trim().toLowerCase(),
        password,
        country: selectedCountry.code,
        currency: selectedCountry.currency,
        timezone: selectedCountry.timezone,
        service_model: serviceModel,
      });

      const data = response.data;
      if (data.token && data.user) {
        // Store JWT and tenant credentials in localStorage
        localStorage.setItem('token', data.token);
        localStorage.setItem('cloud_token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        localStorage.setItem('tenant', JSON.stringify({
          id: data.user.organization_id,
          name: data.user.organization_name,
          currency: data.user.currency,
          timezone: data.user.timezone,
          branchId: data.branch?.id,
        }));

        toast.success(`Welcome to Order It Up, ${data.user.name}!`);
        // Redirect into Cloud Portal with onboarding celebration
        router.push('/cloud-portal?onboarded=true');
      } else {
        toast.error('Failed to complete onboarding');
      }
    } catch (err: any) {
      console.error('Registration failed:', err);
      const msg = err.response?.data?.error || err.message || 'Registration failed. Please try again.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8 selection:bg-orange-500 selection:text-white relative overflow-hidden">
      {/* Background Ambience */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[300px] bg-orange-500/10 blur-[130px] rounded-full pointer-events-none" />

      {/* Brand Header */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center relative z-10">
        <Link href="/" className="inline-flex items-center gap-2 mb-4 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-orange-600 to-amber-500 flex items-center justify-center shadow-lg shadow-orange-500/20 group-hover:scale-105 transition-transform">
            <UtensilsCrossed className="w-6 h-6 text-white" />
          </div>
          <span className="text-2xl font-black tracking-tight text-white">Order It Up</span>
        </Link>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          {step === 1 ? 'Start Your Free Restaurant Trial' : 'Select Your Restaurant Style'}
        </h2>
        <p className="mt-2 text-xs sm:text-sm text-slate-400">
          {step === 1
            ? 'Unified Cloud POS • Multi-Branch Ready • Zero Hardware Lock-in'
            : 'We will automatically pre-populate your starter menu & categories.'}
        </p>

        {/* Progress indicator */}
        <div className="flex items-center justify-center gap-2 mt-6">
          <div className={`h-1.5 rounded-full transition-all duration-300 ${step === 1 ? 'w-10 bg-orange-500' : 'w-4 bg-emerald-500'}`} />
          <div className={`h-1.5 rounded-full transition-all duration-300 ${step === 2 ? 'w-10 bg-orange-500' : 'w-4 bg-slate-800'}`} />
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-xl relative z-10 px-4">
        <div className="bg-slate-900/80 border border-slate-800 backdrop-blur-xl p-6 sm:p-10 shadow-2xl rounded-3xl">
          {step === 1 ? (
            <form onSubmit={handleStep1Submit} className="space-y-5">
              {/* Restaurant Name */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                  Restaurant / Brand Name
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <Store className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={restaurantName}
                    onChange={(e) => setRestaurantName(e.target.value)}
                    placeholder="e.g. TasteCraft Cafe & Bistro"
                    className="w-full pl-10 pr-4 py-3 bg-slate-950/80 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
                  />
                </div>
              </div>

              {/* Owner Name */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                  Owner / General Manager Name
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                    placeholder="e.g. Vikram Malhotra"
                    className="w-full pl-10 pr-4 py-3 bg-slate-950/80 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
                  />
                </div>
              </div>

              {/* Email Address */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                  Business Email Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="owner@tastecraft.com"
                    className="w-full pl-10 pr-4 py-3 bg-slate-950/80 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                  Create Master Password (min. 8 characters)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full pl-10 pr-11 py-3 bg-slate-950/80 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Country & Currency Selection */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                  Operating Country & Base Currency
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <select
                    value={selectedCountry.code}
                    onChange={(e) => {
                      const c = COUNTRIES.find((x) => x.code === e.target.value) || COUNTRIES[0];
                      setSelectedCountry(c);
                    }}
                    className="w-full px-3.5 py-3 bg-slate-950/80 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all cursor-pointer"
                  >
                    {COUNTRIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.name} ({c.currency})
                      </option>
                    ))}
                  </select>

                  <div className="px-3.5 py-3 bg-slate-950/40 border border-slate-800/60 rounded-xl flex items-center justify-between text-xs text-slate-400">
                    <span>Currency Symbol:</span>
                    <span className="font-mono font-bold text-orange-400">{selectedCountry.symbol}</span>
                  </div>
                </div>
              </div>

              {/* Submit Step 1 */}
              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-3.5 px-4 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold rounded-xl shadow-lg shadow-orange-500/20 flex items-center justify-center gap-2 transition-all transform hover:-translate-y-0.5 cursor-pointer"
                >
                  <span>Continue to Menu Setup</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                {/* QSR Option */}
                <button
                  type="button"
                  onClick={() => setServiceModel('qsr')}
                  className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                    serviceModel === 'qsr'
                      ? 'bg-orange-500/10 border-orange-500/60 shadow-lg shadow-orange-500/10 ring-1 ring-orange-500/40'
                      : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="w-10 h-10 rounded-xl bg-orange-500/20 text-orange-400 flex items-center justify-center mb-3">
                    <Flame className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-sm">Fast Food & QSR</h4>
                    <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                      Burgers, fries, rolls, combos, and rapid counter checkout.
                    </p>
                  </div>
                </button>

                {/* Cafe Option */}
                <button
                  type="button"
                  onClick={() => setServiceModel('cafe')}
                  className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                    serviceModel === 'cafe'
                      ? 'bg-amber-500/10 border-amber-500/60 shadow-lg shadow-amber-500/10 ring-1 ring-amber-500/40'
                      : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center mb-3">
                    <Coffee className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-sm">Cafe & Bakery</h4>
                    <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                      Espresso, artisan teas, croissants, cakes, and sandwiches.
                    </p>
                  </div>
                </button>

                {/* Fine Dine Option */}
                <button
                  type="button"
                  onClick={() => setServiceModel('finedine')}
                  className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                    serviceModel === 'finedine'
                      ? 'bg-rose-500/10 border-rose-500/60 shadow-lg shadow-rose-500/10 ring-1 ring-rose-500/40'
                      : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center mb-3">
                    <Wine className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-sm">Fine Dine & Bar</h4>
                    <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                      Multi-course dining, table management, bar KOTs, and tips.
                    </p>
                  </div>
                </button>
              </div>

              {/* Summary pill */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-400 space-y-2">
                <div className="flex justify-between items-center text-slate-300">
                  <span>Organization Name:</span>
                  <span className="font-semibold text-white">{restaurantName}</span>
                </div>
                <div className="flex justify-between items-center text-slate-300">
                  <span>Primary Outlet:</span>
                  <span className="font-semibold text-white">Main Outlet (BR-01)</span>
                </div>
                <div className="flex justify-between items-center text-slate-300">
                  <span>Currency & Region:</span>
                  <span className="font-semibold text-white">{selectedCountry.currency} ({selectedCountry.name})</span>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  disabled={loading}
                  className="px-4 py-3.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back</span>
                </button>

                <button
                  type="button"
                  onClick={handleFinalSubmit}
                  disabled={loading}
                  className="flex-1 py-3.5 px-4 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold rounded-xl shadow-lg shadow-orange-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Provisioning Restaurant...</span>
                    </>
                  ) : (
                    <>
                      <span>Complete Setup & Launch Cloud HQ</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Footer Link */}
          <div className="mt-6 pt-5 border-t border-slate-800 text-center space-y-2">
            <div>
              <span className="text-xs text-slate-400">Already have an account? </span>
              <Link href="/auth/login" className="text-xs font-semibold text-orange-400 hover:text-orange-300 transition-colors">
                Sign in to Cloud HQ
              </Link>
            </div>
            <div>
              <Link href="/" className="text-xs text-slate-500 hover:text-slate-300 transition-colors inline-flex items-center gap-1">
                ← Back to Order It Up Home
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
