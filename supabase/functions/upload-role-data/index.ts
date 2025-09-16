import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper function to find the best matching column name
function findColumnMapping(headers: string[], possibleNames: string[]): string | null {
  for (const possibleName of possibleNames) {
    const found = headers.find(header => 
      header.toLowerCase().trim() === possibleName.toLowerCase().trim() ||
      header.toLowerCase().trim().replace(/\s+/g, '') === possibleName.toLowerCase().trim().replace(/\s+/g, '')
    );
    if (found) {
      console.log(`✅ Found column mapping: "${possibleName}" -> "${found}"`);
      return found;
    }
  }
  console.log(`❌ No column mapping found for: ${possibleNames.join(', ')}`);
  console.log(`Available headers: ${headers.join(', ')}`);
  return null;
}

// Helper function to extract value from row with flexible column mapping
function extractValue(row: any, headers: string[], possibleNames: string[], defaultValue: string = ''): string {
  const columnName = findColumnMapping(headers, possibleNames);
  if (columnName && row[columnName]) {
    const value = String(row[columnName]).trim();
    console.log(`📝 Extracted value from "${columnName}": "${value}"`);
    return value;
  }
  console.log(`⚠️ No value found for columns: ${possibleNames.join(', ')}`);
  return defaultValue;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get the authorization header to forward user context
    const authHeader = req.headers.get('authorization');
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: {
            authorization: authHeader,
          },
        },
      }
    );

    const { sessionId, xlData, smartData } = await req.json();

    console.log('Starting role data upload:', {
      sessionId,
      xlDataCount: xlData?.length || 0,
      smartDataCount: smartData?.length || 0
    });

    // Check for existing data for this session
    const { data: existingXL } = await supabase
      .from('xl_roles_data')
      .select('id')
      .eq('session_id', sessionId);

    const { data: existingSmart } = await supabase
      .from('smart_roles_data')
      .select('id')
      .eq('session_id', sessionId);

    if ((existingXL && existingXL.length > 0) || (existingSmart && existingSmart.length > 0)) {
      console.log('Data already exists for this session, skipping upload');
      return new Response(JSON.stringify({
        success: true,
        totalInserted: 0,
        xlCount: xlData?.length || 0,
        smartCount: smartData?.length || 0,
        skipped: true,
        message: 'Data already uploaded for this session'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let totalInserted = 0;

    // Insert XL data
    if (xlData && xlData.length > 0) {
      // Get headers from the first row to understand column structure
      const headers = Object.keys(xlData[0] || {});
      console.log('XL Data headers:', headers);

      const xlRolesData = xlData.map((row: any) => {
        // Flexible column mapping for role title
        const roleTitle = extractValue(row, headers, [
          'Title', 'RoleTitle', 'JobTitle', 'RoleName', 'CurrentPosition', 'Name', 
          'Role Title', 'Position', 'Job Title', 'Role Name', 'Current Position', 
          'Role', 'Designation', 'Job Role', 'Function'
        ], 'Unknown Role');

        // Flexible column mapping for department
        const department = extractValue(row, headers, [
          'Department', 'Dept', 'Division', 'Team', 'Business Unit', 'BU'
        ]);

        // Flexible column mapping for role family
        const roleFamily = extractValue(row, headers, [
          'RoleFamily', 'JobFamily', 'Family', 'Category', 'Job Category'
        ]);

        // Flexible column mapping for seniority band
        const seniorityBand = extractValue(row, headers, [
          'SeniorityBand', 'Level', 'Grade', 'Band', 'Seniority', 'Job Level'
        ]);

        // Flexible column mapping for role purpose
        const rolePurpose = extractValue(row, headers, [
          'RolePurpose', 'Purpose', 'Job Purpose', 'Description', 'Job Description'
        ]);

        // Flexible column mapping for core responsibilities
        const coreResponsibilities = extractValue(row, headers, [
          'CoreResponsibilities', 'Responsibilities', 'Key Responsibilities', 'Duties'
        ]);

        // Flexible column mapping for required skills
        const requiredSkills = extractValue(row, headers, [
          'RequiredSkills', 'Skills', 'Technical Skills', 'Required Qualifications'
        ]);

        // Flexible column mapping for preferred skills
        const preferredSkills = extractValue(row, headers, [
          'PreferredSkills', 'Preferred Qualifications', 'Nice to Have'
        ]);

        // Flexible column mapping for certifications
        const certifications = extractValue(row, headers, [
          'Certifications', 'Certs', 'Certificates', 'Qualifications'
        ]);

        // Flexible column mapping for tools/platforms
        const toolsPlatforms = extractValue(row, headers, [
          'ToolsPlatforms', 'Tools', 'Platforms', 'Technologies', 'Tech Stack'
        ]);

        // Flexible column mapping for experience
        const experienceMinYears = extractValue(row, headers, [
          'ExperienceMinYears', 'Experience', 'Years Experience', 'Min Experience'
        ]);

        // Flexible column mapping for education
        const education = extractValue(row, headers, [
          'Education', 'Education Requirements', 'Degree', 'Academic Requirements'
        ]);

        // Flexible column mapping for location
        const location = extractValue(row, headers, [
          'Location', 'Work Location', 'Office', 'Site'
        ]);

        // Flexible column mapping for role variant
        const roleVariant = extractValue(row, headers, [
          'RoleVariant', 'Variant', 'Type', 'Role Type'
        ]);

        // Flexible column mapping for alternate titles
        const alternateTitles = extractValue(row, headers, [
          'AlternateTitles', 'Alternative Titles', 'Other Titles', 'Synonyms'
        ]);

        // Flexible column mapping for role ID
        const roleId = extractValue(row, headers, [
          'RoleID', 'ID', 'Role Id', 'Job ID'
        ]);

        return {
          session_id: sessionId,
          role_id: roleId || null,
          department: department || null,
          role_family: roleFamily || null,
          role_title: roleTitle,
          seniority_band: seniorityBand || null,
          role_purpose: rolePurpose || null,
          core_responsibilities: coreResponsibilities || null,
          required_skills: requiredSkills || null,
          preferred_skills: preferredSkills || null,
          certifications: certifications || null,
          tools_platforms: toolsPlatforms || null,
          experience_min_years: experienceMinYears ? parseInt(experienceMinYears) : null,
          education: education || null,
          location: location || null,
          role_variant: roleVariant || null,
          alternate_titles: alternateTitles || null
        };
      });

      const { error: xlError } = await supabase
        .from('xl_roles_data')
        .insert(xlRolesData);

      if (xlError) {
        console.error('Error inserting XL data:', xlError);
        throw new Error(`Failed to insert XL data: ${xlError.message}`);
      }

      totalInserted += xlRolesData.length;
      console.log('Successfully inserted XL roles:', xlRolesData.length);
    }

    // Insert SMART data
    if (smartData && smartData.length > 0) {
      // Get headers from the first row to understand column structure
      const headers = Object.keys(smartData[0] || {});
      console.log('SMART Data headers:', headers);

      const smartRolesData = smartData.map((row: any) => {
        // Flexible column mapping for role title
        const roleTitle = extractValue(row, headers, [
          'Title', 'RoleTitle', 'JobTitle', 'RoleName', 'CurrentPosition', 'Name', 
          'Role Title', 'Position', 'Job Title', 'Role Name', 'Current Position', 
          'Role', 'Designation', 'Job Role', 'Function'
        ], 'Unknown Role');

        // Flexible column mapping for department
        const department = extractValue(row, headers, [
          'Department', 'Dept', 'Division', 'Team', 'Business Unit', 'BU'
        ]);

        // Flexible column mapping for role family
        const roleFamily = extractValue(row, headers, [
          'RoleFamily', 'JobFamily', 'Family', 'Category', 'Job Category'
        ]);

        // Flexible column mapping for seniority band
        const seniorityBand = extractValue(row, headers, [
          'SeniorityBand', 'Level', 'Grade', 'Band', 'Seniority', 'Job Level'
        ]);

        // Flexible column mapping for role purpose
        const rolePurpose = extractValue(row, headers, [
          'RolePurpose', 'Purpose', 'Job Purpose', 'Description', 'Job Description'
        ]);

        // Flexible column mapping for core responsibilities
        const coreResponsibilities = extractValue(row, headers, [
          'CoreResponsibilities', 'Responsibilities', 'Key Responsibilities', 'Duties'
        ]);

        // Flexible column mapping for required skills
        const requiredSkills = extractValue(row, headers, [
          'RequiredSkills', 'Skills', 'Technical Skills', 'Required Qualifications'
        ]);

        // Flexible column mapping for preferred skills
        const preferredSkills = extractValue(row, headers, [
          'PreferredSkills', 'Preferred Qualifications', 'Nice to Have'
        ]);

        // Flexible column mapping for certifications
        const certifications = extractValue(row, headers, [
          'Certifications', 'Certs', 'Certificates', 'Qualifications'
        ]);

        // Flexible column mapping for tools/platforms
        const toolsPlatforms = extractValue(row, headers, [
          'ToolsPlatforms', 'Tools', 'Platforms', 'Technologies', 'Tech Stack'
        ]);

        // Flexible column mapping for experience
        const experienceMinYears = extractValue(row, headers, [
          'ExperienceMinYears', 'Experience', 'Years Experience', 'Min Experience'
        ]);

        // Flexible column mapping for education
        const education = extractValue(row, headers, [
          'Education', 'Education Requirements', 'Degree', 'Academic Requirements'
        ]);

        // Flexible column mapping for location
        const location = extractValue(row, headers, [
          'Location', 'Work Location', 'Office', 'Site'
        ]);

        // Flexible column mapping for role variant
        const roleVariant = extractValue(row, headers, [
          'RoleVariant', 'Variant', 'Type', 'Role Type'
        ]);

        // Flexible column mapping for alternate titles
        const alternateTitles = extractValue(row, headers, [
          'AlternateTitles', 'Alternative Titles', 'Other Titles', 'Synonyms'
        ]);

        // Flexible column mapping for role ID
        const roleId = extractValue(row, headers, [
          'RoleID', 'ID', 'Role Id', 'Job ID'
        ]);

        return {
          session_id: sessionId,
          role_id: roleId || null,
          department: department || null,
          role_family: roleFamily || null,
          role_title: roleTitle,
          seniority_band: seniorityBand || null,
          role_purpose: rolePurpose || null,
          core_responsibilities: coreResponsibilities || null,
          required_skills: requiredSkills || null,
          preferred_skills: preferredSkills || null,
          certifications: certifications || null,
          tools_platforms: toolsPlatforms || null,
          experience_min_years: experienceMinYears ? parseInt(experienceMinYears) : null,
          education: education || null,
          location: location || null,
          role_variant: roleVariant || null,
          alternate_titles: alternateTitles || null
        };
      });

      const { error: smartError } = await supabase
        .from('smart_roles_data')
        .insert(smartRolesData);

      if (smartError) {
        console.error('Error inserting SMART data:', smartError);
        throw new Error(`Failed to insert SMART data: ${smartError.message}`);
      }

      totalInserted += smartRolesData.length;
      console.log('Successfully inserted SMART roles:', smartRolesData.length);
    }

    // Update session status
    const { error: sessionError } = await supabase
      .from('xlsmart_upload_sessions')
      .update({
        status: 'processing',
        total_rows: totalInserted,
        ai_analysis: {
          step: 'upload_complete',
          xl_count: xlData?.length || 0,
          smart_count: smartData?.length || 0,
          total_uploaded: totalInserted
        }
      })
      .eq('id', sessionId);

    if (sessionError) {
      console.error('Error updating session:', sessionError);
    }

    return new Response(JSON.stringify({
      success: true,
      totalInserted,
      xlCount: xlData?.length || 0,
      smartCount: smartData?.length || 0,
      message: 'Role data uploaded successfully'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in upload-role-data function:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Unknown error occurred'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});