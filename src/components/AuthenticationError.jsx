import React from "react";
import { Link } from "react-router-dom";

export default function AuthenticationError({ error }) {
    return (
        <div style={{
            padding: "40px",
            textAlign: "center",
            maxWidth: "600px",
            margin: "50px auto",
            backgroundColor: "#f8f9fa",
            borderRadius: "12px",
            boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)"
        }}>
            <div style={{ fontSize: "48px", marginBottom: "20px" }}>🚫</div>
            <h2 style={{ color: "#dc3545", marginBottom: "15px" }}>
                Authentication Failed
            </h2>

            <div style={{
                backgroundColor: "#f8d7da",
                color: "#721c24",
                padding: "15px",
                borderRadius: "8px",
                marginBottom: "25px",
                fontFamily: "monospace",
                fontSize: "14px",
                textAlign: "left",
                wordBreak: "break-word"
            }}>
                <strong>Error:</strong> {error}
            </div>

            <div style={{
                backgroundColor: "#fff3cd",
                color: "#856404",
                padding: "20px",
                borderRadius: "8px",
                marginBottom: "25px",
                textAlign: "left"
            }}>
                <h4 style={{ marginTop: "0", color: "#856404" }}>🔧 Don't worry! We can fix this.</h4>
                <p>This error usually means the Discord bot API server is not running or not accessible.</p>

                <p><strong>Quick fix:</strong></p>
                <ol style={{ paddingLeft: "20px" }}>
                    <li>Use our diagnostic tool to find the correct URL</li>
                    <li>Run the required Discord commands</li>
                    <li>Get a fresh token and try again</li>
                </ol>
            </div>

            <div style={{ display: "flex", gap: "15px", justifyContent: "center", flexWrap: "wrap" }}>
                <Link
                    to="/diagnostic"
                    style={{
                        display: "inline-block",
                        padding: "12px 24px",
                        backgroundColor: "#007bff",
                        color: "white",
                        textDecoration: "none",
                        borderRadius: "6px",
                        fontWeight: "bold",
                        transition: "background-color 0.2s"
                    }}
                    onMouseOver={(e) => e.target.style.backgroundColor = "#0056b3"}
                    onMouseOut={(e) => e.target.style.backgroundColor = "#007bff"}
                >
                    🔧 Open Diagnostic Tool
                </Link>

                <button
                    onClick={() => window.location.reload()}
                    style={{
                        padding: "12px 24px",
                        backgroundColor: "#28a745",
                        color: "white",
                        border: "none",
                        borderRadius: "6px",
                        fontWeight: "bold",
                        cursor: "pointer",
                        transition: "background-color 0.2s"
                    }}
                    onMouseOver={(e) => e.target.style.backgroundColor = "#1e7e34"}
                    onMouseOut={(e) => e.target.style.backgroundColor = "#28a745"}
                >
                    🔄 Retry Connection
                </button>
            </div>

            <div style={{
                marginTop: "30px",
                padding: "15px",
                backgroundColor: "#e9ecef",
                borderRadius: "8px",
                fontSize: "14px",
                textAlign: "left"
            }}>
                <h4 style={{ marginTop: "0" }}>💡 Manual Steps (if diagnostic tool doesn't work):</h4>
                <p>In Discord, run these commands:</p>
                <code style={{
                    display: "block",
                    backgroundColor: "#f8f9fa",
                    padding: "10px",
                    borderRadius: "4px",
                    margin: "10px 0"
                }}>
                    !cw apiserver start<br />
                    !cw apiserver status<br />
                    !cw admintoken generate
                </code>
                <p>Then update your <code>VITE_BOT_API_URL</code> environment variable and restart the frontend.</p>
            </div>
        </div>
    );
}