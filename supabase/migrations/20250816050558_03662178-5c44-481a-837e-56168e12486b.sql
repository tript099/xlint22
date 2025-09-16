-- Insert sample skills data into skills_master table
INSERT INTO skills_master (id, name, category, description) VALUES
(gen_random_uuid(), 'JavaScript', 'Programming', 'Frontend and backend JavaScript development'),
(gen_random_uuid(), 'Python', 'Programming', 'Python programming for data science and web development'),
(gen_random_uuid(), 'SQL', 'Database', 'Structured Query Language for database management'),
(gen_random_uuid(), 'React', 'Frontend', 'React framework for building user interfaces'),
(gen_random_uuid(), 'Node.js', 'Backend', 'Server-side JavaScript runtime'),
(gen_random_uuid(), 'Data Analysis', 'Analytics', 'Analyzing and interpreting data'),
(gen_random_uuid(), 'Project Management', 'Management', 'Planning and executing projects'),
(gen_random_uuid(), 'AWS', 'Cloud', 'Amazon Web Services cloud platform'),
(gen_random_uuid(), 'Docker', 'DevOps', 'Containerization technology'),
(gen_random_uuid(), 'Machine Learning', 'AI/ML', 'Artificial intelligence and machine learning'),
(gen_random_uuid(), 'Communication', 'Soft Skills', 'Effective verbal and written communication'),
(gen_random_uuid(), 'Leadership', 'Management', 'Leading teams and driving results'),
(gen_random_uuid(), 'Problem Solving', 'Soft Skills', 'Analytical thinking and solution development'),
(gen_random_uuid(), 'Agile', 'Methodology', 'Agile development methodology'),
(gen_random_uuid(), 'Git', 'Tools', 'Version control system')
ON CONFLICT DO NOTHING;