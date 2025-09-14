import { useState, useEffect } from 'react';

export const useAnimateOnce = (delay: number = 0) => {
  const [hasAnimated, setHasAnimated] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setHasAnimated(true);
    }, delay);

    return () => clearTimeout(timer);
  }, []); // Empty dependency array ensures this only runs once

  return hasAnimated;
};