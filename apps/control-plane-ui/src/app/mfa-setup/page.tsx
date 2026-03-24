'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface MfaSetupData {
  secret: string;
  otpAuthUrl: string;
  mfaEnabled: boolean;
}

// Simple QR code generator using Google Charts API
const generateQRCode = (text: string): string => {
  return `https://chart.googleapis.com/chart?chs=200x200&cht=qr&chl=${encodeURIComponent(text)}&choe=UTF-8`;
};

export default function MfaSetupPage() {
  const [setupData, setSetupData] = useState<MfaSetupData | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  useEffect(() => {
    fetchMfaSetup();
  }, []);

  const fetchMfaSetup = async () => {
    try {
      const response = await fetch('/api/control/auth/mfa/setup', {
        method: 'POST',
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Failed to initiate MFA setup');
      }
      
      const data = await response.json();
      setSetupData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to setup MFA');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyAndEnable = async () => {
    if (!verificationCode || !setupData) return;
    
    setVerifying(true);
    setError('');
    
    try {
      const response = await fetch('/api/control/auth/mfa/enable', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ code: verificationCode }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Verification failed');
      }
      
      // MFA enabled successfully, redirect to dashboard
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setVerifying(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Setting up MFA...</p>
        </div>
      </div>
    );
  }

  if (error && !setupData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 mb-4">❌ {error}</div>
          <button
            onClick={fetchMfaSetup}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="text-center text-3xl font-extrabold text-gray-900">
          Set Up Multi-Factor Authentication
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Scan the QR code with your authenticator app
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          {setupData && (
            <div className="space-y-6">
              {/* QR Code */}
              <div className="flex justify-center">
                <div className="bg-white p-4 rounded-lg shadow-inner">
                  {setupData && (
                    <img 
                      src={generateQRCode(setupData.otpAuthUrl)}
                      alt="QR Code for MFA Setup"
                      className="w-48 h-48"
                      onError={(e) => {
                        // Fallback if Google Charts fails
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        const fallback = target.nextElementSibling as HTMLElement;
                        if (fallback) fallback.style.display = 'block';
                      }}
                    />
                  )}
                  <div className="w-48 h-48 flex items-center justify-center hidden" style={{display: 'none'}}>
                    <div className="text-center">
                      <div className="text-4xl mb-2">📱</div>
                      <p className="text-sm text-gray-600">QR Code</p>
                      <p className="text-xs text-gray-500 mt-1">Use secret below</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Manual Entry Key */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Or enter this code manually:
                </label>
                <div className="bg-gray-100 p-3 rounded font-mono text-sm text-center break-all">
                  {setupData.secret}
                </div>
              </div>

              {/* Verification Code Input */}
              <div>
                <label htmlFor="verification-code" className="block text-sm font-medium text-gray-700 mb-2">
                  Enter Verification Code
                </label>
                <input
                  id="verification-code"
                  type="text"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/\s/g, ''))}
                  placeholder="000000"
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-center text-lg font-mono"
                  maxLength={6}
                />
              </div>

              {/* Error Message */}
              {error && (
                <div className="text-red-600 text-sm text-center bg-red-50 p-3 rounded">
                  {error}
                </div>
              )}

              {/* Enable MFA Button */}
              <button
                onClick={handleVerifyAndEnable}
                disabled={!verificationCode || verificationCode.length !== 6 || verifying}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {verifying ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Verifying...
                  </>
                ) : (
                  'Enable MFA'
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
