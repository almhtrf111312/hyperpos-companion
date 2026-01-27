-- Fix partner profit updates from cashier sessions by allowing cashiers to UPDATE their owner's partners
-- Keep INSERT/DELETE restricted to Admin/Boss only

-- Partners table should already have RLS enabled, but ensure it stays on
ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;

-- Replace the overly restrictive policy
DROP POLICY IF EXISTS "Owners manage own partners" ON public.partners;

-- Allow owner (admin/boss) and their cashiers to VIEW partners (needed for profit distribution calculations)
CREATE POLICY "Owners can view partners"
ON public.partners
FOR SELECT
USING (
  user_id = get_owner_id(auth.uid())
  AND (
    has_role(get_owner_id(auth.uid()), 'admin'::app_role)
    OR is_boss(get_owner_id(auth.uid()))
    OR is_boss(auth.uid())
    OR get_user_role(auth.uid()) = 'cashier'::app_role
  )
);

-- Only Admin/Boss can create partners
CREATE POLICY "Owners can insert partners"
ON public.partners
FOR INSERT
WITH CHECK (
  user_id = auth.uid()
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR is_boss(auth.uid())
  )
);

-- Allow cashiers to UPDATE their owner's partner balances (profit/expense movements)
CREATE POLICY "Owners can update partners"
ON public.partners
FOR UPDATE
USING (
  user_id = get_owner_id(auth.uid())
  AND (
    has_role(get_owner_id(auth.uid()), 'admin'::app_role)
    OR is_boss(get_owner_id(auth.uid()))
    OR is_boss(auth.uid())
    OR get_user_role(auth.uid()) = 'cashier'::app_role
  )
)
WITH CHECK (
  user_id = get_owner_id(auth.uid())
  AND (
    has_role(get_owner_id(auth.uid()), 'admin'::app_role)
    OR is_boss(get_owner_id(auth.uid()))
    OR is_boss(auth.uid())
    OR get_user_role(auth.uid()) = 'cashier'::app_role
  )
);

-- Only Admin/Boss can delete partners
CREATE POLICY "Owners can delete partners"
ON public.partners
FOR DELETE
USING (
  user_id = auth.uid()
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR is_boss(auth.uid())
  )
);
