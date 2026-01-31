import React, { useState, useEffect } from 'react';
import { useSlideshow } from '../context/SlideshowContext';

const Slideshow = () => {
  const { current, slides } = useSlideshow();
  const [displayIndex, setDisplayIndex] = useState(current);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    if (current !== displayIndex) {
      setFading(true);
      const timer = setTimeout(() => {
        setDisplayIndex(current);
        setFading(false);
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [current, displayIndex]);

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: `url(${slides[displayIndex]})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        transition: 'opacity 0.6s ease',
        opacity: fading ? 0.3 : 1,
      }} />
      
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'linear-gradient(135deg, rgba(10,10,15,0.8) 0%, rgba(10,10,15,0.85) 50%, rgba(10,10,15,0.9) 100%)',
      }} />
    </div>
  );
};

export default Slideshow;
