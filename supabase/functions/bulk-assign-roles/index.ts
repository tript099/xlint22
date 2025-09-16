import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('=== BULK ASSIGN ROLES - SIMPLIFIED VERSION ===');

  try {
    // Basic environment check
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase credentials');
    }

    console.log('Environment check passed - Supabase credentials available');

    console.log('Creating Supabase client...');
    const supabaseClient = createClient(supabaseUrl, supabaseKey);

    console.log('Fetching employees...');
    // Mimic the exact query from EmployeeRoleAssignment.tsx
    const { data: employees, error: employeesError } = await supabaseClient
      .from('xlsmart_employees')
      .select('*')
      .is('standard_role_id', null)
      .order('created_at', { ascending: false });

    if (employeesError) {
      console.error('Employees fetch error:', employeesError);
      throw new Error(`Failed to fetch employees: ${employeesError.message}`);
    }

    console.log(`Found ${employees?.length || 0} unassigned employees`);

    console.log('Fetching standard roles...');
    // Mimic the exact query from EmployeeRoleAssignment.tsx
    const { data: standardRoles, error: rolesError } = await supabaseClient
      .from('xlsmart_standard_roles')
      .select('id, role_title, job_family, role_level, department, role_category')
      .eq('is_active', true)
      .order('role_title');

    if (rolesError) {
      console.error('Roles fetch error:', rolesError);
      throw new Error(`Failed to fetch standard roles: ${rolesError.message}`);
    }

    console.log(`Found ${standardRoles?.length || 0} standard roles`);

    if (!employees?.length) {
      return new Response(JSON.stringify({
        success: true,
        message: 'No employees need role assignment',
        assigned: 0,
        failed: 0,
        total: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!standardRoles?.length) {
      throw new Error('No standard roles available');
    }

    // Enhanced role matching function
    const findBestMatch = (employee: any, roles: any[]) => {
      let bestMatch = null;
      let bestScore = 0;
      
      for (const role of roles) {
        let score = 0;
        
        // Job title similarity (40%)
        if (role.role_title.toLowerCase().includes(employee.current_position.toLowerCase()) ||
            employee.current_position.toLowerCase().includes(role.role_title.toLowerCase())) {
          score += 0.4;
        }
        
        // Skills match (40%) - Note: role skills are not in this table structure
        const employeeSkills = Array.isArray(employee.skills) ? employee.skills : [];
        
        // For now, we'll use a basic job family/department match instead of detailed skills
        if (employeeSkills.length > 0) {
          // Check if any employee skills match the role title or department
          const skillMatches = employeeSkills.filter(skill => 
            role.role_title.toLowerCase().includes(skill.toLowerCase()) ||
            skill.toLowerCase().includes(role.role_title.toLowerCase()) ||
            (role.department && role.department.toLowerCase().includes(skill.toLowerCase()))
          ).length;
          
          if (skillMatches > 0) {
            score += 0.3; // Give points for any skill matches
          }
        }
        
        // Department match (20%)
        if (role.department && employee.current_department && 
            role.department.toLowerCase() === employee.current_department.toLowerCase()) {
          score += 0.2;
        }
        
        // Job family/role level match (10%)
        if (role.job_family && employee.current_department && 
            role.job_family.toLowerCase().includes(employee.current_department.toLowerCase())) {
          score += 0.1;
        }
        
        if (score > bestScore) {
          bestScore = score;
          bestMatch = role;
        }
      }
      
      return bestMatch;
    };

    // Process all employees
    let assignedCount = 0;
    let failedCount = 0;
    const totalEmployees = employees.length;
    const processedEmployees = [];

    console.log(`Processing ${totalEmployees} employees for role assignment...`);

    for (let i = 0; i < employees.length; i++) {
      const employee = employees[i];
      
      try {
        console.log(`Processing employee ${i + 1}/${totalEmployees}: ${employee.first_name} ${employee.last_name}`);
        console.log(`Analyzing: ${employee.current_position} with skills: ${JSON.stringify(employee.skills)}`);
        
        const matchingRole = findBestMatch(employee, standardRoles);
        
        let assignedRoleId = null;
        if (matchingRole) {
          assignedRoleId = matchingRole.id;
          console.log(`Found matching role: ${matchingRole.role_title}`);
        } else {
          // Assign the first available role as fallback
          assignedRoleId = standardRoles[0].id;
          console.log(`No match found, assigning first role: ${standardRoles[0].role_title}`);
        }

        console.log(`Updating employee with role ID: ${assignedRoleId}`);
        
        const { error: updateError } = await supabaseClient
          .from('xlsmart_employees')
          .update({
            standard_role_id: assignedRoleId,
            role_assignment_status: 'ai_suggested',
            assignment_notes: 'AI bulk assignment'
          })
          .eq('id', employee.id);

        if (updateError) {
          console.error(`Update error for employee ${employee.id}:`, updateError);
          failedCount++;
          processedEmployees.push({
            employee: `${employee.first_name} ${employee.last_name}`,
            status: 'failed',
            error: updateError.message
          });
        } else {
          console.log(`✅ Successfully assigned role to ${employee.first_name} ${employee.last_name}`);
          assignedCount++;
          processedEmployees.push({
            employee: `${employee.first_name} ${employee.last_name}`,
            status: 'assigned',
            assigned_role: matchingRole?.role_title || standardRoles[0].role_title
          });
        }
      } catch (error) {
        console.error(`Error processing employee ${employee.id}:`, error);
        failedCount++;
        processedEmployees.push({
          employee: `${employee.first_name} ${employee.last_name}`,
          status: 'failed',
          error: error.message
        });
      }
    }

    console.log(`Bulk assignment completed: ${assignedCount} assigned, ${failedCount} failed`);

    return new Response(JSON.stringify({
      success: true,
      message: `Bulk assignment completed: ${assignedCount} assigned, ${failedCount} failed`,
      assigned: assignedCount,
      failed: failedCount,
      total: totalEmployees,
      details: processedEmployees
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('=== BULK ASSIGN ERROR ===');
    console.error('Error:', error);
    console.error('Message:', error.message);
    console.error('Stack:', error.stack);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      assigned: 0,
      failed: 1,
      total: 0
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});