-- Create employee_moves table to track actual internal moves
CREATE TABLE public.employee_moves (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.xlsmart_employees(id) ON DELETE CASCADE,
  move_type TEXT NOT NULL CHECK (move_type IN ('promotion', 'lateral_move', 'department_transfer', 'role_change', 'location_change')),
  
  -- Previous position details
  previous_position TEXT NOT NULL,
  previous_department TEXT,
  previous_level TEXT,
  previous_manager_id UUID REFERENCES public.xlsmart_employees(id),
  
  -- New position details  
  new_position TEXT NOT NULL,
  new_department TEXT,
  new_level TEXT,
  new_manager_id UUID REFERENCES public.xlsmart_employees(id),
  
  -- Move metadata
  move_date DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
  reason TEXT,
  notes TEXT,
  
  -- AI recommendation reference
  mobility_plan_id UUID REFERENCES public.ai_analysis_results(id),
  
  -- Approval tracking
  requested_by UUID NOT NULL REFERENCES auth.users(id),
  approved_by UUID REFERENCES auth.users(id),
  approval_date TIMESTAMP WITH TIME ZONE,
  move_status TEXT NOT NULL DEFAULT 'pending' CHECK (move_status IN ('pending', 'approved', 'executed', 'cancelled')),
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_employee_moves_employee_id ON employee_moves(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_moves_move_date ON employee_moves(move_date);
CREATE INDEX IF NOT EXISTS idx_employee_moves_status ON employee_moves(move_status);
CREATE INDEX IF NOT EXISTS idx_employee_moves_mobility_plan ON employee_moves(mobility_plan_id);

-- Create updated_at trigger
CREATE TRIGGER update_employee_moves_updated_at
    BEFORE UPDATE ON employee_moves
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE employee_moves ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view employee moves" ON employee_moves
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can create employee moves" ON employee_moves
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can update employee moves" ON employee_moves
    FOR UPDATE USING (auth.role() = 'authenticated');

-- Add comments
COMMENT ON TABLE employee_moves IS 'Tracks actual internal employee moves and transfers';
COMMENT ON COLUMN employee_moves.move_type IS 'Type of move: promotion, lateral_move, department_transfer, role_change, location_change';
COMMENT ON COLUMN employee_moves.move_status IS 'Status: pending, approved, executed, cancelled';
COMMENT ON COLUMN employee_moves.mobility_plan_id IS 'Reference to the AI mobility plan that suggested this move';


