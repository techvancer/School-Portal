-- ============================================================
-- CORRECTED STUDENT NAME STRUCTURE
-- studentfirstname, studentfathersname, studentgrandfathersname, surname
-- Both in Arabic and English
-- Parent as single combined field (both languages)
-- ============================================================

-- ============================================================
-- STEP 1: DROP OLD COLUMNS (Delete incorrect structure)
-- ============================================================

ALTER TABLE students_tbl 
DROP COLUMN IF EXISTS studentname_ar,
DROP COLUMN IF EXISTS studentname_en,
DROP COLUMN IF EXISTS studentlastname_ar,
DROP COLUMN IF EXISTS studentlastname_en,
DROP COLUMN IF EXISTS parentname_ar,
DROP COLUMN IF EXISTS parentname_en,
DROP COLUMN IF EXISTS parentlastname_ar,
DROP COLUMN IF EXISTS parentlastname_en;

-- ============================================================
-- STEP 2: ADD NEW STUDENT NAME COLUMNS (4 fields × 2 languages)
-- ============================================================

ALTER TABLE students_tbl 
ADD COLUMN IF NOT EXISTS studentfirstname_ar VARCHAR(100),
ADD COLUMN IF NOT EXISTS studentfirstname_en VARCHAR(100),
ADD COLUMN IF NOT EXISTS studentfathersname_ar VARCHAR(100),
ADD COLUMN IF NOT EXISTS studentfathersname_en VARCHAR(100),
ADD COLUMN IF NOT EXISTS studentgrandfathersname_ar VARCHAR(100),
ADD COLUMN IF NOT EXISTS studentgrandfathersname_en VARCHAR(100),
ADD COLUMN IF NOT EXISTS studentsurname_ar VARCHAR(100),
ADD COLUMN IF NOT EXISTS studentsurname_en VARCHAR(100);

-- ============================================================
-- STEP 3: ADD NEW PARENT NAME COLUMN (single combined field)
-- ============================================================

ALTER TABLE students_tbl 
ADD COLUMN IF NOT EXISTS parentname_ar VARCHAR(200),
ADD COLUMN IF NOT EXISTS parentname_en VARCHAR(200);

-- ============================================================
-- STEP 4: UPDATE STUDENT NAMES (from CSV data)
-- ============================================================

