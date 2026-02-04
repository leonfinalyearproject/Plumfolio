import React from 'react';
import { useSlideshow } from '../context/SlideshowContext';
import './Slideshow.css';

const Slideshow = () => {
  const { current, slides, imagesLoaded } = useSlideshow();

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
      {slides.map((slide, index) => (
        <div
          key={index}
          className={`slide ${index === current ? 'active' : ''}`}
          style={{ backgroundImage: `url(${slide})` }}
        />
      ))}
      <div className="slideshow-overlay" />
    </div>
  );
};

export default Slideshow;
