-- Add unique constraint first
ALTER TABLE public.user_roles 
ADD CONSTRAINT user_roles_user_id_unique UNIQUE (user_id);

-- Then add admin role for the current user
INSERT INTO public.user_roles (user_id, role)
VALUES ('174b31d6-f19a-4381-9efb-45f1bea6ff0f', 'admin')
ON CONFLICT (user_id) DO NOTHING;