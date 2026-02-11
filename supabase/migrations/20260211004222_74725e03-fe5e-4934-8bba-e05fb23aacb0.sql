
-- Drop overly permissive SELECT and UPDATE policies on partners
DROP POLICY IF EXISTS "Owners can view partners" ON public.partners;
DROP POLICY IF EXISTS "Owners can update partners" ON public.partners;

-- Recreate SELECT: only admin and boss (no cashier)
CREATE POLICY "Owners can view partners"
ON public.partners
FOR SELECT
USING (
  user_id = get_owner_id(auth.uid())
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR is_boss(auth.uid())
  )
);

-- Recreate UPDATE: only admin and boss (no cashier)
CREATE POLICY "Owners can update partners"
ON public.partners
FOR UPDATE
USING (
  user_id = get_owner_id(auth.uid())
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR is_boss(auth.uid())
  )
)
WITH CHECK (
  user_id = get_owner_id(auth.uid())
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR is_boss(auth.uid())
  )
);
