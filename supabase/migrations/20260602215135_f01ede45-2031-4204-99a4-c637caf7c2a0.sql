-- Prevent admins from escalating their cashiers' role to 'admin'.
-- Admins can only keep sub-account role as 'cashier'; only boss can assign other roles.
DROP POLICY IF EXISTS "Admins can update owned users" ON public.user_roles;

CREATE POLICY "Admins can update owned users"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (
  ((owner_id = auth.uid()) AND has_role(auth.uid(), 'admin'::app_role))
  OR is_boss(auth.uid())
)
WITH CHECK (
  (
    (owner_id = auth.uid())
    AND has_role(auth.uid(), 'admin'::app_role)
    AND role = 'cashier'::app_role
  )
  OR is_boss(auth.uid())
);

-- Also restrict INSERT so admins can only create cashier sub-accounts.
DROP POLICY IF EXISTS "Admins can create owned users" ON public.user_roles;

CREATE POLICY "Admins can create owned users"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  (
    has_role(auth.uid(), 'admin'::app_role)
    AND (owner_id = auth.uid())
    AND role = 'cashier'::app_role
  )
  OR is_boss(auth.uid())
);