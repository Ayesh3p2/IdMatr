'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function MfaVerifyPage() {
  const [verificationCode, setVerificationCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Get the redirect URL from query params, default to '/dashboard'
  const redirectTo = searchParams.get('redirect') || '/dashboard';

  useEffect(() => {
    // Check if user is already authenticated
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/control/auth/me', {
          credentials: 'include',
        });
        
        if (!response.ok) {
          // Not authenticated, redirect to login
          router.push('/login');
          return;
        }
        
        const userData = await response.json();
        
        // If MFA is not enabled, redirect to setup
        if (!userData.mfaEnabled) {
          router.push('/mfa-setup');
          return;
        }
      } catch (err) {
        router.push('/login');
      }
    };
    
    checkAuth();
  }, [router]);

  const handleVerify = async () => {
    if (!verificationCode) return;
    
    setVerifying(true);
    setError('');
    
    try {
      const response = await fetch('/api/control/auth/mfa/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ code: verificationCode }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Invalid verification code');
      }
      
      const result = await response.json();
      
      // MFA verified successfully, redirect to intended destination
      router.push(result.redirectTo || redirectTo);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setVerifying(false);
    }
  };

  const handleResend = async () => {
    // This could trigger a new setup if needed
    setError('');
    setVerificationCode('');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="text-center text-3xl font-extrabold text-gray-900">
          Verify Your Identity
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Enter the 6-digit code from your authenticator app
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <div className="space-y-6">
            {/* Verification Code Input */}
            <div>
              <label htmlFor="verification-code" className="block text-sm font-medium text-gray-700 mb-2">
                Authentication Code
              </label>
              <input
                id="verification-code"
                type="text"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/\s/g, ''))}
                placeholder="000000"
                className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-center text-lg font-mono"
                maxLength={6}
                autoFocus
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && verificationCode.length === 6) {
                    handleVerify();
                  }
                }}
              />
            </div>

            {/* Error Message */}
            {error && (
              <div className="text-red-600 text-sm text-center bg-red-50 p-3 rounded">
                {error}
              </div>
            )}

            {/* Verify Button */}
            <button
              onClick={handleVerify}
              disabled={!verificationCode || verificationCode.length !== 6 || verifying}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {verifying ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Verifying...
                </>
              ) : (
                'Verify'
              )}
            </button>

            {/* Help Section */}
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-2">
                Having trouble?
              </p>
              <div className="space-x-4">
                <button
                  onClick={handleResend}
                  className="text-sm text-blue-600 hover:text-blue-500"
                >
                  Resend Code
                </button>
                <span className="text-gray-400">•</span>
                <button
                  onClick={() => router.push('/mfa-setup')}
                  className="text-sm text-blue-600 hover:text-blue-500"
                >
                  Setup MFA Again
                </button>
              </div>
            </div>

            {/* Security Notice */}
            <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-blue-800">
                    This additional security step helps protect your account from unauthorized access.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
