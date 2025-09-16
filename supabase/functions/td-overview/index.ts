import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Cache-Control': 's-maxage=60, stale-while-revalidate=600'
};

// In-memory cache for schema discovery (10 minutes)
let schemaCache: {
  data: any;
  timestamp: number;
} | null = null;

const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

interface SchemaMapping {
  programsTable: string | null;
  participantsTable: string | null;
  progressTable: string | null;
  sessionsTable: string | null;
  categoriesField: string | null;
  pathwaysTable: string | null;
  warnings: string[];
}

interface TdOverviewResponse {
  overview: {
    totalPrograms: number;
    participantsReady: number;
    avgCompletion: number;
    totalHours: number;
  };
  categories: Array<{ name: string; count: number }>;
  programStatus: { active: number; inactive: number };
  pathwaysHealth: {
    tableFound: boolean;
    rowCount: number;
    lastCreatedAt: string | null;
    sample: Array<{ id: string; name: string; status: string; created_at: string }>;
  };
  schemaNotes: SchemaMapping;
}

async function discoverSchema(): Promise<SchemaMapping> {
  // Check cache first
  if (schemaCache && (Date.now() - schemaCache.timestamp) < CACHE_DURATION) {
    return schemaCache.data;
  }

  console.log('Discovering schema...');
  const mapping: SchemaMapping = {
    programsTable: null,
    participantsTable: null,
    progressTable: null,
    sessionsTable: null,
    categoriesField: null,
    pathwaysTable: null,
    warnings: []
  };

  try {
    // Get all tables in public schema
    const { data: tables, error } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public');

    if (error) {
      mapping.warnings.push(`Failed to query information_schema: ${error.message}`);
      return mapping;
    }

    const tableNames = tables?.map(t => t.table_name) || [];
    console.log('Available tables:', tableNames);

    // Find training-related tables
    const trainingTables = tableNames.filter(name => 
      name.includes('training') || 
      name.includes('program') || 
      name.includes('course') || 
      name.includes('session') || 
      name.includes('enrol') || 
      name.includes('participant') || 
      name.includes('progress') || 
      name.includes('completion') || 
      name.includes('category') || 
      name.includes('pathway') || 
      name.includes('learning_path')
    );

    console.log('Training-related tables found:', trainingTables);

    // Map tables based on naming patterns
    for (const tableName of trainingTables) {
      if (tableName.includes('program') && !mapping.programsTable) {
        mapping.programsTable = tableName;
      } else if ((tableName.includes('enroll') || tableName.includes('participant')) && !mapping.participantsTable) {
        mapping.participantsTable = tableName;
      } else if (tableName.includes('progress') && !mapping.progressTable) {
        mapping.progressTable = tableName;
      } else if (tableName.includes('session') && !mapping.sessionsTable) {
        mapping.sessionsTable = tableName;
      } else if ((tableName.includes('pathway') || tableName.includes('learning_path')) && !mapping.pathwaysTable) {
        mapping.pathwaysTable = tableName;
      }
    }

    // Check for specific known tables
    if (tableNames.includes('training_programs') && !mapping.programsTable) {
      mapping.programsTable = 'training_programs';
    }
    if (tableNames.includes('employee_training_enrollments') && !mapping.participantsTable) {
      mapping.participantsTable = 'employee_training_enrollments';
    }
    if (tableNames.includes('training_completions') && !mapping.progressTable) {
      mapping.progressTable = 'training_completions';
    }
    if (tableNames.includes('xlsmart_development_plans') && !mapping.pathwaysTable) {
      mapping.pathwaysTable = 'xlsmart_development_plans';
    }

    // Discover column structure for programs table
    if (mapping.programsTable) {
      try {
        const { data: columns, error: colError } = await supabase
          .from('information_schema.columns')
          .select('column_name, data_type')
          .eq('table_schema', 'public')
          .eq('table_name', mapping.programsTable);

        if (!colError && columns) {
          const columnNames = columns.map(c => c.column_name);
          if (columnNames.includes('category')) {
            mapping.categoriesField = 'category';
          } else if (columnNames.includes('type')) {
            mapping.categoriesField = 'type';
          } else if (columnNames.includes('tags')) {
            mapping.categoriesField = 'tags';
          }
        }
      } catch (err) {
        mapping.warnings.push(`Failed to discover columns for ${mapping.programsTable}: ${err.message}`);
      }
    }

    // Cache the result
    schemaCache = {
      data: mapping,
      timestamp: Date.now()
    };

    console.log('Schema discovery completed:', mapping);
    return mapping;

  } catch (error) {
    mapping.warnings.push(`Schema discovery failed: ${error.message}`);
    return mapping;
  }
}

