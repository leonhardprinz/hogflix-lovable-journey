-- Make leonhardprinz@gmail.com an admin
INSERT INTO public.user_roles (user_id, role)
VALUES ('72c85bde-d3a8-4f9c-9889-918376409217', 'admin'::app_role)
ON CONFLICT (user_id, role) DO NOTHING;