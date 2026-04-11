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
    let modified = false;

    // 1. Fix buildFilters missing lang
    const bfRegex = /buildFilters\(\s*([^,]+)\s*,\s*([^,)]+)\s*\)/g;
    if (bfRegex.test(content)) {
        content = content.replace(bfRegex, 'buildFilters($1, $2, {}, lang)');
        modified = true;
    }

    // Fix some edge cases where buildFilters already has 3 args but no lang:
    // buildFilters(applied, baseFilterData).filter(...)
    // This is handled above assuming the 3rd arg wasn't there. If it was there, it would not match because of `)` 
    
    // Replace specific known statsCards labels:
    const specificStrings = [
        'Total Students', 'My Classes', 'My Sections', 'My Subjects', 
        'Exams', 'Attendance', 'Schedule', 'Coming Soon',
        'Average Mark by Classes', 'Mark Distribution', 'Attendance by Classes', 
        'Weekly Schedule', 'No marks recorded yet'
    ];

    specificStrings.forEach(str => {
        // Match string literals inside objects or JSX text that are exactly these strings.
        // E.g. title: 'Total Students'
        const regex1 = new RegExp(`title:\\s*['"]${str}['"]`, 'g');
        if (regex1.test(content)) {
            content = content.replace(regex1, `title: t('${str}', lang)`);
            modified = true;
        }

        const regex2 = new RegExp(`value:\\s*['"]${str}['"]`, 'g');
        if (regex2.test(content)) {
            content = content.replace(regex2, `value: t('${str}', lang)`);
            modified = true;
        }

        // Match >String< in JSX
        const regex3 = new RegExp(`>\\s*${str}\\s*<`, 'g');
        if (regex3.test(content)) {
            content = content.replace(regex3, `>{t('${str}', lang)}<`);
            modified = true;
        }
    });

    if (modified) {
        fs.writeFileSync(file, content, 'utf8');
    }
});

console.log('Fixed buildFilters and common strings.');
