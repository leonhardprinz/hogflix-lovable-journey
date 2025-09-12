-- Clean up all placeholder/sample content from videos table
DELETE FROM videos 
WHERE title LIKE '%Content %' 
   OR description LIKE 'Sample description%'
   OR title LIKE 'Trending Now Content%'
   OR title LIKE 'Popular on HogFlix Content%'
   OR title LIKE 'Action & Adventure Content%'
   OR title LIKE 'Comedy Content%'
   OR title LIKE 'Drama Content%'
   OR title LIKE 'Horror Content%'
   OR title LIKE 'Sci-Fi Content%'
   OR title LIKE 'Documentary Content%'
   OR title LIKE 'Kids & Family Content%'
   OR title LIKE 'Continue Watching Content%';

-- This will keep only real user-uploaded content like "Hulk Hog: Standup Special"