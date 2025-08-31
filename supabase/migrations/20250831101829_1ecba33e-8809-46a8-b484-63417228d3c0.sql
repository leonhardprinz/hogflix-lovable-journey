-- Add is_kids_profile column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN is_kids_profile BOOLEAN NOT NULL DEFAULT false;