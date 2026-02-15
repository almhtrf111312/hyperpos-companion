
-- Library Members table
CREATE TABLE public.library_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  registration_date DATE DEFAULT CURRENT_DATE,
  membership_status TEXT DEFAULT 'active', -- active, suspended
  late_fees NUMERIC DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.library_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own library members"
ON public.library_members FOR ALL
USING (user_id = get_owner_id(auth.uid()))
WITH CHECK (user_id = get_owner_id(auth.uid()));

CREATE TRIGGER update_library_members_updated_at
BEFORE UPDATE ON public.library_members
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Book Loans table
CREATE TABLE public.book_loans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.library_members(id) ON DELETE CASCADE,
  loan_date DATE DEFAULT CURRENT_DATE,
  due_date DATE NOT NULL,
  return_date DATE,
  status TEXT DEFAULT 'active', -- active, returned, overdue, lost
  late_fee NUMERIC DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.book_loans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own book loans"
ON public.book_loans FOR ALL
USING (user_id = get_owner_id(auth.uid()))
WITH CHECK (user_id = get_owner_id(auth.uid()));

CREATE TRIGGER update_book_loans_updated_at
BEFORE UPDATE ON public.book_loans
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
