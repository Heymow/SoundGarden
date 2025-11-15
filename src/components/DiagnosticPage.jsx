import React, { useState } from "react";
import { BOT_API_URL } from "../config/api";

export default function DiagnosticPage() {
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [currentUrl, setCurrentUrl] = useState(BOT_API_URL);

    const addResult = (message, type = "info") => {
        setResults(prev => [...prev, {
            message,
            type,
            timestamp: new Date().toLocaleTimeString()
        }]);
    };

    const clearResults = () => {
        setResults([]);
    };

    // Test de base sans authentification
    const testBasicConnection = async (testUrl) => {
        try {
            const url = `${testUrl}/api/public/status`;
            addResult(`🧪 Testing: ${url}`, "info");

            const response = await fetch(url, {
                method: "GET",
                headers: { "Content-Type": "application/json" },
                signal: AbortSignal.timeout(10000) // 10 secondes
            });

            addResult(`📡 Response: ${response.status} ${response.statusText}`,
                response.ok ? "success" : "error");

            if (response.ok) {
                const data = await response.json();
                addResult(`✅ Bot API found! Data: ${JSON.stringify(data)}`, "success");
                return { success: true, data, url: testUrl };
            } else {
                const text = await response.text();
                addResult(`❌ Error response: ${text.substring(0, 200)}`, "error");
                return { success: false, error: `HTTP ${response.status}` };
            }
        } catch (error) {
            addResult(`❌ Connection failed: ${error.message}`, "error");
            return { success: false, error: error.message };
        }
    };

    // Test spécifique pour bot local (0.0.0.0:8080 -> localhost:8080)  
    const testLocalBotServer = async () => {
        setLoading(true);
        clearResults();

        addResult("🏠 Testing local bot server (Discord shows 0.0.0.0:8080)...", "info");

        const localVariants = [
            "http://localhost:8080",
            "http://127.0.0.1:8080",
            "http://0.0.0.0:8080",  // Unlikely to work but let's try
        ];

        let found = false;
        for (const testUrl of localVariants) {
            addResult(`🧪 Testing: ${testUrl}`, "info");

            try {
                const result = await testBasicConnection(testUrl);
                if (result.success) {
                    found = true;
                    addResult(`🎉 SUCCESS! Bot found on ${testUrl}`, "success");
                    addResult(`💡 Update your .env: VITE_BOT_API_URL=${testUrl}`, "warning");
                    break;
                }
            } catch (error) {
                addResult(`❌ Failed: ${error.message}`, "error");
            }
        }

        if (!found) {
            addResult("❌ Local bot server not accessible", "error");
            addResult("🔧 Possible issues:", "warning");
            addResult("  • CORS not configured: Run '!cw apiconfig cors *' in Discord", "warning");
            addResult("  • Firewall blocking port 8080", "warning");
            addResult("  • Bot API server crashed: Run '!cw apiserver restart' in Discord", "warning");
        }

        setLoading(false);
    };

    // Scanner plusieurs ports
    const scanPorts = async () => {
        setLoading(true);
        clearResults();

        const commonPorts = [8080, 3000, 3001, 5000, 8000, 8888, 9000];
        const baseHost = currentUrl.replace(/:\d+$/, "");

        addResult("🔍 Starting port scan...", "info");

        let found = false;
        for (const port of commonPorts) {
            const testUrl = `${baseHost}:${port}`;
            addResult(`🔍 Scanning port ${port}...`, "info");

            const result = await testBasicConnection(testUrl);
            if (result.success) {
                found = true;
                addResult(`🎉 SUCCESS! Found bot API on ${testUrl}`, "success");
                break;
            }
        }

        if (!found) {
            addResult(`❌ No bot API server found on any common port`, "error");
            addResult(`💡 Make sure to run "!cw apiserver start" in Discord first`, "warning");
        }

        setLoading(false);
    };

    // Tester l'URL configurée
    const testConfiguredUrl = async () => {
        setLoading(true);
        clearResults();

        addResult("🧪 Testing configured URL...", "info");
        const result = await testBasicConnection(currentUrl);

        if (!result.success) {
            addResult("💡 Try scanning ports to find the correct URL", "warning");
        }

        setLoading(false);
    };

    // Tester une URL personnalisée
    const testCustomUrl = async () => {
        const customUrl = prompt("Enter the bot API URL to test:", currentUrl);
        if (!customUrl) return;

        setLoading(true);
        clearResults();

        addResult(`🧪 Testing custom URL: ${customUrl}`, "info");
        await testBasicConnection(customUrl);

        setLoading(false);
    };

    // Tester des variantes Railway courantes
    const testRailwayVariants = async () => {
        setLoading(true);
        clearResults();

        addResult("🚂 Testing Railway URL patterns...", "info");

        // Extraire le domaine du backend (localhost:3001 -> railway URL pattern)
        const backendUrl = "http://localhost:3001"; // Votre backend Railway

        const railwayPatterns = [
            "https://soundgarden-bot-production.up.railway.app",
            "https://soundgarden-discord-bot-production.up.railway.app",
            "https://collabwarz-bot-production.up.railway.app",
            "https://soundgarden-production-0d5e.up.railway.app", // Même que votre backend
        ];

        for (const url of railwayPatterns) {
            addResult(`🧪 Trying Railway pattern: ${url}`, "info");
            const result = await testBasicConnection(url);
            if (result.success) {
                addResult(`🎉 SUCCESS! Found bot on Railway: ${url}`, "success");
                break;
            }
        }

        setLoading(false);
    };

    // Tester le même domaine que le backend
    const testSameDomainAsBackend = async () => {
        setLoading(true);
        clearResults();

        addResult("🌐 Testing if bot runs on same domain as backend...", "info");

        // Votre backend est sur Railway, testez si le bot y est aussi
        const backendDomain = "https://soundgarden-production-0d5e.up.railway.app";

        addResult(`🧪 Testing backend domain for bot API: ${backendDomain}`, "info");
        const result = await testBasicConnection(backendDomain);

        if (!result.success) {
            addResult("💡 Bot API not on same domain as backend", "warning");
            addResult("💡 Your bot Discord needs to be deployed separately!", "warning");
        }

        setLoading(false);
    };

    // Tester votre bot RedBot spécifique
    const testYourRedBot = async () => {
        setLoading(true);
        clearResults();

        addResult("🤖 Testing your specific RedBot instance...", "info");

        // Votre bot RedBot - Railway expose automatiquement sur port 443 (HTTPS)
        const botUrls = [
            "https://worker-production-31cd.up.railway.app",  // Railway standard (pas besoin de :8080)
            "https://worker-production-31cd.up.railway.app:8080"  // Au cas où le port serait explicite
        ];

        let found = false;
        for (const url of botUrls) {
            addResult(`🧪 Testing your RedBot: ${url}`, "info");
            const result = await testBasicConnection(url);
            if (result.success) {
                addResult(`✅ FOUND! Your RedBot API works: ${url}`, "success");
                addResult(`🎯 Update your VITE_BOT_API_URL to: ${url}`, "success");
                addResult(`📝 The CollabWarz cog API server is accessible!`, "success");
                found = true;
                break;
            }
        }

        if (!found) {
            addResult("❌ RedBot API not accessible!", "error");
            addResult("🔍 Possible issues:", "warning");
            addResult("   • CollabWarz cog not loaded: !load collabwarz", "info");
            addResult("   • API server not started: !cw apiserver start", "info");
            addResult("   • Wrong CORS config: !cw apiconfig cors *", "info");
        }

        setLoading(false);
    };

    // Checker si le bot Discord est déployé sur Railway
    const checkBotDeploymentStatus = async () => {
        setLoading(true);
        clearResults();

        addResult("🚂 Searching for Discord bots on Railway instances...", "info");

        // Test des patterns typiques pour bot Discord + votre RedBot
        const botUrls = [
            "https://worker-production-31cd.up.railway.app",  // VOTRE BOT REDBOT
            "https://soundgarden-bot-production.up.railway.app",
            "https://collabwarz-production.up.railway.app",
            "https://discord-bot-production.up.railway.app",
            "https://soundgarden-discord-production.up.railway.app",
            "https://red-discord-bot-production.up.railway.app",
            "https://red-bot-production.up.railway.app"
        ];

        let found = false;
        for (const url of botUrls) {
            addResult(`🧪 Testing: ${url}`, "info");
            const result = await testBasicConnection(url);
            if (result.success) {
                addResult(`✅ FOUND! Discord bot at: ${url}`, "success");
                addResult(`🎯 Update your VITE_BOT_API_URL to: ${url}`, "success");
                found = true;
                break;
            }
        }

        if (!found) {
            addResult("❌ No bot APIs found!", "error");
            addResult("💡 Check if CollabWarz cog is loaded and API started", "warning");
        }

        setLoading(false);
    }; return (
        <div style={{
            padding: "20px",
            maxWidth: "800px",
            margin: "0 auto",
            backgroundColor: "#f8f9fa",
            minHeight: "100vh"
        }}>
            <div style={{
                background: "#ffffff",
                padding: "20px",
                borderRadius: "8px",
                marginBottom: "20px",
                boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                color: "#333"
            }}>
                <h1 style={{ color: "#333", marginBottom: "15px" }}>🔧 Bot API Diagnostic Tool</h1>
                <p style={{ color: "#666", marginBottom: "15px" }}><strong>Use this tool to diagnose connection issues WITHOUT needing authentication.</strong></p>

                <div style={{
                    background: "#e3f2fd",
                    padding: "15px",
                    borderRadius: "5px",
                    margin: "15px 0",
                    border: "1px solid #2196f3"
                }}>
                    <h3 style={{ color: "#1976d2", marginTop: 0 }}>🏗️ Votre architecture :</h3>
                    <ul style={{ color: "#333", margin: "10px 0" }}>
                        <li><strong>Backend Node.js</strong> (Railway soundgarden-production-0d5e) → API principal</li>
                        <li><strong>RedBot + CollabWarz cog</strong> (Railway worker-production-31cd) → Bot Discord</li>
                        <li><strong>Frontend React</strong> (cette instance Railway) → Interface web</li>
                    </ul>
                    <div style={{
                        backgroundColor: "#d4edda",
                        padding: "10px",
                        borderRadius: "4px",
                        marginTop: "10px",
                        border: "1px solid #c3e6cb"
                    }}>
                        <strong style={{ color: "#155724" }}>🎯 Votre bot RedBot :</strong>
                        <code style={{
                            display: "block",
                            margin: "5px 0",
                            padding: "5px",
                            backgroundColor: "#f8f9fa",
                            borderRadius: "3px"
                        }}>
                            https://worker-production-31cd.up.railway.app
                        </code>
                    </div>
                </div>

                <div style={{
                    background: "#fff3cd",
                    padding: "15px",
                    borderRadius: "5px",
                    margin: "15px 0"
                }}>
                    <strong>📋 Before testing:</strong>
                    <ol>
                        <li>Make sure your Discord bot is online</li>
                        <li>Run <code>!cw apiserver start</code> in Discord</li>
                        <li>Run <code>!cw apiserver status</code> to see the port</li>
                    </ol>
                </div>

                <div style={{ marginBottom: "20px" }}>
                    <label><strong>Current configured URL:</strong></label>
                    <input
                        type="text"
                        value={currentUrl}
                        onChange={(e) => setCurrentUrl(e.target.value)}
                        style={{
                            width: "100%",
                            padding: "8px",
                            margin: "5px 0",
                            border: "1px solid #ddd",
                            borderRadius: "4px"
                        }}
                    />
                </div>

                {/* Your RedBot Test */}
                <div style={{
                    background: "#d4edda",
                    padding: "15px",
                    borderRadius: "5px",
                    margin: "15px 0",
                    border: "2px solid #28a745"
                }}>
                    <strong style={{ color: "#155724" }}>🤖 Test YOUR RedBot (Recommended):</strong>
                    <p style={{ color: "#155724", margin: "10px 0" }}>
                        Test your specific RedBot instance with CollabWarz cog:
                    </p>
                    <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "10px" }}>
                        <button
                            onClick={() => testYourRedBot()}
                            disabled={loading}
                            style={{
                                padding: "12px 20px",
                                backgroundColor: "#28a745",
                                color: "white",
                                border: "none",
                                borderRadius: "4px",
                                cursor: loading ? "not-allowed" : "pointer",
                                fontWeight: "bold",
                                fontSize: "16px"
                            }}
                        >
                            🎯 Test RedBot API
                        </button>
                    </div>
                </div>

                {/* Local & Cloud Bot Detection */}
                <div style={{
                    background: "#e7f3ff",
                    padding: "15px",
                    borderRadius: "5px",
                    margin: "15px 0"
                }}>
                    <strong>🏠 Local Bot Detection:</strong>
                    <p>If your bot runs locally (Discord shows "Running on 0.0.0.0:8080"):</p>
                    <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "10px" }}>
                        <button
                            onClick={() => testLocalBotServer()}
                            disabled={loading}
                            style={{
                                padding: "8px 16px",
                                backgroundColor: "#28a745",
                                color: "white",
                                border: "none",
                                borderRadius: "4px",
                                cursor: loading ? "not-allowed" : "pointer"
                            }}
                        >
                            🏠 Test Local Bot Server
                        </button>
                    </div>
                </div>

                {/* Railway / Cloud Bot Detection */}
                <div style={{
                    background: "#fff3cd",
                    padding: "15px",
                    borderRadius: "5px",
                    margin: "15px 0",
                    border: "1px solid #ffc107"
                }}>
                    <strong style={{ color: "#856404" }}>🚂 Railway Bot Detection:</strong>
                    <p style={{ color: "#856404", margin: "10px 0" }}>Votre bot Discord doit AUSSI être hébergé sur Railway !</p>

                    <div style={{
                        backgroundColor: "#d1ecf1",
                        padding: "10px",
                        borderRadius: "4px",
                        marginBottom: "15px",
                        border: "1px solid #bee5eb"
                    }}>
                        <strong style={{ color: "#0c5460" }}>💡 Votre architecture :</strong>
                        <ul style={{ color: "#0c5460", margin: "5px 0", paddingLeft: "20px" }}>
                            <li>Instance Railway #1 → Backend Node.js (port 3001)</li>
                            <li>Instance Railway #2 → Bot Discord + cog CollabWarz (port 8080)</li>
                            <li>Instance Railway #3 → Frontend SoundGarden</li>
                        </ul>
                        <p style={{ color: "#0c5460", margin: "5px 0 0 0", fontStyle: "italic" }}>
                            Il faut trouver l'URL de votre instance Railway #2 !
                        </p>
                    </div>
                    <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "10px" }}>
                        <button
                            onClick={() => checkBotDeploymentStatus()}
                            disabled={loading}
                            style={{
                                padding: "8px 16px",
                                backgroundColor: "#dc3545",
                                color: "white",
                                border: "none",
                                borderRadius: "4px",
                                cursor: loading ? "not-allowed" : "pointer",
                                fontWeight: "bold"
                            }}
                        >
                            🚨 Check Bot Deployment
                        </button>
                        <button
                            onClick={() => testRailwayVariants()}
                            disabled={loading}
                            style={{
                                padding: "8px 16px",
                                backgroundColor: "#6f42c1",
                                color: "white",
                                border: "none",
                                borderRadius: "4px",
                                cursor: loading ? "not-allowed" : "pointer"
                            }}
                        >
                            🚂 Test Railway URLs
                        </button>
                        <button
                            onClick={() => testSameDomainAsBackend()}
                            disabled={loading}
                            style={{
                                padding: "8px 16px",
                                backgroundColor: "#fd7e14",
                                color: "white",
                                border: "none",
                                borderRadius: "4px",
                                cursor: loading ? "not-allowed" : "pointer"
                            }}
                        >
                            🌐 Test Same Domain as Backend
                        </button>
                    </div>
                </div>

                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                    <button
                        onClick={testConfiguredUrl}
                        disabled={loading}
                        style={{
                            padding: "10px 20px",
                            backgroundColor: "#007bff",
                            color: "white",
                            border: "none",
                            borderRadius: "4px",
                            cursor: loading ? "not-allowed" : "pointer"
                        }}
                    >
                        {loading ? "🔄 Testing..." : "🧪 Test Current URL"}
                    </button>

                    <button
                        onClick={scanPorts}
                        disabled={loading}
                        style={{
                            padding: "10px 20px",
                            backgroundColor: "#28a745",
                            color: "white",
                            border: "none",
                            borderRadius: "4px",
                            cursor: loading ? "not-allowed" : "pointer"
                        }}
                    >
                        {loading ? "🔄 Scanning..." : "🔍 Scan Common Ports"}
                    </button>

                    <button
                        onClick={testCustomUrl}
                        disabled={loading}
                        style={{
                            padding: "10px 20px",
                            backgroundColor: "#6c757d",
                            color: "white",
                            border: "none",
                            borderRadius: "4px",
                            cursor: loading ? "not-allowed" : "pointer"
                        }}
                    >
                        🎯 Test Custom URL
                    </button>

                    <button
                        onClick={clearResults}
                        style={{
                            padding: "10px 20px",
                            backgroundColor: "#dc3545",
                            color: "white",
                            border: "none",
                            borderRadius: "4px",
                            cursor: "pointer"
                        }}
                    >
                        🧹 Clear Results
                    </button>
                </div>
            </div>

            {/* Instructions spécifiques */}
            <div style={{
                background: "#ffffff",
                padding: "20px",
                borderRadius: "8px",
                marginBottom: "20px",
                border: "1px solid #17a2b8",
                boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
            }}>
                <h3 style={{ color: "#17a2b8", marginTop: 0 }}>🎯 Comment trouver l'URL de votre bot Discord :</h3>

                <div style={{ marginBottom: "15px" }}>
                    <strong>1. Dans votre Railway Dashboard :</strong>
                    <ul style={{ margin: "5px 0", color: "#333" }}>
                        <li>Cherchez le projet où vous avez déployé votre bot Discord</li>
                        <li>Cliquez dessus → onglet "Settings" → "Domains"</li>
                        <li>Copiez l'URL (ex: <code>https://votre-bot-xxxxx.up.railway.app</code>)</li>
                    </ul>
                </div>

                <div style={{ marginBottom: "15px" }}>
                    <strong>2. Dans Discord :</strong>
                    <ul style={{ margin: "5px 0", color: "#333" }}>
                        <li>Tapez <code>!cw apiconfig</code> pour voir la configuration</li>
                        <li>Si "Host" montre une URL Railway → c'est celle-là !</li>
                    </ul>
                </div>

                <div style={{
                    backgroundColor: "#f0f8ff",
                    padding: "10px",
                    borderRadius: "4px",
                    border: "1px solid #17a2b8"
                }}>
                    <strong style={{ color: "#17a2b8" }}>💡 Astuce :</strong>
                    <span style={{ color: "#333" }}> Une fois l'URL trouvée, utilisez le bouton "🎯 Test Custom URL" ci-dessous pour la tester !</span>
                </div>
            </div>

            {/* Results */}
            {results.length > 0 && (
                <div style={{
                    background: "#ffffff",
                    border: "1px solid #ddd",
                    borderRadius: "8px",
                    padding: "20px"
                }}>
                    <h3>📋 Test Results</h3>
                    <div style={{
                        maxHeight: "400px",
                        overflowY: "auto",
                        backgroundColor: "#f8f9fa",
                        padding: "10px",
                        borderRadius: "4px",
                        fontFamily: "monospace",
                        fontSize: "14px"
                    }}>
                        {results.map((result, index) => (
                            <div
                                key={index}
                                style={{
                                    padding: "8px 0",
                                    borderBottom: "1px solid #e9ecef",
                                    color: result.type === "error" ? "#dc3545" :
                                        result.type === "success" ? "#28a745" :
                                            result.type === "warning" ? "#fd7e14" : "#495057"
                                }}
                            >
                                <span style={{ color: "#6c757d", marginRight: "10px", fontSize: "12px" }}>
                                    [{result.timestamp}]
                                </span>
                                <span style={{ fontWeight: result.type === "error" || result.type === "success" ? "bold" : "normal" }}>
                                    {result.message}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Instructions */}
            <div style={{
                marginTop: "30px",
                padding: "20px",
                backgroundColor: "#e9ecef",
                borderRadius: "8px"
            }}>
                <h3>💡 What to do once you find the correct URL:</h3>
                <ol>
                    <li>Update your environment variable <code>VITE_BOT_API_URL</code> to the working URL</li>
                    <li>Or update your <code>.env</code> file with: <code>VITE_BOT_API_URL=https://your-bot-url</code></li>
                    <li>Restart your frontend development server</li>
                    <li>Generate a new admin token with <code>!cw admintoken generate</code></li>
                    <li>Use the token in the admin panel</li>
                </ol>
            </div>

            {/* Railway Specific Instructions */}
            <div style={{
                marginTop: "20px",
                padding: "20px",
                backgroundColor: "#fff3cd",
                borderRadius: "8px"
            }}>
                <h3>🚂 Railway Deployment Troubleshooting:</h3>
                <p><strong>Since you use Railway for your backend, your bot might be:</strong></p>
                <ul>
                    <li><strong>Also on Railway:</strong> Check if you deployed the Discord bot to Railway too</li>
                    <li><strong>Local but not running:</strong> Make sure the bot is started locally and API is enabled</li>
                    <li><strong>Different port:</strong> Bot might be on a different port than 8080</li>
                </ul>

                <p><strong>Quick checks in Discord:</strong></p>
                <code style={{
                    display: "block",
                    backgroundColor: "#f8f9fa",
                    padding: "10px",
                    borderRadius: "4px",
                    margin: "10px 0"
                }}>
                    !cw help                     # Is bot responding?<br />
                    !cw apiserver status         # Is API server running?<br />
                    !cw apiserver start          # Start API if not running<br />
                    !cw admintoken debug         # See current config
                </code>
            </div>
        </div>
    );
}