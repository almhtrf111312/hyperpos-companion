
CREATE OR REPLACE FUNCTION public.trg_recalc_pos_invoice_profit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.invoices i WHERE i.id=NEW.invoice_id AND i.operation_id IS NOT NULL
             AND COALESCE(i.status,'') <> 'refunded') THEN
    PERFORM public.recalc_pos_invoice_profit(NEW.invoice_id);
  END IF;
  RETURN NULL;
END $$;
REVOKE EXECUTE ON FUNCTION public.trg_recalc_pos_invoice_profit() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS recalc_pos_invoice_profit_trigger ON public.invoice_items;
CREATE CONSTRAINT TRIGGER recalc_pos_invoice_profit_trigger
AFTER INSERT ON public.invoice_items
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION public.trg_recalc_pos_invoice_profit();
