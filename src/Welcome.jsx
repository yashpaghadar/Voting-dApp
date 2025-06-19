import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSpring, animated, config } from 'react-spring';
import './Welcome.css';

export default function Welcome() {
  const [isVisible, setIsVisible] = useState(false);
  const navigate = useNavigate();

  // Logo animation - faster but still smooth rotation
  const logoSpring = useSpring({
    from: { opacity: 0, transform: 'rotate(-180deg) scale(0.5)' },
    to: { opacity: isVisible ? 1 : 0, transform: isVisible ? 'rotate(0deg) scale(1)' : 'rotate(180deg) scale(0.5)' },
    config: { ...config.wobbly, duration: 800 }
  });

  // Title animation - quicker entrance with less delay
  const titleSpring = useSpring({
    from: { opacity: 0, transform: 'translateY(40px) scale(0.8)' },
    to: { opacity: isVisible ? 1 : 0, transform: isVisible ? 'translateY(0px) scale(1)' : 'translateY(40px) scale(0.8)' },
    delay: 300,
    config: { ...config.stiff, duration: 700 }
  });

  // Subtitle animation - faster but still follows title
  const subtitleSpring = useSpring({
    from: { opacity: 0, transform: 'translateY(30px)' },
    to: { opacity: isVisible ? 1 : 0, transform: isVisible ? 'translateY(0px)' : 'translateY(30px)' },
    delay: 500,
    config: { ...config.slow, duration: 800 }
  });

  // Background pulse - quicker but still subtle
  const pulseSpring = useSpring({
    from: { opacity: 0, transform: 'scale(0)' },
    to: { opacity: isVisible ? 0.3 : 0, transform: isVisible ? 'scale(1.5)' : 'scale(0)' },
    config: { ...config.molasses, duration: 1200 }
  });

  useEffect(() => {
    setIsVisible(true);
    
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(() => navigate('/vote'), 1000);
    }, 5000);
    
    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="welcome-container">
      {/* Vite Logo with spring animation */}
      <animated.img 
        src="/vite.svg" 
        alt="Vite Logo" 
        className="vite-logo"
        style={{
          ...logoSpring,
          filter: isVisible ? 'drop-shadow(0 0 15px rgba(29, 78, 216, 0.7))' : 'none'
        }}
      />
      
      {/* Title with spring animation */}
      <animated.h1 
        className="welcome-title"
        style={{
          ...titleSpring,
          textShadow: isVisible ? '0 0 15px rgba(29, 78, 216, 0.5)' : 'none'
        }}
      >
        Welcome to Blockchain Technology
      </animated.h1>
      
      {/* Subtitle with spring animation */}
      <animated.p 
        className="welcome-subtitle"
        style={subtitleSpring}
      >
        Fast and Secure Decentralized Voting System
      </animated.p>
      
      {/* Progress bar */}
      <div className="progress-container">
        <animated.div 
          className="progress-bar"
          style={{
            width: isVisible ? '100%' : '0%',
            opacity: isVisible ? 1 : 0
          }}
        />
      </div>
      
      {/* Background pulse */}
      <animated.div 
        className="pulse-circle"
        style={pulseSpring}
      />
      
      {/* Floating particles */}
      {Array.from({ length: 15 }).map((_, i) => {
        const particleSpring = useSpring({
          from: { opacity: 0, transform: 'translateY(20px)' },
          to: { 
            opacity: isVisible ? 0.6 : 0,
            transform: isVisible ? 'translateY(0px)' : 'translateY(20px)' 
          },
          delay: i * 100,
          config: config.gentle
        });
        
        return (
          <animated.div
            key={i}
            className="particle"
            style={{
              ...particleSpring,
              left: `${Math.random() * 100}%`,
              width: `${Math.random() * 10 + 5}px`,
              height: `${Math.random() * 10 + 5}px`,
              animation: isVisible ? `float ${Math.random() * 3 + 2}s ease-in-out ${i * 0.1}s infinite alternate` : 'none'
            }}
          />
        );
      })}
    </div>
  );
}
