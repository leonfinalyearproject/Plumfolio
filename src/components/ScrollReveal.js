import React, { useEffect, useRef, Children, cloneElement, isValidElement } from 'react';

/**
 * Lusion-style scroll reveal — elements animate in once they enter the viewport.
 */
export function ScrollReveal({
  children,
  className = '',
  animation = 'up',
  delay = 0,
  duration = 0.85,
  as: Tag = 'div',
}) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.classList.add('is-visible');
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add('is-visible');
          observer.unobserve(el);
        }
      },
      { threshold: 0.08, rootMargin: '0px 0px -5% 0px' }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag
      ref={ref}
      className={`scroll-reveal scroll-reveal-${animation} ${className}`.trim()}
      style={{
        '--reveal-delay': `${delay}ms`,
        '--reveal-duration': `${duration}s`,
      }}
    >
      {children}
    </Tag>
  );
}

/** Stagger child elements with incremental reveal delays. */
export function StaggerReveal({
  children,
  className = '',
  animation = 'up',
  stagger = 70,
  baseDelay = 0,
  as: Tag = 'div',
}) {
  const items = Children.toArray(children);
  return (
    <Tag className={className}>
      {items.map((child, i) => (
        isValidElement(child) ? (
          <ScrollReveal key={child.key ?? i} animation={animation} delay={baseDelay + i * stagger}>
            {child}
          </ScrollReveal>
        ) : (
          <ScrollReveal key={i} animation={animation} delay={baseDelay + i * stagger}>
            {child}
          </ScrollReveal>
        )
      ))}
    </Tag>
  );
}

/** Subtle parallax tied to scroll position (landing hero). */
export function useParallax(speed = 0.35) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;

    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const y = window.scrollY * speed;
        el.style.transform = `translate3d(0, ${y}px, 0)`;
      });
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
    };
  }, [speed]);

  return ref;
}

export default ScrollReveal;
