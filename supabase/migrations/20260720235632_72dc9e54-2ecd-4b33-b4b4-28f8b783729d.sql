REVOKE EXECUTE ON FUNCTION public.refund_invoice_atomic(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.refund_invoice_atomic(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.refund_invoice_atomic(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.refund_invoice_atomic(text) TO service_role;