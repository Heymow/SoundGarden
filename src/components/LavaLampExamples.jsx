import React from 'react';
import LavaLamp, { LavaLampContainer } from './LavaLamp';
import { LAVA_LAMP_PRESETS, LAVA_LAMP_CONFIGS, createLavaLampProps } from './LavaLampPresets';

/**
 * Exemples d'utilisation du composant LavaLamp
 */
export default function LavaLampExamples() {
    return (
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <h2>Exemples d'utilisation LavaLamp</h2>

            {/* Exemple 1: Utilisation basique */}
            <div style={{ height: '200px', border: '1px solid #333', borderRadius: '8px', position: 'relative' }}>
                <LavaLamp />
                <div style={{ position: 'relative', zIndex: 1, padding: '20px', color: 'white' }}>
                    <h3>Exemple basique</h3>
                    <p>LavaLamp avec les paramètres par défaut (vert)</p>
                </div>
            </div>

            {/* Exemple 2: Avec LavaLampContainer */}
            <LavaLampContainer
                style={{ height: '200px', border: '1px solid #333', borderRadius: '8px', padding: '20px' }}
                lavaProps={createLavaLampProps('blue', 'intense')}
            >
                <h3 style={{ color: 'white', margin: '0 0 10px 0' }}>Avec Container</h3>
                <p style={{ color: 'rgba(255,255,255,0.8)', margin: 0 }}>
                    Utilisation de LavaLampContainer avec preset bleu et config intense
                </p>
            </LavaLampContainer>

            {/* Exemple 3: Couleurs personnalisées */}
            <div style={{ height: '200px', border: '1px solid #333', borderRadius: '8px', position: 'relative' }}>
                <LavaLamp
                    colors={LAVA_LAMP_PRESETS.purple}
                    blobCount={7}
                    speed={1.5}
                    blur={20}
                    opacity={0.8}
                />
                <div style={{ position: 'relative', zIndex: 1, padding: '20px', color: 'white' }}>
                    <h3>Couleurs personnalisées</h3>
                    <p>Preset violet avec paramètres customisés</p>
                </div>
            </div>

            {/* Exemple 4: Card avec LavaLamp */}
            <LavaLampContainer
                className="card"
                style={{
                    background: 'linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))',
                    border: '1px solid rgba(255,255,255,0.05)',
                    borderRadius: '12px',
                    padding: '24px',
                    minHeight: '150px'
                }}
                lavaProps={createLavaLampProps('orange', 'subtle')}
            >
                <h3 style={{ color: 'white', margin: '0 0 12px 0' }}>Card avec effet LavaLamp</h3>
                <p style={{ color: 'rgba(255,255,255,0.8)', margin: '0 0 16px 0' }}>
                    Une carte avec un arrière-plan LavaLamp subtil en orange.
                </p>
                <button style={{
                    background: 'rgba(251, 146, 60, 0.2)',
                    border: '1px solid rgba(251, 146, 60, 0.4)',
                    color: 'white',
                    padding: '8px 16px',
                    borderRadius: '6px',
                    cursor: 'pointer'
                }}>
                    Action
                </button>
            </LavaLampContainer>

            {/* Exemple 5: Bannière avec arc-en-ciel */}
            <LavaLampContainer
                style={{
                    height: '120px',
                    background: 'linear-gradient(90deg, rgba(0,0,0,0.8), rgba(0,0,0,0.6))',
                    borderRadius: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}
                lavaProps={{
                    colors: LAVA_LAMP_PRESETS.rainbow,
                    blobCount: 10,
                    speed: 2,
                    blur: 25,
                    opacity: 0.9
                }}
            >
                <h2 style={{ color: 'white', textAlign: 'center', margin: 0 }}>
                    🌈 Bannière Arc-en-ciel
                </h2>
            </LavaLampContainer>

            {/* Guide d'utilisation */}
            <div style={{ marginTop: '40px', color: '#ccc' }}>
                <h3>Comment utiliser :</h3>
                <pre style={{ background: 'rgba(255,255,255,0.05)', padding: '16px', borderRadius: '8px', overflow: 'auto' }}>
                    {`// Méthode 1: LavaLamp basique
<div style={{ position: 'relative', height: '200px' }}>
  <LavaLamp />
  <div style={{ position: 'relative', zIndex: 1 }}>Contenu</div>
</div>

// Méthode 2: Avec LavaLampContainer (plus simple)
<LavaLampContainer lavaProps={createLavaLampProps('blue', 'intense')}>
  <h3>Mon contenu</h3>
</LavaLampContainer>

// Méthode 3: Complètement personnalisé
<LavaLamp
  colors={['rgba(255,0,0,0.4)', 'rgba(0,255,0,0.4)']}
  blobCount={8}
  speed={1.5}
  blur={30}
  opacity={0.7}
/>`}
                </pre>
            </div>
        </div>
    );
}