async function getOverviewMetrics(schema: SchemaMapping): Promise<TdOverviewResponse> {
  const response: TdOverviewResponse = {
    overview: {
      totalPrograms: 0,
      participantsReady: 0,
      avgCompletion: 0,
      totalHours: 0
    },
    categories: [],
    programStatus: { active: 0, inactive: 0 },
    pathwaysHealth: {
      tableFound: false,
      rowCount: 0,
      lastCreatedAt: null,
      sample: []
    },
    schemaNotes: schema
  };

  try {
    // Get total programs
    if (schema.programsTable) {
      const { data: programs, error: programsError } = await supabase
        .from(schema.programsTable)
        .select('*');

      if (!programsError && programs) {
        response.overview.totalPrograms = programs.length;
        
        // Calculate active vs inactive
        const activePrograms = programs.filter(p => 
          p.status === 'active' || p.status === 'published' || p.status === 'open'
        );
        response.programStatus.active = activePrograms.length;
        response.programStatus.inactive = programs.length - activePrograms.length;

        // Calculate total hours
        const totalHours = programs.reduce((sum, p) => {
          if (p.duration_hours) return sum + p.duration_hours;
          if (p.duration_minutes) return sum + (p.duration_minutes / 60);
          return sum;
        }, 0);
        response.overview.totalHours = Math.round(totalHours);

        // Get categories
        if (schema.categoriesField) {
          const categoryStats = programs.reduce((acc: any, program: any) => {
            const category = program[schema.categoriesField!] || 'Other';
            acc[category] = (acc[category] || 0) + 1;
            return acc;
          }, {});

          response.categories = Object.entries(categoryStats)
            .map(([name, count]) => ({ name, count: count as number }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);
        }
      } else {
        schema.warnings.push(`Failed to query ${schema.programsTable}: ${programsError?.message}`);
      }
    }

    // Get participants ready for enrollment
    if (schema.participantsTable) {
      const { data: participants, error: participantsError } = await supabase
        .from(schema.participantsTable)
        .select('*')
        .in('status', ['enrolled', 'in_progress', 'pending', 'invited']);

      if (!participantsError && participants) {
        response.overview.participantsReady = participants.length;
      } else {
        schema.warnings.push(`Failed to query ${schema.participantsTable}: ${participantsError?.message}`);
      }
    }

    // Calculate average completion rate
    if (schema.progressTable) {
      const { data: progress, error: progressError } = await supabase
        .from(schema.progressTable)
        .select('*');

      if (!progressError && progress && progress.length > 0) {
        // Try different completion calculation methods
        let totalCompletion = 0;
        let validRecords = 0;

        for (const record of progress) {
          if (record.progress_percentage !== undefined && record.progress_percentage !== null) {
            totalCompletion += record.progress_percentage;
            validRecords++;
          } else if (record.completion_status === 'passed' || record.completion_status === 'completed') {
            totalCompletion += 100;
            validRecords++;
          } else if (record.completion_status === 'failed') {
            totalCompletion += 0;
            validRecords++;
          }
        }

        if (validRecords > 0) {
          response.overview.avgCompletion = Math.round(totalCompletion / validRecords);
        }
      } else {
        schema.warnings.push(`Failed to query ${schema.progressTable}: ${progressError?.message}`);
      }
    }

    // Check pathways health
    if (schema.pathwaysTable) {
      const { data: pathways, error: pathwaysError } = await supabase
        .from(schema.pathwaysTable)
        .select('id, name, status, created_at')
        .order('created_at', { ascending: false })
        .limit(5);

      if (!pathwaysError && pathways) {
        response.pathwaysHealth.tableFound = true;
        response.pathwaysHealth.rowCount = pathways.length;
        response.pathwaysHealth.lastCreatedAt = pathways.length > 0 ? pathways[0].created_at : null;
        response.pathwaysHealth.sample = pathways.map(p => ({
          id: p.id,
          name: p.name || p.target_role || 'Unnamed Pathway',
          status: p.status || p.plan_status || 'unknown',
          created_at: p.created_at
        }));
      } else {
        schema.warnings.push(`Failed to query ${schema.pathwaysTable}: ${pathwaysError?.message}`);
      }
    }

  } catch (error) {
    schema.warnings.push(`Overview metrics calculation failed: ${error.message}`);
  }

  return response;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const isHealthCheck = url.pathname.endsWith('/health');
    const refreshCache = url.searchParams.get('refresh') === '1';

    // Clear cache if refresh requested
    if (refreshCache) {
      schemaCache = null;
    }

    if (isHealthCheck) {
      const schema = await discoverSchema();
      return new Response(JSON.stringify({
        ok: true,
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        mappedTables: schema
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Main overview endpoint
    const schema = await discoverSchema();
    const overview = await getOverviewMetrics(schema);

    return new Response(JSON.stringify(overview), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('TD Overview error:', error);
    return new Response(JSON.stringify({
      error: error.message,
      details: 'Training & Development overview failed',
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});


