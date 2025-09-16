-- Create table for AI analysis results
CREATE TABLE public.ai_analysis_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  analysis_type TEXT NOT NULL,
  function_name TEXT NOT NULL,
  input_parameters JSONB NOT NULL DEFAULT '{}',
  analysis_result JSONB NOT NULL DEFAULT '{}',
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'completed'
);

-- Enable RLS
ALTER TABLE public.ai_analysis_results ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own AI analyses" 
ON public.ai_analysis_results 
FOR SELECT 
USING (auth.uid() = created_by);

CREATE POLICY "Users can create their own AI analyses" 
ON public.ai_analysis_results 
FOR INSERT 
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their own AI analyses" 
ON public.ai_analysis_results 
FOR UPDATE 
USING (auth.uid() = created_by);

-- Create indexes for better performance
CREATE INDEX idx_ai_analysis_results_function_name ON public.ai_analysis_results(function_name);
CREATE INDEX idx_ai_analysis_results_analysis_type ON public.ai_analysis_results(analysis_type);
CREATE INDEX idx_ai_analysis_results_created_by ON public.ai_analysis_results(created_by);
CREATE INDEX idx_ai_analysis_results_created_at ON public.ai_analysis_results(created_at DESC);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_ai_analysis_results_updated_at
BEFORE UPDATE ON public.ai_analysis_results
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();