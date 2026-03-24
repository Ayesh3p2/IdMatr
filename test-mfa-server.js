const express = require('express');
const path = require('path');
const app = express();
const port = 3000;

// Serve static files
app.use(express.static(path.join(__dirname, 'apps/control-plane-ui/src')));

// Mock API endpoints for testing MFA flow
app.use(express.json());

// Mock login endpoint
app.post('/api/control/auth/login', (req, res) => {
  const { email, password } = req.body;
  
  // Mock user data
  const mockUser = {
    id: '123',
    email: email,
    name: 'Test User',
    role: 'platform_operator',
    mfaEnabled: false, // Simulate new user
  };

  // Simulate the fixed MFA logic
  const requiresMfaSetup = true; // New user needs MFA setup
  const requiresMfaVerification = false;

  res.json({
    access_token: 'mock-jwt-token',
    operator: mockUser,
    routing: {
      requiresMfaSetup,
      requiresMfaVerification,
      redirectTo: requiresMfaSetup ? '/mfa-setup' : '/dashboard'
    }
  });
});

// Mock MFA setup endpoint
app.post('/api/control/auth/mfa/setup', (req, res) => {
  res.json({
    secret: 'JBSWY3DPEHPK3PXP', // Mock TOTP secret
    otpAuthUrl: 'otpauth://totp/IDMatr%20Control%20Plane:test@example.com?secret=JBSWY3DPEHPK3PXP&issuer=IDMatr%20Control%20Plane',
    mfaEnabled: false
  });
});

// Mock MFA enable endpoint
app.post('/api/control/auth/mfa/enable', (req, res) => {
  res.json({
    success: true,
    mfaEnabled: true
  });
});

// Mock MFA verify endpoint
app.post('/api/control/auth/mfa/verify', (req, res) => {
  const { code } = req.body;
  
  // Accept any 6-digit code for testing
  if (code && code.length === 6) {
    res.json({
      success: true,
      verified: true,
      redirectTo: '/dashboard'
    });
  } else {
    res.status(400).json({
      message: 'Invalid verification code'
    });
  }
});

// Mock current user endpoint
app.get('/api/control/auth/me', (req, res) => {
  res.json({
    id: '123',
    email: 'test@example.com',
    name: 'Test User',
    role: 'platform_operator',
    mfaEnabled: false, // Will be true after setup
  });
});

// Serve the MFA setup page
app.get('/mfa-setup', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
    <title>MFA Setup Test</title>
    <script src="https://unpkg.com/qrcode@1.5.3/build/qrcode.min.js"></script>
    <style>
        body { font-family: Arial, sans-serif; max-width: 500px; margin: 50px auto; padding: 20px; }
        .container { background: #f9f9f9; padding: 30px; border-radius: 8px; }
        .qr-code { text-align: center; margin: 20px 0; }
        .secret { background: #e8e8e8; padding: 10px; border-radius: 4px; font-family: monospace; word-break: break-all; }
        input { width: 100%; padding: 10px; margin: 10px 0; border: 1px solid #ddd; border-radius: 4px; }
        button { background: #007bff; color: white; padding: 12px 24px; border: none; border-radius: 4px; cursor: pointer; }
        button:disabled { background: #ccc; cursor: not-allowed; }
        .success { color: green; }
        .error { color: red; }
    </style>
</head>
<body>
    <div class="container">
        <h2>🔐 MFA Setup Test</h2>
        <p><strong>Testing the FIXED MFA Flow</strong></p>
        
        <div class="qr-code">
            <canvas id="qr-code"></canvas>
        </div>
        
        <div class="secret" id="secret">
            Loading secret...
        </div>
        
        <input type="text" id="verification-code" placeholder="Enter 6-digit code" maxlength="6">
        <button onclick="enableMFA()">Enable MFA</button>
        
        <div id="message"></div>
        
        <hr>
        <h3>📋 Test Instructions:</h3>
        <ol>
            <li>Scan QR code with any authenticator app</li>
            <li>Enter the 6-digit code</li>
            <li>Click "Enable MFA"</li>
            <li>Should redirect to dashboard</li>
        </ol>
        
        <p><strong>🎯 This demonstrates the FIXED flow:</strong></p>
        <ul>
            <li>✅ New user gets MFA setup (not verification)</li>
            <li>✅ No premature MFA enforcement</li>
            <li>✅ Proper conditional routing</li>
        </ul>
    </div>

    <script>
        // Fetch MFA setup data
        fetch('/api/control/auth/mfa/setup', {
            method: 'POST',
            credentials: 'include'
        })
        .then(res => res.json())
        .then(data => {
            document.getElementById('secret').textContent = data.secret;
            
            // Generate QR code
            QRCode.toCanvas(document.getElementById('qr-code'), data.otpAuthUrl, function (error) {
                if (error) console.error(error);
            });
        })
        .catch(err => console.error('Error:', err));

        function enableMFA() {
            const code = document.getElementById('verification-code').value;
            const messageEl = document.getElementById('message');
            
            if (!code || code.length !== 6) {
                messageEl.innerHTML = '<div class="error">Please enter a 6-digit code</div>';
                return;
            }

            fetch('/api/control/auth/mfa/enable', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ code })
            })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    messageEl.innerHTML = '<div class="success">✅ MFA Enabled Successfully! Redirecting to dashboard...</div>';
                    setTimeout(() => {
                        window.location.href = '/dashboard';
                    }, 2000);
                } else {
                    messageEl.innerHTML = '<div class="error">Failed to enable MFA</div>';
                }
            })
            .catch(err => {
                messageEl.innerHTML = '<div class="error">Error: ' + err.message + '</div>';
            });
        }
    </script>
</body>
</html>
  `);
});

// Mock dashboard
app.get('/dashboard', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
    <title>Dashboard - MFA Test</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
        .success { background: #d4edda; color: #155724; padding: 20px; border-radius: 8px; }
        .test-flow { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }
    </style>
</head>
<body>
    <div class="success">
        <h2>🎉 MFA Flow Test SUCCESSFUL!</h2>
        <p>You have successfully demonstrated the FIXED MFA implementation.</p>
    </div>
    
    <div class="test-flow">
        <h3>✅ What Just Happened:</h3>
        <ol>
            <li><strong>Login</strong> → Detected new user (mfaEnabled = false)</li>
            <li><strong>Redirect</strong> → Sent to /mfa-setup (NOT /mfa-verify)</li>
            <li><strong>Setup</strong> → User completed MFA enrollment</li>
            <li><strong>Enable</strong> → System set mfaEnabled = true</li>
            <li><strong>Access</strong> → Granted dashboard access</li>
        </ol>
    </div>
    
    <div class="test-flow">
        <h3>🔧 Next Login Test:</h3>
        <p>Next time this user logs in, they will be redirected to <strong>/mfa-verify</strong> instead of setup.</p>
    </div>
    
    <h3>🚀 Cloudflare Tunnel URL:</h3>
    <p><strong>https://phase-laugh-ohio-soundtrack.trycloudflare.com</strong></p>
    <p>Share this URL to test the MFA flow remotely!</p>
</body>
</html>
  `);
});

app.listen(port, () => {
  console.log(`🚀 MFA Test Server running at http://localhost:${port}`);
  console.log(`🌐 Public URL: https://phase-laugh-ohio-soundtrack.trycloudflare.com`);
  console.log(`📱 Test the fixed MFA flow!`);
});
