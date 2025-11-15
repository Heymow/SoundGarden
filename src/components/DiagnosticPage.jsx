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
        }

        setLoading(false);
    };

    return (
        <div style={{ padding: "20px", maxWidth: "800px", margin: "0 auto" }}>
            <div style={{
                background: "#f8f9fa",
                padding: "20px",
                borderRadius: "8px",
                marginBottom: "20px"
            }}>
                <h1>🔧 Bot API Diagnostic Tool</h1>
                <p><strong>Use this tool to diagnose connection issues WITHOUT needing authentication.</strong></p>

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
                    margin: "15px 0"
                }}>
                    <strong>🚂 Railway / Cloud Bot Detection:</strong>
                    <p>If your bot runs on Railway or another cloud service:</p>
                    <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "10px" }}>
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
                                    padding: "5px 0",
                                    borderBottom: "1px solid #eee",
                                    color: result.type === "error" ? "#dc3545" :
                                        result.type === "success" ? "#28a745" :
                                            result.type === "warning" ? "#ffc107" : "#333"
                                }}
                            >
                                <span style={{ color: "#666", marginRight: "10px" }}>
                                    [{result.timestamp}]
                                </span>
                                {result.message}
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