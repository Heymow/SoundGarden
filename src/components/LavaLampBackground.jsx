import React, { useEffect, useRef } from 'react';

export default function LavaLampBackground() {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const blobsRef = useRef([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const resizeCanvas = () => {
      const parent = canvas.parentElement;
      canvas.width = parent.offsetWidth;
      canvas.height = parent.offsetHeight;
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Create blob objects
    const createBlob = (index) => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      radius: 80 + Math.random() * 120,
      vx: (Math.random() - 0.5) * 0.5,
      vy: (Math.random() - 0.5) * 0.5,
      color: [
        'rgba(74, 222, 128, 0.4)',
        'rgba(52, 211, 153, 0.45)',
        'rgba(34, 197, 94, 0.4)',
        'rgba(16, 185, 129, 0.35)',
      ][index % 4],
    });

    // Initialize blobs
    blobsRef.current = Array.from({ length: 5 }, (_, i) => createBlob(i));

    // Animation loop
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Update and draw blobs
      blobsRef.current.forEach((blob) => {
        // Update position
        blob.x += blob.vx;
        blob.y += blob.vy;

        // Bounce off edges
        if (blob.x < -blob.radius / 2 || blob.x > canvas.width + blob.radius / 2) {
          blob.vx *= -1;
        }
        if (blob.y < -blob.radius / 2 || blob.y > canvas.height + blob.radius / 2) {
          blob.vy *= -1;
        }

        // Oscillate size slightly
        const time = Date.now() * 0.001;
        const scale = 1 + Math.sin(time + blob.x) * 0.1;

        // Draw blob with radial gradient
        const gradient = ctx.createRadialGradient(
          blob.x,
          blob.y,
          0,
          blob.x,
          blob.y,
          blob.radius * scale
        );
        gradient.addColorStop(0, blob.color);
        gradient.addColorStop(1, 'rgba(74, 222, 128, 0)');

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
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: -1,
        filter: 'blur(40px)',
        opacity: 0.8,
      }}
    />
  );
}
