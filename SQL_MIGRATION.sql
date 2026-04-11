-- ============================================================
-- SCHOOL PORTAL v40 - DATABASE MIGRATION
-- Run this in Supabase SQL Editor
-- ============================================================

-- ============================================================
-- PART 1: ADD NEW NAME COLUMNS
-- ============================================================

-- --- STUDENTS TABLE ---
ALTER TABLE students_tbl 
ADD COLUMN IF NOT EXISTS studentname_ar VARCHAR(100),
ADD COLUMN IF NOT EXISTS studentname_en VARCHAR(100),
ADD COLUMN IF NOT EXISTS studentlastname_ar VARCHAR(100),
ADD COLUMN IF NOT EXISTS studentlastname_en VARCHAR(100),
ADD COLUMN IF NOT EXISTS parentname_ar VARCHAR(100),
ADD COLUMN IF NOT EXISTS parentname_en VARCHAR(100),
ADD COLUMN IF NOT EXISTS parentlastname_ar VARCHAR(100),
ADD COLUMN IF NOT EXISTS parentlastname_en VARCHAR(100);

-- --- EMPLOYEES TABLE ---
ALTER TABLE employee_tbl 
ADD COLUMN IF NOT EXISTS employeename_ar VARCHAR(100),
ADD COLUMN IF NOT EXISTS employeelastname_ar VARCHAR(100),
ADD COLUMN IF NOT EXISTS employeelastname_en VARCHAR(100);

-- ============================================================
-- PART 2: UPDATE STUDENT NAMES (ARABIC + ENGLISH)
-- ============================================================

-- Student 1: Ali Mohammed
UPDATE students_tbl SET 
  studentname_ar = 'علي',
  studentname_en = 'Ali',
  studentlastname_ar = 'محمد',
  studentlastname_en = 'Mohammed'
WHERE studentid = 1;

-- Parent 1: Mohammed Ali
UPDATE students_tbl SET 
  parentname_ar = 'محمد',
  parentname_en = 'Mohammed',
  parentlastname_ar = 'علي',
  parentlastname_en = 'Ali'
WHERE studentid = 1;

-- Student 2: Omar Ahmad
UPDATE students_tbl SET 
  studentname_ar = 'عمر',
  studentname_en = 'Omar',
  studentlastname_ar = 'أحمد',
  studentlastname_en = 'Ahmad'
WHERE studentid = 2;

-- Parent 2: Ahmad Omar
UPDATE students_tbl SET 
  parentname_ar = 'أحمد',
  parentname_en = 'Ahmad',
  parentlastname_ar = 'عمر',
  parentlastname_en = 'Omar'
WHERE studentid = 2;

-- Student 3: Yousef Khalid
UPDATE students_tbl SET 
  studentname_ar = 'يوسف',
  studentname_en = 'Yousef',
  studentlastname_ar = 'خالد',
  studentlastname_en = 'Khalid'
WHERE studentid = 3;

-- Parent 3: [Please provide]
UPDATE students_tbl SET 
  parentname_ar = 'والد',
  parentname_en = 'Parent',
  parentlastname_ar = 'ثالث',
  parentlastname_en = 'Third'
WHERE studentid = 3;

-- Student 4: Hassan Nasser
UPDATE students_tbl SET 
  studentname_ar = 'حسن',
  studentname_en = 'Hassan',
  studentlastname_ar = 'ناصر',
  studentlastname_en = 'Nasser'
WHERE studentid = 4;

-- Parent 4: [Please provide]
UPDATE students_tbl SET 
  parentname_ar = 'والد',
  parentname_en = 'Parent',
  parentlastname_ar = 'رابع',
  parentlastname_en = 'Fourth'
WHERE studentid = 4;

-- Student 5: Abdelrhman Aqeel
UPDATE students_tbl SET 
  studentname_ar = 'عبدالرحمن',
  studentname_en = 'Abdelrhman',
  studentlastname_ar = 'عقيل',
  studentlastname_en = 'Aqeel'
WHERE studentid = 5;

-- Parent 5: [Please provide]
UPDATE students_tbl SET 
  parentname_ar = 'والد',
  parentname_en = 'Parent',
  parentlastname_ar = 'خامس',
  parentlastname_en = 'Fifth'
WHERE studentid = 5;

-- ============================================================
-- PART 3: UPDATE EMPLOYEE NAMES (ARABIC + ENGLISH)
-- ============================================================

-- Employee 1: Ahmad Ali
UPDATE employee_tbl SET 
  employeename_ar = 'أحمد',
  employeename_en = 'Ahmad',
  employeelastname_ar = 'علي',
  employeelastname_en = 'Ali'
