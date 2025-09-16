 
    // Fetch job descriptions data - get all active JDs for now
    console.log('About to query xlsmart_job_descriptions with service role');
    const { data: jobDescriptions, error: jdError } = await supabase
      .from('xlsmart_job_descriptions')
      .select('*');

    console.log('Query completed');
    console.log('Error:', jdError);
    console.log('Data length:', jobDescriptions?.length);
    console.log('Data preview:', jobDescriptions?.slice(0, 2));
    
    if (jdError) {
      console.error('Error fetching job descriptions:', jdError);
      throw new Error(`Failed to fetch job descriptions: ${jdError.message}`);
    }

    console.log(`Found ${jobDescriptions?.length || 0} job descriptions`);

    if (!jobDescriptions || jobDescriptions.length === 0) {
      console.log('No job descriptions found for analysis');
      throw new Error('No job descriptions found for analysis. Please ensure job descriptions exist in the database.');
    }

    // Fetch related data
    const { data: standardRoles } = await supabase
      .from('xlsmart_standard_roles')
      .select('*');

    const { data: employees } = await supabase
      .from('xlsmart_employees')
      .select('*');

    console.log(`Found ${standardRoles?.length || 0} standard roles and ${employees?.length || 0} employees`);

    let result;
    try {
      switch (analysisType) {
        case 'jd_optimization':
          result = await performJDOptimization(jobDescriptions || [], standardRoles || [], departmentFilter);
          break;
        case 'market_alignment':
          result = await performMarketAlignment(jobDescriptions || [], standardRoles || []);
          break;
        case 'skills_mapping':
          result = await performSkillsMapping(jobDescriptions || [], employees || []);
          break;
        case 'compliance_analysis':
          result = await performComplianceAnalysis(jobDescriptions || []);
          break;
        default:
          throw new Error('Invalid analysis type');
      }
      console.log('Analysis completed successfully');
    } catch (aiError) {
      console.error('AI Analysis error:', aiError);
      throw new Error(`AI analysis failed: ${aiError.message}`);
    }

    // Save results to database
    const { data: savedResult, error: saveError } = await supabase
      .from('ai_analysis_results')
      .insert({
        analysis_type: analysisType,
        function_name: 'ai-job-descriptions-intelligence',
        input_parameters: { analysisType, departmentFilter, roleFilter },
        analysis_result: result,
        status: 'completed'
      })
      .select()
      .single();

    if (saveError) {
      console.error('Error saving analysis result:', saveError);
      // Continue even if save fails - return the result
    } else {
      console.log('Analysis result saved to database:', savedResult.id);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('=== Error in ai-job-descriptions-intelligence function ===');
    console.error('Error type:', error.constructor.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    
    return new Response(JSON.stringify({ 
      error: error.message,
      details: 'Check edge function logs for more information'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});



async function callLiteLLM(prompt: string, systemPrompt: string) {
  let openAIApiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openAIApiKey) {
    openAIApiKey = Deno.env.get('LITELLM_API_KEY');
  }
  if (!openAIApiKey) {
    throw new Error('OpenAI API key not configured. Please set OPENAI_API_KEY or LITELLM_API_KEY');
  }

  console.log('=== LiteLLM API Call Started ===');
  console.log('OpenAI API Key exists:', !!openAIApiKey);
  console.log('System prompt length:', systemPrompt.length);
  console.log('Prompt length:', prompt.length);

  const requestBody = {
    model: 'azure/gpt-4.1',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt }
    ],
    temperature: 0.7,
    max_completion_tokens: 3000,
  };

  console.log('Making request to LiteLLM proxy...');
  
  try {
    const startTime = Date.now();
    const response = await fetch('https://proxyllm.ximplify.id/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });
    
    const endTime = Date.now();
    console.log(`API call took ${endTime - startTime}ms`);
    console.log('LiteLLM proxy response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('LiteLLM API error response:', errorText);
      throw new Error(`LiteLLM API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    console.log('Response content length:', data.choices?.[0]?.message?.content?.length || 0);
    console.log('LiteLLM response received successfully');
    
    const content = data.choices[0].message.content;
    
    // Clean up any markdown code blocks before JSON parsing
    const cleanContent = content.replace(/```json\s*|\s*```/g, '').trim();
    
    // Additional cleaning - remove any trailing content after the last }
    const lastBraceIndex = cleanContent.lastIndexOf('}');
    const finalContent = lastBraceIndex !== -1 ? cleanContent.substring(0, lastBraceIndex + 1) : cleanContent;
    
    console.log('Cleaned content preview (first 200 chars):', finalContent.substring(0, 200));
    console.log('Analysis completed successfully');
    return finalContent;
    
  } catch (error) {
    console.error('Error in callLiteLLM:', error);
    throw error;
  }
}

async function performJDOptimization(jobDescriptions: any[], standardRoles: any[], departmentFilter?: string) {
  const systemPrompt = `You are an AI HR intelligence specialist for XLSMART, one of Indonesia's largest telecom companies. Specialize in jd_optimization for job descriptions to: Evaluate content against telecom industry standards and market benchmarks. Identify missing or unnecessary requirements. Recommend optimizations for clarity, inclusivity, and alignment with HR best practices. Detect risks related to compliance, bias, or fairness. ⚙️ Output Requirements: Always return insights in valid JSON format. Ensure results are concise, structured, and machine-readable, ready for integration into XLSMART's HR systems.

Return a JSON object with this structure:
{
  "summary": {
    "totalAnalyzed": number,
    "averageCompleteness": number,
    "averageClarity": number,
    "improvementOpportunities": number
  },
  "optimizationRecommendations": [
    {
      "role": "string",
      "currentScore": number,
      "issues": ["string"],
      "recommendations": ["string"],
      "priority": "high|medium|low"
    }
  ],
  "bestPractices": [
    {
      "category": "string",
      "recommendation": "string",
      "impact": "string"
    }
  ],
  "industryAlignment": {
    "score": number,
    "gaps": ["string"],
    "recommendations": ["string"]
  }
}`;

  const prompt = `Analyze these job descriptions for optimization opportunities:

Job Descriptions: ${JSON.stringify(jobDescriptions.slice(0, 20))}
Standard Roles: ${JSON.stringify(standardRoles.slice(0, 10))}
${departmentFilter ? `Focus on department: ${departmentFilter}` : ''}

Provide specific, actionable recommendations for improving job descriptions to attract better candidates and improve role clarity.`;

  console.log(`Analyzing ${jobDescriptions.length} job descriptions with ${standardRoles.length} standard roles`);
  
  const response = await callLiteLLM(prompt, systemPrompt);
  console.log('AI Response received for JD optimization');
  
  try {
    const parsedResult = JSON.parse(response);
    console.log('Successfully parsed JD optimization results');
    return parsedResult;
  } catch (parseError) {
    console.error('Failed to parse AI response for JD optimization:', parseError);
    console.error('Raw AI response:', response);
    throw new Error(`Failed to parse AI response: ${parseError.message}`);
  }
}

async function performMarketAlignment(jobDescriptions: any[], standardRoles: any[]) {
  const systemPrompt = `You are an AI HR intelligence specialist for XLSMART, one of Indonesia's largest telecom companies. Specialize in market_alignment for job descriptions to: Evaluate content against telecom industry standards and market benchmarks. Identify missing or unnecessary requirements. Recommend optimizations for clarity, inclusivity, and alignment with HR best practices. Detect risks related to compliance, bias, or fairness. ⚙️ Output Requirements: Always return insights in valid JSON format. Ensure results are concise, structured, and machine-readable, ready for integration into XLSMART's HR systems.

Return a JSON object with this structure:
{
  "marketAlignment": {
    "overallScore": number,
    "industryStandards": number,
    "competitivePositioning": number,
    "salaryAlignment": number
  },
  "roleAnalysis": [
    {
      "role": "string",
      "marketAlignment": number,
      "strengthAreas": ["string"],
      "improvementAreas": ["string"],
      "marketTrends": ["string"]
    }
  ],
  "industryTrends": [
    {
      "trend": "string",
      "impact": "string",
      "recommendation": "string"
    }
  ],
  "competitiveAnalysis": {
    "advantages": ["string"],
    "gaps": ["string"],
    "recommendations": ["string"]
  }
}`;

  const prompt = `Analyze market alignment for these job descriptions:

Job Descriptions: ${JSON.stringify(jobDescriptions.slice(0, 15))}
Standard Roles: ${JSON.stringify(standardRoles.slice(0, 10))}

Consider current market trends, industry standards, and competitive positioning. Provide insights on how these JDs compare to market benchmarks.`;

  console.log(`Analyzing ${jobDescriptions.length} job descriptions for market alignment`);
  
  const response = await callLiteLLM(prompt, systemPrompt);
  console.log('AI Response received for market alignment');
  
  try {
    const parsedResult = JSON.parse(response);
    console.log('Successfully parsed market alignment results');
    return parsedResult;
  } catch (parseError) {
    console.error('Failed to parse AI response for market alignment:', parseError);
    console.error('Raw AI response:', response);
    throw new Error(`Failed to parse AI response: ${parseError.message}`);
  }
}

async function performSkillsMapping(jobDescriptions: any[], employees: any[]) {
  const systemPrompt = `You are an AI HR intelligence specialist for XLSMART, one of Indonesia's largest telecom companies. Specialize in skills_mapping for job descriptions to: Evaluate content against telecom industry standards and market benchmarks. Identify missing or unnecessary requirements. Recommend optimizations for clarity, inclusivity, and alignment with HR best practices. Detect risks related to compliance, bias, or fairness. ⚙️ Output Requirements: Always return insights in valid JSON format. Ensure results are concise, structured, and machine-readable, ready for integration into XLSMART's HR systems.

Return a JSON object with this structure:
{
  "skillsAlignment": {
    "overallMatch": number,
    "criticalSkillsGap": number,
    "emergingSkillsReadiness": number,
    "skillsInflation": number
  },
  "skillsAnalysis": [
    {
      "role": "string",
      "requiredSkills": ["string"],
      "availableSkills": ["string"],
      "skillsGap": ["string"],
      "overqualifiedAreas": ["string"]
    }
  ],
  "emergingSkills": [
    {
      "skill": "string",
      "importance": "high|medium|low",
      "currentCoverage": number,
      "recommendation": "string"
    }
  ],
  "skillsDevelopment": {
    "priorityAreas": ["string"],
    "trainingRecommendations": ["string"],
    "recruitmentGaps": ["string"]
  }
}`;

  const prompt = `Analyze skills mapping between job descriptions and employee capabilities:

Job Descriptions: ${JSON.stringify(jobDescriptions.slice(0, 15))}
Employee Skills Sample: ${JSON.stringify(employees.slice(0, 20).map(emp => ({
    role: emp.current_role,
    skills: emp.skills,
    experience: emp.years_experience
  })))}

Identify skill gaps, overqualification areas, and alignment opportunities.`;

  console.log(`Analyzing skills mapping for ${jobDescriptions.length} job descriptions and ${employees.length} employees`);
  
  const response = await callLiteLLM(prompt, systemPrompt);
  console.log('AI Response received for skills mapping');
  
  try {
    const parsedResult = JSON.parse(response);
    console.log('Successfully parsed skills mapping results');
    return parsedResult;
  } catch (parseError) {
    console.error('Failed to parse AI response for skills mapping:', parseError);
    console.error('Raw AI response:', response);
    throw new Error(`Failed to parse AI response: ${parseError.message}`);
  }
}

async function performComplianceAnalysis(jobDescriptions: any[]) {
  const systemPrompt = `You are an AI HR intelligence specialist for XLSMART, one of Indonesia's largest telecom companies. Specialize in compliance_analysis for job descriptions to: Evaluate content against telecom industry standards and market benchmarks. Identify missing or unnecessary requirements. Recommend optimizations for clarity, inclusivity, and alignment with HR best practices. Detect risks related to compliance, bias, or fairness. ⚙️ Output Requirements: Always return insights in valid JSON format. Ensure results are concise, structured, and machine-readable, ready for integration into XLSMART's HR systems.

Return a JSON object with this structure:
{
  "complianceScore": {
    "overall": number,
    "legalCompliance": number,
    "inclusivity": number,
    "accessibility": number,
    "equalOpportunity": number
  },
  "complianceIssues": [
    {
      "role": "string",
      "issueType": "string",
      "severity": "high|medium|low",
      "description": "string",
      "recommendation": "string"
    }
  ],
  "inclusivityAnalysis": {
    "languageNeutrality": number,
    "biasDetection": ["string"],
    "accessibilityFeatures": ["string"],
    "improvementAreas": ["string"]
  },
  "legalCompliance": {
    "requiredDisclosures": boolean,
    "discriminationRisk": "low|medium|high",
    "accommodationLanguage": boolean,
    "salaryTransparency": boolean
  }
}`;

  const prompt = `Analyze these job descriptions for compliance and inclusivity:

Job Descriptions: ${JSON.stringify(jobDescriptions.slice(0, 20))}

Focus on legal compliance, inclusive language, accessibility, equal opportunity, and potential bias issues. Provide specific recommendations for improvement.`;

  console.log(`Analyzing compliance for ${jobDescriptions.length} job descriptions`);
  
  const response = await callLiteLLM(prompt, systemPrompt);
  console.log('AI Response received for compliance analysis');
  
  try {
    const parsedResult = JSON.parse(response);
    console.log('Successfully parsed compliance analysis results');
    return parsedResult;
  } catch (parseError) {
    console.error('Failed to parse AI response for compliance analysis:', parseError);
    console.error('Raw AI response:', response);
    throw new Error(`Failed to parse AI response: ${parseError.message}`);
  }
}