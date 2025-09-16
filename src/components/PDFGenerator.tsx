import React from 'react';
import jsPDF from 'jspdf';

interface JobDescription {
  id: string;
  title: string;
  summary?: string;
  job_identity?: any;
  responsibilities?: string[];
  required_qualifications?: string[];
  preferred_qualifications?: string[];
  key_contacts?: any;
  competencies?: any;
  salary_range_min?: number;
  salary_range_max?: number;
  currency?: string;
  experience_level?: string;
  employment_type?: string;
  location_type?: string;
}

export const generatePDF = (jd: JobDescription) => {
  const pdf = new jsPDF();
  let yPosition = 20;
  const lineHeight = 6;
  const pageWidth = pdf.internal.pageSize.getWidth();
  const margin = 20;
  const contentWidth = pageWidth - 2 * margin;
  const cellHeight = 8;

  // Helper function to draw table
  const drawTable = (data: string[][], startY: number, colWidths: number[]) => {
    let currentY = startY;
    
    data.forEach((row, rowIndex) => {
      let currentX = margin;
      let maxRowHeight = cellHeight;
      
      // Calculate row height based on text content
      row.forEach((cell, colIndex) => {
        const lines = pdf.splitTextToSize(cell, colWidths[colIndex] - 4);
        const requiredHeight = Math.max(cellHeight, lines.length * lineHeight + 4);
        maxRowHeight = Math.max(maxRowHeight, requiredHeight);
      });
      
      // Draw cells
      row.forEach((cell, colIndex) => {
        // Draw cell border
        pdf.rect(currentX, currentY, colWidths[colIndex], maxRowHeight);
        
        // Set font style for header row
        if (rowIndex === 0) {
          pdf.setFillColor(200, 200, 200);
          pdf.rect(currentX, currentY, colWidths[colIndex], maxRowHeight, 'F');
          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(10);
        } else {
          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(9);
        }
        
        // Add text to cell
        const lines = pdf.splitTextToSize(cell, colWidths[colIndex] - 4);
        const textY = currentY + 6;
        lines.forEach((line: string, lineIndex: number) => {
          pdf.text(line, currentX + 2, textY + (lineIndex * lineHeight));
        });
        
        currentX += colWidths[colIndex];
      });
      
      currentY += maxRowHeight;
    });
    
    return currentY;
  };

  // Header
  pdf.setFontSize(18);
  pdf.setFont('helvetica', 'bold');
  pdf.text('JOB DESCRIPTION', pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 15;

  // 1. Job Identity Table
  const identity = jd.job_identity || {};
  const identityData = [
    ['Job Identity', ''],
    ['Position Title', identity.positionTitle || jd.title],
    ['Directorate', identity.directorate || '-'],
    ['Division', identity.division || '-'],
    ['Department', identity.department || '-'],
    ['Direct Supervisor', identity.directSupervisor || '-'],
    ['Direct Subordinate', Array.isArray(identity.directSubordinate) && identity.directSubordinate.length > 0 
      ? identity.directSubordinate.map((sub, idx) => `${idx + 1}. ${sub}`).join('\n') 
      : '-']
  ];

  yPosition = drawTable(identityData, yPosition, [50, 120]);
  yPosition += 10;

  // 2. Job Purposes Table
  const jobPurposesData = [
    ['Job Purposes', ''],
    ['', jd.summary || 'To be defined based on role requirements and organizational needs.']
  ];
  yPosition = drawTable(jobPurposesData, yPosition, [50, 120]);
  yPosition += 10;

  // 3. Main Responsibility Table
  const responsibilities = jd.responsibilities || [];
  const mainRespData = [
    ['Main Responsibility', ''],
    ['', responsibilities.length > 0 
      ? responsibilities.map((resp, idx) => `${idx + 1}. ${resp}`).join('\n')
      : '1. Lead the formulation and execution of strategic responsibilities\n2. Ensure end-to-end operational management\n3. Drive performance optimization and efficiency\n4. Ensure regulatory compliance and governance'
    ]
  ];
  yPosition = drawTable(mainRespData, yPosition, [50, 120]);
  yPosition += 10;

  // 4. Key Output Table
  const keyOutputs = jd.required_qualifications || [];
  const keyOutputData = [
    ['Key Output', ''],
    ['', keyOutputs.length > 0 
      ? keyOutputs.map(output => `• ${output}`).join('\n')
      : '• Strategic plans and performance reports\n• Operational efficiency metrics\n• Regulatory compliance documentation\n• Stakeholder engagement outcomes'
    ]
  ];
  yPosition = drawTable(keyOutputData, yPosition, [50, 120]);
  yPosition += 10;

  // Check if we need a new page
  if (yPosition > pdf.internal.pageSize.getHeight() - 80) {
    pdf.addPage();
    yPosition = 20;
  }

  // 5. Key Contacts & Relationship Table
  const contacts = jd.key_contacts || {};
  const contactsData = [
    ['Key Contacts & Relationship', '', ''],
    ['', 'Internal', 'External'],
    ['', 
      contacts.internal && contacts.internal.length > 0 
        ? contacts.internal.map((contact, idx) => `${idx + 1}. ${contact}`).join('\n')
        : '1. Senior Management\n2. Department Heads\n3. Team Members\n4. Support Functions',
      contacts.external && contacts.external.length > 0
        ? contacts.external.map((contact, idx) => `${idx + 1}. ${contact}`).join('\n') 
        : '1. Regulatory bodies\n2. Industry partners\n3. Service providers\n4. Stakeholders'
    ]
  ];
  yPosition = drawTable(contactsData, yPosition, [50, 60, 60]);
  yPosition += 10;

  // 6. Competency Section - Functional Competency
  const competencies = jd.competencies || {};
  const functional = competencies.functional || {};
  const leadership = competencies.leadership || {};

  // Check if we need a new page for competency section
  if (yPosition > pdf.internal.pageSize.getHeight() - 120) {
    pdf.addPage();
    yPosition = 20;
  }

  // Functional Competency Table
  const functionalCompetencyData = [
    ['Functional Competency', 'Requirements'],
    ['Academy Qualifications', functional.academyQualifications || 'Bachelor\'s degree in relevant field'],
    ['Professional Experience', functional.professionalExperience || 'Minimum 3-5 years relevant experience'],
    ['Certification/License', functional.certificationLicense || 'Professional certifications as required'],
    ['Expertise', functional.expertise ? functional.expertise.join(', ') : 'Domain-specific technical skills']
  ];

  yPosition = drawTable(functionalCompetencyData, yPosition, [70, 100]);
  yPosition += 10;

  // Leadership Competency Table
  const leadershipCompetencyData = [
    ['Leadership Competency', 'Level'],
    ['Strategic Accountability', leadership.strategicAccountability || 'Mastery'],
    ['Customer Centric', leadership.customerCentric || 'Mastery'],
    ['Coalition Building', leadership.coalitionBuilding || 'Mastery'],
    ['People First', leadership.peopleFirst || 'Mastery'],
    ['Agile Leadership', leadership.agileLeadership || 'Mastery'],
    ['Result Driven', leadership.resultDriven || 'Mastery'],
    ['Technology Savvy', leadership.technologySavvy || 'Mastery']
  ];

  yPosition = drawTable(leadershipCompetencyData, yPosition, [70, 100]);

  // Save the PDF
  const filename = `${jd.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_job_description.pdf`;
  pdf.save(filename);
};

export const PDFPreview: React.FC<{ jd: JobDescription }> = ({ jd }) => {
  const TableComponent = ({ data, className = "" }: { data: string[][], className?: string }) => (
    <div className="overflow-x-auto">
      <table className={`w-full border-collapse border border-gray-300 text-xs sm:text-sm ${className} mb-4 min-w-full`}>
        <tbody>
          {data.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, cellIndex) => (
                <td 
                  key={cellIndex} 
                  className={`border border-gray-300 p-2 sm:p-3 ${
                    rowIndex === 0 ? 'bg-gray-100 font-bold text-gray-800' : 
                    cellIndex === 0 && cell !== '' ? 'bg-gray-50 font-semibold text-gray-700' : 'text-gray-600'
                  }`}
                  style={{ 
                    width: data[0].length === 2 ? (cellIndex === 0 ? '35%' : '65%') : 
                           data[0].length === 3 ? (cellIndex === 0 ? '25%' : '37.5%') : 'auto',
                    verticalAlign: 'top',
                    lineHeight: '1.4',
                    minWidth: data[0].length === 3 ? '120px' : 'auto'
                  }}
                >
                  {cell.split('\n').map((line, lineIndex) => (
                    <div key={lineIndex} className="mb-1 last:mb-0 break-words">{line}</div>
                  ))}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const identity = jd.job_identity || {};
  const contacts = jd.key_contacts || {};
  const competencies = jd.competencies || {};
  const functional = competencies.functional || {};
  const leadership = competencies.leadership || {};

  return (
    <div className="border border-gray-200 rounded-lg p-4 sm:p-6 bg-white max-h-[600px] overflow-y-auto shadow-sm">
      <div className="text-center mb-6 sm:mb-8">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-800 mb-2">JOB DESCRIPTION</h1>
        <div className="w-12 sm:w-16 h-1 bg-blue-500 mx-auto rounded"></div>
      </div>

      <div className="space-y-4 sm:space-y-6">
        {/* Job Identity Table */}
        <TableComponent 
          data={[
            ['Job Identity', ''],
            ['Position Title', identity.positionTitle || jd.title],
            ['Directorate', identity.directorate || '-'],
            ['Division', identity.division || '-'],
            ['Department', identity.department || '-'],
            ['Direct Supervisor', identity.directSupervisor || '-'],
            ['Direct Subordinate', Array.isArray(identity.directSubordinate) && identity.directSubordinate.length > 0 
              ? identity.directSubordinate.map((sub, idx) => `${idx + 1}. ${sub}`).join('\n') 
              : '-']
          ]}
        />

        {/* Job Purposes Table */}
        <TableComponent 
          data={[
            ['Job Purposes', ''],
            ['', jd.summary || 'To be defined based on role requirements and organizational needs.']
          ]}
        />

        {/* Main Responsibility Table */}
        <TableComponent 
          data={[
            ['Main Responsibility', ''],
            ['', jd.responsibilities && jd.responsibilities.length > 0 
              ? jd.responsibilities.map((resp, idx) => `${idx + 1}. ${resp}`).join('\n')
              : '1. Lead the formulation and execution of strategic responsibilities\n2. Ensure end-to-end operational management\n3. Drive performance optimization and efficiency\n4. Ensure regulatory compliance and governance'
            ]
          ]}
        />

        {/* Key Output Table */}
        <TableComponent 
          data={[
            ['Key Output', ''],
            ['', jd.required_qualifications && jd.required_qualifications.length > 0 
              ? jd.required_qualifications.map(output => `• ${output}`).join('\n')
              : '• Strategic plans and performance reports\n• Operational efficiency metrics\n• Regulatory compliance documentation\n• Stakeholder engagement outcomes'
            ]
          ]}
        />

        {/* Key Contacts & Relationship Table */}
        <TableComponent 
          data={[
            ['Key Contacts & Relationship', '', ''],
            ['', 'Internal', 'External'],
            ['', 
              contacts.internal && contacts.internal.length > 0 
                ? contacts.internal.map((contact, idx) => `${idx + 1}. ${contact}`).join('\n')
                : '1. Senior Management\n2. Department Heads\n3. Team Members\n4. Support Functions',
              contacts.external && contacts.external.length > 0
                ? contacts.external.map((contact, idx) => `${idx + 1}. ${contact}`).join('\n') 
                : '1. Regulatory bodies\n2. Industry partners\n3. Service providers\n4. Stakeholders'
            ]
          ]}
        />

        {/* Competency Section - Functional Competency */}
        <TableComponent 
          data={[
            ['Functional Competency', 'Requirements'],
            ['Academy Qualifications', functional.academyQualifications || 'Bachelor\'s degree in relevant field'],
            ['Professional Experience', functional.professionalExperience || 'Minimum 3-5 years relevant experience'],
            ['Certification/License', functional.certificationLicense || 'Professional certifications as required'],
            ['Expertise', functional.expertise ? functional.expertise.join(', ') : 'Domain-specific technical skills']
          ]}
        />

        {/* Competency Section - Leadership Competency */}
        <TableComponent 
          data={[
            ['Leadership Competency', 'Level'],
            ['Strategic Accountability', leadership.strategicAccountability || 'Mastery'],
            ['Customer Centric', leadership.customerCentric || 'Mastery'],
            ['Coalition Building', leadership.coalitionBuilding || 'Mastery'],
            ['People First', leadership.peopleFirst || 'Mastery'],
            ['Agile Leadership', leadership.agileLeadership || 'Mastery'],
            ['Result Driven', leadership.resultDriven || 'Mastery'],
            ['Technology Savvy', leadership.technologySavvy || 'Mastery']
          ]}
        />
      </div>
    </div>
  );
};
