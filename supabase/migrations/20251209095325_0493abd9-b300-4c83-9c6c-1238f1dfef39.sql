INSERT INTO public.user_roles (user_id, role)
VALUES ('3b5bc01b-32e9-47f5-ac93-0184adcec671', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;