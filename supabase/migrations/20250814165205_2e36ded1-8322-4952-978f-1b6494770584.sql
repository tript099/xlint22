-- Update RLS policies to handle system-created AI analyses
DROP POLICY "Users can create their own AI analyses" ON public.ai_analysis_results;

CREATE POLICY "Authenticated users can create AI analyses" 
ON public.ai_analysis_results 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

-- Update trigger to automatically set created_by
CREATE OR REPLACE FUNCTION public.set_ai_analysis_created_by()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- If created_by is not set or is 'system', set it to the current user
  IF NEW.created_by IS NULL OR NEW.created_by::text = 'system' THEN
    NEW.created_by = auth.uid();
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER set_ai_analysis_created_by_trigger
BEFORE INSERT ON public.ai_analysis_results
FOR EACH ROW
EXECUTE FUNCTION public.set_ai_analysis_created_by();