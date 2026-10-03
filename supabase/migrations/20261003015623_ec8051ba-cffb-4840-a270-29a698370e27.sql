drop policy if exists "Users manage own invoices" on public.invoices;

create policy "Licensed users read own invoices"
on public.invoices for select to authenticated
using (user_id = get_owner_id(auth.uid()) and (public.is_license_valid(auth.uid()) or public.is_boss(auth.uid())));

create policy "Users insert own invoices"
on public.invoices for insert to authenticated
with check (user_id = get_owner_id(auth.uid()));

create policy "Users update own invoices"
on public.invoices for update to authenticated
using (user_id = get_owner_id(auth.uid()))
with check (user_id = get_owner_id(auth.uid()));

create policy "Users delete own invoices"
on public.invoices for delete to authenticated
using (user_id = get_owner_id(auth.uid()));