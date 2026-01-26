
-- Drop the existing view with SECURITY DEFINER properties
DROP VIEW IF EXISTS public.boss_owners_view;

-- Recreate the view WITHOUT security_invoker (default is security invoker which respects RLS)
-- This view should only be accessible by boss users via RLS
CREATE VIEW public.boss_owners_view
WITH (security_invoker = true) AS
SELECT 
    ur.user_id,
    ur.role,
    ur.created_at AS role_created_at,
    ur.is_active,
    p.full_name,
    al.expires_at AS license_expires,
    al.is_revoked AS license_revoked,
    al.max_cashiers,
    al.license_tier,
    al.device_id,
    COALESCE((
        SELECT count(*) 
        FROM user_roles 
        WHERE user_roles.owner_id = ur.user_id AND user_roles.role = 'cashier'
    ), 0)::integer AS cashier_count
FROM user_roles ur
LEFT JOIN profiles p ON p.user_id = ur.user_id
LEFT JOIN app_licenses al ON al.user_id = ur.user_id AND al.is_revoked = false
WHERE ur.role = 'admin'::app_role
ORDER BY ur.created_at DESC;

-- Grant access to authenticated users (RLS on underlying tables will filter)
GRANT SELECT ON public.boss_owners_view TO authenticated;

-- Add a comment explaining the view's purpose
COMMENT ON VIEW public.boss_owners_view IS 'View for boss users to see all admin owners. Access controlled by RLS on underlying tables (user_roles, profiles, app_licenses).';
