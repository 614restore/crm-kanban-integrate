-- Migrate estimate line items from JSON field to separate table
-- This enables proper relational queries and prevents data corruption

-- Create the estimate_items table
CREATE TABLE IF NOT EXISTS public.estimate_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_id uuid NOT NULL REFERENCES public.estimates(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  description text NOT NULL,
  quantity numeric NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_estimate_items_estimate_id ON public.estimate_items(estimate_id);
CREATE INDEX IF NOT EXISTS idx_estimate_items_company_id ON public.estimate_items(company_id);
CREATE INDEX IF NOT EXISTS idx_estimate_items_order ON public.estimate_items(estimate_id, order_index);

-- Add RLS policies
ALTER TABLE public.estimate_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "estimate_items_company_isolation" 
  ON public.estimate_items FOR ALL 
  USING (company_id = (auth.jwt() ->> 'company_id')::uuid);

-- Migrate existing data from JSON items field to new table
DO $$
DECLARE
  r RECORD;
  item JSONB;
  item_order INT;
BEGIN
  FOR r IN
    SELECT id, company_id, items
    FROM public.estimates
    WHERE items IS NOT NULL 
      AND jsonb_array_length(items) > 0
  LOOP
    item_order := 0;
    
    FOR item IN SELECT * FROM jsonb_array_elements(r.items)
    LOOP
      INSERT INTO public.estimate_items (
        estimate_id,
        company_id,
        description,
        quantity,
        unit_price,
        total,
        order_index
      ) VALUES (
        r.id,
        r.company_id,
        COALESCE(item->>'description', item->>'name', 'Line Item'),
        COALESCE((item->>'quantity')::numeric, (item->>'qty')::numeric, 1),
        COALESCE((item->>'unit_price')::numeric, (item->>'price')::numeric, (item->>'unitPrice')::numeric, 0),
        COALESCE((item->>'total')::numeric, (item->>'amount')::numeric, 0),
        item_order
      );
      
      item_order := item_order + 1;
    END LOOP;
  END LOOP;
END;
$$;

-- Create helper function to get estimate with items
CREATE OR REPLACE FUNCTION get_estimate_with_items(p_estimate_id uuid)
RETURNS TABLE(
  estimate_data jsonb,
  items_data jsonb
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    to_jsonb(e) as estimate_data,
    COALESCE(
      (SELECT jsonb_agg(
        jsonb_build_object(
          'id', ei.id,
          'description', ei.description,
          'quantity', ei.quantity,
          'unit_price', ei.unit_price,
          'total', ei.total,
          'order_index', ei.order_index
        )
        ORDER BY ei.order_index
      )
      FROM public.estimate_items ei
      WHERE ei.estimate_id = p_estimate_id),
      '[]'::jsonb
    ) as items_data
  FROM public.estimates e
  WHERE e.id = p_estimate_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add trigger to update estimate totals when items change
CREATE OR REPLACE FUNCTION update_estimate_totals()
RETURNS trigger AS $$
DECLARE
  estimate_subtotal numeric;
  estimate_tax_rate numeric;
  estimate_tax numeric;
  estimate_total numeric;
BEGIN
  -- Calculate new totals
  SELECT 
    COALESCE(SUM(total), 0),
    COALESCE(e.tax / NULLIF(e.subtotal, 0), 0.1) -- preserve tax rate or default to 10%
  INTO estimate_subtotal, estimate_tax_rate
  FROM public.estimate_items ei
  LEFT JOIN public.estimates e ON e.id = COALESCE(NEW.estimate_id, OLD.estimate_id)
  WHERE ei.estimate_id = COALESCE(NEW.estimate_id, OLD.estimate_id)
  GROUP BY e.tax, e.subtotal;
  
  estimate_tax := estimate_subtotal * estimate_tax_rate;
  estimate_total := estimate_subtotal + estimate_tax;
  
  -- Update estimate totals
  UPDATE public.estimates
  SET 
    subtotal = estimate_subtotal,
    tax = estimate_tax,
    total = estimate_total,
    updated_at = now()
  WHERE id = COALESCE(NEW.estimate_id, OLD.estimate_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER estimate_items_update_totals
  AFTER INSERT OR UPDATE OR DELETE ON public.estimate_items
  FOR EACH ROW EXECUTE FUNCTION update_estimate_totals();

-- Optional: Remove the items JSON column after migration is verified
-- ALTER TABLE public.estimates DROP COLUMN items;