-- Remove dynamic/algorithmic categories that shouldn't be selectable for uploads
DELETE FROM categories WHERE name IN ('Trending Now', 'Popular on HogFlix');