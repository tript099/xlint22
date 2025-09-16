export interface TdOverviewData {
  overview: {
    totalPrograms: number;
    participantsReady: number;
    avgCompletion: number;
    totalHours: number;
  };
  categories: Array<{
    name: string;
    count: number;
  }>;
  programStatus: {
    active: number;
    inactive: number;
  };
  pathwaysHealth: {
    tableFound: boolean;
    rowCount: number;
    lastCreatedAt: string | null;
    sample: Array<{
      id: string;
      name: string;
      status: string;
      created_at: string;
    }>;
  };
  schemaNotes: {
    programsTable: string | null;
    participantsTable: string | null;
    progressTable: string | null;
    sessionsTable: string | null;
    categoriesField: string | null;
    pathwaysTable: string | null;
    warnings: string[];
  };
}

export interface TdOverviewHook {
  data: TdOverviewData | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export interface TdOverviewHealth {
  ok: boolean;
  version: string;
  timestamp: string;
  mappedTables: TdOverviewData['schemaNotes'];
}


