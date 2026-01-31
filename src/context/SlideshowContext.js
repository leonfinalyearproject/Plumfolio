import React, { createContext, useContext, useState, useEffect, useRef } from 'react';

import slide1 from '../pages/slide1.jpg';
import slide2 from '../pages/slide2.jpg';
import slide3 from '../pages/slide3.jpg';
import slide4 from '../pages/slide4.jpg';
import slide5 from '../pages/slide5.jpg';
import slide6 from '../pages/slide6.jpg';

const slides = [slide1, slide2, slide3, slide4, slide5, slide6];

const SlideshowContext = createContext();

export const SlideshowProvider = ({ children }) => {
  const [current, setCurrent] = useState(0);
  const [imagesLoaded, setImagesLoaded] = useState(false);
  const intervalRef = useRef(null);

  // Preload all images on mount
  useEffect(() => {
    let loadedCount = 0;
    
    slides.forEach((src) => {
      const img = new Image();
      img.onload = () => {
        loadedCount++;
        if (loadedCount === slides.length) {
          setImagesLoaded(true);
        }
      };
      img.src = src;
    });
  }, []);

  // Start slideshow after images are loaded
  useEffect(() => {
    if (!imagesLoaded) return;

    intervalRef.current = setInterval(() => {
      setCurrent((prev) => (prev + 1) % slides.length);
    }, 6000);

    return () => clearInterval(intervalRef.current);
  }, [imagesLoaded]);

  return (
    <SlideshowContext.Provider value={{ current, slides, imagesLoaded }}>
      {children}
    </SlideshowContext.Provider>
  );
};

export const useSlideshow = () => {
  const context = useContext(SlideshowContext);
  if (!context) {
    throw new Error('useSlideshow must be used within SlideshowProvider');
  }
  return context;
};
