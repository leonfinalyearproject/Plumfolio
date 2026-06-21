import React, { createContext, useContext, useState, useEffect, useRef } from 'react';

// Gradient slides — no external image assets required for build/deploy.
const slides = [
  'linear-gradient(135deg, #EDE9FE 0%, #DDD6FE 50%, #C4B5FD 100%)',
  'linear-gradient(135deg, #ECFDF5 0%, #D1FAE5 50%, #A7F3D0 100%)',
  'linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 50%, #BFDBFE 100%)',
  'linear-gradient(135deg, #FDF4FF 0%, #FAE8FF 50%, #F5D0FE 100%)',
  'linear-gradient(135deg, #F0FDF4 0%, #DCFCE7 50%, #BBF7D0 100%)',
  'linear-gradient(135deg, #F8FAFC 0%, #E2E8F0 50%, #CBD5E1 100%)',
];

const SlideshowContext = createContext();

export const SlideshowProvider = ({ children }) => {
  const [current, setCurrent] = useState(0);
  const [imagesLoaded, setImagesLoaded] = useState(true);
  const intervalRef = useRef(null);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setCurrent(prev => (prev + 1) % slides.length);
    }, 5000);
    return () => clearInterval(intervalRef.current);
  }, []);

  return (
    <SlideshowContext.Provider value={{ current, slides, imagesLoaded }}>
      {children}
    </SlideshowContext.Provider>
  );
};

export const useSlideshow = () => {
  const ctx = useContext(SlideshowContext);
  if (!ctx) throw new Error('useSlideshow must be used within SlideshowProvider');
  return ctx;
};

export default SlideshowContext;
