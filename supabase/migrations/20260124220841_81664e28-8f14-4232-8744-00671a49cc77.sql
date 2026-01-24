-- Update boss_owners_view to include device_id
DROP VIEW IF EXISTS public.boss_owners_view;

CREATE VIEW public.boss_owners_view AS
SELECT 
  ur.user_id,
  ur.role,
  ur.created_at as role_created_at,
  ur.is_active,
  p.full_name,
  al.expires_at as license_expires,
  al.is_revoked as license_revoked,
  al.max_cashiers,
  al.license_tier,
  al.device_id,
  COALESCE(
    (SELECT COUNT(*) FROM public.user_roles 
     WHERE owner_id = ur.user_id AND role = 'cashier'),
    0
  )::int as cashier_count
FROM public.user_roles ur
LEFT JOIN public.profiles p ON p.user_id = ur.user_id
LEFT JOIN public.app_licenses al ON al.user_id = ur.user_id AND al.is_revoked = false
WHERE ur.role = 'admin'
ORDER BY ur.created_at DESC;