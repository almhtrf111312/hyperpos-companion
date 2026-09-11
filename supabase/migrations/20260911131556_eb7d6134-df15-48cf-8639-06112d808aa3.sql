-- Internal-only functions: not callable from the API at all
DO $$
DECLARE fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'public.handle_new_user()',
    'public.handle_new_user_role()',
    'public.handle_updated_at()',
    'public.update_updated_at_column()',
    'public.update_warehouse_timestamp()',
    'public.update_purchase_invoice_updated_at()',
    'public.guard_refunded_invoice_status()',
    'public.record_main_stock_movement()',
    'public.record_warehouse_stock_movement()',
    'public.prevent_license_self_upgrade()',
    'public.is_first_user()',
    'public.can_add_cashier(uuid)',
    'public.count_owner_cashiers(uuid)',
    'public.get_user_role(uuid)'
  ] LOOP
    BEGIN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn);
    EXCEPTION WHEN undefined_function THEN NULL; END;
  END LOOP;
END $$;

-- Business functions: signed-in users only (no anonymous access)
DO $$
DECLARE fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'public.get_boss_owners()',
    'public.reset_user_device(uuid)',
    'public.revoke_license(uuid, text)',
    'public.delete_owner_cascade(uuid)',
    'public.add_product_quantity(uuid, integer)',
    'public.deduct_product_quantity(uuid, integer)',
    'public.get_stock_discrepancies()',
    'public.get_next_invoice_number(uuid)',
    'public.get_inventory_value(uuid)',
    'public.is_license_valid(uuid)',
    'public.refund_invoice_atomic(text, text)',
    'public.process_pos_sale_atomic(text, text, text, text, numeric, numeric, numeric, numeric, numeric, numeric, numeric, text, uuid, jsonb)'
  ] LOOP
    BEGIN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', fn);
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', fn);
    EXCEPTION WHEN undefined_function THEN NULL; END;
  END LOOP;
END $$;

-- Row-level-security helpers must stay executable so policies keep working
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_boss(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_owner_id(uuid) TO anon, authenticated;