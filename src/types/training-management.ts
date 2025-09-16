export interface TrainingProgram {
  id: string;
  name: string;
  description: string;
  category: string;
  type: 'online' | 'classroom' | 'hybrid' | 'certification';
  duration_hours: number;
  duration_weeks: number;
  difficulty_level: 'Beginner' | 'Intermediate' | 'Advanced';
  target_audience: string[];
  learning_objectives: string[];
  tags: string[];
  max_participants: number;
  cost_per_participant: number;
  certification_provided: boolean;
  certification_name?: string;
  certification_validity_months?: number;
  instructor_name?: string;
  instructor_email?: string;
  schedule_type: 'self_paced' | 'scheduled' | 'recurring';
  start_date?: string;
  end_date?: string;
  enrollment_deadline?: string;
  status: 'draft' | 'active' | 'inactive' | 'completed' | 'cancelled';
  created_by: string;
  updated_by?: string;
  created_at: string;
  updated_at: string;
}

export interface TrainingEnrollment {
  id: string;
  employee_id: string;
  training_program_id: string;
  enrollment_date: string;
  enrollment_type: 'self_enrolled' | 'manager_assigned' | 'hr_assigned' | 'mandatory' | 'ai_recommended';
  recommended_by?: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  target_completion_date?: string;
  status: 'enrolled' | 'in_progress' | 'completed' | 'cancelled' | 'failed' | 'expired';
  progress_percentage: number;
  time_spent_hours: number;
  last_activity_date?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  training_programs?: TrainingProgram;
  xlsmart_employees?: {
    first_name: string;
    last_name: string;
    current_position: string;
    current_department: string;
  };
}

export interface TrainingRecommendation {
  employeeId: string;
  employeeName: string;
  currentRole: string;
  department: string;
  recommendedTrainings: Array<{
    trainingId: string;
    trainingName: string;
    category: string;
    priority: 'high' | 'medium' | 'low';
    reason: string;
    estimatedHours: number;
    skillsGained: string[];
  }>;
  skillGaps: string[];
  overallScore: number;
  analysisDate: string;
}

export interface TrainingAnalytics {
  totalPrograms: number;
  activePrograms: number;
  totalEnrollments: number;
  activeEnrollments: number;
  totalCompletions: number;
  completionRate: number;
  departmentStats: Record<string, number>;
  categoryStats: Record<string, number>;
  recentEnrollments: TrainingEnrollment[];
  topPrograms: TrainingProgram[];
}

export interface CreateTrainingProgramData {
  name: string;
  description: string;
  category: string;
  type?: 'online' | 'classroom' | 'hybrid' | 'certification';
  duration_hours: number;
  duration_weeks?: number;
  difficulty_level?: 'Beginner' | 'Intermediate' | 'Advanced';
  target_audience?: string[];
  learning_objectives?: string[];
  tags?: string[];
  max_participants?: number;
  cost_per_participant?: number;
  certification_provided?: boolean;
  certification_name?: string;
  certification_validity_months?: number;
  content_url?: string;
  instructor_name?: string;
  instructor_email?: string;
  schedule_type?: 'self_paced' | 'scheduled' | 'recurring';
  start_date?: string;
  end_date?: string;
  enrollment_deadline?: string;
  created_by: string;
}

export interface AssignTrainingData {
  employeeId: string;
  trainingProgramId: string;
  enrollmentType?: 'self_enrolled' | 'manager_assigned' | 'hr_assigned' | 'mandatory' | 'ai_recommended';
  priority?: 'low' | 'medium' | 'high' | 'critical';
  targetCompletionDate?: string;
  assignedBy: string;
}

export interface UpdateEnrollmentData {
  enrollmentId: string;
  status?: 'enrolled' | 'in_progress' | 'completed' | 'cancelled' | 'failed' | 'expired';
  progressPercentage?: number;
  timeSpentHours?: number;
  notes?: string;
}


