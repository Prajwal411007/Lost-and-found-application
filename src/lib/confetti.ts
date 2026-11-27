/**
 * Lightweight, zero-dependency confetti celebration effect.
 * Respects prefers-reduced-motion.
 */
export function triggerCelebrationConfetti() {
  if (typeof window === 'undefined') return;

  // Respect prefers-reduced-motion
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return;
  }

  const colors = ['#0d9488', '#2563eb', '#e11d48', '#f59e0b', '#10b981', '#8b5cf6'];
  const confettiCount = 60;
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.top = '0';
  container.style.left = '0';
  container.style.width = '100vw';
  container.style.height = '100vh';
  container.style.pointerEvents = 'none';
  container.style.zIndex = '99999';
  container.style.overflow = 'hidden';

  document.body.appendChild(container);

  for (let i = 0; i < confettiCount; i++) {
    const particle = document.createElement('div');
    const color = colors[Math.floor(Math.random() * colors.length)];
    const size = Math.random() * 8 + 6;
    const left = Math.random() * 100;
    const animDuration = Math.random() * 2 + 1.8;
    const delay = Math.random() * 0.3;

    particle.style.position = 'absolute';
    particle.style.top = '-20px';
    particle.style.left = `${left}vw`;
    particle.style.width = `${size}px`;
    particle.style.height = `${size * 0.6}px`;
    particle.style.backgroundColor = color;
    particle.style.borderRadius = '2px';
    particle.style.opacity = '1';
    particle.style.transform = `rotate(${Math.random() * 360}deg)`;
    particle.style.transition = `transform ${animDuration}s cubic-bezier(0.25, 1, 0.5, 1), top ${animDuration}s cubic-bezier(0.25, 1, 0.5, 1), opacity ${animDuration}s ease-out`;
    particle.style.transitionDelay = `${delay}s`;

    container.appendChild(particle);

    requestAnimationFrame(() => {
      particle.style.top = `${Math.random() * 40 + 70}vh`;
      particle.style.transform = `rotate(${Math.random() * 720}deg) scale(${Math.random() * 0.5 + 0.5})`;
      particle.style.opacity = '0';
    });
  }

  setTimeout(() => {
    if (document.body.contains(container)) {
      document.body.removeChild(container);
    }
  }, 4000);
}