-- Student 1: Ali Mohammed (Ali = first, Mohammed = father's name)
UPDATE students_tbl SET 
  studentfirstname_ar = 'علي',
  studentfirstname_en = 'Ali',
  studentfathersname_ar = 'محمد',
  studentfathersname_en = 'Mohammed',
  studentgrandfathersname_ar = '',
  studentgrandfathersname_en = '',
  studentsurname_ar = '',
  studentsurname_en = ''
WHERE studentid = 1;

-- Student 2: Omar Ahmad (Omar = first, Ahmad = father's name)
UPDATE students_tbl SET 
  studentfirstname_ar = 'عمر',
  studentfirstname_en = 'Omar',
  studentfathersname_ar = 'أحمد',
  studentfathersname_en = 'Ahmad',
  studentgrandfathersname_ar = '',
  studentgrandfathersname_en = '',
  studentsurname_ar = '',
  studentsurname_en = ''
WHERE studentid = 2;

-- Student 3: Yousef Khalid (Yousef = first, Khalid = father's name)
UPDATE students_tbl SET 
  studentfirstname_ar = 'يوسف',
  studentfirstname_en = 'Yousef',
  studentfathersname_ar = 'خالد',
  studentfathersname_en = 'Khalid',
  studentgrandfathersname_ar = '',
  studentgrandfathersname_en = '',
  studentsurname_ar = '',
  studentsurname_en = ''
WHERE studentid = 3;

-- Student 4: Hassan Nasser (Hassan = first, Nasser = father's name)
UPDATE students_tbl SET 
  studentfirstname_ar = 'حسن',
  studentfirstname_en = 'Hassan',
  studentfathersname_ar = 'ناصر',
  studentfathersname_en = 'Nasser',
  studentgrandfathersname_ar = '',
  studentgrandfathersname_en = '',
  studentsurname_ar = '',
  studentsurname_en = ''
WHERE studentid = 4;

-- Student 5: Abdelrhman Aqeel (Abdelrhman = first, Aqeel = father's name)
UPDATE students_tbl SET 
  studentfirstname_ar = 'عبدالرحمن',
  studentfirstname_en = 'Abdelrhman',
  studentfathersname_ar = 'عقيل',
  studentfathersname_en = 'Aqeel',
  studentgrandfathersname_ar = '',
  studentgrandfathersname_en = '',
  studentsurname_ar = '',
  studentsurname_en = ''
WHERE studentid = 5;

-- ============================================================
-- STEP 5: UPDATE PARENT NAMES (single combined field)
-- ============================================================

-- Parent 1: Mohammed Ali (combined)
UPDATE students_tbl SET 
  parentname_ar = 'محمد علي',
  parentname_en = 'Mohammed Ali'
WHERE studentid = 1;

-- Parent 2: Ahmad Omar (combined)
UPDATE students_tbl SET 
  parentname_ar = 'أحمد عمر',
  parentname_en = 'Ahmad Omar'
WHERE studentid = 2;

-- Parent 3: Khalid Yousef (combined)
UPDATE students_tbl SET 
  parentname_ar = 'خالد يوسف',
  parentname_en = 'Khalid Yousef'
WHERE studentid = 3;

-- Parent 4: Nasser Hassan (combined)
UPDATE students_tbl SET 
  parentname_ar = 'ناصر حسن',
  parentname_en = 'Nasser Hassan'
WHERE studentid = 4;

-- Parent 5: Abdelrhman Jehad (combined)
UPDATE students_tbl SET 
  parentname_ar = 'عبدالرحمن جهاد',
  parentname_en = 'Abdelrhman Jehad'
WHERE studentid = 5;

-- ============================================================
-- STEP 6: DROP OLD COLUMNS (Clean up)
-- ============================================================

ALTER TABLE students_tbl 
DROP COLUMN IF EXISTS studentname,
DROP COLUMN IF EXISTS parentname;

-- ============================================================
-- VERIFICATION QUERIES
-- ============================================================

-- Check student names structure
SELECT 
  studentid,
  studentfirstname_ar,
  studentfirstname_en,
  studentfathersname_ar,
  studentfathersname_en,
  studentgrandfathersname_ar,
  studentgrandfathersname_en,
  studentsurname_ar,
  studentsurname_en
FROM students_tbl;

-- Check parent names
SELECT 
  studentid,
  parentname_ar,
  parentname_en
FROM students_tbl;

-- Full student view
SELECT * FROM students_tbl;

-- ============================================================
-- ADD MARKS/WEIGHT COLUMN TO QUESTIONS TABLE
-- ============================================================

-- Add the marks column to track question weight/marks
ALTER TABLE questions_exams_employee_subjects_sections_tbl 
ADD COLUMN IF NOT EXISTS question_marks DECIMAL(5,2) DEFAULT 1.00;

-- Update all existing questions with default 1 mark each
UPDATE questions_exams_employee_subjects_sections_tbl 
SET question_marks = 1.00 
WHERE question_marks IS NULL;

-- Verify the new column
SELECT 
  questionid,
  examid,
  employeeid,
  question_marks
FROM questions_exams_employee_subjects_sections_tbl
LIMIT 10;

-- ============================================================
-- SET ALL QUESTIONS TO 2 MARKS EACH
-- ============================================================

-- Update all existing questions to 2.00 marks
UPDATE questions_exams_employee_subjects_sections_tbl 
SET question_marks = 2.00;

-- Verification: View all questions with their marks
SELECT 
  questionid,
  examid,
  employeeid,
  question_marks
FROM questions_exams_employee_subjects_sections_tbl
ORDER BY questionid, examid;

-- View total marks by exam
SELECT 
  examid,
  COUNT(*) as total_questions,
  SUM(question_marks) as total_marks
FROM questions_exams_employee_subjects_sections_tbl
GROUP BY examid
ORDER BY examid;
