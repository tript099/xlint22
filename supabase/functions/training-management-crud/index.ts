import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, ...params } = await req.json();
    
    console.log('Training Management CRUD action:', action);

    switch (action) {
      case 'create_program':
        return await createTrainingProgram(params);
      
      case 'update_program':
        return await updateTrainingProgram(params);
      
      case 'delete_program':
        return await deleteTrainingProgram(params);
      
      case 'get_programs':
        return await getTrainingPrograms(params);
      
      case 'assign_training':
        return await assignTraining(params);
      
      case 'get_employee_trainings':
        return await getEmployeeTrainings(params);
      
      case 'update_enrollment':
        return await updateEnrollment(params);
      
      case 'get_training_analytics':
        return await getTrainingAnalytics();
      
      default:
        throw new Error(`Unknown action: ${action}`);
    }

  } catch (error) {
    console.error('Training Management CRUD error:', error);
    return new Response(JSON.stringify({
      error: error.message,
      details: 'Training management operation failed',
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

async function createTrainingProgram(params: any) {
  const {
    name,
    description,
    category,
    type = 'online',
    duration_hours,
    duration_weeks,
    difficulty_level = 'Beginner',
    target_audience = [],
    learning_objectives = [],
    tags = [],
    max_participants = 50,
    cost_per_participant = 0,
    certification_provided = false,
    certification_name,
    certification_validity_months,
    instructor_name,
    instructor_email,
    schedule_type = 'self_paced',
    start_date,
    end_date,
    enrollment_deadline,
    created_by
  } = params;

  const { data: program, error } = await supabase
    .from('training_programs')
    .insert({
      name,
      description,
      category,
      type,
      duration_hours,
      duration_weeks,
      difficulty_level,
      target_audience,
      learning_objectives,
      tags,
      max_participants,
      cost_per_participant,
      certification_provided,
      certification_name,
      certification_validity_months,
      instructor_name,
      instructor_email,
      schedule_type,
      start_date,
      end_date,
      enrollment_deadline,
      status: 'active',
      created_by
    })
    .select()
    .single();

  if (error) throw error;

  return new Response(JSON.stringify({
    success: true,
    program
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

async function updateTrainingProgram(params: any) {
  const { id, ...updateData } = params;

  const { data: program, error } = await supabase
    .from('training_programs')
    .update({
      ...updateData,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  return new Response(JSON.stringify({
    success: true,
    program
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

async function deleteTrainingProgram(params: any) {
  const { id } = params;

  // First, check if there are any enrollments
  const { data: enrollments, error: enrollmentsError } = await supabase
    .from('employee_training_enrollments')
    .select('id')
    .eq('training_program_id', id);

  if (enrollmentsError) throw enrollmentsError;

  if (enrollments && enrollments.length > 0) {
    // Soft delete - mark as inactive instead of hard delete
    const { data: program, error } = await supabase
      .from('training_programs')
      .update({
        status: 'inactive',
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return new Response(JSON.stringify({
      success: true,
      program,
      message: 'Program marked as inactive due to existing enrollments'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } else {
    // Hard delete if no enrollments
    const { error } = await supabase
      .from('training_programs')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return new Response(JSON.stringify({
      success: true,
      message: 'Program deleted successfully'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

async function getTrainingPrograms(params: any) {
  const { status = 'active', category, limit = 50, offset = 0 } = params;

  let query = supabase
    .from('training_programs')
    .select('*')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) {
    query = query.eq('status', status);
  }

  if (category) {
    query = query.eq('category', category);
  }

  const { data: programs, error } = await query;

  if (error) throw error;

  return new Response(JSON.stringify({
    success: true,
    programs: programs || []
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

async function assignTraining(params: any) {
  const {
    employeeId,
    trainingProgramId,
    enrollmentType = 'hr_assigned',
    priority = 'medium',
    targetCompletionDate,
    assignedBy
  } = params;

  // Check if already enrolled
  const { data: existing } = await supabase
    .from('employee_training_enrollments')
    .select('id')
    .eq('employee_id', employeeId)
    .eq('training_program_id', trainingProgramId)
    .single();

  if (existing) {
    throw new Error('Employee is already enrolled in this training program');
  }

  // Get training program details
  const { data: program, error: programError } = await supabase
    .from('training_programs')
    .select('*')
    .eq('id', trainingProgramId)
    .single();

  if (programError || !program) {
    throw new Error('Training program not found');
  }

  // Try to find the assigning employee record
  let recommendedById = null;
  if (assignedBy) {
    const { data: assigningEmployee } = await supabase
      .from('xlsmart_employees')
      .select('id')
      .eq('id', assignedBy)
      .single();
    
    if (assigningEmployee) {
      recommendedById = assigningEmployee.id;
    }
  }

  // Create enrollment
  const enrollmentData: any = {
    employee_id: employeeId,
    training_program_id: trainingProgramId,
    enrollment_type: enrollmentType,
    priority,
    target_completion_date: targetCompletionDate,
    status: 'enrolled',
    enrollment_date: new Date().toISOString(),
    progress_percentage: 0,
    time_spent_hours: 0
  };

  // Only add recommended_by if we found a valid employee record
  if (recommendedById) {
    enrollmentData.recommended_by = recommendedById;
  }

  const { data: enrollment, error } = await supabase
    .from('employee_training_enrollments')
    .insert(enrollmentData)
    .select(`
      *,
      training_programs(*),
      xlsmart_employees!employee_training_enrollments_employee_id_fkey(first_name, last_name, current_position, current_department)
    `)
    .single();

  if (error) throw error;

  return new Response(JSON.stringify({
    success: true,
    enrollment
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

async function getEmployeeTrainings(params: any) {
  const { employeeId, status, limit = 50, offset = 0 } = params;

  let query = supabase
    .from('employee_training_enrollments')
    .select(`
      *,
      training_programs(*),
      training_completions(*)
    `)
    .eq('employee_id', employeeId)
    .order('enrollment_date', { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) {
    query = query.eq('status', status);
  }

  const { data: enrollments, error } = await query;

  if (error) throw error;

  return new Response(JSON.stringify({
    success: true,
    enrollments: enrollments || []
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

async function updateEnrollment(params: any) {
  const {
    enrollmentId,
    status,
    progressPercentage,
    timeSpentHours,
    notes
  } = params;

  const updateData: any = {
    updated_at: new Date().toISOString()
  };

  if (status) updateData.status = status;
  if (progressPercentage !== undefined) updateData.progress_percentage = progressPercentage;
  if (timeSpentHours !== undefined) updateData.time_spent_hours = timeSpentHours;
  if (notes) updateData.notes = notes;

  if (progressPercentage > 0) {
    updateData.last_activity_date = new Date().toISOString();
  }

  const { data: enrollment, error } = await supabase
    .from('employee_training_enrollments')
    .update(updateData)
    .eq('id', enrollmentId)
    .select(`
      *,
      training_programs(*),
      xlsmart_employees!employee_training_enrollments_employee_id_fkey(first_name, last_name)
    `)
    .single();

  if (error) throw error;

  return new Response(JSON.stringify({
    success: true,
    enrollment
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

async function getTrainingAnalytics() {
  // Get comprehensive training analytics
  const { data: programs, error: programsError } = await supabase
    .from('training_programs')
    .select('*');

  if (programsError) throw programsError;

  const { data: enrollments, error: enrollmentsError } = await supabase
    .from('employee_training_enrollments')
    .select(`
      *,
      training_programs(name, category),
      xlsmart_employees!employee_training_enrollments_employee_id_fkey(first_name, last_name, current_department)
    `);

  if (enrollmentsError) throw enrollmentsError;

  const { data: completions, error: completionsError } = await supabase
    .from('training_completions')
    .select('*');

  if (completionsError) throw completionsError;

  // Calculate analytics
  const totalPrograms = programs?.length || 0;
  const activePrograms = programs?.filter(p => p.status === 'active').length || 0;
  const totalEnrollments = enrollments?.length || 0;
  const activeEnrollments = enrollments?.filter(e => ['enrolled', 'in_progress'].includes(e.status)).length || 0;
  const totalCompletions = completions?.length || 0;
  const completionRate = totalEnrollments > 0 ? Math.round((totalCompletions / totalEnrollments) * 100) : 0;

  // Department analytics
  const departmentStats = enrollments?.reduce((acc: any, enrollment: any) => {
    const dept = enrollment.xlsmart_employees?.current_department || 'Unknown';
    acc[dept] = (acc[dept] || 0) + 1;
    return acc;
  }, {}) || {};

  // Category analytics
  const categoryStats = programs?.reduce((acc: any, program: any) => {
    const category = program.category || 'Other';
    acc[category] = (acc[category] || 0) + 1;
    return acc;
  }, {}) || {};

  return new Response(JSON.stringify({
    success: true,
    analytics: {
      totalPrograms,
      activePrograms,
      totalEnrollments,
      activeEnrollments,
      totalCompletions,
      completionRate,
      departmentStats,
      categoryStats,
      recentEnrollments: enrollments?.slice(0, 10) || [],
      topPrograms: programs?.filter(p => p.status === 'active').slice(0, 5) || []
    }
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}


