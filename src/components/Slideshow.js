import React, { useState, useEffect, useRef } from 'react';
import { useSlideshow } from '../context/SlideshowContext';
import './Slideshow.css';

const Slideshow = () => {
  const { current, slides, imagesLoaded } = useSlideshow();
  const [activeIndex, setActiveIndex] = useState(current);
  const [nextIndex, setNextIndex] = useState(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const timeoutRef = useRef(null);

  useEffect(() => {
    if (current !== activeIndex && !isTransitioning) {
      setNextIndex(current);
      setIsTransitioning(true);
      
      // After transition completes, update active
      timeoutRef.current = setTimeout(() => {
        setActiveIndex(current);
        setNextIndex(null);
        setIsTransitioning(false);
      }, 1500); // Match CSS transition duration
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [current, activeIndex, isTransitioning]);

  if (!imagesLoaded) {
    return (
      <div className="slideshow-container">
        <div className="slideshow-loading" />
        <div className="slideshow-overlay" />
      </div>
    );
  }

  return (
    <div className="slideshow-container">
      {/* Active slide */}
      <div 
        className={`slide ${isTransitioning ? 'fade-out' : ''}`}
        style={{ backgroundImage: `url(${slides[activeIndex]})` }}
      />
      
      {/* Next slide (fades in on top) */}
      {nextIndex !== null && (
        <div 
          className="slide next-slide"
          style={{ backgroundImage: `url(${slides[nextIndex]})` }}
        />
      )}
      
      {/* Dark overlay */}
      <div className="slideshow-overlay" />
    </div>
  );
};

export default Slideshow;