WHERE employeeid = 1;

-- Employee 2: Yousef Hassan
UPDATE employee_tbl SET 
  employeename_ar = 'يوسف',
  employeename_en = 'Yousef',
  employeelastname_ar = 'حسن',
  employeelastname_en = 'Hassan'
WHERE employeeid = 2;

-- Employee 3: Mohammed Khalid
UPDATE employee_tbl SET 
  employeename_ar = 'محمد',
  employeename_en = 'Mohammed',
  employeelastname_ar = 'خالد',
  employeelastname_en = 'Khalid'
WHERE employeeid = 3;

-- Employee 4: Khaled Almoslih
UPDATE employee_tbl SET 
  employeename_ar = 'خالد',
  employeename_en = 'Khaled',
  employeelastname_ar = 'المصلح',
  employeelastname_en = 'Almoslih'
WHERE employeeid = 4;

-- Employee 10: Shadi hakawati
UPDATE employee_tbl SET 
  employeename_ar = 'شادي',
  employeename_en = 'Shadi',
  employeelastname_ar = 'حكاوتي',
  employeelastname_en = 'Hakawati'
WHERE employeeid = 10;

-- Employee 11: Abdelrhman Ahmad
UPDATE employee_tbl SET 
  employeename_ar = 'عبدالرحمن',
  employeename_en = 'Abdelrhman',
  employeelastname_ar = 'أحمد',
  employeelastname_en = 'Ahmad'
WHERE employeeid = 11;

-- Employee 12: Abdalrhman Alajouz
UPDATE employee_tbl SET 
  employeename_ar = 'عبدالرحمن',
  employeename_en = 'Abdalrhman',
  employeelastname_ar = 'العجوز',
  employeelastname_en = 'Alajouz'
WHERE employeeid = 12;

-- ============================================================
-- PART 4: UPDATE CLASS NAMES (ARABIC PRIMARY)
-- ============================================================

UPDATE classes_tbl SET classname = 'الأول', classname_en = 'First Grade' WHERE classid = 1;
UPDATE classes_tbl SET classname = 'الثاني', classname_en = 'Second Grade' WHERE classid = 2;
UPDATE classes_tbl SET classname = 'الثالث', classname_en = 'Third Grade' WHERE classid = 3;
UPDATE classes_tbl SET classname = 'الرابع', classname_en = 'Fourth Grade' WHERE classid = 4;
UPDATE classes_tbl SET classname = 'الخامس', classname_en = 'Fifth Grade' WHERE classid = 5;
UPDATE classes_tbl SET classname = 'السادس', classname_en = 'Sixth Grade' WHERE classid = 6;
UPDATE classes_tbl SET classname = 'السابع', classname_en = 'Seventh Grade' WHERE classid = 7;
UPDATE classes_tbl SET classname = 'الثامن', classname_en = 'Eighth Grade' WHERE classid = 8;
UPDATE classes_tbl SET classname = 'التاسع', classname_en = 'Ninth Grade' WHERE classid = 9;
UPDATE classes_tbl SET classname = 'العاشر', classname_en = 'Tenth Grade' WHERE classid = 10;
UPDATE classes_tbl SET classname = 'الحادي عشر', classname_en = 'Eleventh Grade' WHERE classid = 11;
UPDATE classes_tbl SET classname = 'الثاني عشر', classname_en = 'Twelfth Grade' WHERE classid = 12;
UPDATE classes_tbl SET classname = 'روضة', classname_en = 'Kindergarten' WHERE classid = 13;
UPDATE classes_tbl SET classname = 'تمهيدي', classname_en = 'Preparatory' WHERE classid = 14;
UPDATE classes_tbl SET classname = 'فصل خاص', classname_en = 'Special Class' WHERE classid = 15;
UPDATE classes_tbl SET classname = 'برنامج إضافي', classname_en = 'Additional Program' WHERE classid = 16;
UPDATE classes_tbl SET classname = 'برنامج علاجي', classname_en = 'Remedial Program' WHERE classid = 17;

-- ============================================================
-- VERIFICATION QUERIES (Run to verify data was updated)
-- ============================================================

-- Check students with new name fields
SELECT studentid, studentname_ar, studentname_en, studentlastname_ar, studentlastname_en FROM students_tbl;

-- Check employees with new name fields
SELECT employeeid, employeename_ar, employeename_en, employeelastname_ar, employeelastname_en FROM employee_tbl;

-- Check classes with Arabic names
SELECT classid, classname, classname_en FROM classes_tbl;
