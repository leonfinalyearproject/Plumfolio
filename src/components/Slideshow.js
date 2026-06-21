import React from 'react';
import { useSlideshow } from '../context/SlideshowContext';
import './Slideshow.css';

const Slideshow = () => {
  const { current, slides } = useSlideshow();

  return (
    <div className="slideshow-container">
      {slides.map((slide, index) => (
        <div
          key={index}
          className={`slide ${index === current ? 'active' : ''}`}
          style={{ background: slide }}
        />
      ))}
      <div className="slideshow-overlay" />
    </div>
  );
};

export default Slideshow;
