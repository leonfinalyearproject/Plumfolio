import React, { useState, useEffect } from 'react';

import slide1 from '../pages/slide1.jpg';
import slide2 from '../pages/slide2.jpg';
import slide3 from '../pages/slide3.jpg';
import slide4 from '../pages/slide4.jpg';
import slide5 from '../pages/slide5.jpg';
import slide6 from '../pages/slide6.jpg';

const slides = [slide1, slide2, slide3, slide4, slide5, slide6];

const Slideshow = () => {
  const [current, setCurrent] = useState(0);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setFading(true);
      setTimeout(() => {
        setCurrent((prev) => (prev + 1) % slides.length);
        setFading(false);
      }, 800);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      overflow: 'hidden',
    }}>
      {/* Current slide */}
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: `url(${slides[current]})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        transition: 'opacity 0.8s ease',
        opacity: fading ? 0 : 1,
      }} />
      
      {/* Dark overlay */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'linear-gradient(135deg, rgba(10,10,15,0.82) 0%, rgba(10,10,15,0.88) 50%, rgba(10,10,15,0.92) 100%)',
      }} />
    </div>
  );
};

export default Slideshow;
