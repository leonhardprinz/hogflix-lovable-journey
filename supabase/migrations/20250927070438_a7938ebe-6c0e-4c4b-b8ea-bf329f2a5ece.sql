-- Remove the inappropriate "Continue Watching" category from new uploads
-- This category should only be dynamic, not selectable for new content
DELETE FROM public.categories 
WHERE name = 'Continue Watching' AND id = '770087b0-5e31-47b9-92f5-9ff5a9425736';