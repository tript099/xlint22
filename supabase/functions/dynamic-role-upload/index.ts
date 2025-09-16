import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { sessionName, excelData } = await req.json();
    
    console.log('Starting dynamic role upload for session:', sessionName);
    console.log('Received', excelData.length, 'Excel files');

    // Create upload session
    const { data: session, error: sessionError } = await supabase
      .from('xlsmart_upload_sessions')
      .insert({
        session_name: sessionName,
        file_names: excelData.map((file: any) => file.fileName),
        temp_table_names: [],
        status: 'uploading'
      })
      .select()
      .single();

    if (sessionError) {
      throw new Error(`Failed to create upload session: ${sessionError.message}`);
    }

    const tempTableNames: string[] = [];
    let totalRows = 0;

    // Process each Excel file
    for (let i = 0; i < excelData.length; i++) {
      const fileData = excelData[i];
      const { fileName, headers, rows } = fileData;
      
      console.log(`Processing file ${i + 1}: ${fileName}`);
      console.log('Headers:', headers);
      console.log('Row count:', rows.length);

      // Generate unique temporary table name
      const tempTableName = `temp_roles_${session.id.replace(/-/g, '_')}_${i + 1}`;
      tempTableNames.push(tempTableName);

      // Create temporary table with dynamic columns - using a safer approach
      const columnDefinitions = headers.map((header: string, index: number) => {
        const cleanHeader = header.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
        return `col_${index}_${cleanHeader.substring(0, 30)} TEXT`; // Limit column name length
      });

      const tempTableName = `temp_roles_${session.id.replace(/-/g, '_')}_f${i + 1}`;
      tempTableNames.push(tempTableName);

      // Use a database function to create the table safely
      const { error: createError } = await supabase.rpc('create_temp_role_table', {
        table_name: tempTableName,
        columns: columnDefinitions
      });

      if (createError) {
        throw new Error(`Failed to create temporary table: ${createError.message}`);
      }

      // Insert data into temporary table
      const insertPromises = rows.map((row: any[], index: number) => {
        const values = headers.map((header: string, headerIndex: number) => {
          const value = row[headerIndex] || '';
          return typeof value === 'string' ? value.replace(/'/g, "''") : String(value);
        });

        const columnNames = headers.map((header: string) => 
          header.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase()
        );

        const insertSQL = `
          INSERT INTO ${tempTableName} (original_row_number, source_file, ${columnNames.join(', ')})
          VALUES (${index + 1}, '${fileName}', '${values.join("', '")}')
        `;

        return supabase.rpc('execute_sql', { query: insertSQL });
      });

      // Execute all inserts
      const insertResults = await Promise.all(insertPromises);
      const failedInserts = insertResults.filter(result => result.error);
      
      if (failedInserts.length > 0) {
        console.warn(`${failedInserts.length} rows failed to insert for ${fileName}`);
      }

      totalRows += rows.length;
      console.log(`Successfully processed ${rows.length - failedInserts.length} rows for ${fileName}`);
    }

    // Update session with temp table names and total rows
    const { error: updateError } = await supabase
      .from('xlsmart_upload_sessions')
      .update({
        temp_table_names: tempTableNames,
        total_rows: totalRows,
        status: 'analyzing'
      })
      .eq('id', session.id);

    if (updateError) {
      throw new Error(`Failed to update session: ${updateError.message}`);
    }

    console.log('Upload complete. Created tables:', tempTableNames);

    return new Response(JSON.stringify({
      success: true,
      sessionId: session.id,
      tempTableNames,
      totalRows,
      message: `Successfully uploaded ${totalRows} rows across ${excelData.length} files`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in dynamic role upload:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});