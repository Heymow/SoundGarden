import React, { useEffect, useRef } from 'react';
import './LavaLamp.css';

/**
 * LavaLamp - Composant d'effet de fond animé réutilisable
 * 
 * @param {Object} props - Propriétés du composant
 * @param {string[]} [props.colors] - Couleurs des bulles (par défaut: tons verts)
 * @param {number} [props.blobCount] - Nombre de bulles (par défaut: 5)
 * @param {number} [props.speed] - Vitesse d'animation (par défaut: 1)
 * @param {number} [props.blur] - Intensité du flou (par défaut: 25)
 * @param {number} [props.opacity] - Opacité globale (par défaut: 0.7)
 * @param {string} [props.className] - Classe CSS additionnelle
 * @param {Object} [props.style] - Styles inline additionnels
 */
export default function LavaLamp({
    colors = [
        'rgba(74, 222, 128, 0.4)',
        'rgba(52, 211, 153, 0.45)',
        'rgba(34, 197, 94, 0.4)',
        'rgba(16, 185, 129, 0.35)',
    ],
    blobCount = 5,
    speed = 1,
    blur = 25,
    opacity = 0.7,
    className = '',
    style = {},
}) {
    const canvasRef = useRef(null);
    const animationRef = useRef(null);
    const blobsRef = useRef([]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');

        const resizeCanvas = () => {
            const parent = canvas.parentElement;
            if (parent) {
                canvas.width = parent.offsetWidth || window.innerWidth;
                canvas.height = parent.offsetHeight || window.innerHeight;
            }
        };

        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);

        // Créer les objets blob
        const createBlob = (index) => ({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            radius: 80 + Math.random() * 120,
            vx: (Math.random() - 0.5) * 2 * speed,
            vy: (Math.random() - 0.5) * 2 * speed,
            color: colors[index % colors.length],
        });

        // Initialiser les blobs
        blobsRef.current = Array.from({ length: blobCount }, (_, i) => createBlob(i));

        // Boucle d'animation
        const animate = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Mettre à jour et dessiner les blobs
            blobsRef.current.forEach((blob) => {
                // Mettre à jour la position
                blob.x += blob.vx;
                blob.y += blob.vy;

                // Rebondir sur les bords
                if (blob.x < -blob.radius / 2 || blob.x > canvas.width + blob.radius / 2) {
                    blob.vx *= -1;
                }
                if (blob.y < -blob.radius / 2 || blob.y > canvas.height + blob.radius / 2) {
                    blob.vy *= -1;
                }

                // Oscillation légère de la taille
                const time = Date.now() * 0.001;
                const scale = 1 + Math.sin(time + blob.x) * 0.01;

                // Dessiner le blob avec un gradient radial
                const gradient = ctx.createRadialGradient(
                    blob.x,
                    blob.y,
                    0,
                    blob.x,
                    blob.y,
                    blob.radius * scale
                );
                gradient.addColorStop(0, blob.color);
                gradient.addColorStop(1, 'transparent');

                ctx.fillStyle = gradient;
                ctx.beginPath();
                ctx.arc(blob.x, blob.y, blob.radius * scale, 0, Math.PI * 2);
                ctx.fill();
            });

            animationRef.current = requestAnimationFrame(animate);
        };

        animate();

        return () => {
            window.removeEventListener('resize', resizeCanvas);
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
        };
    }, [colors, blobCount, speed, blur, opacity]);

    return (
        <canvas
            ref={canvasRef}
            className={`lava-lamp ${className}`}
            style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                zIndex: 0,
                filter: `blur(${blur}px)`,
                opacity,
                pointerEvents: 'none', // Ne pas interférer avec les interactions
                ...style,
            }}
        />
    );
}

/**
 * LavaLampContainer - Wrapper pour faciliter l'utilisation avec des enfants
 * 
 * @param {Object} props
 * @param {React.ReactNode} props.children - Contenu du conteneur
 * @param {Object} [props.lavaProps] - Props à passer au composant LavaLamp
 * @param {string} [props.className] - Classe CSS du conteneur
 * @param {Object} [props.style] - Styles inline du conteneur
 */
export function LavaLampContainer({
    children,
    lavaProps = {},
    className = '',
    style = {},
    ...props
}) {
    return (
        <div
            className={`lava-lamp-container ${className}`}
            style={{
                position: 'relative',
                overflow: 'hidden',
                ...style,
            }}
            {...props}
        >
            <LavaLamp {...lavaProps} />
            <div style={{ position: 'relative', zIndex: 1 }}>
                {children}
            </div>
        </div>
    );
}