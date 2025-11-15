import React from "react";

export default function DiagnosticPage() {
    return (
        <div style={{
            padding: "20px",
            maxWidth: "800px",
            margin: "0 auto",
            backgroundColor: "#f8f9fa",
            minHeight: "100vh"
        }}>
            <div style={{
                background: "#ffffff",
                padding: "30px",
                borderRadius: "8px",
                boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                textAlign: "center"
            }}>
                <h1 style={{ color: "#333", marginBottom: "20px" }}>
                    🔧 Diagnostic Supprimé
                </h1>
                
                <p style={{ color: "#666", fontSize: "18px", marginBottom: "30px" }}>
                    L'outil de diagnostic a été retiré pour se concentrer sur le problème principal.
                </p>

                <div style={{
                    backgroundColor: "#e3f2fd",
                    padding: "20px",
                    borderRadius: "8px",
                    border: "1px solid #2196f3",
                    textAlign: "left"
                }}>
                    <h3 style={{ color: "#1976d2", marginTop: 0 }}>🎯 Prochaines étapes :</h3>
                    <ol style={{ color: "#333" }}>
                        <li>Identifier le problème exact avec l'authentification</li>
                        <li>Vérifier la configuration du bot RedBot</li>
                        <li>Tester la connectivité de base</li>
                        <li>Résoudre étape par étape</li>
                    </ol>
                </div>

                <p style={{ color: "#666", marginTop: "20px", fontStyle: "italic" }}>
                    Concentrons-nous sur comprendre ce qui ne va pas avant d'ajouter des outils complexes.
                </p>
            </div>
        </div>
    );
}