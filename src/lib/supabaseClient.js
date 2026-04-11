import { createClient } from '@supabase/supabase-js';

// Security: service key is NEVER exposed here — it lives in api/db.js (server-side only)
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
// SUPABASE_SERVICE_KEY intentionally removed from frontend
export const EDGE_FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-employee`;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ============================================================
// READ — uses the user's JWT so RLS policies based on auth.uid() fire correctly
// ============================================================
export async function rest(table, params = {}, accessToken = null) {
  const url = new URL(`${SUPABASE_URL}/rest/v1/${table}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  let token = accessToken;
  if (!token) {
    const { data: { session } } = await supabase.auth.getSession();
    token = session?.access_token || SUPABASE_ANON_KEY;
  }
  const res = await fetch(url.toString(), {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });
  if (!res.ok) throw new Error(`${table}: ${res.status}`);
  return res.json();
}

// ============================================================
// WRITE — all operations proxy through /api/db (service key stays server-side)
// The user's JWT is attached so the server can verify identity.
// ============================================================
async function dbApi(payload) {
  const getToken = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  };

  const doFetch = async (token) => fetch('/api/db', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  });

  let token = await getToken();
  let res = await doFetch(token);

  // If 401, try once more with a refreshed session (token may have just rotated)
  if (res.status === 401) {
    await supabase.auth.refreshSession();
    token = await getToken();
    res = await doFetch(token);
  }

  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.error || `DB error ${res.status}`);
  }
  return res.json();
}

export async function insert(table, data) {
  return dbApi({ action: 'insert', table, data });
}

export async function update(table, id, idField, data) {
  return dbApi({ action: 'update', table, id, idField, data });
}

export async function remove(table, id, idField) {
  return dbApi({ action: 'remove', table, id, idField });
}

export async function nextId(table, idField) {
  try {
    const res = await dbApi({ action: 'nextId', table, idField });
    return res.nextId ?? 1;
  } catch { return 1; }
}

// Flexible raw query — replaces inline fetch() calls that used SUPABASE_SERVICE_KEY directly
// path: table + query string e.g. "employee_tbl?employeeid=eq.5"
// method: "GET" | "POST" | "PATCH" | "DELETE"
// body: optional object
// prefer: optional Prefer header value e.g. "return=minimal"
export async function dbQuery(path, method = 'GET', body, prefer) {
  return dbApi({ action: 'query', path, method, body: body ?? null, prefer });
}

// ============================================================
// NAME DISPLAY HELPER FUNCTIONS
// ============================================================

export function getStudentFullName(student, language = 'ar') {
  if (!student) return '';
  if (language === 'en') {
    return [student.studentfirstname_en, student.studentfathersname_en, student.studentgrandfathersname_en, student.studentsurname_en].filter(Boolean).join(' ').trim();
  }
  return [student.studentfirstname_ar, student.studentfathersname_ar, student.studentgrandfathersname_ar, student.studentsurname_ar].filter(Boolean).join(' ').trim();
}

export function getStudentFirstName(student, language = 'ar') {
  if (!student) return '';
  if (language === 'en') return student.studentfirstname_en || '';
  return student.studentfirstname_ar || '';
}

export function getParentName(student, language = 'ar') {
  if (!student) return '';
  if (language === 'en') return student.parentname_en || '';
  return student.parentname_ar || '';
}

export function getTeacherDisplayName(teacher, language = 'ar') {
  if (!teacher) return '';
  if (language === 'en') return `${teacher.employeename_en || teacher.employeename || ''} ${teacher.employeelastname_en || ''}`.trim();
  return `${teacher.employeename_ar || teacher.employeename || ''} ${teacher.employeelastname_ar || ''}`.trim();
}

export function getClassDisplayName(cls, language = 'ar') {
  if (!cls) return 'Class';
  if (language === 'en') return cls.classname_en || cls.classname || 'Class';
  return cls.classname || cls.classname_en || 'Class';
}
