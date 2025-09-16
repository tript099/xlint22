import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('=== Training Management API Started ===');
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing required environment variables');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { action, ...params } = await req.json();
    
    console.log('Training management action:', action, 'params:', params);

    switch (action) {
      case 'get_training_analytics':
        return await getTrainingAnalytics(supabase);
      
      case 'get_employee_trainings':
        return await getEmployeeTrainings(supabase, params.employeeId);
      
      case 'enroll_employee':
        return await enrollEmployee(supabase, params);
      
      case 'update_progress':
        return await updateTrainingProgress(supabase, params);
      
      case 'complete_training':
        return await completeTraining(supabase, params);
      
      case 'get_program_statistics':
        return await getProgramStatistics(supabase, params.programId);
      
      case 'get_department_analytics':
        return await getDepartmentAnalytics(supabase, params.department);
      
      default:
        throw new Error(`Unknown action: ${action}`);
    }

  } catch (error) {
    console.error('Training management error:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      details: 'Training management operation failed',
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function getTrainingAnalytics(supabase: any) {
  console.log('Getting training analytics...');
  
  // Get training programs stats
  const { data: programs, error: programsError } = await supabase
    .from('training_programs')
    .select('*');
  
  if (programsError) throw programsError;

  // Get enrollment stats
  const { data: enrollments, error: enrollmentsError } = await supabase
    .from('employee_training_enrollments')
    .select(`
      *,
      training_programs(*),
      xlsmart_employees(first_name, last_name, current_department)
    `);
  
  if (enrollmentsError) throw enrollmentsError;

  // Get completion stats
  const { data: completions, error: completionsError } = await supabase
    .from('training_completions')
    .select(`
      *,
      training_programs(name, category),
      xlsmart_employees(first_name, last_name)
    `);
  
  if (completionsError) throw completionsError;

  // Calculate analytics
  const totalPrograms = programs?.length || 0;
  const activePrograms = programs?.filter(p => p.status === 'active').length || 0;
  const totalEnrollments = enrollments?.length || 0;
  const activeEnrollments = enrollments?.filter(e => ['enrolled', 'in_progress'].includes(e.status)).length || 0;
  const totalCompletions = completions?.length || 0;
  
  const completionRate = totalEnrollments > 0 ? Math.round((totalCompletions / totalEnrollments) * 100) : 0;
  
  // Calculate average hours from programs
  const totalHours = programs?.reduce((sum, p) => sum + (p.duration_hours || 0), 0) || 0;
  const avgHours = totalPrograms > 0 ? Math.round(totalHours / totalPrograms) : 0;

  // Group by category
  const categoryStats = programs?.reduce((acc: any, program: any) => {
    const category = program.category || 'Other';
    acc[category] = (acc[category] || 0) + 1;
    return acc;
  }, {}) || {};

  // Department enrollment stats
  const departmentStats = enrollments?.reduce((acc: any, enrollment: any) => {
    const dept = enrollment.xlsmart_employees?.current_department || 'Unknown';
    acc[dept] = (acc[dept] || 0) + 1;
    return acc;
  }, {}) || {};

  const analytics = {
    totalPrograms,
    activePrograms,
    totalEnrollments,
    activeEnrollments,
    totalCompletions,
    completionRate,
    avgHours,
    categoryStats,
    departmentStats,
    recentCompletions: completions?.slice(-5) || [],
    topPrograms: programs?.filter(p => p.status === 'active').slice(0, 5) || []
  };

  return new Response(JSON.stringify(analytics), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function getEmployeeTrainings(supabase: any, employeeId: string) {
  console.log('Getting trainings for employee:', employeeId);
  
  const { data: enrollments, error } = await supabase
    .from('employee_training_enrollments')
    .select(`
      *,
      training_programs(*),
      training_completions(*)
    `)
    .eq('employee_id', employeeId)
    .order('enrollment_date', { ascending: false });
  
  if (error) throw error;

  return new Response(JSON.stringify(enrollments || []), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function enrollEmployee(supabase: any, params: any) {
  console.log('Enrolling employee:', params);
  
  const { employeeId, trainingProgramId, enrollmentType = 'self_enrolled', priority = 'medium' } = params;
  
  // Check if already enrolled
  const { data: existing } = await supabase
    .from('employee_training_enrollments')
    .select('id')
    .eq('employee_id', employeeId)
    .eq('training_program_id', trainingProgramId)
    .single();
  
  if (existing) {
    throw new Error('Employee already enrolled in this training program');
  }

  const { data: enrollment, error } = await supabase
    .from('employee_training_enrollments')
    .insert({
      employee_id: employeeId,
      training_program_id: trainingProgramId,
      enrollment_type: enrollmentType,
      priority: priority,
      status: 'enrolled'
    })
    .select()
    .single();
  
  if (error) throw error;

  return new Response(JSON.stringify({ success: true, enrollment }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function updateTrainingProgress(supabase: any, params: any) {
  console.log('Updating training progress:', params);
  
  const { enrollmentId, progressPercentage, timeSpentHours, notes } = params;
  
  const updateData: any = {
    updated_at: new Date().toISOString()
  };
  
  if (progressPercentage !== undefined) {
    updateData.progress_percentage = progressPercentage;
    if (progressPercentage > 0) {
      updateData.status = 'in_progress';
    }
  }
  
  if (timeSpentHours !== undefined) {
    updateData.time_spent_hours = timeSpentHours;
  }
  
  if (notes) {
    updateData.notes = notes;
  }
  
  updateData.last_activity_date = new Date().toISOString();

  const { data: enrollment, error } = await supabase
    .from('employee_training_enrollments')
    .update(updateData)
    .eq('id', enrollmentId)
    .select()
    .single();
  
  if (error) throw error;

  return new Response(JSON.stringify({ success: true, enrollment }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function completeTraining(supabase: any, params: any) {
  console.log('Completing training:', params);
  
  const { 
    enrollmentId, 
    employeeId, 
    trainingProgramId, 
    finalScore, 
    feedbackRating, 
    feedbackComments,
    skillsAcquired = [],
    certificateIssued = false 
  } = params;
  
  // Update enrollment status
  const { error: enrollmentError } = await supabase
    .from('employee_training_enrollments')
    .update({ 
      status: 'completed',
      progress_percentage: 100,
      updated_at: new Date().toISOString()
    })
    .eq('id', enrollmentId);
  
  if (enrollmentError) throw enrollmentError;

  // Create completion record
  const { data: completion, error: completionError } = await supabase
    .from('training_completions')
    .insert({
      enrollment_id: enrollmentId,
      employee_id: employeeId,
      training_program_id: trainingProgramId,
      completion_status: finalScore >= 70 ? 'passed' : 'failed',
      final_score: finalScore,
      feedback_rating: feedbackRating,
      feedback_comments: feedbackComments,
      skills_acquired: skillsAcquired,
      certificate_issued: certificateIssued
    })
    .select()
    .single();
  
  if (completionError) throw completionError;

  return new Response(JSON.stringify({ success: true, completion }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function getProgramStatistics(supabase: any, programId: string) {
  console.log('Getting program statistics for:', programId);
  
  // Get program details
  const { data: program, error: programError } = await supabase
    .from('training_programs')
    .select('*')
    .eq('id', programId)
    .single();
  
  if (programError) throw programError;

  // Get enrollment statistics
  const { data: enrollments, error: enrollmentsError } = await supabase
    .from('employee_training_enrollments')
    .select('*')
    .eq('training_program_id', programId);
  
  if (enrollmentsError) throw enrollmentsError;

  // Get completion statistics
  const { data: completions, error: completionsError } = await supabase
    .from('training_completions')
    .select('*')
    .eq('training_program_id', programId);
  
  if (completionsError) throw completionsError;

  const totalEnrollments = enrollments?.length || 0;
  const totalCompletions = completions?.length || 0;
  const completionRate = totalEnrollments > 0 ? Math.round((totalCompletions / totalCompletions) * 100) : 0;
  
  const avgRating = completions?.length > 0 
    ? completions.reduce((sum, c) => sum + (c.feedback_rating || 0), 0) / completions.length 
    : 0;

  const statistics = {
    program,
    totalEnrollments,
    totalCompletions,
    completionRate: Math.round(completionRate),
    avgRating: Math.round(avgRating * 10) / 10,
    enrollmentsByStatus: enrollments?.reduce((acc: any, e: any) => {
      acc[e.status] = (acc[e.status] || 0) + 1;
      return acc;
    }, {}) || {}
  };

  return new Response(JSON.stringify(statistics), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function getDepartmentAnalytics(supabase: any, department: string) {
  console.log('Getting department analytics for:', department);
  
  // Get employees in department
  const { data: employees, error: employeesError } = await supabase
    .from('xlsmart_employees')
    .select('id')
    .eq('current_department', department)
    .eq('is_active', true);
  
  if (employeesError) throw employeesError;

  const employeeIds = employees?.map(e => e.id) || [];

  // Get department enrollments
  const { data: enrollments, error: enrollmentsError } = await supabase
    .from('employee_training_enrollments')
    .select(`
      *,
      training_programs(name, category)
    `)
    .in('employee_id', employeeIds);
  
  if (enrollmentsError) throw enrollmentsError;

  // Get department completions
  const { data: completions, error: completionsError } = await supabase
    .from('training_completions')
    .select('*')
    .in('employee_id', employeeIds);
  
  if (completionsError) throw completionsError;

  const totalEmployees = employees?.length || 0;
  const totalEnrollments = enrollments?.length || 0;
  const totalCompletions = completions?.length || 0;
  const participationRate = totalEmployees > 0 ? Math.round((new Set(enrollments?.map(e => e.employee_id)).size / totalEmployees) * 100) : 0;
  const completionRate = totalEnrollments > 0 ? Math.round((totalCompletions / totalEnrollments) * 100) : 0;

  const analytics = {
    department,
    totalEmployees,
    totalEnrollments,
    totalCompletions,
    participationRate,
    completionRate,
    popularCategories: enrollments?.reduce((acc: any, e: any) => {
      const category = e.training_programs?.category || 'Other';
      acc[category] = (acc[category] || 0) + 1;
      return acc;
    }, {}) || {}
  };

  return new Response(JSON.stringify(analytics), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
