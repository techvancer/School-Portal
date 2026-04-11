const fs = require('fs');
const path = require('path');

const srcPages = path.join(__dirname, 'src', 'pages');

const walk = (dir) => {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach((file) => {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            results = results.concat(walk(file));
        } else if (file.endsWith('.jsx')) {
            results.push(file);
        }
    });
    return results;
};

const allPages = walk(srcPages);

allPages.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    
    // Add imports if not present
    let importDepth = '';
    if (file.includes('admin') || file.includes('supervisor')) {
        importDepth = '../../';
    } else {
        importDepth = '../';
    }

    let modified = false;

    if (!content.includes('LanguageContext')) {
        content = `import { useLang } from '${importDepth}context/LanguageContext';\n` + content;
        modified = true;
    }
    if (!content.includes('langHelper')) {
        content = `import { t, getField, getStudentName as _getStudentName } from '${importDepth}lib/langHelper';\n` + content;
        modified = true;
    }

    // Inject const { lang, isAr } = useLang(); just inside the exported function
    // Match `export default function XYZ() {`
    if (!content.includes('useLang()')) {
        content = content.replace(/(export default function \w+\([^)]*\)\s*\{)/, '$1\n    const { lang, isAr } = useLang();\n');
        modified = true;
    }

    // Use lang in useFilterData
    if (content.includes('useFilterData(user)')) {
        content = content.replace(/useFilterData\(user\)/g, 'useFilterData(user, lang)');
        modified = true;
    }
    
    // Replace text strings with t(key, lang)
    const translations = {
        'Dashboard': 'dashboard',
        'Teachers': 'teachers',
        'Students': 'students',
        'Classes': 'classes',
        'Subjects': 'subjects',
        'Exams': 'exams',
        'Attendance': 'attendance',
        'Schedule': 'schedule',
        'Reports': 'reports',
        'Employees': 'employees',
        'Supervisors': 'supervisors',
        'My Classes': 'myClasses',
        'Edit Marks': 'editMarks',
        'Videos': 'videos',
        'Status': 'status',
        'Actions': 'actions',
        'Total Students': 'totalStudents',
    };

    // Generic simple text replace for table headers and titles
    for (const [en, key] of Object.entries(translations)) {
        const regex = new RegExp(`>\\s*${en}\\s*<`, 'g');
        if (regex.test(content)) {
            content = content.replace(regex, `>{t('${key}', lang)}<`);
            modified = true;
        }
    }

    // specific helpers replace
    if (content.includes('getClassName(cl)')) {
        content = content.replace(/getClassName\(cl\)/g, 'getClassName(cl, lang)');
        modified = true;
    }
    if (content.includes('getSectionName(sec)')) {
        content = content.replace(/getSectionName\(sec\)/g, 'getSectionName(sec, lang)');
        modified = true;
    }
    
    // update mapping e.g. row.classname_en -> getField(row, 'classname', 'classname_en', lang)
    const fieldsMap = [
        {ar: 'schoolname', en: 'schoolname_en'},
        {ar: 'branchname', en: 'branchname_en'},
        {ar: 'divisionname', en: 'divisionname_en'},
        {ar: 'curriculumname', en: 'curriculumname_en'},
        {ar: 'stagename', en: 'stagename_en'},
        {ar: 'classname', en: 'classname_en'},
        {ar: 'sectionname', en: 'sectionname_en'},
        {ar: 'subjectname', en: 'Subjectname_en'},
        {ar: 'examname', en: 'examname_en'},
        {ar: 'semistername', en: 'semistername_en'},
        {ar: 'typename', en: 'typename_en'},
        {ar: 'employeename', en: 'employeename_en'},
        {ar: 'parentname_ar', en: 'parentname_en'},
    ];

    fieldsMap.forEach(f => {
        const regex = new RegExp(`(\\w+)\\.${f.en}`, 'g');
        if (regex.test(content)) {
            content = content.replace(regex, `getField($1, '${f.ar}', '${f.en}', lang)`);
            modified = true;
        }
        const regex2 = new RegExp(`(\\w+)\\?\.${f.en}`, 'g');
        if (regex2.test(content)) {
            content = content.replace(regex2, `getField($1, '${f.ar}', '${f.en}', lang)`);
            modified = true;
        }
    });

    // Handle student names
    const stuRegex = /(\w+)\.studentname/g;
    if (stuRegex.test(content)) {
        content = content.replace(stuRegex, `_getStudentName($1, lang)`);
        modified = true;
    }

    if (modified) {
        fs.writeFileSync(file, content, 'utf8');
    }
});
console.log('Automated translation script finished applying to all pages.');
